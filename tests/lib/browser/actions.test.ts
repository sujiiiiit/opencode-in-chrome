import { describe, expect, it, vi } from 'vitest';
import { Actor, type Fingerprint } from '@/lib/browser/actions';
import type { PageChange } from '@/lib/browser/snapshot/reader';
import { navigateAndWait, navigationText, type NavEvents } from '@/lib/browser/navigation';
import { frameFor, regionToDevice, Screenshots } from '@/lib/browser/screenshots';
import { VisionCheck } from '@/lib/browser/server';
import { batchTool } from '@/lib/browser/tools/batch';
import { runTool, ToolError, type ToolDef } from '@/lib/browser/tools/registry';

const textOf = (r: { content: ReadonlyArray<{ type: string; text?: string }> }) => r.content.map((c) => c.text ?? '').join('\n');

describe('batch', () => {
  const tool = (name: string, behave: (args: Record<string, unknown>) => Promise<string>): ToolDef => ({
    name,
    description: name,
    inputSchema: { type: 'object', properties: {} },
    handler: async (args) => ({ text: [await behave(args)], images: name === 'shot' ? [{ data: 'IMG', mimeType: 'image/jpeg' }] : [] }),
  });
  const tools = [
    tool('ok', async () => 'fine'),
    tool('shot', async () => 'captured'),
    tool('fail', async () => {
      throw new ToolError('OBSCURED', 'covered by a banner');
    }),
  ];
  const batch = batchTool(() => [...tools, batchTool(() => tools)]);

  it('stops at the first error and keeps earlier results and images', async () => {
    const result = await runTool(
      batch,
      { actions: [{ name: 'ok' }, { name: 'shot' }, { name: 'fail' }, { name: 'ok' }, { name: 'ok' }] },
      'ses_1',
    );
    const text = textOf(result);
    expect(text).toContain('[1. ok] fine');
    expect(text).toContain('[2. shot] captured');
    expect(text).toContain('[3. fail] OBSCURED: covered by a banner');
    expect(text).toContain('2 completed, 2 not run (item 3 failed).');
    expect(result.content.filter((c) => c.type === 'image')).toHaveLength(1);
  });

  it('refuses nested batches and unknown tools', async () => {
    const result = await runTool(batch, { actions: [{ name: 'batch', input: {} }] }, 'ses_1');
    expect(textOf(result)).toContain('INVALID_INPUT: batch cannot be nested');
    expect(textOf(await runTool(batch, { actions: [{ name: 'nope' }] }, 'ses_1'))).toContain('unknown tool "nope"');
  });
});
describe('navigateAndWait', () => {
  const events = () => {
    let cb: Parameters<NavEvents['watch']>[1] | undefined;
    return {
      emit: (kind: 'committed' | 'loaded' | 'history' | 'error', error?: string, url = 'https://shop.test/') => cb?.({ kind, url, error }),
      watch: (_t: number, c: typeof cb) => ((cb = c), () => (cb = undefined)),
    };
  };

  it('resolves after the commit, the load and the DOM settle', async () => {
    const ev = events();
    const settle = vi.fn(async () => undefined);
    const start = async () => {
      ev.emit('committed');
      ev.emit('loaded');
    };
    const result = await navigateAndWait({ tabId: 1, events: ev as unknown as NavEvents, start, settle });
    expect(result).toEqual({ status: 'loaded', waited: 'quiet' });
    expect(settle).toHaveBeenCalled();
  });

  it("waits for the requested page when a fresh tab's about:blank commits and loads after start", async () => {
    const ev = events();
    const start = async () => {
      // The tab's own blank document commits and loads after we asked for the real page.
      setTimeout(() => {
        ev.emit('committed', undefined, 'about:blank');
        ev.emit('loaded', undefined, 'about:blank');
      }, 5);
      setTimeout(() => {
        ev.emit('committed', undefined, 'https://shop.test/');
        ev.emit('loaded', undefined, 'https://shop.test/');
      }, 40);
    };
    const settle = vi.fn(async () => undefined);
    let resolvedAt = 0;
    const started = Date.now();
    const result = await navigateAndWait({ tabId: 1, url: 'https://shop.test/', events: ev as unknown as NavEvents, start, settle, timeoutMs: 1000 }).then((r) => ((resolvedAt = Date.now() - started), r));
    expect(result).toEqual({ status: 'loaded', waited: 'quiet' });
    expect(resolvedAt).toBeGreaterThanOrEqual(35);
  });

  it('still accepts about:blank when that is the page asked for', async () => {
    const ev = events();
    const start = async () => {
      ev.emit('committed', undefined, 'about:blank');
      ev.emit('loaded', undefined, 'about:blank');
    };
    expect(await navigateAndWait({ tabId: 1, url: 'about:blank', events: ev as unknown as NavEvents, start, settle: async () => undefined })).toMatchObject({ status: 'loaded' });
  });

  it('says when the page kept changing until the settle cap', async () => {
    const ev = events();
    let t = 0;
    const result = await navigateAndWait({
      tabId: 1,
      events: ev as unknown as NavEvents,
      start: async () => {
        ev.emit('committed');
        ev.emit('loaded');
      },
      settle: async () => {
        t += 5_000;
      },
      now: () => t,
    });
    expect(result).toEqual({ status: 'loaded', waited: 'busy' });
    expect(navigationText(result, { url: 'https://busy.test/', title: 'Busy' })).toBe('Navigated to https://busy.test/ — "Busy" (loaded; the page was still changing after 5 s)');
  });

  it('ignores a load that finishes before this navigation commits (a fresh blank tab)', async () => {
    const ev = events();
    const start = async () => {
      ev.emit('loaded'); // the tab's own about:blank
      setTimeout(() => {
        ev.emit('committed');
        ev.emit('loaded');
      }, 20);
    };
    const settle = vi.fn(async () => undefined);
    expect(await navigateAndWait({ tabId: 1, events: ev as unknown as NavEvents, start, settle, timeoutMs: 1000 })).toEqual({ status: 'loaded', waited: 'quiet' });
  });

  it('treats a history route change as a navigation', async () => {
    const ev = events();
    const result = await navigateAndWait({ tabId: 1, events: ev as unknown as NavEvents, start: async () => ev.emit('history'), settle: async () => undefined });
    expect(result).toEqual({ status: 'loaded', waited: 'history' });
    expect(navigationText(result, { url: 'https://app.test/b', title: 'B' })).toBe('Navigated to https://app.test/b — "B" (same-document route change)');
  });

  it('times out on a page that never finishes and says it may still be loading', async () => {
    const ev = events();
    const result = await navigateAndWait({ tabId: 1, events: ev as unknown as NavEvents, start: async () => undefined, settle: async () => undefined, timeoutMs: 30 });
    expect(result).toEqual({ status: 'timeout' });
    expect(navigationText(result, { url: 'http://slow.test/', title: '' })).toBe(
      'Still loading after 15 s: http://slow.test/ — "". The page may still be loading; read it, or wait and read again.',
    );
  });

  it('reports a failed load', async () => {
    const ev = events();
    const result = await navigateAndWait({ tabId: 1, events: ev as unknown as NavEvents, start: async () => ev.emit('error', 'net::ERR_NAME_NOT_RESOLVED'), settle: async () => undefined });
    expect(navigationText(result, { url: 'chrome-error://chromewebdata/', title: 'x' }, 'https://nope.invalid/')).toMatch(
      /^Could not load https:\/\/nope\.invalid\/: net::ERR_NAME_NOT_RESOLVED/,
    );
  });

  it('formats a successful navigation with its title', () => {
    expect(navigationText({ status: 'loaded', waited: 'quiet' }, { url: 'https://news.ycombinator.com/', title: 'Hacker News' })).toBe(
      'Navigated to https://news.ycombinator.com/ — "Hacker News" (waited for the load and 500 ms without DOM changes)',
    );
  });
});

