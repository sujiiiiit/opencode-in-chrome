import { expect, test } from './fixtures';
import { AGENTS, CONFIG, PROVIDERS } from '../tests/support/testkit';

test('header buttons share a tooltip', async ({ connect, context, extensionId }) => {
  await connect();
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.getByRole('button', { name: 'Settings' }).hover();
  await expect(page.locator('[data-slot="tooltip"]')).toHaveText('Settings');
  await page.getByRole('button', { name: 'History' }).hover();
  await expect(page.locator('[data-slot="tooltip"]')).toHaveText('History');
  await expect(page.locator('[data-slot="tooltip"]')).toHaveCount(1);
});

test('model picker animates open and closes from its trigger', async ({ connect, context, extensionId }) => {
  await connect();
  const page = await context.newPage();
  await page.route(/\/api\/(provider|agent|config)(\?.*)?$/, async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const body = name === 'provider' ? PROVIDERS : name === 'agent' ? AGENTS : CONFIG;
    await route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const trigger = page.locator('[data-slot="model-chip"]');
  await expect(trigger).toBeEnabled();
  await page.evaluate(() => {
    (window as Window & { pickerTransitions?: string[] }).pickerTransitions = [];
    document.addEventListener('transitionrun', (event) => {
      if ((event.target as Element).getAttribute('data-slot') === 'model-picker') {
        (window as Window & { pickerTransitions?: string[] }).pickerTransitions?.push(event.propertyName);
      }
    });
  });
  await trigger.click();
  const picker = page.locator('[data-slot="model-picker"]');
  await expect(picker).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { pickerTransitions?: string[] }).pickerTransitions ?? []))
    .toContain('opacity');
  await trigger.click();
  await expect(picker).not.toBeVisible();
});
