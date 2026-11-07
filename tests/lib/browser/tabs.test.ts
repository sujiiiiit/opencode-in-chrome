import { beforeEach, describe, expect, it } from 'vitest';
import { groupTitle, isRestrictedUrl, TabScope } from '@/lib/browser/tabs';
import { codeOf, FakeChrome, memoryStore } from '../../support/fake-chrome';

let chrome: FakeChrome;
let store: ReturnType<typeof memoryStore<never>>;
let scope: TabScope;
beforeEach(() => {
  chrome = new FakeChrome();
  store = memoryStore();
  scope = new TabScope(chrome, store as never);
});

describe('tabs_context', () => {
  it('creates a titled group with one blank background tab in the last focused window', async () => {
    chrome.focusedWindow = 3;
    const ctx = await scope.context('ses_abcd', true);
    expect(ctx.tabs).toHaveLength(1);
    const tab = chrome.tabs.get(ctx.tabs[0]!.id)!;
    expect(tab).toMatchObject({ url: 'about:blank', windowId: 3, active: false, groupId: ctx.groupId });
    expect(chrome.groups.get(ctx.groupId!)).toMatchObject({ title: groupTitle('ses_abcd'), color: 'orange' });
    expect(ctx.currentTabId).toBe(tab.id);
  });

  it('reports no tabs without createIfEmpty', async () => {
    expect(await scope.context('ses_1')).toEqual({ tabs: [], currentTabId: undefined, groupId: undefined });
    expect(chrome.tabs.size).toBe(0);
  });

  it('keeps sessions apart and recovers after a worker restart', async () => {
    const a = await scope.context('ses_A', true);
    const b = await scope.context('ses_B', true);
    expect(a.groupId).not.toBe(b.groupId);
    const restarted = new TabScope(chrome, store as never);
    expect((await restarted.context('ses_A')).tabs.map((t) => t.id)).toEqual(a.tabs.map((t) => t.id));
    expect(await codeOf(restarted.resolve('ses_A', b.tabs[0]!.id))).toBe('NOT_IN_GROUP');
  });
});

describe('resolve', () => {
  it('fails with NOT_IN_GROUP for a user tab and lists the valid ids', async () => {
    const own = await scope.context('ses_1', true);
    const user = chrome.addUserTab('https://mail.example.com/');
    await expect(scope.resolve('ses_1', user.id)).rejects.toThrow(`Valid tab ids: ${own.tabs[0]!.id}`);
  });

  it('fails with NO_TAB when the session has none', async () => {
    expect(await codeOf(scope.resolve('ses_1'))).toBe('NO_TAB');
  });

  it('uses and updates the current tab', async () => {
    const first = (await scope.context('ses_1', true)).tabs[0]!;
    const second = await scope.create('ses_1', 'https://example.com/');
    expect((await scope.resolve('ses_1')).id).toBe(second.id);
    await scope.resolve('ses_1', first.id);
    expect((await scope.context('ses_1')).currentTabId).toBe(first.id);
  });
});

describe('tabs_create and tabs_close', () => {
  it('opens tabs in the existing group without focusing them', async () => {
    const ctx = await scope.context('ses_1', true);
    const tab = await scope.create('ses_1', 'https://example.com/');
    expect(chrome.tabs.get(tab.id)).toMatchObject({ groupId: ctx.groupId, active: false, url: 'https://example.com/' });
  });

  it('makes the most recently used remaining tab current after closing the current one', async () => {
    const a = (await scope.context('ses_1', true)).tabs[0]!;
    const b = await scope.create('ses_1');
    const c = await scope.create('ses_1');
    await scope.resolve('ses_1', a.id);
    await scope.resolve('ses_1', c.id);
    await scope.close('ses_1', c.id);
    expect((await scope.context('ses_1')).currentTabId).toBe(a.id);
    expect(b.id).toBeDefined();
  });

  it('removes the session when its last tab closes, then starts fresh', async () => {
    const first = await scope.context('ses_1', true);
    expect(await scope.close('ses_1', first.tabs[0]!.id)).toEqual({ remaining: 0 });
    expect((await scope.context('ses_1')).tabs).toEqual([]);
    const fresh = await scope.context('ses_1', true);
    expect(fresh.groupId).not.toBe(first.groupId);
  });

  it('refuses to close a tab outside the group', async () => {
    await scope.context('ses_1', true);
    const user = chrome.addUserTab('https://bank.example/');
    expect(await codeOf(scope.close('ses_1', user.id!))).toBe('NOT_IN_GROUP');
    expect(chrome.tabs.has(user.id!)).toBe(true);
  });

  it('drops tabs the user closed by hand', async () => {
    const a = (await scope.context('ses_1', true)).tabs[0]!;
    const b = await scope.create('ses_1');
    chrome.tabs.delete(b.id);
    expect((await scope.context('ses_1')).tabs.map((t) => t.id)).toEqual([a.id]);
  });
});