describe('screenshot frames', () => {
  it('caps the long edge at 1568 and keeps CSS size for mapping', () => {
    expect(frameFor({ width: 1920, height: 911 })).toEqual({ frameW: 1568, frameH: 744, cssW: 1920, cssH: 911 });
    expect(frameFor({ width: 1280, height: 800 })).toEqual({ frameW: 1280, frameH: 800, cssW: 1280, cssH: 800 });
  });

  it('maps a zoom region to device pixels at DPR 1 and 2', () => {
    const frame = frameFor({ width: 1920, height: 911 });
    expect(regionToDevice([0, 0, 784, 372], frame, 1)).toEqual({ x: 0, y: 0, width: 960, height: 455 });
    expect(regionToDevice([0, 0, 784, 372], frame, 2)).toEqual({ x: 0, y: 0, width: 1920, height: 911 });
  });

  it('keeps only the last 10 screenshots per session and fails old ids with STALE_REF', async () => {
    const debuggers = { send: vi.fn(async () => ({ data: 'RAW' })) };
    const shots = new Screenshots({
      debuggers: debuggers as never,
      viewport: async () => ({ width: 1920, height: 911, dpr: 1 }),
      resize: async (_b, _m, out) => `resized:${out.width}x${out.height}`,
    });
    const first = await shots.screenshot('ses_1', 5);
    expect(first.text).toMatch(/^Screenshot ss_\w+ \(1568x744 jpeg\) — coordinate frame 1568x744\.$/);
    expect(first.shot.image.data).toBe('resized:1568x744');
    const half = await shots.screenshot('ses_1', 5, 0.5);
    expect(half.text).toContain('(784x372 jpeg)');
    for (let i = 0; i < 10; i++) await shots.screenshot('ses_1', 5);
    expect(() => shots.get('ses_1', first.shot.id)).toThrow(/no longer kept/);
    expect(shots.frameOf(5)).toMatchObject({ frameW: 1568, cssW: 1920 });
  });

  it('explains a screenshot that times out on a background tab', async () => {
    const debuggers = { send: vi.fn(async () => Promise.reject(new ToolError('TIMEOUT', 'x'))) };
    const shots = new Screenshots({ debuggers: debuggers as never, viewport: async () => ({ width: 800, height: 600, dpr: 1 }), resize: async (b) => b });
    await expect(shots.screenshot('ses_1', 5)).rejects.toThrow(/bring it to the front/);
  });
});

