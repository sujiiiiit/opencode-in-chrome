// The rest of chrome.tabs / chrome.tabGroups, always limited to the session's own tabs.
import { beforeEach, describe, expect, it } from 'vitest';
import { TabScope } from '@/lib/browser/tabs';
import { codeOf, FakeChrome, memoryStore } from '../../support/fake-chrome';

let chrome: FakeChrome;
let scope: TabScope;
let a: number;
let b: number;
beforeEach(async () => {
  chrome = new FakeChrome();
  scope = new TabScope(chrome, memoryStore() as never);
  a = (await scope.create('ses_1', 'https://a.example/')).id;
  b = (await scope.create('ses_1', 'https://b.example/')).id;
});

const userTab = () => chrome.addUserTab('https://mail.example.com/').id!;

describe('every operation stays inside the session', () => {
  it.each([
    ['reload', (id: number) => scope.reload('ses_1', id)],
    ['duplicate', (id: number) => scope.duplicate('ses_1', id)],
    ['move', (id: number) => scope.move('ses_1', id, 0)],
    ['discard', (id: number) => scope.discard('ses_1', id)],
    ['setState', (id: number) => scope.setState('ses_1', id, { muted: true })],
    ['zoom', (id: number) => scope.zoom('ses_1', id)],
    ['setZoom', (id: number) => scope.setZoom('ses_1', id, 1.5)],
    ['zoomSettings', (id: number) => scope.zoomSettings('ses_1', id)],
    ['setZoomSettings', (id: number) => scope.setZoomSettings('ses_1', id, { mode: 'manual' })],
    ['language', (id: number) => scope.language('ses_1', id)],
    ['capture', (id: number) => scope.capture('ses_1', id)],
    ['split', (id: number) => scope.split('ses_1', [id, a])],
    ['unsplit', (id: number) => scope.unsplit('ses_1', id)],
  ])('%s refuses a tab the session does not own', async (_name, run) => {
    expect(await codeOf(run(userTab()))).toBe('NOT_IN_GROUP');
  });

  it('refuses another session that has no tabs at all', async () => {
    expect(await codeOf(scope.reload('ses_other', a))).toBe('NO_TAB');
  });
});

describe('reload', () => {
  it('reloads the current tab by default and can bypass the cache', async () => {
    await scope.reload('ses_1');
    await scope.reload('ses_1', a, true);
    expect(chrome.reloads).toEqual([
      { tabId: b, bypassCache: false },
      { tabId: a, bypassCache: true },
    ]);
  });
});

describe('duplicate', () => {
  it('puts the copy in the same group, makes it current and tracks it', async () => {
    const copy = await scope.duplicate('ses_1', a);
    const ctx = await scope.context('ses_1');
    expect(chrome.tabs.get(copy.id)).toMatchObject({ url: 'https://a.example/', groupId: ctx.groupId });
    expect(ctx.currentTabId).toBe(copy.id);
    expect(ctx.tabs.map((t) => t.id)).toEqual([a, b, copy.id]);
  });
});

describe('move', () => {
  it('reorders inside the window and keeps the group', async () => {
    const before = chrome.tabs.get(a)!.groupId;
    const moved = await scope.move('ses_1', a, 0);
    expect(moved.id).toBe(a);
    expect(chrome.tabs.get(a)).toMatchObject({ index: 0, groupId: before });
  });

  it('accepts -1 for the end of the window', async () => {
    await scope.move('ses_1', a, -1);
    expect(chrome.tabs.get(a)!.index).toBe(chrome.tabs.size - 1);
  });

  it('rejects an index below -1', async () => {
    expect(await codeOf(scope.move('ses_1', a, -2))).toBe('INVALID_INPUT');
  });
});

describe('discard', () => {
  it('discards a background tab', async () => {
    expect((await scope.discard('ses_1', a)).discarded).toBe(true);
    expect(chrome.tabs.get(a)!.discarded).toBe(true);
  });

  it('refuses the active tab instead of silently doing nothing', async () => {
    chrome.tabs.get(a)!.active = true;
    expect(await codeOf(scope.discard('ses_1', a))).toBe('INVALID_INPUT');
    expect(chrome.tabs.get(a)!.discarded).toBeUndefined();
  });
});

