// GIF recording (spec browser/screenshots, design D11): while recording, every action adds a
// small frame (long edge 800 px) with what was done and where the pointer went. Export draws
// click markers, action labels and a progress bar, encodes with gifenc and saves the file
// through chrome.downloads. Everything runs in the service worker (OffscreenCanvas).
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { ToolError } from './tools/registry';

export const MAX_FRAMES = 60;
export const THUMB_EDGE = 800;

export type GifFrame = {
  data: string; // JPEG, base64
  width: number;
  height: number;
  label: string;
  /** Pointer position in frame pixels, for click markers. */
  point?: [number, number];
};

export type GifOptions = { showClickIndicators?: boolean; showActionLabels?: boolean; showProgressBar?: boolean; quality?: number };

export type RecorderDeps = {
  /** A JPEG of the tab's viewport with its long edge at most THUMB_EDGE, plus the CSS size it shows. */
  thumbnail: (tabId: number) => Promise<{ data: string; width: number; height: number; cssW: number; cssH: number }>;
  encode: (frames: GifFrame[], options: GifOptions) => Promise<Uint8Array>;
  save: (bytes: Uint8Array, filename: string) => Promise<void>;
};

type Recording = { active: boolean; frames: GifFrame[] };

export class GifRecorder {
  private readonly sessions = new Map<string, Recording>();

  constructor(private readonly deps: RecorderDeps) {}

  isRecording(sessionID: string): boolean {
    return this.sessions.get(sessionID)?.active === true;
  }

  frameCount(sessionID: string): number {
    return this.sessions.get(sessionID)?.frames.length ?? 0;
  }

  async start(sessionID: string, tabId: number): Promise<void> {
    const rec = this.sessions.get(sessionID) ?? { active: false, frames: [] };
    rec.active = true;
    this.sessions.set(sessionID, rec);
    await this.capture(sessionID, tabId, 'Start');
  }

  async stop(sessionID: string, tabId: number): Promise<void> {
    if (!this.isRecording(sessionID)) return;
    await this.capture(sessionID, tabId, 'End');
    this.sessions.get(sessionID)!.active = false;
  }

  clear(sessionID: string): void {
    this.sessions.delete(sessionID);
  }

  /** Adds a frame if the session is recording; `cssPoint` is where the pointer acted (viewport CSS px). */
  async capture(sessionID: string, tabId: number, label: string, cssPoint?: [number, number]): Promise<void> {
    const rec = this.sessions.get(sessionID);
    if (!rec?.active) return;
    const shot = await this.deps.thumbnail(tabId).catch(() => undefined);
    if (!shot) return;
    const point: [number, number] | undefined = cssPoint
      ? [(cssPoint[0] * shot.width) / shot.cssW, (cssPoint[1] * shot.height) / shot.cssH]
      : undefined;
    rec.frames.push({ data: shot.data, width: shot.width, height: shot.height, label, point });
    if (rec.frames.length > MAX_FRAMES) rec.frames.splice(1, rec.frames.length - MAX_FRAMES); // keep the first frame
  }

  async export(sessionID: string, filename: string, options: GifOptions = {}): Promise<{ frames: number; bytes: number; filename: string }> {
    const frames = this.sessions.get(sessionID)?.frames ?? [];
    if (frames.length === 0) throw new ToolError('INVALID_INPUT', 'Nothing was recorded. Use gif start_recording, act, then export.');
    const name = /\.gif$/i.test(filename) ? filename : `${filename}.gif`;
    const bytes = await this.deps.encode(frames, options);
    await this.deps.save(bytes, name);
    return { frames: frames.length, bytes: bytes.byteLength, filename: name };
  }
}

/** Encodes frames to an animated GIF with overlays, using OffscreenCanvas (worker-safe). */
export async function encodeGif(frames: GifFrame[], options: GifOptions): Promise<Uint8Array> {
  const width = frames[0]!.width;
  const height = frames[0]!.height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  for (const [i, frame] of frames.entries()) {
    const bytes = Uint8Array.from(atob(frame.data), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const sx = width / frame.width;
    const sy = height / frame.height;
    if (frame.point && options.showClickIndicators !== false) {
      ctx.beginPath();
      ctx.arc(frame.point[0] * sx, frame.point[1] * sy, 14, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f97316';
      ctx.stroke();
    }
    if (options.showActionLabels !== false && frame.label) {
      ctx.font = '600 14px sans-serif';
      const text = frame.label.length > 70 ? frame.label.slice(0, 69) + '…' : frame.label;
      const w = ctx.measureText(text).width + 16;
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(8, 8, w, 26);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, 16, 26);
    }
    if (options.showProgressBar !== false) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(0, height - 4, (width * (i + 1)) / frames.length, 4);
    }
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: i === frames.length - 1 ? 1500 : 900 });
  }
  gif.finish();
  return gif.bytes();
}

export function gifDataUrl(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/gif;base64,${btoa(binary)}`;
}
