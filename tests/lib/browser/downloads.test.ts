import { describe, expect, it } from 'vitest';
import { describeDownload, DownloadWatch, type DownloadItem } from '@/lib/browser/downloads';
import { runTool } from '@/lib/browser/tools/registry';
import { downloadsTool } from '@/lib/browser/tools/downloads';

const item = (over: Partial<DownloadItem> = {}): DownloadItem => ({
  id: 7, url: 'https://shop.test/export?x=1', filename: '/home/me/Downloads/report.csv', state: 'complete', bytesReceived: 12_600, totalBytes: 12_600, ...over,
});

function setup() {
  let created: (i: DownloadItem) => void = () => undefined;
  const items = new Map<number, DownloadItem>();
  let clock = 1000;
  const watch = new DownloadWatch(
    { onCreated: (cb) => (created = cb), search: async (id) => items.get(id) },
    () => clock,
    async (ms) => {
      clock += ms;
      for (const [id, d] of items) if (d.state === 'in_progress' && clock >= 3000) items.set(id, { ...d, state: 'complete' });
    },
  );
  const start = (d: DownloadItem) => {
    items.set(d.id, d);
    created(d);
  };
  return { watch, start, tick: (ms: number) => (clock += ms), now: () => clock };
}

describe('describeDownload', () => {
  it('names the file, its state, size and where it was saved', () => {
    expect(describeDownload(item())).toBe('d7 report.csv — complete, 12.3 KB, saved to /home/me/Downloads/report.csv');
    expect(describeDownload(item({ state: 'interrupted', error: 'NETWORK_FAILED' }))).toBe('d7 report.csv — failed (NETWORK_FAILED)');
    expect(describeDownload(item({ state: 'in_progress', filename: '', bytesReceived: 512, totalBytes: 2048 }))).toBe('d7 export — downloading, 512 B of 2.0 KB');
  });
});

describe('DownloadWatch', () => {
  it('gives a session only the downloads created while its action ran', async () => {
    const { watch, start, tick, now } = setup();
    start(item({ id: 1 }));
    tick(10);
    const since = now();
    start(item({ id: 2 }));
    expect(await watch.claimSince('ses_1', since)).toEqual([expect.stringMatching(/^Download started: d2 report\.csv/)]);
    expect(watch.owns('ses_1', 2)).toBe(true);
    expect(watch.owns('ses_1', 1)).toBe(false);
    expect(await watch.claimSince('ses_2', since)).toEqual([]);
  });

  it('downloads tool waits for in-progress files and hides other sessions', async () => {
    const { watch, start, now } = setup();
    const since = now();
    start(item({ id: 3, state: 'in_progress', bytesReceived: 0 }));
    await watch.claimSince('ses_1', since);
    const tool = downloadsTool(watch);
    const text = async (args: Record<string, unknown>, ses = 'ses_1') => ((await runTool(tool, args, ses)).content[0] as { text: string }).text;
    expect(await text({})).toMatch(/^d3 report\.csv — downloading/);
    expect(await text({ wait: true })).toMatch(/^d3 report\.csv — complete/);
    expect(await text({}, 'ses_2')).toMatch(/^No downloads in this session yet/);
    expect(await text({ id: 'd3' }, 'ses_2')).toBe('INVALID_INPUT: No download d3 in this session.');
  });
});

describe('DownloadWatch.save (P5)', () => {
  it('returns the saved path and never hands the file to an action', async () => {
    let created: (i: DownloadItem) => void = () => undefined;
    const items = new Map<number, DownloadItem>();
    const watch = new DownloadWatch({
      onCreated: (cb) => (created = cb),
      search: async (id) => items.get(id),
      download: async (_url, filename) => {
        const d = item({ id: 9, filename: `/home/me/Downloads/${filename}`, state: 'complete' });
        items.set(9, d);
        created(d);
        return 9;
      },
    }, () => 0, async () => undefined);
    expect(await watch.save('data:image/jpeg;base64,AA==', 'opencode/ss_1.jpg')).toBe('/home/me/Downloads/opencode/ss_1.jpg');
    expect(await watch.claimSince('ses_1', 0)).toEqual([]);
  });
});
