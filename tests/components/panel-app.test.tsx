import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadConnection, saveConnection, type Connection } from '@/lib/opencode/connection';
import { BASE, TOKEN, fakeServer, routeFetch, unauthorized } from '@/tests/support/testkit';
import PanelApp from '@/components/panel-app';

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

  it('on a 401 clears the connection and returns to the pair screen with a notice', async () => {
    await saveConnection(connection);
    vi.stubGlobal('fetch', fakeServer({ overrides: { 'GET /api/event': () => unauthorized() } }).fetch);
    render(<PanelApp />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: /message/i }), 'hi{Enter}');
    expect(await screen.findByLabelText(/pairing link or code/i)).toBeInTheDocument();
    expect(screen.getByText(/session expired, pair again/i)).toBeInTheDocument();
    expect(await loadConnection()).toBeNull();
  });

  it('Unpair clears the connection', async () => {
    await saveConnection(connection);
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PanelApp />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /unpair/i }));
    await screen.findByLabelText(/pairing link or code/i);
    await waitFor(async () => expect(await loadConnection()).toBeNull());
  });

  it('ignores an expired token and shows the pair screen', async () => {
    await saveConnection({ ...connection, expiresAt: Date.now() - 1000 });
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PanelApp />);
    expect(await screen.findByLabelText(/pairing link or code/i)).toBeInTheDocument();
  });
});
