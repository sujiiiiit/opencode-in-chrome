import { describe, expect, it } from 'vitest';
import { browserStateHooks, renderBrowserState, TabWatch, trackRevisions } from '@/lib/browser/state';
import type { TabInfo } from '@/lib/browser/tabs';

describe('renderBrowserState', () => {
  const tabs = [
    { id: 412, title: 'Hacker News', url: 'https://news.ycombinator.com/', rev: 3 },
    { id: 413, title: 'Docs "v2"', url: 'https://docs.test/a', rev: 1 },
  ];

  it('lists the current tab first, the others after, with quoted page strings and revisions', () => {
    expect(renderBrowserState({ tabs, currentTabId: 413, dialogs: [], changed: [], unverified: [] })).toBe(
      [
        '<browser-state>',
        'current tab: 413 "Docs \\"v2\\"" "https://docs.test/a" · rev 1',
        'other tabs: 412 "Hacker News" "https://news.ycombinator.com/" · rev 3',
        '</browser-state>',
      ].join('\n'),
    );
  });

  it('adds open dialogs, changed tabs and unverified actions', () => {
    const text = renderBrowserState({
      tabs,
      currentTabId: 412,
      dialogs: [{ tabId: 412, type: 'confirm', message: 'Delete?' }],
      changed: [{ tabId: 413, url: 'https://docs.test/b' }],
      unverified: ['left_click [e12] on tab 412'],
    });
    expect(text).toContain('dialog open on tab 412: confirm "Delete?" (answer it with computer action "dialog"');
    expect(text).toContain('tab 413 changed since you last saw it (now "https://docs.test/b"); earlier refs on it may be stale');
    expect(text).toContain('unverified: left_click [e12] on tab 412 (read the tab to check, or finish with done "partial")');
  });
});

describe('TabWatch', () => {
  const tab = (id: number, url: string): TabInfo => ({ id, title: '', url });

  it('counts revisions per tab from top-frame navigations', () => {
    const watch = new TabWatch();
    let fire: (tabId: number) => void = () => undefined;
    trackRevisions(watch, { onTopNavigation: (cb) => (fire = cb) });
    fire(1);
    fire(1);
    fire(2);
    expect([watch.rev(1), watch.rev(2), watch.rev(3)]).toEqual([2, 1, 0]);
    watch.forgetTab(1);
    expect(watch.rev(1)).toBe(0);
  });

  it("reports a URL that changed between two of the session's calls, once", () => {
    const watch = new TabWatch();
    watch.begin('s', [tab(1, 'https://a.test/')]);
    expect(watch.end('s', [tab(1, 'https://a.test/')])).toEqual([]);
    // The user navigates the tab between calls.
    watch.begin('s', [tab(1, 'https://b.test/')]);
    expect(watch.end('s', [tab(1, 'https://b.test/')])).toEqual([{ tabId: 1, url: 'https://b.test/' }]);
    watch.begin('s', [tab(1, 'https://b.test/')]);
    expect(watch.end('s', [tab(1, 'https://b.test/')])).toEqual([]);
  });

  it("does not report a change the session's own call made", () => {
    const watch = new TabWatch();
    watch.begin('s', [tab(1, 'https://a.test/')]);
    watch.end('s', [tab(1, 'https://a.test/')]);
    // The call itself navigates: begin sees the old URL, end the new one.
    watch.begin('s', [tab(1, 'https://a.test/')]);
    expect(watch.end('s', [tab(1, 'https://a.test/next')])).toEqual([]);
  });
});

describe('browserStateHooks', () => {
  it('builds the block for the acted-on tab, and nothing for a session without tabs', async () => {
    const tabs = new Map<string, TabInfo[]>([['s', [{ id: 7, title: 'Shop', url: 'https://shop.test/' }, { id: 8, title: 'Board', url: 'https://board.test/' }]]]);
    const hooks = browserStateHooks({
      watch: new TabWatch(),
      context: async (sid) => ({ tabs: tabs.get(sid) ?? [], currentTabId: 8 }),
      dialog: (id) => (id === 7 ? { type: 'alert', message: 'Saved' } : undefined),
      unverified: () => ['left_click [e3] on tab 7'],
    });
    await hooks.beforeCall('s');
    const text = (await hooks.footer('s', 7))!;
    expect(text).toMatch(/^<browser-state>\ncurrent tab: 7 "Shop"/);
    expect(text).toContain('other tabs: 8 "Board"');
    expect(text).toContain('dialog open on tab 7: alert "Saved"');
    expect(text).toContain('unverified: left_click [e3] on tab 7');
    expect(await hooks.footer('none')).toBeUndefined();
  });
});
