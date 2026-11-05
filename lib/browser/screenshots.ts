// Screenshots and zoom (spec browser/screenshots, design D8). Captures the viewport through
// CDP, then scales it so its long edge fits the 1568 px coordinate frame the model clicks
// in. Each capture gets an id; the last 10 per session are kept for coordinate mapping and
// upload_image. Images are JPEG.
import type { DebuggerSessions } from './debugger';
import { ToolError, type ToolImage } from './tools/registry';

const FRAME_LONG_EDGE = 1568;
const KEEP_PER_SESSION = 10;
const CAPTURE_TIMEOUT_MS = 5_000;
const JPEG_QUALITY = 80;

export type Viewport = { width: number; height: number; dpr: number };

export type ShotFrame = { frameW: number; frameH: number; cssW: number; cssH: number };

export type Shot = ShotFrame & { id: string; tabId: number; image: ToolImage; width: number; height: number };

/** Draws `base64` (any image) into a `width`×`height` JPEG, optionally cropping a device-pixel box first. */
export type Resizer = (
  base64: string,
  mime: string,
  out: { width: number; height: number },
  crop?: { x: number; y: number; width: number; height: number },
) => Promise<string>;

/** The coordinate frame for a viewport: CSS size scaled so the long edge is at most 1568. */
export function frameFor(viewport: { width: number; height: number }): ShotFrame {
  const scale = Math.min(1, FRAME_LONG_EDGE / Math.max(viewport.width, viewport.height, 1));
  return {
    frameW: Math.round(viewport.width * scale),
    frameH: Math.round(viewport.height * scale),
    cssW: viewport.width,
    cssH: viewport.height,
  };
}

/** A frame-space region → the device-pixel crop box of a capture. */
export function regionToDevice(region: [number, number, number, number], frame: ShotFrame, dpr: number) {
  const [x0, y0, x1, y1] = region;
  const sx = (frame.cssW / frame.frameW) * dpr;
  const sy = (frame.cssH / frame.frameH) * dpr;
  return {
    x: Math.round(Math.min(x0, x1) * sx),
    y: Math.round(Math.min(y0, y1) * sy),
    width: Math.max(1, Math.round(Math.abs(x1 - x0) * sx)),
    height: Math.max(1, Math.round(Math.abs(y1 - y0) * sy)),
  };
}

let shotSeq = 0;
const newId = () => `ss_${Date.now().toString(36)}${(++shotSeq).toString(36)}`;

export class Screenshots {
  private readonly bySession = new Map<string, Shot[]>();
  private readonly latestByTab = new Map<number, Shot>();

  constructor(
    private readonly deps: {
      debuggers: DebuggerSessions;
      viewport: (tabId: number) => Promise<Viewport>;
      resize: Resizer;
      /** Hides and restores the agent-tab indicator around a capture. */
      hideIndicator?: (tabId: number, hidden: boolean) => Promise<void>;
    },
  ) {}

  /** The frame clicks on this tab are given in: the latest screenshot's, if any. */
  frameOf(tabId: number): ShotFrame | undefined {
    return this.latestByTab.get(tabId);
  }

  get(sessionID: string, id: string): Shot {
    const shot = this.bySession.get(sessionID)?.find((s) => s.id === id);
    if (!shot) throw new ToolError('STALE_REF', `Screenshot ${id} is no longer kept (only the last ${KEEP_PER_SESSION} are). Take a new screenshot.`);
    return shot;
  }

  private keep(sessionID: string, shot: Shot): void {
    const list = [...(this.bySession.get(sessionID) ?? []), shot].slice(-KEEP_PER_SESSION);
    this.bySession.set(sessionID, list);
    this.latestByTab.set(shot.tabId, shot);
  }

  forgetTab(tabId: number): void {
    this.latestByTab.delete(tabId);
  }

