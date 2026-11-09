import { expect, openPage, refOf, test } from './fixtures';

test('wait_for waits for text to appear and a spinner to go, in the page and its frames', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/waiting.html'));
  const tree = (await tool('read_page')).text;
  await tool('computer', { action: 'left_click', ref: refOf(tree, /Load results/), action_summary: 'Loads the search results' });

  const ready = await tool('wait_for', { text: 'Results ready', text_gone: 'Loading', selector: 'li.hit' });
  expect(ready.isError).toBeFalsy();
  expect(ready.text).toMatch(/^Waited \d+\.\d s: text "Results ready" is on the page; text "Loading" is gone; an element matching "li\.hit" is visible\./);

  const frame = await tool('wait_for', { text: 'Frame finished', idle: true });
  expect(frame.text).toMatch(/^Waited \d+\.\d s: text "Frame finished" is on the page; the page is idle/);
});

test('wait_for times out with what is still unmet, and rejects bad input', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/waiting.html'));
  const late = await tool('wait_for', { selector: '.never', text: 'Search results', timeout: 1 });
  expect(late.isError).toBe(true);
  expect(late.text).toMatch(/^TIMEOUT: Still waiting after 1\.\d s for: an element matching "\.never" is visible\. Already true: text "Search results" is on the page\./);

  expect((await tool('wait_for', {})).text).toMatch(/^INVALID_INPUT: Give at least one condition/);
  expect((await tool('wait_for', { selector: '[[bad' })).text).toMatch(/^INVALID_INPUT: "\[\[bad" is not a valid CSS selector\./);
});

test('a click that starts a slow page load waits for the new page', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/waiting.html'));
  const tree = (await tool('read_page')).text;
  const click = await tool('computer', { action: 'left_click', ref: refOf(tree, /Open the slow report/), action_summary: 'Opens the slow report' });
  expect(click.text).toContain('Waited for the new page to load.');
  expect(click.text).toContain(`URL changed to ${pages.url('/slow?ms=2500')}`);

  const url = await tool('wait_for', { url: '/slow' });
  expect(url.text).toMatch(/^Waited 0\.\d s: URL contains "\/slow"\./);
});

test('a click that downloads a file reports it, and downloads says where it was saved', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/waiting.html'));
  const tree = (await tool('read_page')).text;
  const click = await tool('computer', { action: 'left_click', ref: refOf(tree, /Export prices/), action_summary: 'Downloads the price export' });
  expect(click.text).toMatch(/Download started: d\d+ /);

  const list = await tool('downloads', { wait: true, timeout: 10 });
  // Playwright's browser saves downloads under random names in its artifacts folder; real Chrome uses export.csv.
  expect(list.text).toMatch(/^d\d+ \S+ — complete, 28 B, saved to \S+/);
});
