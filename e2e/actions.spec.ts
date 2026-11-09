import type { BrowserContext, Page } from '@playwright/test';
import { expect, openPage, refOf, SESSION, test } from './fixtures';

/** The Playwright page for a tab the extension opened. */
async function pageFor(context: BrowserContext, url: string): Promise<Page> {
  await expect.poll(() => context.pages().some((p) => p.url() === url)).toBe(true);
  return context.pages().find((p) => p.url() === url)!;
}

test('clicks are trusted input and report what changed', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  const tree = (await tool('read_page')).text;

  const trusted = await tool('computer', { action: 'left_click', ref: refOf(tree, /Trusted only/), action_summary: 'Presses the trusted button' });
  expect(trusted.text).toMatch(/^Clicked button "Trusted only" \[e\d+\]\./);
  await expect(page.locator('#trusted-status')).toHaveText('trusted click');

  const menu = await tool('computer', { action: 'left_click', ref: refOf(tree, /Filters/), action_summary: 'Opens the Filters menu' });
  expect(menu.text).toContain('Page changes since your last look (+ added, - removed):');
  expect(menu.text).toMatch(/\n- +button "Filters" \[e\d+\] \(collapsed/);
  expect(menu.text).toMatch(/\n\+ +button "Filters" \[e\d+\] \(expanded/);
  expect(menu.text).toMatch(/\n\+ +button "Price: low to high" \[e\d+\]/);
  // Unchanged lines are counted, not repeated.
  expect(menu.text).not.toMatch(/\n {2}button "Trusted only"/);

  const again = await tool('computer', { action: 'hover', ref: refOf(tree, /Trusted only/) });
  expect(again.text).toMatch(/Hovered over .*\nNo visible change/);
});

test('a covered element fails with OBSCURED and no click is sent', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  const tree = (await tool('read_page')).text;
  const result = await tool('computer', { action: 'left_click', ref: refOf(tree, /Buy now/), action_summary: 'Buys the item' });
  expect(result.isError).toBe(true);
  expect(result.text).toMatch(/^OBSCURED: button "Buy now" is covered by region "Cookie consent" \(div#banner\)\. Close or accept that first \(find its button\), then try again\.\n\n<browser-state>/);
  await expect(page.locator('#covered')).toHaveText('Buy now');
});

test('typing, ctrl+a and keys reach the focused field', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  const notes = refOf((await tool('read_page')).text, /textbox "Notes"/);
  await tool('computer', { action: 'left_click', ref: notes, action_summary: 'Focuses the notes box' });
  const typed = await tool('computer', { action: 'type', text: 'ring bell', action_summary: 'Types delivery notes' });
  expect(typed.text).toMatch(/^Typed "ring bell" into textbox "Notes"\./);
  await tool('computer', { action: 'key', text: 'ctrl+a Backspace', action_summary: 'Clears the notes box' });
  await expect(page.locator('#notes')).toHaveValue('');
  await tool('computer', { action: 'type', text: 'gate 4', action_summary: 'Types delivery notes' });
  await expect(page.locator('#notes')).toHaveValue('gate 4');
});

test('form_input updates a framework-controlled input and reports old and new values', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  const ref = refOf((await tool('read_page')).text, /Controlled name/);
  const result = await tool('form_input', { ref, value: 'Test User', action_summary: 'Sets the name to Test User' });
  expect(result.text).toMatch(/^Set textbox "Controlled name" \[e\d+\] to "Test User" \(was ""\)\./);
  await expect(page.locator('#controlled-state')).toHaveText('state: "Test User"');

  await openPage(tool, sw, pages.url('/form.html'));
  const tree = (await tool('read_page')).text;
  await tool('form_input', { ref: refOf(tree, /combobox "Crust"/), value: 'Thin', action_summary: 'Picks the thin crust' });
  await tool('form_input', { ref: refOf(tree, /checkbox "Extra Cheese"/), value: true, action_summary: 'Adds extra cheese' });
  const after = (await tool('read_page')).text;
  expect(after).toMatch(/combobox "Crust" \[e\d+\] value="Thin"/);
  expect(after).toMatch(/checkbox "Extra Cheese" \[e\d+\] \(checked\)/);
  const bad = await tool('form_input', { ref: refOf(tree, /combobox "Crust"/), value: 'stuffed', action_summary: 'Picks a crust' });
  expect(bad.text).toMatch(/^INVALID_INPUT: combobox "Crust" has no option "stuffed"\. Options: "Thin" \("thin"\), "Deep dish" \("deep"\)\./);
});

