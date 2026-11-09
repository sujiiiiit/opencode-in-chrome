import type { BrowserContext, Page } from '@playwright/test';
import { expect, openPage, refOf, test } from './fixtures';

async function pageFor(context: BrowserContext, url: string): Promise<Page> {
  await expect.poll(() => context.pages().some((p) => p.url() === url)).toBe(true);
  return context.pages().find((p) => p.url() === url)!;
}

test('typing reaches a contenteditable rich text editor and fires its input events', async ({ tool, sw, pages, context }) => {
  await openPage(tool, sw, pages.url('/editor.html'));
  const page = await pageFor(context, pages.url('/editor.html'));
  const ref = refOf((await tool('find', { query: 'message body' })).text, /Message body/);
  await tool('computer', { action: 'left_click', ref, action_summary: 'Focuses the message body' });
  const typed = await tool('computer', { action: 'type', text: 'Hello from the agent', action_summary: 'Writes the message' });
  expect(typed.isError).toBeFalsy();
  await expect(page.locator('#editor')).toHaveText('Hello from the agent');
  await expect(page.locator('#count')).toHaveText('4');
  await tool('computer', { action: 'key', text: 'ctrl+a Backspace', action_summary: 'Clears the message' });
  await expect(page.locator('#editor')).toHaveText('');
});
