import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
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
import logoLight from '@/assets/opencode-logo-light.svg';
import logoDark from '@/assets/opencode-logo-dark.svg';

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
  await user.click(screen.getAllByRole('button', { name: /^connect$/i }).at(-1)!);
}

const sessionCookie = (value = TOKEN) => ({ name: 'opencode_session_28894', value, domain: '127.0.0.1' });

function stubCookies(cookies: ReturnType<typeof sessionCookie>[]) {
  const listeners: ((info: { cookie: ReturnType<typeof sessionCookie>; removed: boolean }) => void)[] = [];
  vi.spyOn(fakeBrowser.cookies, 'getAll').mockImplementation((async ({ domain }: { domain?: string }) =>
    cookies.filter((c) => c.domain === domain)) as never);
  vi.spyOn(fakeBrowser.cookies.onChanged, 'addListener').mockImplementation(((l: never) => listeners.push(l)) as never);
  vi.spyOn(fakeBrowser.cookies.onChanged, 'removeListener').mockImplementation((() => undefined) as never);
  return { set: (cookie = sessionCookie()) => listeners.forEach((l) => l({ cookie, removed: false })) };
}

describe('PairScreen', () => {
  it('copies the pairing command when clicked', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    const user = userEvent.setup();
    render(<PairScreen onPaired={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /copy opencode pair command/i }));
    expect(await navigator.clipboard.readText()).toBe('opencode pair');
    expect(screen.getByText('Copied')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /copy opencode pair command/i })).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows the pairing command and OpenCode logo', () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PairScreen onPaired={vi.fn()} />);
    expect(screen.getByText(/need a link/i)).toBeInTheDocument();
    const sources = Array.from(document.querySelectorAll('img'), (image) => image.getAttribute('src'));
    expect(sources).toEqual(expect.arrayContaining([logoLight, logoDark]));
  });

  it('offers one-click Connect when the browser already has an opencode session', async () => {
    const fetch = routeFetch(serverRoutes());
    vi.stubGlobal('fetch', fetch);
    stubCookies([sessionCookie()]);
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await screen.findByText(/session found/i);
    expect(screen.queryByLabelText(/pairing link or code/i)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() => expect(onPaired).toHaveBeenCalledTimes(1));
    expect((await loadConnection())?.token).toBe(TOKEN);
    expect(fetch.calls.some((c) => c.url.pathname.startsWith('/auth/connect'))).toBe(false);
  });

  it('connects on its own when a pairing link is opened in a tab', async () => {
    vi.stubGlobal('fetch', routeFetch(serverRoutes()));
    const cookies = stubCookies([]);
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /server settings/i }));
    await waitFor(() => expect(screen.getByLabelText(/server address/i)).toHaveValue(BASE));
    cookies.set();
    await waitFor(() => expect(onPaired).toHaveBeenCalledTimes(1));
    expect(onPaired.mock.calls[0]![0]).toMatchObject({ baseUrl: BASE, token: TOKEN });
  });

  it('shows an error when the browser session is rejected', async () => {
    vi.stubGlobal('fetch', routeFetch(serverRoutes({ 'GET /api/info': () => unauthorized() })));
    stubCookies([sessionCookie()]);
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await screen.findByText(/session found/i);
    await userEvent.setup().click(screen.getByRole('button', { name: /^connect$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i);
    expect(onPaired).not.toHaveBeenCalled();
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
    await userEvent.setup().click(screen.getByRole('button', { name: /server settings/i }));
    await waitFor(() => expect(screen.getByLabelText(/server address/i)).toHaveValue(BASE));
    await userEvent.setup().click(screen.getByRole('button', { name: /back to connect/i }));
    await pasteAndConnect(CODE);
    await waitFor(() => expect(onPaired).toHaveBeenCalled());
  });

  it('does not show an offline warning before a connection attempt', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    render(<PairScreen onPaired={vi.fn()} />);
    await screen.findByLabelText(/pairing link or code/i);
    expect(screen.queryByText(/no local server found/i)).not.toBeInTheDocument();
  });

  it('allows pairing with a link when a browser session exists', async () => {
    vi.stubGlobal('fetch', routeFetch(serverRoutes()));
    stubCookies([sessionCookie()]);
    const onPaired = vi.fn();
    render(<PairScreen onPaired={onPaired} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /use a pairing link/i }));
    await pasteAndConnect(LINK);
    await waitFor(() => expect(onPaired).toHaveBeenCalledTimes(1));
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
    await userEvent.setup().click(screen.getByRole('button', { name: /server settings/i }));
    await waitFor(() => expect(screen.getByLabelText(/server address/i)).toHaveValue(BASE));
    await userEvent.setup().click(screen.getByRole('button', { name: /back to connect/i }));
    const before = fetch.calls.length;
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/pairing link or code/i));
    await user.paste(`http://192.168.1.5:28894/auth/connect/${CODE}`);
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeDisabled();
    await user.tab();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetch.calls).toHaveLength(before);
  });

  it('enables Connect only for a valid pairing link or code with a server', async () => {
    vi.stubGlobal('fetch', routeFetch({}));
    const user = userEvent.setup();
    render(<PairScreen onPaired={vi.fn()} />);
    const input = screen.getByLabelText(/pairing link or code/i);
    const connect = screen.getByRole('button', { name: /^connect$/i });
    expect(connect).toBeDisabled();
    await user.type(input, 'short');
    expect(connect).toBeDisabled();
    await user.clear(input);
    await user.type(input, CODE);
    expect(connect).toBeDisabled();
    await user.clear(input);
    await user.paste(LINK);
    expect(connect).toBeEnabled();
    await user.clear(input);
    expect(connect).toBeDisabled();
  });

  it('keeps the edited server address when returning to connect', async () => {
    vi.stubGlobal('fetch', routeFetch(serverRoutes()));
    const user = userEvent.setup();
    render(<PairScreen onPaired={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /server settings/i }));
    const address = screen.getByLabelText(/server address/i);
    await waitFor(() => expect(address).toHaveValue(BASE));
    await user.clear(address);
    await user.type(address, 'http://localhost:28894');
    await user.click(screen.getByRole('button', { name: /back to connect/i }));
    await user.click(screen.getByRole('button', { name: /server settings/i }));
    expect(screen.getByLabelText(/server address/i)).toHaveValue('http://localhost:28894');
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
