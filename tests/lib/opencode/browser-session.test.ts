import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { findBrowserSession, sessionFromCookie, watchBrowserSession } from '@/lib/opencode/browser-session';
import { BASE, TOKEN } from '@/tests/support/testkit';

const NOW = 1_700_000_000_000; // before TOKEN's expiry (1796106971 s)
const cookie = (over: Partial<{ name: string; value: string; domain: string }> = {}) => ({
  name: 'opencode_session_28894',
  value: TOKEN,
  domain: '127.0.0.1',
  ...over,
});

describe('sessionFromCookie', () => {
  it('reads the base URL from the cookie name and the token from its value', () => {
    expect(sessionFromCookie(cookie(), NOW)).toEqual({ baseUrl: BASE, token: TOKEN });
    expect(sessionFromCookie(cookie({ domain: 'localhost', name: 'opencode_session_4096' }), NOW)).toEqual({
      baseUrl: 'http://localhost:4096',
      token: TOKEN,
    });
  });

  it('ignores other cookies, non-loopback hosts, malformed and expired tokens', () => {
    expect(sessionFromCookie(cookie({ name: 'other' }), NOW)).toBeNull();
    expect(sessionFromCookie(cookie({ domain: 'example.com' }), NOW)).toBeNull();
    expect(sessionFromCookie(cookie({ value: 'not a token' }), NOW)).toBeNull();
    expect(sessionFromCookie(cookie(), 1796106971000)).toBeNull();
  });
});

describe('findBrowserSession', () => {
  it('prefers the session for the detected server', async () => {
    vi.spyOn(fakeBrowser.cookies, 'getAll').mockImplementation((async ({ domain }: { domain?: string }) =>
      domain === '127.0.0.1'
        ? [cookie({ name: 'opencode_session_1111' }), cookie(), cookie({ name: 'unrelated' })]
        : []) as never);
    expect(await findBrowserSession(BASE)).toEqual({ baseUrl: BASE, token: TOKEN });
    expect((await findBrowserSession(null))?.baseUrl).toBe('http://127.0.0.1:1111');
  });

  it('returns null when the cookies API is unavailable', async () => {
    vi.spyOn(fakeBrowser.cookies, 'getAll').mockRejectedValue(new Error('no permission'));
    expect(await findBrowserSession(BASE)).toBeNull();
  });
});

describe('watchBrowserSession', () => {
  it('reports set session cookies, skips removals, and unsubscribes', () => {
    let listener!: (info: { cookie: ReturnType<typeof cookie>; removed: boolean }) => void;
    vi.spyOn(fakeBrowser.cookies.onChanged, 'addListener').mockImplementation(((l: never) => (listener = l)) as never);
    const remove = vi.spyOn(fakeBrowser.cookies.onChanged, 'removeListener').mockImplementation((() => undefined) as never);
    const onSession = vi.fn();
    const unwatch = watchBrowserSession(onSession);
    listener({ cookie: cookie(), removed: true });
    listener({ cookie: cookie({ name: 'unrelated' }), removed: false });
    listener({ cookie: cookie(), removed: false });
    expect(onSession).toHaveBeenCalledExactlyOnceWith({ baseUrl: BASE, token: TOKEN });
    unwatch();
    expect(remove).toHaveBeenCalledWith(listener);
  });
});
