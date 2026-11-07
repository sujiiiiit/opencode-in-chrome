import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CONNECTION_KEY, loadConnection, saveConnection, type Connection } from '@/lib/opencode/connection';
import { fakeOpencode } from '@/tests/support/queue-server';
import { BASE, TOKEN, routeFetch, unauthorized } from '@/tests/support/testkit';
import PanelApp from '@/components/panel-app';
import { SettingsPage } from '@/components/settings/settings-page';

vi.mock('@/components/settings/models-section', () => ({ ModelsSection: () => null }));
vi.mock('@/components/settings/web-search-section', () => ({ WebSearchSection: () => null }));
vi.mock('@/components/settings/browser-section', () => ({ BrowserSection: () => null }));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: Date.now() + 20 * 86_400_000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

describe('PanelApp routing', () => {
  it('shows the pair screen when there is no connection', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PanelApp />);
    expect(await screen.findByLabelText(/pairing link or code/i)).toBeInTheDocument();
  });

  it('shows the chat screen when a connection is stored', async () => {
    await saveConnection(connection);
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PanelApp />);
    expect(await screen.findByRole('textbox', { name: /message/i })).toBeInTheDocument();
  });

  it('logs out from settings and returns an open panel to pairing', async () => {
    await saveConnection(connection);
    const storageListeners: Array<(changes: Record<string, { newValue?: unknown }>, area: string) => void> = [];
    vi.spyOn(fakeBrowser.storage.onChanged, 'addListener').mockImplementation((listener) => {
      storageListeners.push(listener as (typeof storageListeners)[number]);
    });
    vi.stubGlobal('fetch', routeFetch({}));
    render(<><PanelApp /><SettingsPage /></>);
    expect(await screen.findByRole('textbox', { name: /message/i })).toBeInTheDocument();
    await userEvent.setup().click(await screen.findByRole('button', { name: /log out/i }));
    expect(await loadConnection()).toBeNull();
    act(() => storageListeners.forEach((listener) => listener({ [CONNECTION_KEY]: { newValue: undefined } }, 'local')));
    expect(await screen.findByLabelText(/pairing link or code/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('on a 401 (seen as soon as the chat connects) clears the connection and returns to the pair screen', async () => {
    await saveConnection(connection);
    vi.stubGlobal('fetch', fakeOpencode({ overrides: { 'GET /api/event': () => unauthorized() } }).fetch);
    render(<PanelApp />);
    expect(await screen.findByLabelText(/pairing link or code/i)).toBeInTheDocument();
    expect(screen.getByText(/session expired, pair again/i)).toBeInTheDocument();
    expect(await loadConnection()).toBeNull();
  });

  it('ignores an expired token and shows the pair screen', async () => {
    await saveConnection({ ...connection, expiresAt: Date.now() - 1000 });
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PanelApp />);
    expect(await screen.findByLabelText(/pairing link or code/i)).toBeInTheDocument();
  });
});