  private async capture(tabId: number): Promise<{ data: string; viewport: Viewport }> {
    const viewport = await this.deps.viewport(tabId);
    await this.deps.hideIndicator?.(tabId, true).catch(() => undefined);
    try {
      const result = await this.deps.debuggers
        .send<{ data: string }>(tabId, 'Page.captureScreenshot', { format: 'jpeg', quality: JPEG_QUALITY, fromSurface: true }, { timeoutMs: CAPTURE_TIMEOUT_MS })
        .catch((error: unknown) => {
          if (error instanceof ToolError && error.code === 'TIMEOUT') {
            throw new ToolError(
              'TIMEOUT',
              'The screenshot did not arrive within 5 s. The tab is probably in the background: bring it to the front (or ask the user to), then try again.',
            );
          }
          throw error;
        });
      return { data: result.data, viewport };
    } finally {
      await this.deps.hideIndicator?.(tabId, false).catch(() => undefined);
    }
  }

  /** A small JPEG of the viewport (long edge at most `maxEdge`) for GIF frames; not kept. */
  async thumbnail(tabId: number, maxEdge: number): Promise<{ data: string; width: number; height: number; cssW: number; cssH: number }> {
    const { data, viewport } = await this.capture(tabId);
    const fit = Math.min(1, maxEdge / Math.max(viewport.width, viewport.height));
    const width = Math.max(1, Math.round(viewport.width * fit));
    const height = Math.max(1, Math.round(viewport.height * fit));
    return { data: await this.deps.resize(data, 'image/jpeg', { width, height }), width, height, cssW: viewport.width, cssH: viewport.height };
  }

  /** `screenshot`: the viewport in the coordinate frame, optionally scaled down further. */
  async screenshot(sessionID: string, tabId: number, scale = 1): Promise<{ shot: Shot; text: string }> {
    const { data, viewport } = await this.capture(tabId);
    const frame = frameFor(viewport);
    const width = Math.max(1, Math.round(frame.frameW * scale));
    const height = Math.max(1, Math.round(frame.frameH * scale));
    const sameSize = width === Math.round(viewport.width * viewport.dpr) && height === Math.round(viewport.height * viewport.dpr);
    const out = sameSize ? data : await this.deps.resize(data, 'image/jpeg', { width, height });
    const shot: Shot = { ...frame, id: newId(), tabId, width, height, image: { data: out, mimeType: 'image/jpeg' } };
    this.keep(sessionID, shot);
    const scaled = scale < 1 ? ` — ${scale}-scale view; coordinates stay in the ${frame.frameW}x${frame.frameH} frame` : '';
    return {
      shot,
      text: `Screenshot ${shot.id} (${width}x${height} jpeg) — coordinate frame ${frame.frameW}x${frame.frameH}${scaled}.`,
    };
  }

  /** `zoom`: a region of the frame at device resolution (long edge at most 1568 px). */
  async zoom(sessionID: string, tabId: number, region: [number, number, number, number], scale = 1): Promise<{ shot: Shot; text: string }> {
    const { data, viewport } = await this.capture(tabId);
    const frame = this.frameOf(tabId) ?? frameFor(viewport);
    const crop = regionToDevice(region, frame, viewport.dpr);
    const fit = Math.min(1, FRAME_LONG_EDGE / Math.max(crop.width, crop.height)) * scale;
    const width = Math.max(1, Math.round(crop.width * fit));
    const height = Math.max(1, Math.round(crop.height * fit));
    const out = await this.deps.resize(data, 'image/jpeg', { width, height }, crop);
    const shot: Shot = { ...frame, id: newId(), tabId, width, height, image: { data: out, mimeType: 'image/jpeg' } };
    this.bySession.set(sessionID, [...(this.bySession.get(sessionID) ?? []), shot].slice(-KEEP_PER_SESSION));
    return { shot, text: `Zoomed region (${region.join(',')}) of the ${frame.frameW}x${frame.frameH} frame — ${width}x${height} jpeg, id ${shot.id}.` };
  }
}

/** OffscreenCanvas resizer for the service worker. */
export const canvasResize: Resizer = async (base64, mime, out, crop) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const canvas = new OffscreenCanvas(out.width, out.height);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  if (crop) ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height);
  else ctx.drawImage(bitmap, 0, 0, out.width, out.height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY / 100 });
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
};
