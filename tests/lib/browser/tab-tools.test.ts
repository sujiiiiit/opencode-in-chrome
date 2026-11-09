import { beforeEach, describe, expect, it } from 'vitest';
import { browserStateHooks, TabWatch } from '@/lib/browser/state';
import { TabScope } from '@/lib/browser/tabs';
import { runTool, type ToolDef } from '@/lib/browser/tools/registry';
import { requirePage, tabTools, withScheme } from '@/lib/browser/tools/tabs';
import { codeOf, FakeChrome, memoryStore } from '../../support/fake-chrome';

let chrome: FakeChrome;
let scope: TabScope;
let tools: Record<string, ToolDef>;
let watch: TabWatch;
beforeEach(() => {
  watch = new TabWatch();
  chrome = new FakeChrome();
  scope = new TabScope(chrome, memoryStore() as never);
  tools = Object.fromEntries(tabTools(scope).map((t) => [t.name, t]));
});

const call = async (name: string, args: Record<string, unknown> = {}, session = 'ses_1') => {
  const hooks = browserStateHooks({ watch, context: (sid) => scope.context(sid), dialog: () => undefined });
  const result = await runTool(tools[name]!, args, session, hooks);
  return { text: (result.content[0] as { text: string }).text, isError: result.isError === true };
};

describe('tab tools', () => {
  it('tabs_context explains how to start when empty and lists tabs once created', async () => {
    expect((await call('tabs_context')).text).toMatch(/no tabs.*tabs_share/);
    await call('tabs_create');
    const created = await call('tabs_context');
    const id = [...chrome.tabs.keys()][0];
    expect(created.text).toContain(`Tabs in this session (current: ${id}):\n- ${id} "" about:blank`);
    expect(created.text).toContain(`<browser-state>
current tab: ${id} "(untitled)" "about:blank" · rev 0
</browser-state>`);
  });

  it('lists existing user tabs without creating one and shares a selected web tab', async () => {
    const user = chrome.addUserTab('https://mail.example.com/');
    const other = chrome.addUserTab('https://docs.example.com/');
    const listed = await call('tabs_context');
    expect(listed.text).toContain(`  ${user.id} "https://mail.example.com/" https://mail.example.com/`);
    expect(listed.text).toContain(`  ${other.id} "https://docs.example.com/" https://docs.example.com/`);
    expect(chrome.tabs.size).toBe(2);
    const shared = await call('tabs_share', { tabId: user.id });
    expect(shared.isError).toBe(false);
    expect((await scope.context('ses_1')).tabs.map((tab) => tab.id)).toEqual([user.id]);
    expect((await call('tabs_context')).text).toContain(`  ${other.id} "https://docs.example.com/"`);
  });

  it('attaches a browser page for navigation but refuses a tab owned by another chat', async () => {
    const internal = chrome.addUserTab('chrome://newtab/');
    expect((await call('tabs_share', { tabId: internal.id })).text).toMatch(/Navigate it to a website/);
    expect((await scope.context('ses_1')).tabs.map((tab) => tab.id)).toContain(internal.id);
    expect(await codeOf(requirePage(scope, 'ses_1', internal.id))).toBe('RESTRICTED_PAGE');
    const user = chrome.addUserTab('https://mail.example.com/');
    await scope.share('ses_other', user.id!);
    expect((await call('tabs_share', { tabId: user.id })).text).toMatch(/^NOT_IN_GROUP:/);
  });

  it('tabs_create opens a URL with https assumed', async () => {
    const result = await call('tabs_create', { url: 'example.com' });
    expect(result.text).toMatch(/^Created tab \d+ at https:\/\/example\.com\./);
    expect([...chrome.tabs.values()][0]!.url).toBe('https://example.com');
  });

  it('tabs_close refuses a tab outside the group with NOT_IN_GROUP', async () => {
    await call('tabs_create');
    const user = chrome.addUserTab('https://mail.example.com/');
    const result = await call('tabs_close', { tabId: user.id });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/^NOT_IN_GROUP: Tab \d+ is not one of this session's tabs\. Valid tab ids: \d+\./);
  });

  it('tabs_close of the last tab says the group is gone', async () => {
    await call('tabs_create');
    const id = [...chrome.tabs.keys()][0];
    expect((await call('tabs_close', { tabId: id })).text).toMatch(/no tabs left/);
    expect(chrome.tabs.size).toBe(0);
  });

  it('tabs_close requires tabId', async () => {
    expect((await call('tabs_close')).text).toBe('INVALID_INPUT: Missing required argument `tabId`.');
  });
});

describe('requirePage', () => {
  it('fails with RESTRICTED_PAGE on browser pages and blank tabs', async () => {
    await scope.context('ses_1', true);
    expect(await codeOf(requirePage(scope, 'ses_1', undefined))).toBe('RESTRICTED_PAGE');
    const tab = await scope.create('ses_1', 'chrome://newtab/');
    await expect(requirePage(scope, 'ses_1', tab.id)).rejects.toThrow(/Navigate to a web page first/);
  });

  it('returns a web page tab', async () => {
    const tab = await scope.create('ses_1', 'https://example.com/');
    expect(await requirePage(scope, 'ses_1', tab.id)).toMatchObject({ id: tab.id, url: 'https://example.com/' });
  });
});

describe('withScheme', () => {
  it.each([
    ['example.com', 'https://example.com'],
    ['http://127.0.0.1:3000/a', 'http://127.0.0.1:3000/a'],
    ['about:blank', 'about:blank'],
  ])('%s → %s', (input, out) => expect(withScheme(input)).toBe(out));

  it('shows an MCP client only the sites of other tabs', async () => {
    const user = chrome.addUserTab('https://mail.example.com/inbox/secret-thread?token=1');
    const listed = await call('tabs_context', {}, 'mcp-1a2b3c4d');
    expect(listed.text).toContain(`  ${user.id} https://mail.example.com`);
    expect(listed.text).not.toMatch(/secret-thread|token/);
    expect(listed.text).toContain('sites only');
  });

  it('tabs_switch makes a session tab current and refuses a tab outside the session', async () => {
    await call('tabs_create', { url: 'https://a.example/' });
    await call('tabs_create', { url: 'https://b.example/' });
    const [first, second] = (await scope.context('ses_1')).tabs.map((t) => t.id);
    expect((await scope.context('ses_1')).currentTabId).toBe(second);
    const switched = await call('tabs_switch', { tabId: first });
    expect(switched.text).toContain(`Tab ${first}`);
    expect((await scope.context('ses_1')).currentTabId).toBe(first);
    const stranger = chrome.addUserTab('https://c.example/');
    expect((await call('tabs_switch', { tabId: stranger.id })).text).toMatch(/^NOT_IN_GROUP:/);
  });
});