test('navigate waits for loads, reports slow pages and follows pushState routes', async ({ tool, pages }) => {
  const first = await tool('navigate', { url: pages.url('/form.html') });
  expect(first.text).toMatch(new RegExp(`^Navigated to ${pages.url('/form.html').replace(/[.?]/g, '\\$&')} — "Pizza order"`));

  const withTree = await tool('navigate', { url: pages.url('/spa'), snapshot: true });
  expect(withTree.text).toContain('link "About"');
  const about = await tool('computer', { action: 'left_click', ref: refOf(withTree.text, /link "About"/), action_summary: 'Opens the About page' });
  expect(about.text).toContain(`URL changed to ${pages.url('/spa/about')}`);
  await expect.poll(async () => (await tool('read_page')).text).toContain('button "Contact"');

  const back = await tool('navigate', { url: 'back' });
  expect(back.text).toMatch(/^Navigated to .*\/spa — /);

  const slow = await tool('navigate', { url: pages.url('/slow?ms=17000') });
  expect(slow.text).toMatch(/^Still loading after 15 s: /);
});

test('navigating a just-created tab reports the requested page, not its about:blank', async ({ tool, pages }) => {
  // The group's first tab is created blank and is still committing it when navigate starts.
  for (const route of ['/tasks.html', '/form.html']) {
    const fresh = await tool('tabs_create', {});
    const tabId = Number(/Created tab (\d+)/.exec(fresh.text)?.[1]);
    const result = await tool('navigate', { url: pages.url(route), tabId });
    expect(result.text).toMatch(new RegExp(`^Navigated to ${pages.url(route).replace(/[.?]/g, '\\$&')} — "(Task board|Pizza order)" \\(waited for the load`));
  }
});

test('a link opening a new tab names it and adds it to the group', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const ref = refOf((await tool('read_page')).text, /Open form in new tab/);
  const result = await tool('computer', { action: 'left_click', ref, action_summary: 'Opens the form in a new tab' });
  const newTab = Number(/New tab (\d+) opened and joined this session/.exec(result.text)?.[1]);
  expect(newTab).toBeGreaterThan(0);
  const context = await tool('tabs_context');
  expect(context.text).toContain(`- ${newTab} `);
});

test('dialogs are reported, block page reads, and can be answered', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  // Playwright dismisses dialogs on its pages unless something listens; leave them to the agent.
  page.on('dialog', () => undefined);
  const ref = refOf((await tool('read_page')).text, /Delete item/);
  const click = await tool('computer', { action: 'left_click', ref, action_summary: 'Deletes the item' });
  expect(click.text).toContain('Dialog open: confirm "Delete item?"');
  const blocked = await tool('read_page');
  expect(blocked.text).toMatch(/^DIALOG_OPEN: Dialog open: confirm "Delete item\?"/);
  const answered = await tool('computer', { action: 'dialog', accept: true });
  expect(answered.text).toMatch(/^Accepted the confirm dialog "Delete item\?"\./);
  await expect(page.locator('#confirm-status')).toHaveText('deleted');
});

