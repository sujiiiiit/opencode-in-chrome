import { currentTab, expect, openPage, SESSION, test } from './fixtures';

test('tabs_context creates a titled tab group with a blank background tab', async ({ tool, sw }) => {
  const first = await tool('tabs_context', { createIfEmpty: true });
  expect(first.isError).toBeFalsy();
  const tabId = await currentTab(tool);
  const group = await sw.evaluate(async (id) => {
    const tab = await chrome.tabs.get(id);
    const info = await chrome.tabGroups.get(tab.groupId);
    return { title: info.title, color: info.color, url: tab.pendingUrl || tab.url };
  }, tabId);
  expect(group).toEqual({ title: `Opencode ${SESSION.slice(-4)}`, color: 'orange', url: 'about:blank' });
});

test('the debugger attaches when a web tab joins the session', async ({ tool, sw, pages }) => {
  await tool('tabs_create', { url: pages.url('/form.html') });
  const tabId = await currentTab(tool);
  await expect
    .poll(() =>
      sw.evaluate(async (id) => (await chrome.debugger.getTargets()).some((t: { tabId?: number; attached: boolean }) => t.tabId === id && t.attached), tabId),
    )
    .toBe(true);
});

test('sessions cannot touch user tabs or each other', async ({ tool, context, sw, pages }) => {
  await tool('tabs_context', { createIfEmpty: true });
  const user = await context.newPage();
  await user.goto(pages.url('/form.html'));
  const userTabId = await sw.evaluate(
    async (url) => (await chrome.tabs.query({})).find((t: { url?: string }) => t.url === url)!.id!,
    pages.url('/form.html'),
  );
  const close = await tool('tabs_close', { tabId: userTabId });
  expect(close.isError).toBe(true);
  expect(close.text).toMatch(/^NOT_IN_GROUP: /);
  expect(user.isClosed()).toBe(false);

  const other = await tool('tabs_context', {}, 'ses_e2e_other');
  expect(other.text).toMatch(/no tabs/);
});

test('closing the last tab removes the group', async ({ tool, sw }) => {
  const tabId = await currentTab(tool);
  const closed = await tool('tabs_close', { tabId });
  expect(closed.text).toMatch(/no tabs left/);
  const groups = await sw.evaluate(() => chrome.tabGroups.query({ title: 'Opencode 0001' }));
  expect(groups).toHaveLength(0);
});

test('sharing a tab from the side panel moves it into the session group, and unsharing gives it back', async ({ tool, sw, context, pages, extensionId }) => {
  await tool('tabs_context', { createIfEmpty: true });
  const user = await context.newPage();
  await user.goto(pages.url('/form.html'));
  const tabId = await sw.evaluate(
    async (url) => (await chrome.tabs.query({})).find((t: { url?: string }) => t.url === url)!.id!,
    pages.url('/form.html'),
  );
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const shared = await panel.evaluate(
    ({ id, session }) => chrome.runtime.sendMessage({ type: 'opencode.browser.share', sessionID: session, tabId: id }),
    { id: tabId, session: SESSION },
  );
  expect(shared.tab).toMatchObject({ id: tabId });
  expect((await tool('tabs_context')).text).toContain(`- ${tabId} "Pizza order"`);
  const groupTitle = await sw.evaluate(async (id) => (await chrome.tabGroups.get((await chrome.tabs.get(id)).groupId)).title, tabId);
  expect(groupTitle).toBe(`Opencode ${SESSION.slice(-4)}`);

  await panel.evaluate(({ id, session }) => chrome.runtime.sendMessage({ type: 'opencode.browser.unshare', sessionID: session, tabId: id }), {
    id: tabId,
    session: SESSION,
  });
  expect((await tool('tabs_context')).text).not.toContain(`- ${tabId} `);
  expect(user.isClosed()).toBe(false);
});

test('results end with the browser-state block, which reports a tab the user navigated', async ({ tool, sw, context, pages }) => {
  const tabId = await openPage(tool, sw, pages.url('/tasks.html'));
  const first = await tool('read_page');
  expect(first.text).toContain(`<browser-state>\ncurrent tab: ${tabId} "Task board" "${pages.url('/tasks.html')}" · rev `);
  expect(first.text).toMatch(/ · rev \d+\n<\/browser-state>$/);
  // The user navigates the agent's tab between two calls.
  const page = context.pages().find((p) => p.url() === pages.url('/tasks.html'))!;
  await page.goto(pages.url('/form.html'));
  const next = await tool('tabs_context');
  expect(next.text).toContain(`tab ${tabId} changed since you last saw it (now "${pages.url('/form.html')}"); earlier refs on it may be stale`);
  // Reported once: the session has now seen it.
  expect((await tool('tabs_context')).text).not.toContain('changed since you last saw it');
});
