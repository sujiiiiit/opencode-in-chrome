import { expect, openPage, refOf, test } from './fixtures';

test('console reads page logs and uncaught errors', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/diag.html'));
  await expect.poll(async () => (await tool('console', { pattern: 'probe' })).text).toMatch(/\[1\] \d\d:\d\d:\d\d LOG probe-log 1/);
  const ref = refOf((await tool('read_page')).text, /button "Throw"/);
  await tool('computer', { action: 'left_click', ref, action_summary: 'Triggers the error' });
  await expect.poll(async () => (await tool('console', { onlyErrors: true })).text).toContain('ERROR Error: boom from button');
});

test('network lists the page load requests on the first call and reads a body', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/diag.html'));
  await expect.poll(async () => (await tool('network')).text).toMatch(/r\d+ GET 200 fetch .*\/api\/items/);
  const list = (await tool('network')).text;
  expect(list).toMatch(/r1 GET 200 document .* http:\/\/127\.0\.0\.1:\d+\/diag\.html/);
  expect(list).not.toContain('chrome-extension://');
  const id = /(r\d+) GET 200 fetch/.exec(list)![1]!;
  const body = await tool('network', { request_id: id });
  expect(body.text).toContain('{"items":[1,2,3]}');
});

test('javascript runs in the page under a strict CSP and reports thrown errors', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/csp.html'));
  const title = await tool('javascript', { code: 'document.title' });
  expect(title.text).toContain('"Strict CSP"');
  const awaited = await tool('javascript', { code: 'await new Promise((r) => setTimeout(() => r(6 * 7), 50))' });
  expect(awaited.text).toContain('42');
  const thrown = await tool('javascript', { code: 'throw new Error("boom")' });
  expect(thrown.isError).toBe(true);
  expect(thrown.text).toMatch(/^INVALID_INPUT: The code threw: .*boom/);
});