describe('setState', () => {
  it('mutes, unmutes, highlights and toggles autoDiscardable', async () => {
    await scope.setState('ses_1', a, { muted: true, autoDiscardable: false, highlighted: true });
    expect(chrome.tabs.get(a)).toMatchObject({ mutedInfo: { muted: true }, autoDiscardable: false, highlighted: true });
    await scope.setState('ses_1', a, { muted: false });
    expect(chrome.tabs.get(a)!.mutedInfo).toEqual({ muted: false });
  });

  it('refuses to pin, because Chrome would drop a pinned tab out of the group', async () => {
    expect(await codeOf(scope.setState('ses_1', a, { pinned: true }))).toBe('INVALID_INPUT');
    expect(chrome.tabs.get(a)!.pinned).toBeUndefined();
    expect((await scope.context('ses_1')).tabs.map((t) => t.id)).toContain(a);
  });

  it('allows unpinning a shared tab the user had pinned', async () => {
    await scope.setState('ses_1', a, { pinned: false });
    expect(chrome.tabs.get(a)!.pinned).toBe(false);
  });

  it('rejects an empty change', async () => {
    expect(await codeOf(scope.setState('ses_1', a, {}))).toBe('INVALID_INPUT');
  });
});

describe('zoom', () => {
  it('reads and sets the zoom factor, 0 resets to the default', async () => {
    expect(await scope.zoom('ses_1', a)).toBe(1);
    await scope.setZoom('ses_1', a, 1.5);
    expect(await scope.zoom('ses_1', a)).toBe(1.5);
    await scope.setZoom('ses_1', a, 0);
    expect(await scope.zoom('ses_1', a)).toBe(1);
  });

  it('rejects a negative factor', async () => {
    expect(await codeOf(scope.setZoom('ses_1', a, -1))).toBe('INVALID_INPUT');
  });

  it('reads and sets zoom settings', async () => {
    expect(await scope.zoomSettings('ses_1', a)).toMatchObject({ mode: 'automatic', scope: 'per-origin' });
    await scope.setZoomSettings('ses_1', a, { mode: 'manual', scope: 'per-tab' });
    expect(await scope.zoomSettings('ses_1', a)).toMatchObject({ mode: 'manual', scope: 'per-tab' });
  });

  it('rejects per-origin scope outside automatic mode', async () => {
    expect(await codeOf(scope.setZoomSettings('ses_1', a, { mode: 'manual', scope: 'per-origin' }))).toBe('INVALID_INPUT');
  });
});

describe('language and capture', () => {
  it('detects the page language', async () => {
    expect(await scope.language('ses_1', a)).toBe('en');
  });

  it('captures the visible area only of a tab that is showing', async () => {
    expect(await codeOf(scope.capture('ses_1', a))).toBe('NOT_INTERACTABLE');
    chrome.tabs.get(a)!.active = true;
    chrome.tabs.get(a)!.windowId = 1;
    expect(await scope.capture('ses_1', a)).toMatch(/^data:image\/png;base64,/);
  });
});

describe('split view', () => {
  it('splits two session tabs and unsplits by either tab', async () => {
    const id = await scope.split('ses_1', [a, b]);
    expect(chrome.tabs.get(a)!.splitViewId).toBe(id);
    expect(chrome.tabs.get(b)!.splitViewId).toBe(id);
    await scope.unsplit('ses_1', b);
    expect(chrome.tabs.get(a)!.splitViewId).toBe(-1);
    expect(chrome.tabs.get(b)!.splitViewId).toBe(-1);
  });

  it('refuses to split a tab with itself', async () => {
    expect(await codeOf(scope.split('ses_1', [a, a]))).toBe('INVALID_INPUT');
  });

  it('refuses to unsplit a tab that is not split', async () => {
    expect(await codeOf(scope.unsplit('ses_1', a))).toBe('INVALID_INPUT');
  });
});

