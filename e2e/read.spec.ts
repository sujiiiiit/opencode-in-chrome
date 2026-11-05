import { expect, openPage, refOf, test } from './fixtures';

test('read_page lists form controls with state and stable refs', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/form.html'));
  const first = await tool('read_page');
  expect(first.isError).toBeFalsy();
  expect(first.text).toContain('textbox "Customer name:"');
  expect(first.text).toMatch(/textbox "Password:" \[e\d+\] type="password"/);
  expect(first.text).toMatch(/checkbox "Onion" \[e\d+\] \(disabled\)/);
  expect(first.text).toMatch(/combobox "Crust" \[e\d+\] value="Deep dish"/);
  expect(first.text).toMatch(/button "Submit order" \[e\d+\]/);
  expect(first.text).toMatch(/<untrusted_page_content id="[0-9a-f]+">/);
  expect(first.text).toMatch(/Viewport: 1280x\d+, scrolled to 0,0/);
  expect(first.text).toMatch(/<browser-state>\ncurrent tab: \d+ "Pizza order" "[^"]+\/form\.html" · rev \d+\n<\/browser-state>$/);
  const again = await tool('read_page');
  expect(refOf(again.text, /Submit order/)).toBe(refOf(first.text, /Submit order/));
});

test('read_page includes open and closed shadow roots', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/shadow.html'));
  const result = await tool('read_page');
  expect(result.text).toMatch(/button "Shadow Save" \[e\d+\]/);
  expect(result.text).toMatch(/textbox "shadow input" \[e\d+\]/);
  expect(result.text).toMatch(/button "Closed shadow btn" \[e\d+\]/);
});

test('read_page stitches same-origin and cross-origin iframes under their iframe lines', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/frames.html'));
  await expect.poll(async () => (await tool('read_page')).text, { timeout: 15_000 }).toContain('Pay now');
  const lines = (await tool('read_page')).text.split('\n');
  const same = lines.findIndex((l) => l.startsWith('iframe "Same origin"'));
  expect(lines[same + 1]).toMatch(/^ button "Iframe btn" \[e\d+\]/);
  const cross = lines.findIndex((l) => l.startsWith('iframe "Cross origin"'));
  expect(lines[cross]).toContain(`origin="${pages.otherOrigin}"`);
  expect(lines.slice(cross + 1, cross + 3).join('\n')).toMatch(/ textbox "Card number" \[e\d+\]\n button "Pay now" \[e\d+\]/);
});

test('read_page fails on browser pages and narrows to a subtree by ref', async ({ tool, sw, pages }) => {
  await tool('tabs_context', { createIfEmpty: true });
  const blank = await tool('read_page');
  expect(blank.text).toMatch(/^RESTRICTED_PAGE: /);
  await openPage(tool, sw, pages.url('/frames.html'));
  await expect.poll(async () => (await tool('read_page')).text, { timeout: 15_000 }).toContain('Pay now');
  const frameRef = refOf((await tool('read_page')).text, /iframe "Cross origin"/);
  const sub = await tool('read_page', { ref_id: frameRef });
  expect(sub.text).toContain('Pay now');
  expect(sub.text).not.toContain('Top button');
});

test('find returns the best match first without a model, and get_page_text reads main text', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/form.html'));
  const found = await tool('find', { query: 'submit order button' });
  expect(found.text).toMatch(/^<untrusted_page_content[^\n]*\ne\d+: button "Submit order"/);
  const none = await tool('find', { query: 'shopping cart' });
  expect(none.text).toMatch(/^No element matched/);
  const text = await tool('get_page_text');
  expect(text.text).toMatch(/^Title: Pizza order\nURL: http:\/\/127\.0\.0\.1:\d+\/form\.html\nSource element: <body>/);
  expect(text.text).toContain('Order a pizza');
});

test('read_page lists the window around the viewport and counts what lies outside', async ({ tool, sw, pages }) => {
  await openPage(tool, sw, pages.url('/tall.html'));
  const near = (await tool('read_page')).text;
  expect(near).toContain('button "Section 0"');
  expect(near).not.toContain('button "Section 12"');
  expect(near).toMatch(/… 0 more actionable elements above and \d+ below the window/);
  const whole = (await tool('read_page', { window: 'page' })).text;
  expect(whole).toContain('button "Section 19"');
  expect(whole).not.toMatch(/more actionable elements/);
  // After scrolling to the bottom, the window follows the viewport.
  await tool('computer', { action: 'scroll_to', ref: refOf(whole, /button "Section 19"/), action_summary: 'Scrolls to the last section' });
  const bottom = (await tool('read_page', { window: 'viewport' })).text;
  expect(bottom).toContain('button "Section 19"');
  expect(bottom).toMatch(/… \d+ more actionable elements above and 0 below the viewport/);
});
