import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BrowserSection } from '@/components/settings/browser-section';
import { siteFromInput } from '@/components/settings/use-browser-settings';
import { BROWSER_ENABLED_KEY, loadPolicy, POLICY_KEY } from '@/lib/browser/settings';

beforeEach(() => fakeBrowser.reset());

describe('BrowserSection', () => {
  it('starts with browser access on and persists an explicit off choice', async () => {
    const user = userEvent.setup();
    render(<BrowserSection />);
    const toggle = await screen.findByRole('switch', { name: 'Let chats use the browser' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await waitFor(async () => expect((await fakeBrowser.storage.local.get(BROWSER_ENABLED_KEY))[BROWSER_ENABLED_KEY]).toBe(false));
    await waitFor(() => expect(toggle).not.toBeChecked());
  });

  it('switches the approval mode', async () => {
    const user = userEvent.setup();
    render(<BrowserSection />);
    await user.click(await screen.findByText('Act on allowed sites'));
    await waitFor(async () => expect((await loadPolicy()).mode).toBe('act'));
  });

  it('adds a site from a URL, changes its rule, marks it sensitive and removes it', async () => {
    const user = userEvent.setup();
    render(<BrowserSection />);
    expect(await screen.findByText(/No sites yet/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Add a site' }), 'https://mail.google.com/mail/u/0');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const row = await screen.findByText('google.com');
    const item = within(row.closest('li')!);
    await user.click(item.getByText('Block'));
    await waitFor(async () => expect((await loadPolicy()).sites['google.com']).toEqual({ rule: 'block' }));
    await user.click(item.getByText('Sensitive'));
    await waitFor(async () => expect((await loadPolicy()).sites['google.com']).toEqual({ rule: 'block', sensitive: true }));
    await user.click(item.getByRole('button', { name: 'Remove google.com' }));
    await waitFor(async () => expect((await loadPolicy()).sites).toEqual({}));
  });

  it('shows sites the worker saved while chatting', async () => {
    await fakeBrowser.storage.local.set({ [POLICY_KEY]: { mode: 'ask', sites: { 'shop.test': { rule: 'allow' } } } });
    render(<BrowserSection />);
    expect(await screen.findByText('shop.test')).toBeInTheDocument();
  });
});

describe('siteFromInput', () => {
  it.each([
    ['google.com', 'google.com'],
    ['https://mail.google.com/x', 'google.com'],
    ['  BBC.co.uk ', 'bbc.co.uk'],
    ['', ''],
  ])('%s → %s', (input, site) => expect(siteFromInput(input)).toBe(site));
});