describe('highlight', () => {
  it('selects session tabs by id, translating to window positions', async () => {
    chrome.tabs.get(a)!.index = 0;
    chrome.tabs.get(b)!.index = 1;
    chrome.tabs.get(a)!.windowId = 1;
    chrome.tabs.get(b)!.windowId = 1;
    await scope.highlight('ses_1', [b]);
    expect(chrome.tabs.get(b)!.highlighted).toBe(true);
    expect(chrome.tabs.get(a)!.highlighted).toBe(false);
  });

  it('refuses a tab outside the session, tabs in two windows and an empty list', async () => {
    expect(await codeOf(scope.highlight('ses_1', [userTab()]))).toBe('NOT_IN_GROUP');
    chrome.tabs.get(a)!.windowId = 1;
    chrome.tabs.get(b)!.windowId = 2;
    expect(await codeOf(scope.highlight('ses_1', [a, b]))).toBe('INVALID_INPUT');
    expect(await codeOf(scope.highlight('ses_1', []))).toBe('INVALID_INPUT');
  });
});

describe('details', () => {
  it('reports the state flags of every session tab', async () => {
    chrome.tabs.get(a)!.audible = true;
    chrome.tabs.get(b)!.discarded = true;
    chrome.tabs.get(b)!.mutedInfo = { muted: true };
    const { tabs } = await scope.details('ses_1');
    expect(tabs.find((t) => t.id === a)).toMatchObject({ audible: true, muted: false, discarded: false, pinned: false });
    expect(tabs.find((t) => t.id === b)).toMatchObject({ audible: false, muted: true, discarded: true });
  });
});

describe('tab group', () => {
  it('reads, renames, recolours and collapses only the session group', async () => {
    const group = await scope.groupInfo('ses_1');
    expect(group).toMatchObject({ title: 'Opencode', color: 'orange', collapsed: false });
    await scope.updateGroupOf('ses_1', { title: 'Research', color: 'blue', collapsed: true });
    expect(await scope.groupInfo('ses_1')).toMatchObject({ title: 'Research', color: 'blue', collapsed: true });
  });

  it('moves the group within its window', async () => {
    await scope.moveGroup('ses_1', 0);
    expect(chrome.groupMoves).toEqual([{ groupId: (await scope.context('ses_1')).groupId, index: 0 }]);
  });

  it('refuses without a group', async () => {
    expect(await codeOf(scope.groupInfo('ses_none'))).toBe('NO_TAB');
  });

  it('rejects an unknown colour and an empty change', async () => {
    expect(await codeOf(scope.updateGroupOf('ses_1', { color: 'magenta' }))).toBe('INVALID_INPUT');
    expect(await codeOf(scope.updateGroupOf('ses_1', {}))).toBe('INVALID_INPUT');
  });
});

describe('tabs.onReplaced', () => {
  it('moves the session membership from the removed id to the added id', async () => {
    chrome.tabs.set(900, { ...chrome.tabs.get(a)!, id: 900 });
    chrome.tabs.delete(a);
    await scope.replaced(900, a);
    const ctx = await scope.context('ses_1');
    expect(ctx.tabs.map((t) => t.id)).toEqual([900, b]);
    expect(await scope.sessionOf(a)).toBeUndefined();
    expect(await scope.sessionOf(900)).toBe('ses_1');
  });

  it('keeps the shared flag and the current tab', async () => {
    const user = userTab();
    await scope.share('ses_1', user);
    chrome.tabs.set(901, { ...chrome.tabs.get(user)!, id: 901 });
    chrome.tabs.delete(user);
    await scope.replaced(901, user);
    expect((await scope.context('ses_1')).currentTabId).toBe(901);
    await scope.close('ses_1', 901);
    expect(chrome.tabs.get(901)!.groupId).toBe(-1); // released, not closed
  });

  it('ignores tabs no session owns', async () => {
    await expect(scope.replaced(950, 951)).resolves.toBeUndefined();
  });
});
