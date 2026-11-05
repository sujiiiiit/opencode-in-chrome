import type { BrowserContext, Page } from '@playwright/test';
import { expect, openPage, refOf, SESSION, test } from './fixtures';

// 1920 wide: the coordinate frame is 1568 wide, so clicks must be mapped back to CSS pixels.
test.use({ viewportSize: { width: 1920, height: 900 } });

async function pageFor(context: BrowserContext, url: string): Promise<Page> {
  await expect.poll(() => context.pages().some((p) => p.url() === url)).toBe(true);
  return context.pages().find((p) => p.url() === url)!;
}

test.beforeEach(({ fake }) => {
  fake.setSessionModel(SESSION, { providerID: 'anthropic', id: 'claude-sonnet-5-5' });
});

test('screenshots use the 1568 px frame and a coordinate from a 0.5-scale shot hits the button', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  // Background tabs do not paint: bring the agent tab to the front, as the user would see it.
  await page.bringToFront();
  const shot = await tool('computer', { action: 'screenshot', scale: 0.5 });
  expect(shot.text).toMatch(/^Screenshot ss_\w+ \(784x368 jpeg\) — coordinate frame 1568x735 — 0\.5-scale view/);
  const image = shot.content.find((c) => c.type === 'image');
  expect(image).toMatchObject({ type: 'image', mimeType: 'image/jpeg' });

  const box = (await page.locator('#trusted').boundingBox())!;
  const frameX = Math.round(((box.x + box.width / 2) * 1568) / 1920);
  const frameY = Math.round(((box.y + box.height / 2) * 735) / 900);
  const click = await tool('computer', { action: 'left_click', coordinate: [frameX, frameY], action_summary: 'Presses the trusted button' });
  expect(click.text).toMatch(/^Clicked \(\d+, \d+\)\./);
  await expect(page.locator('#trusted-status')).toHaveText('trusted click');

  const zoom = await tool('computer', { action: 'zoom', region: [0, 0, 400, 200] });
  expect(zoom.text).toMatch(/^Zoomed region \(0,0,400,200\) of the 1568x735 frame — \d+x\d+ jpeg/);
});

test('a text-only model is told to use read_page instead of screenshots', async ({ tool, sw, pages, fake }) => {
  fake.setSessionModel(SESSION, { providerID: 'kilo', id: 'kilo-auto/free' });
  await openPage(tool, sw, pages.url('/form.html'));
  const shot = await tool('computer', { action: 'screenshot' });
  expect(shot.isError).toBe(true);
  expect(shot.text).toMatch(/does not accept images.*Use read_page or find instead/);
});

test('the agent indicator is on agent tabs, hidden during a capture, and not in the page tree', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  await page.bringToFront();
  const indicator = page.locator('[data-opencode-indicator]');
  await expect(indicator).toHaveCount(1);
  await expect(indicator).toBeVisible();
  // Record every display change of the indicator while a screenshot is taken.
  await page.evaluate(() => {
    const host = document.querySelector('[data-opencode-indicator]') as HTMLElement;
    (window as unknown as { __displays: string[] }).__displays = [];
    new MutationObserver(() => (window as unknown as { __displays: string[] }).__displays.push(host.style.display)).observe(host, { attributes: true });
  });
  await tool('computer', { action: 'screenshot' });
  expect(await page.evaluate(() => (window as unknown as { __displays: string[] }).__displays)).toEqual(['none', 'block']);
  expect((await tool('read_page', { filter: 'all' })).text).not.toContain('Opencode is using this tab');
});

test('upload_image puts a screenshot into a file input and drops it on a target', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  await page.bringToFront();
  const shot = await tool('computer', { action: 'screenshot', scale: 0.3 });
  const id = /Screenshot (ss_\w+)/.exec(shot.text)![1]!;
  const ref = refOf((await tool('read_page')).text, /"Attachment"/);
  const up = await tool('upload_image', { imageId: id, ref, filename: 'page.jpg' });
  expect(up.text).toMatch(/^Uploaded "page\.jpg" to /);
  await expect(page.locator('#file-status')).toHaveText(/^page\.jpg:\d+$/);

  const drop = (await page.locator('#drop').boundingBox())!;
  const dropped = await tool('upload_image', {
    imageId: id,
    coordinate: [Math.round(((drop.x + 20) * 1568) / 1920), Math.round(((drop.y + 20) * 735) / 900)],
  });
  expect(dropped.text).toMatch(/^Dropped "image\.png"/);
  await expect(page.locator('#drop-status')).toHaveText('image.png');
  expect((await tool('upload_image', { imageId: 'ss_missing', ref })).text).toMatch(/^STALE_REF: Screenshot ss_missing is no longer kept/);
});

test('gif records actions and exports a download', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/actions.html'));
  const page = await pageFor(context, pages.url('/actions.html'));
  await page.bringToFront();
  expect((await tool('gif', { action: 'export', filename: 'none.gif' })).text).toMatch(/^INVALID_INPUT: Nothing was recorded/);
  await tool('gif', { action: 'start_recording' });
  const tree = (await tool('read_page')).text;
  await tool('computer', { action: 'left_click', ref: refOf(tree, /Filters/), action_summary: 'Opens the Filters menu' });
  await tool('computer', { action: 'left_click', ref: refOf(tree, /Trusted only/), action_summary: 'Presses the trusted button' });
  const stopped = await tool('gif', { action: 'stop_recording' });
  expect(stopped.text).toMatch(/^Stopped recording with 4 frame\(s\)/);
  const exported = await tool('gif', { action: 'export', filename: 'checkout.gif' });
  expect(exported.text).toMatch(/^Exported 4 frame\(s\) to the download "checkout\.gif"/);
  // Playwright stores downloads under generated names, so find it by its URL and type.
  await expect
    .poll(() =>
      sw.evaluate(async () =>
        (await chrome.downloads.search({}))
          .filter((d: { url: string }) => d.url.startsWith('data:image/gif'))
          .map((d: { state: string; fileSize: number }) => (d.fileSize > 1000 ? d.state : 'tiny')),
      ),
    )
    .toContain('complete');
});
