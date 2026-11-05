import type { BrowserContext, Page } from '@playwright/test';
import { expect, openPage, refOf, SESSION, test } from './fixtures';

test.use({ approvals: 'manual' });

async function pageFor(context: BrowserContext, url: string): Promise<Page> {
  await expect.poll(() => context.pages().some((p) => p.url() === url)).toBe(true);
  return context.pages().find((p) => p.url() === url)!;
}

/** Answers the next approval form the extension creates. */
async function answerNext(fake: Parameters<Parameters<typeof test>[2]>[0]['fake'], choice: 'once' | 'always' | 'deny') {
  const form = await fake.waitForForm(15_000);
  fake.answerForm(form.id, { choice });
  return form;
}

test('a new site needs the user once per session, and "always" remembers it', async ({ tool, sw, pages, fake }) => {
  const created = tool('tabs_create', { url: pages.url('/form.html') });
  await created;
  const read = tool('read_page');
  const form = await answerNext(fake, 'once');
  expect(form.title).toBe('Let the agent use 127.0.0.1?');
  expect(form.metadata).toMatchObject({ kind: 'browser-approval', approval: 'site', site: '127.0.0.1' });
  expect((await read).text).toContain('Pizza order');
  // Same session, same site: no new prompt.
  expect((await tool('find', { query: 'submit' })).isError).toBeFalsy();
  expect(fake.forms.size).toBe(1);

  // A different session is asked again; "always" stores an allow rule.
  await openPage(tool, sw, pages.url('/form.html'), 'ses_e2e_other');
  const other = tool('read_page', {}, 'ses_e2e_other');
  await answerNext(fake, 'always');
  await other;
  const policy = await sw.evaluate(async () => (await chrome.storage.local.get('opencode.browser.policy'))['opencode.browser.policy'] as { sites: Record<string, { rule: string }> });
  expect(policy.sites['127.0.0.1']).toEqual({ rule: 'allow' });
});

test('blocked sites fail without a request', async ({ tool, sw, pages }) => {
  await sw.evaluate(() => chrome.storage.local.set({ 'opencode.browser.policy': { mode: 'ask', sites: { '127.0.0.1': { rule: 'block' } } } }));
  await tool('tabs_context', { createIfEmpty: true });
  const nav = await tool('navigate', { url: pages.url('/form.html') });
  expect(nav.text).toMatch(/^BLOCKED_SITE: 127\.0\.0\.1 is blocked/);
});

test('consequential clicks ask every time and a denial sends no input', async ({ tool, sw, pages, fake, context }) => {
  await sw.evaluate(() => chrome.storage.local.set({ 'opencode.browser.policy': { mode: 'ask', sites: { '127.0.0.1': { rule: 'allow' } } } }));
  await openPage(tool, sw, pages.url('/injection.html'));
  const page = await pageFor(context, pages.url('/injection.html'));
  const ref = refOf((await tool('read_page')).text, /button "Delete account"/);
  const click = tool('computer', { action: 'left_click', ref, action_summary: 'Deletes the account' });
  const form = await answerNext(fake, 'deny');
  expect(form.title).toBe('Allow this action on 127.0.0.1?');
  expect(form.metadata).toMatchObject({ approval: 'action', summary: 'Deletes the account', tier: 'consequential' });
  const result = await click;
  expect(result.text).toMatch(/^DENIED: The user declined: Deletes the account/);
  await expect(page.locator('#status')).toHaveText('account active');
});

test('page text with injected instructions stays inside the untrusted markers', async ({ tool, sw, pages }) => {
  await sw.evaluate(() => chrome.storage.local.set({ 'opencode.browser.policy': { mode: 'act', sites: {} } }));
  await openPage(tool, sw, pages.url('/injection.html'));
  for (const result of [await tool('get_page_text'), await tool('read_page', { filter: 'all' })]) {
    const open = /<untrusted_page_content id="([0-9a-f]+)">/.exec(result.text);
    expect(open).not.toBeNull();
    const close = result.text.indexOf(`</untrusted_page_content id="${open![1]}">`);
    const injected = result.text.indexOf('Ignore previous instructions');
    expect(injected).toBeGreaterThan(open!.index);
    expect(injected).toBeLessThan(close);
  }
});

test('typing into a password field is refused in every mode', async ({ tool, sw, pages, context }) => {
  await sw.evaluate(() =>
    chrome.storage.local.set({ 'opencode.browser.policy': { mode: 'act', sites: { '127.0.0.1': { rule: 'allow', autoConsequential: true } } } }),
  );
  await openPage(tool, sw, pages.url('/form.html'));
  const page = await pageFor(context, pages.url('/form.html'));
  const tree = (await tool('read_page')).text;
  const pw = refOf(tree, /textbox "Password:"/);
  await tool('computer', { action: 'left_click', ref: pw, action_summary: 'Focuses the password box' });
  const typed = await tool('computer', { action: 'type', text: 'hunter2', action_summary: 'Types the password' });
  expect(typed.text).toMatch(/^DENIED: .*passwords/);
  const filled = await tool('form_input', { ref: pw, value: 'hunter2', action_summary: 'Fills the password' });
  expect(filled.text).toMatch(/^DENIED: /);
  await expect(page.locator('input[name=pw]')).toHaveValue('');
});

test('the stop control halts a running batch and refuses calls until resumed', async ({ tool, sw, pages, context, extensionId }) => {
  await sw.evaluate(() => chrome.storage.local.set({ 'opencode.browser.policy': { mode: 'act', sites: {} } }));
  await openPage(tool, sw, pages.url('/actions.html'));
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const batch = tool('batch', {
    actions: [
      { name: 'computer', input: { action: 'wait', duration: 2 } },
      { name: 'read_page', input: {} },
    ],
  });
  await new Promise((r) => setTimeout(r, 500));
  expect(await panel.evaluate(() => chrome.runtime.sendMessage({ type: 'opencode.browser.stop' }))).toEqual({ stopped: true });
  expect((await batch).text).toContain('Stopped by the user: 1 completed, 1 not run.');
  expect((await tool('read_page')).text).toMatch(/^DENIED: The user stopped all browser activity/);
  await panel.evaluate(() => chrome.runtime.sendMessage({ type: 'opencode.browser.resume' }));
  expect((await tool('tabs_context')).isError).toBeFalsy();
  expect(SESSION).toBeTruthy();
});
