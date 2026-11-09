import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProbe } from '@/lib/browser/page/wait-page';
import { mergeProbes } from '@/lib/browser/snapshot/reader';
import type { ProbeResult } from '@/lib/browser/page/wait-page';
import { TabScope } from '@/lib/browser/tabs';
import { runTool, type ToolDef } from '@/lib/browser/tools/registry';
import { waitTool, type WaitDeps } from '@/lib/browser/tools/wait';
import { FakeChrome, memoryStore } from '../../support/fake-chrome';

const proto = Element.prototype as Element & { checkVisibility?: () => boolean };
const original = proto.checkVisibility;

describe('page probe', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // happy-dom has no layout: an element is visible unless it carries `hidden`.
    proto.checkVisibility = function (this: Element) {
      return !this.closest('[hidden]');
    };
  });
  afterEach(() => {
    proto.checkVisibility = original;
  });

  it('finds visible text regardless of case and spacing', () => {
    document.body.innerHTML = '<p>Your   order\n has been <b>PLACED</b></p>';
    const probe = createProbe(document);
    expect(probe({ texts: ['order has been placed', 'Loading'] }).texts).toEqual([true, false]);
  });

  it('matches only visible elements and flags invalid selectors', () => {
    document.body.innerHTML = '<div class="spinner" hidden></div><div class="result">1</div>';
    const probe = createProbe(document);
    expect(probe({ selectors: ['.spinner', '.result', '[[bad'] }).selectors).toEqual([false, true, null]);
  });

  it('is idle only after the DOM stays quiet for the window', () => {
    let t = 1000;
    const probe = createProbe(document, () => t);
    expect(probe({ idleMs: 500 }).idle).toBe(false);
    t += 600;
    expect(probe({ idleMs: 500 }).idle).toBe(true);
  });
});

describe('mergeProbes', () => {
  const args = { texts: ['Done'], selectors: ['.ok', '[[bad'], idleMs: 500 };
  it('holds a text or selector found in any frame, idle only when every frame is', () => {
    const top: ProbeResult = { texts: [false], selectors: [false, null], idle: true };
    const frame: ProbeResult = { texts: [true], selectors: [true, null], idle: false };
    expect(mergeProbes([top, frame], args)).toEqual({ texts: [true], selectors: [true, null], idle: false });
  });
  it('is undefined when no frame answered', () => {
    expect(mergeProbes([], args)).toBeUndefined();
  });
});

describe('wait_for', () => {
  let scope: TabScope;
  let tabId: number;
  let clock: number;
  let url: string;
  let probes: Array<ProbeResult | Error>;
  let tool: ToolDef;
  let dialog: { type: string; message: string } | undefined;

  const call = async (args: Record<string, unknown>) => {
    const r = await runTool(tool, args, 'ses_1');
    return (r.content[0] as { text: string }).text;
  };

  beforeEach(async () => {
    scope = new TabScope(new FakeChrome(), memoryStore() as never);
    tabId = (await scope.create('ses_1', 'https://shop.test/cart')).id;
    clock = 0;
    url = 'https://shop.test/cart';
    probes = [];
    dialog = undefined;
    const deps: WaitDeps = {
      scope,
      reader: {
        probe: vi.fn(async () => {
          const next = probes.length > 1 ? probes.shift()! : probes[0];
          if (next instanceof Error) throw next;
          return next;
        }),
        change: vi.fn(async () => ({ kind: 'diff' as const, text: '+ heading "Thanks"' })),
      } as never,
      dialogs: { get: () => dialog as never },
      tab: async () => ({ id: tabId, url }),
      sleep: async (ms) => {
        clock += ms;
      },
      now: () => clock,
    };
    tool = waitTool(deps);
  });

  it('needs at least one condition', async () => {
    expect(await call({})).toMatch(/^INVALID_INPUT: Give at least one condition/);
  });

  it('polls until the text appears and reports the page change', async () => {
    probes = [{ texts: [false], selectors: [] }, { texts: [false], selectors: [] }, { texts: [true], selectors: [] }];
    const text = await call({ text: 'Thanks' });
    expect(text).toMatch(/^Waited 0\.5 s: text "Thanks" is on the page\./);
    expect(text).toContain('+ heading "Thanks"');
  });

  it('treats a page that cannot answer (mid-navigation) as not yet', async () => {
    probes = [new Error('frame gone'), { texts: [false, false], selectors: [] }, { texts: [true, false], selectors: [] }];
    expect(await call({ text: 'Thanks', text_gone: 'Loading' })).toMatch(/^Waited 0\.5 s: text "Thanks" is on the page; text "Loading" is gone\./);
  });

  it('times out with the unmet and the met conditions', async () => {
    probes = [{ texts: [], selectors: [false], idle: true }];
    const text = await call({ selector: '.results li', idle: true, timeout: 2 });
    expect(text).toMatch(/^TIMEOUT: Still waiting after 2\.0 s for: an element matching "\.results li" is visible\. Already true: the page is idle/);
  });

  it('waits for the URL alone without reading the page', async () => {
    let n = 0;
    const probe = vi.fn();
    tool = waitTool({
      scope,
      reader: { probe, change: vi.fn(async () => ({ kind: 'same' as const, text: '' })) } as never,
      dialogs: { get: () => undefined },
      tab: async () => ({ id: tabId, url: ++n > 2 ? 'https://shop.test/done' : url }),
      sleep: async (ms) => {
        clock += ms;
      },
      now: () => clock,
    });
    expect(await call({ url: '/done' })).toBe('Waited 0.5 s: URL contains "/done".');
    expect(probe).not.toHaveBeenCalled();
  });

  it('fails at once on an invalid selector', async () => {
    probes = [{ texts: [], selectors: [null] }];
    expect(await call({ selector: '[[bad' })).toBe('INVALID_INPUT: "[[bad" is not a valid CSS selector.');
  });

  it('stops when a dialog opens', async () => {
    dialog = { type: 'confirm', message: 'Leave page?' };
    expect(await call({ idle: true })).toMatch(/^Stopped waiting: Dialog open: confirm "Leave page\?"/);
  });
});