describe('sharing and popups', () => {
  it('shares a user tab into the session and releases it without closing', async () => {
    const user = chrome.addUserTab('https://docs.example.com/');
    await scope.share('ses_1', user.id!);
    const ctx = await scope.context('ses_1');
    expect(ctx.tabs.map((t) => t.id)).toEqual([user.id]);
    expect(chrome.tabs.get(user.id!)!.groupId).toBe(ctx.groupId);
    await scope.close('ses_1', user.id!);
    expect(chrome.tabs.get(user.id!)).toMatchObject({ groupId: -1 });
  });

  it('moves the current tab to a new chat when that chat starts', async () => {
    const user = chrome.addUserTab('https://docs.example.com/');
    await scope.share('ses_old', user.id!);
    const groupId = (await scope.context('ses_old')).groupId;
    await scope.share('ses_new', user.id!, true);
    expect((await scope.context('ses_old')).tabs).toEqual([]);
    expect((await scope.context('ses_new')).tabs.map((tab) => tab.id)).toEqual([user.id]);
    expect((await scope.context('ses_new')).groupId).toBe(groupId);
    expect(chrome.groups.size).toBe(1);
    expect(chrome.tabs.size).toBe(1);
  });

  it('keeps the whole existing group when a new chat takes over', async () => {
    const first = chrome.addUserTab('https://docs.example.com/');
    await scope.share('ses_old', first.id!);
    const second = await scope.create('ses_old', 'https://mail.example.com/');
    const groupId = (await scope.context('ses_old')).groupId;
    await scope.share('ses_new', first.id!, true);
    expect((await scope.context('ses_new')).tabs.map((tab) => tab.id)).toEqual([second.id, first.id]);
    expect((await scope.context('ses_new')).groupId).toBe(groupId);
    expect(chrome.groups.size).toBe(1);
  });

  it('renames an existing group when another tab joins it', async () => {
    const first = chrome.addUserTab('https://docs.example.com/');
    await scope.share('ses_old', first.id!);
    const groupId = chrome.tabs.get(first.id!)!.groupId!;
    chrome.groups.get(groupId)!.title = 'Opencode old';
    const second = chrome.addUserTab('https://mail.example.com/');
    await scope.share('ses_old', second.id!);
    expect(chrome.groups.get(groupId)!.title).toBe('Opencode');
  });

  it('adopts a popup opened from an agent tab into its group', async () => {
    const ctx = await scope.context('ses_1', true);
    const popup = await chrome.create({ url: 'https://example.com/new' });
    const adopted = await scope.adoptPopup({ ...popup, openerTabId: ctx.tabs[0]!.id });
    expect(adopted).toEqual({ sessionID: 'ses_1', tabId: popup.id });
    expect(chrome.tabs.get(popup.id!)!.groupId).toBe(ctx.groupId);
    expect(await scope.sessionOf(popup.id!)).toBe('ses_1');
  });

  it('ignores tabs opened from user tabs', async () => {
    await scope.context('ses_1', true);
    const user = chrome.addUserTab('https://example.com/');
    const other = await chrome.create({});
    expect(await scope.adoptPopup({ ...other, openerTabId: user.id })).toBeUndefined();
  });

  it('forgets a tab dragged out of the group', async () => {
    const ctx = await scope.context('ses_1', true);
    const tab = await scope.create('ses_1');
    await scope.groupChanged(tab.id, -1);
    expect((await scope.context('ses_1')).tabs.map((t) => t.id)).toEqual([ctx.tabs[0]!.id]);
  });
});

describe('join and leave hooks', () => {
  it('reports tabs joining and leaving any session', async () => {
    const joined: number[] = [];
    const left: number[] = [];
    scope = new TabScope(chrome, memoryStore() as never, { onJoin: (id) => joined.push(id), onLeave: (id) => left.push(id) });
    const a = (await scope.context('ses_1', true)).tabs[0]!;
    const user = chrome.addUserTab('https://docs.example.com/');
    await scope.share('ses_2', user.id!);
    await scope.close('ses_1', a.id);
    await scope.unshare('ses_2', user.id!);
    expect(joined).toEqual([a.id, user.id]);
    expect(left).toEqual([a.id, user.id]);
  });
});


describe('isRestrictedUrl', () => {
  it.each([
    ['chrome://newtab/', true],
    ['about:blank', true],
    ['chrome-extension://abc/page.html', true],
    ['https://chromewebstore.google.com/detail/x', true],
    ['https://chrome.google.com/webstore/detail/x', true],
    ['file:///C:/x.html', true],
    ['data:text/html,hi', true],
    [undefined, true],
    ['https://chrome.google.com/search', false],
    ['https://news.ycombinator.com/', false],
    ['http://127.0.0.1:5173/', false],
  ])('%s → %s', (url, restricted) => {
    expect(isRestrictedUrl(url)).toBe(restricted);
  });
});
