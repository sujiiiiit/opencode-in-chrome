import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadConnection } from '@/lib/opencode/connection';
import {
  BASE,
  CODE,
  HOME_WIN,
  SERVER_INFO,
  TOKEN,
  jsonResponse,
  routeFetch,
  unauthorized,
} from '@/tests/support/testkit';
import { PairScreen } from '@/components/pair/pair-screen';

const LINK = `${BASE}/auth/connect/${CODE}`;

const serverRoutes = (extra: Record<string, () => Response> = {}) => ({
  'GET /api/info': (call: { headers: Headers }) =>
    call.headers.has('authorization') ? jsonResponse(SERVER_INFO) : unauthorized(),
  [`GET /auth/connect/${CODE}`]: () => jsonResponse({ token: TOKEN }),
  'GET /api/location': () => jsonResponse({ directory: HOME_WIN, project: { id: 'global' } }),
  'POST /api/experimental/fs/write': () => jsonResponse({ data: {} }),
  ...extra,
});

async function pasteAndConnect(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(/pairing link or code/i));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: /connect/i }));
}

describe('PairScreen', () => {
  it('shows the copy-do-not-open hint', () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PairScreen onPaired={vi.fn()} />);
    expect(screen.getByText(/copy the link/i)).toBeInTheDocument();
    expect(screen.getByText(/don.t open it/i)).toBeInTheDocument();
  });

  it('pairs from a pasted link and reports the connection', async () => {
    vi.stubGlobal('fetch', routeFetch(serverRoutes()));
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await pasteAndConnect(LINK);
    await waitFor(() => expect(onPaired).toHaveBeenCalledTimes(1));
    expect(onPaired.mock.calls[0]![0]).toMatchObject({ baseUrl: BASE, serverVersion: '2.2.5' });
    expect((await loadConnection())?.token).toBe(TOKEN);
  });

  it('prefills the detected server and pairs with a bare code', async () => {
    vi.stubGlobal('fetch', routeFetch(serverRoutes()));
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await waitFor(() => expect(screen.getByLabelText(/server address/i)).toHaveValue(BASE));
    await pasteAndConnect(CODE);
    await waitFor(() => expect(onPaired).toHaveBeenCalled());
  });

  it('suggests starting the service when no server is detected', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PairScreen onPaired={vi.fn()} />);
    expect(await screen.findByText(/opencode service start/i)).toBeInTheDocument();
  });

  it('shows the expired-code error', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch(serverRoutes({ [`GET /auth/connect/${CODE}`]: () => unauthorized('Pairing link expired or already used') })),
    );
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await pasteAndConnect(LINK);
    expect(await screen.findByRole('alert')).toHaveTextContent(/expired or used/i);
    expect(onPaired).not.toHaveBeenCalled();
  });

  it('shows the offline error', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PairScreen onPaired={vi.fn()} />);
    await pasteAndConnect(LINK);
    expect(await screen.findByRole('alert')).toHaveTextContent(/opencode service start/i);
  });

  it('rejects a non-loopback link without any request to it', async () => {
    const fetch = routeFetch(serverRoutes());
    vi.stubGlobal('fetch', fetch);
    render(<PairScreen onPaired={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/server address/i)).toHaveValue(BASE));
    const before = fetch.calls.length;
    await pasteAndConnect(`http://192.168.1.5:28894/auth/connect/${CODE}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(/127\.0\.0\.1|localhost/);
    expect(fetch.calls).toHaveLength(before);
  });

  it('shows a notice passed in (for example after a 401)', () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PairScreen onPaired={vi.fn()} notice="Session expired, pair again" />);
    expect(screen.getByText('Session expired, pair again')).toBeInTheDocument();
  });

  it('disables the button while connecting', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.stubGlobal(
      'fetch',
      routeFetch(serverRoutes({ [`GET /auth/connect/${CODE}`]: () => gate.then(() => jsonResponse({ token: TOKEN })) as never })),
    );
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await pasteAndConnect(LINK);
    expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled();
    release();
    await waitFor(() => expect(onPaired).toHaveBeenCalled());
  });
});
