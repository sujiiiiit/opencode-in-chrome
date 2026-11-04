// Adopts the session the opencode web UI holds in this browser. Opening an
// `opencode pair` link in a tab redeems the code and sets an HttpOnly cookie
// `opencode_session_<port>` on the loopback host; its value is an API token
// (`<expiresUnixSeconds>.<sig>`) that also works as our Basic credential.
// The cookie itself is never sent by us: the server refuses cross-origin
// cookie auth, so we read it with the cookies API and send it as a header.

import { browser, type Browser } from 'wxt/browser';
import { isValidToken, tokenExpiry } from './connection';
import { normalizeBaseUrl } from './link';

export type BrowserSession = { baseUrl: string; token: string };

const COOKIE_RE = /^opencode_session_(\d{1,5})$/;
const LOOPBACK_DOMAINS = ['127.0.0.1', 'localhost'];

type CookieLike = Pick<Browser.cookies.Cookie, 'name' | 'value' | 'domain'>;

/** The session a cookie carries, or null when it is not a live opencode session cookie. */
export function sessionFromCookie(cookie: CookieLike, now = Date.now()): BrowserSession | null {
  const port = COOKIE_RE.exec(cookie.name)?.[1];
  if (!port || !LOOPBACK_DOMAINS.includes(cookie.domain)) return null;
  if (!isValidToken(cookie.value) || tokenExpiry(cookie.value) <= now) return null;
  const base = normalizeBaseUrl(`http://${cookie.domain}:${port}`);
  return base.ok ? { baseUrl: base.baseUrl, token: cookie.value } : null;
}

/** A live session cookie already in this browser, preferring `preferredBaseUrl`. */
export async function findBrowserSession(preferredBaseUrl?: string | null): Promise<BrowserSession | null> {
  try {
    const lists = await Promise.all(LOOPBACK_DOMAINS.map((domain) => browser.cookies.getAll({ domain })));
    const sessions = lists.flat().flatMap((cookie) => sessionFromCookie(cookie) ?? []);
    return sessions.find((s) => s.baseUrl === preferredBaseUrl) ?? sessions[0] ?? null;
  } catch {
    // No cookies permission (or API) in this browser: fall back to pasting a link.
    return null;
  }
}

/** Calls `onSession` whenever a pairing link is opened in this browser. Returns an unsubscribe. */
export function watchBrowserSession(onSession: (session: BrowserSession) => void): () => void {
  const listener = ({ cookie, removed }: Browser.cookies.CookieChangeInfo) => {
    if (removed) return;
    const session = sessionFromCookie(cookie);
    if (session) onSession(session);
  };
  try {
    browser.cookies.onChanged.addListener(listener);
  } catch {
    return () => undefined;
  }
  return () => browser.cookies.onChanged.removeListener(listener);
}