test('clicks reach a cross-origin iframe through its offset', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/frames.html'));
  await expect.poll(async () => (await tool('read_page')).text, { timeout: 15_000 }).toContain('Pay now');
  const tree = (await tool('read_page')).text;
  await tool('computer', { action: 'left_click', ref: refOf(tree, /iframe "Cross origin"/), action_summary: 'Focuses the iframe' });
  const result = await tool('computer', { action: 'left_click', ref: refOf(tree, /button "Pay now"/), action_summary: 'Pays in the iframe' });
  expect(result.isError).toBeFalsy();
  await expect.poll(async () => (await tool('read_page', { filter: 'all' })).text).toContain('paragraph "paid"');
  const card = refOf(tree, /textbox "Card number"/);
  const filled = await tool('form_input', { ref: card, value: '4242', action_summary: 'Types a test card number' });
  expect(filled.text).toMatch(/^Set textbox "Card number" \[e\d+\] to "4242"/);
});

test('file_upload reads files through the server and resize_window reports the viewport', async ({ tool, sw, pages, context, fake }) => {
  fake.files.set('uploads/cv.txt', new TextEncoder().encode('hello world'));
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  const ref = refOf((await tool('read_page')).text, /"Attachment"/);
  const result = await tool('file_upload', { ref, paths: ['uploads/cv.txt'] });
  expect(result.text).toMatch(/^Uploaded "cv\.txt" to .*Attachment/);
  await expect(page.locator('#file-status')).toHaveText('cv.txt:11');
  const missing = await tool('file_upload', { ref, paths: ['nope.txt'] });
  expect(missing.text).toMatch(/^INVALID_INPUT: Could not read "nope\.txt"/);

  const resized = await tool('resize_window', { width: 900, height: 700 });
  expect(resized.text).toMatch(/^Resized the window to 900x700\. The page viewport is now \d+x\d+\./);
  expect(SESSION).toBeTruthy();
});

test('a click shows a change elsewhere on the page in its diff (the cart count)', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/shop.html'));
  const tree = (await tool('read_page', { filter: 'all' })).text;
  // The second product's button: Red, Blue, Steel.
  const add = /\[(e\d+)\]/.exec(tree.split('\n').filter((l) => /button "Add to cart"/.test(l))[1]!)![1]!;
  const result = await tool('computer', { action: 'left_click', ref: add, action_summary: 'Adds the blue kettle to the cart' });
  expect(result.text).toMatch(/\n- +paragraph "Cart: 0 items"/);
  expect(result.text).toMatch(/\n\+ +paragraph "Cart: 1 item \(Blue kettle\)"/);
});

test('an action on a page the session has not read shows the whole windowed outline and says why', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/shop.html'));
  const found = (await tool('find', { query: 'Add to cart' })).text;
  const result = await tool('computer', { action: 'left_click', ref: refOf(found, /Add to cart/), action_summary: 'Adds a kettle to the cart' });
  expect(result.text).toContain('The page now (first look at this page in this session):');
  expect(result.text).toMatch(/button "Add to cart" \[e\d+\]/);
});

test('a target that does nothing is refused on the third try, and reading the page unlocks it', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/dead.html'));
  const page = await pageFor(context, pages.url('/dead.html'));
  const ref = refOf((await tool('read_page')).text, /Does nothing/);
  const click = () => tool('computer', { action: 'left_click', ref, action_summary: 'Presses the dead button' });
  expect((await click()).text).toContain('No visible change');
  expect((await click()).text).toContain('Note: this action had no effect 2 times on the same target');
  const third = await click();
  expect(third.text).toMatch(/^NO_EFFECT: /);
  expect(await page.evaluate(() => (window as unknown as { deadClicks: number }).deadClicks)).toBe(2);
  // The unverified click is in the state block, and done refuses success until the tab is read.
  expect(third.text).toContain('unverified: left_click');
  expect((await tool('done', { outcome: 'success', summary: 'Pressed it' })).text).toMatch(/^UNVERIFIED: /);
  await tool('read_page');
  expect((await click()).text).toContain('had no effect 3 times');
  expect(await page.evaluate(() => (window as unknown as { deadClicks: number }).deadClicks)).toBe(3);
  expect((await tool('done', { outcome: 'partial', summary: 'The button does nothing' })).text).toMatch(/^Done \(partial\)/);
});
