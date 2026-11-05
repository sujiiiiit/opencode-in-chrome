import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BrowserControls } from '@/components/chat/browser-controls';
import { BROWSER_ENABLED_KEY, STOPPED_KEY, TABS_KEY } from '@/lib/browser/settings';

let sent: unknown[];
beforeEach(async () => {
  fakeBrowser.reset();
  sent = [];
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
    sent.push(message);
    return { ok: true };
  });
  await fakeBrowser.storage.local.set({ [BROWSER_ENABLED_KEY]: true });
});

describe('BrowserControls', () => {
  it('renders nothing while browser access is off', async () => {
    await fakeBrowser.storage.local.set({ [BROWSER_ENABLED_KEY]: false });
    const { container } = render(<BrowserControls sessionID="ses_1" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it('shares the active web tab with the chat', async () => {
    vi.spyOn(fakeBrowser.tabs as unknown as { query: () => Promise<unknown[]> }, 'query').mockResolvedValue([{ id: 42, url: 'https://docs.example.com/', active: true }]);
    const user = userEvent.setup();
    render(<BrowserControls sessionID="ses_1" />);
    await user.click(await screen.findByRole('button', { name: 'Share this tab with the chat' }));
    await waitFor(() => expect(sent).toEqual([{ type: 'opencode.browser.share', sessionID: 'ses_1', tabId: 42 }]));
  });

  it('refuses to share a browser page and needs a session first', async () => {
    vi.spyOn(fakeBrowser.tabs as unknown as { query: () => Promise<unknown[]> }, 'query').mockResolvedValue([{ id: 7, url: 'chrome://settings/', active: true }]);
    const user = userEvent.setup();
    const { rerender } = render(<BrowserControls sessionID={undefined} />);
    expect(await screen.findByRole('button', { name: 'Share this tab with the chat' })).toBeDisabled();
    rerender(<BrowserControls sessionID="ses_1" />);
    await user.click(screen.getByRole('button', { name: 'Share this tab with the chat' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only web pages can be shared.');
    expect(sent).toEqual([]);
  });

  it('offers stop while the chat has tabs, then resume once stopped', async () => {
    await fakeBrowser.storage.session.set({ [TABS_KEY]: { ses_1: { groupId: 3, tabIds: [10], shared: [] } } });
    const user = userEvent.setup();
    render(<BrowserControls sessionID="ses_1" />);
    await user.click(await screen.findByRole('button', { name: 'Stop browser activity' }));
    expect(sent).toEqual([{ type: 'opencode.browser.stop' }]);
    await fakeBrowser.storage.session.set({ [STOPPED_KEY]: true });
    await user.click(await screen.findByRole('button', { name: 'Resume browser' }));
    expect(sent).toEqual([{ type: 'opencode.browser.stop' }, { type: 'opencode.browser.resume' }]);
  });
});
