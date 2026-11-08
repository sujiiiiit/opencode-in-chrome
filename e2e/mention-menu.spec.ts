import { expect, test } from './fixtures';

test.use({ viewportSize: { width: 360, height: 850 } });

test('mention menus reopen, filter, recover from no matches, and select without sending', async ({ connect, context, extensionId }) => {
  await connect();
  const page = await context.newPage();
  await page.route(/\/api\/(agent|skill|command|reference)(\?.*)?$/, async (route) => {
    const kind = new URL(route.request().url()).pathname.split('/').pop();
    const data = kind === 'agent' ? [{ name: 'explore', mode: 'subagent' }, { name: 'general', mode: 'subagent' }]
      : kind === 'skill' ? [{ id: 'pdf' }]
        : kind === 'command' ? [{ name: 'review' }] : [];
    await route.fulfill({ json: { location: { directory: 'C:/workspace' }, data }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const editor = page.getByRole('textbox', { name: 'Message' });
  await editor.click();

  for (const trigger of ['@', '/']) {
    await page.keyboard.type(trigger);
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.locator('[data-slot="mention-hint"]')).toHaveText('Type to filter');
    await expect(editor).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await page.keyboard.press('Backspace');
    await page.keyboard.type(trigger);
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.locator('[data-slot="mention-hint"]')).toBeVisible();
    await page.keyboard.type('zzzz');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.locator('[data-slot="mention-hint"]')).toHaveCount(0);
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
    await expect(page.locator('[data-slot="mention-hint"]')).toBeVisible();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Backspace');
  }

  await page.keyboard.type('@gen');
  await expect(page.getByRole('option', { name: 'general' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(editor.locator('[data-mention="agent"]')).toHaveText('@general');
  await expect(editor).toBeFocused();
});
