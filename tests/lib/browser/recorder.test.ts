import { describe, expect, it, vi } from 'vitest';
import { GifRecorder, MAX_FRAMES } from '@/lib/browser/recorder';

const deps = () => ({
  thumbnail: vi.fn(async () => ({ data: 'JPG', width: 800, height: 400, cssW: 1600, cssH: 800 })),
  encode: vi.fn(async (frames: unknown[]) => new Uint8Array(frames.length)),
  save: vi.fn(async () => undefined),
});

describe('GifRecorder', () => {
  it('records frames only while recording, with pointer positions in frame pixels', async () => {
    const d = deps();
    const rec = new GifRecorder(d);
    await rec.capture('ses_1', 5, 'ignored');
    expect(rec.frameCount('ses_1')).toBe(0);
    await rec.start('ses_1', 5);
    await rec.capture('ses_1', 5, 'Clicked button "Buy"', [800, 400]);
    await rec.stop('ses_1', 5);
    await rec.capture('ses_1', 5, 'after stop');
    expect(rec.frameCount('ses_1')).toBe(3);
    await rec.export('ses_1', 'checkout');
    const frames = d.encode.mock.calls[0]![0] as Array<{ label: string; point?: number[] }>;
    expect(frames.map((f) => f.label)).toEqual(['Start', 'Clicked button "Buy"', 'End']);
    expect(frames[1]!.point).toEqual([400, 200]);
    expect(d.save).toHaveBeenCalledWith(expect.any(Uint8Array), 'checkout.gif');
  });

  it(`keeps the first frame and the last ${MAX_FRAMES - 1} others`, async () => {
    const rec = new GifRecorder(deps());
    await rec.start('ses_1', 5);
    for (let i = 0; i < 100; i++) await rec.capture('ses_1', 5, `step ${i}`);
    expect(rec.frameCount('ses_1')).toBe(MAX_FRAMES);
  });

  it('refuses to export nothing and clears frames', async () => {
    const rec = new GifRecorder(deps());
    await expect(rec.export('ses_1', 'x.gif')).rejects.toThrow('Nothing was recorded');
    await rec.start('ses_1', 5);
    rec.clear('ses_1');
    expect(rec.frameCount('ses_1')).toBe(0);
    expect(rec.isRecording('ses_1')).toBe(false);
  });
});