describe('VisionCheck', () => {
  it('reads the session model and its image input capability', async () => {
    const client = {
      session: { get: vi.fn(async () => ({ model: { providerID: 'kilo', id: 'kilo-auto/free' } })) },
      model: {
        list: vi.fn(async () => ({
          data: [
            { providerID: 'kilo', id: 'kilo-auto/free', capabilities: { input: ['text'] } },
            { providerID: 'anthropic', id: 'claude-sonnet-5-5', capabilities: { input: ['text', 'image'] } },
          ],
        })),
      },
    };
    const check = new VisionCheck(async () => client as never);
    expect(await check.supports('ses_1')).toEqual({ vision: false, model: 'kilo/kilo-auto/free' });
    await check.supports('ses_1');
    expect(client.session.get).toHaveBeenCalledTimes(1); // cached
  });

  it('allows screenshots when the server cannot be asked', async () => {
    expect(await new VisionCheck(async () => undefined).supports('ses_1')).toEqual({ vision: undefined, model: undefined });
  });
});

describe('Actor.report', () => {
  const fp = (extra: Partial<Fingerprint> = {}): Fingerprint => ({ url: 'https://a.test/', title: 'A', tabIds: [1], ...extra });
  const actorWith = (after: Fingerprint, page: PageChange | Error, dialog?: { type: string; message: string }) => {
    const change = vi.fn(async () => {
      if (page instanceof Error) throw page;
      return page;
    });
    const actor = new Actor({
      reader: { change } as never,
      debuggers: {} as never,
      dialogs: { get: () => dialog } as never,
      scope: {} as never,
      tab: async () => ({}),
    });
    vi.spyOn(actor, 'observe').mockResolvedValue(after);
    return { actor, change };
  };

  it('shows the outline diff since the last look and calls it a change', async () => {
    const { actor, change } = actorWith(fp(), { kind: 'diff', text: '<untrusted>\n+ menuitem "Settings" [e3]\n</untrusted>' });
    expect(await actor.report(1, 'ses_1', fp())).toEqual({
      text: 'Page changes since your last look (+ added, - removed):\n<untrusted>\n+ menuitem "Settings" [e3]\n</untrusted>',
      effect: 'changed',
    });
    expect(change).toHaveBeenCalledWith('ses_1', 1);
  });

  it('shows the whole outline, and why, when there is nothing to compare with', async () => {
    const { actor } = actorWith(fp(), { kind: 'outline', reason: 'a new document loaded', text: 'button "B" [e9]' });
    expect(await actor.report(1, 'ses_1', fp())).toEqual({ text: 'The page now (a new document loaded):\nbutton "B" [e9]', effect: 'changed' });
  });

  it('reports no visible change, or that the page could not be read', async () => {
    expect(await actorWith(fp(), { kind: 'same', text: '' }).actor.report(1, 'ses_1', fp())).toEqual({ text: 'No visible change', effect: 'none' });
    expect(await actorWith(fp(), new Error('frozen')).actor.report(1, 'ses_1', fp())).toEqual({
      text: 'Could not read the page after the action; read it to see what happened.',
      effect: 'unknown',
    });
  });

  it('reports URL, title, new tabs and dialogs, and does not read a page a dialog blocks', async () => {
    const moved = fp({ url: 'https://a.test/next', title: 'Next', tabIds: [1, 9] });
    const { actor, change } = actorWith(moved, { kind: 'same', text: '' }, { type: 'confirm', message: 'Sure?' });
    expect(await actor.report(1, 'ses_1', fp())).toEqual({
      text: 'Dialog open: confirm "Sure?"\nURL changed to https://a.test/next\nTitle is now "Next"\nNew tab 9 opened and joined this session',
      effect: 'changed',
    });
    expect(change).not.toHaveBeenCalled();
  });
});
