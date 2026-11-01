import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CONNECTION_KEY, loadConnection } from '@/lib/opencode/connection';
import { detectServer, pairWithCode } from '@/lib/opencode/pair';
import { BASE, CODE, HOME_WIN, SERVER_INFO, TOKEN, jsonResponse, routeFetch, unauthorized } from '@/tests/support/testkit';

const okRoutes = () => ({
  [`GET /auth/connect/${CODE}`]: () => jsonResponse({ token: TOKEN }),
  'GET /api/info': () => jsonResponse(SERVER_INFO),
  'GET /api/location': () => jsonResponse({ directory: HOME_WIN, project: { id: 'global' } }),
  'POST /api/experimental/fs/write': () => jsonResponse({ data: {} }),
});

describe('pairWithCode', () => {
  it('redeems (200 -> token), verifies with /api/info and saves the connection', async () => {
    const fetch = routeFetch(okRoutes());
    const result = await pairWithCode({ baseUrl: BASE, code: CODE, fetch, now: () => 5 });
    expect(result).toMatchObject({ ok: true });
    expect(await loadConnection()).toEqual({
      baseUrl: BASE,
      token: TOKEN,
      expiresAt: 1796106971000,
      serverVersion: '2.2.5',
      pairedAt: 5,
    });
    const redeem = fetch.calls[0]!;
    expect(redeem.headers.get('accept')).toBe('application/json');
    expect(redeem.init.redirect).toBe('error');
    expect(redeem.headers.has('authorization')).toBe(false);
    const info = fetch.calls[1]!;
    expect(info.headers.get('authorization')).toBe('Basic ' + btoa('opencode:' + TOKEN));
  });

  it('bootstraps the workspace after pairing', async () => {
    const fetch = routeFetch(okRoutes());
    await pairWithCode({ baseUrl: BASE, code: CODE, fetch });
    expect(fetch.calls.some((c) => c.url.pathname === '/api/experimental/fs/write')).toBe(true);
  });

  it('still pairs when the workspace bootstrap fails (retried lazily in chat)', async () => {
    const fetch = routeFetch({ ...okRoutes(), 'GET /api/location': () => jsonResponse({}, 500) });
    expect(await pairWithCode({ baseUrl: BASE, code: CODE, fetch })).toMatchObject({ ok: true });
    expect(await loadConnection()).not.toBeNull();
  });

  it('401 on redeem -> expired/used message with the copy-do-not-open hint, nothing stored', async () => {
    const fetch = routeFetch({
      [`GET /auth/connect/${CODE}`]: () => unauthorized('Pairing link expired or already used'),
    });
    const result = await pairWithCode({ baseUrl: BASE, code: CODE, fetch });
    expect(result).toMatchObject({ ok: false, kind: 'expired' });
    expect(!result.ok && result.message).toMatch(/expired or used/i);
    expect(!result.ok && result.message).toMatch(/opencode pair/);
    expect((await fakeBrowser.storage.local.get(CONNECTION_KEY))[CONNECTION_KEY]).toBeUndefined();
  });

  it('transport error -> offline message', async () => {
    const result = await pairWithCode({ baseUrl: BASE, code: CODE, fetch: routeFetch({}) });
    expect(result).toMatchObject({ ok: false, kind: 'offline' });
    expect(!result.ok && result.message).toMatch(/opencode service start/);
  });

  it('refuses a redirect (the HTML flow burns the code) and does not follow it', async () => {
    const fetch = routeFetch({
      [`GET /auth/connect/${CODE}`]: (call) => {
        if (call.init.redirect === 'error') throw new TypeError('Failed to fetch (redirect)');
        return new Response(null, { status: 302, headers: { location: '/' } });
      },
    });
    const result = await pairWithCode({ baseUrl: BASE, code: CODE, fetch });
    expect(result.ok).toBe(false);
    expect(fetch.calls).toHaveLength(1);
  });

  it('rejects a malformed token from the server', async () => {
    const fetch = routeFetch({
      ...okRoutes(),
      [`GET /auth/connect/${CODE}`]: () => jsonResponse({ token: 'not a token' }),
    });
    const result = await pairWithCode({ baseUrl: BASE, code: CODE, fetch });
    expect(result).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await loadConnection()).toBeNull();
  });

  it('rejects a non-opencode response body', async () => {
    const fetch = routeFetch({ [`GET /auth/connect/${CODE}`]: () => jsonResponse({ hello: 'world' }) });
    expect(await pairWithCode({ baseUrl: BASE, code: CODE, fetch })).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('does not store the token when /api/info rejects it', async () => {
    const fetch = routeFetch({ ...okRoutes(), 'GET /api/info': () => unauthorized() });
    const result = await pairWithCode({ baseUrl: BASE, code: CODE, fetch });
    expect(result.ok).toBe(false);
    expect(await loadConnection()).toBeNull();
  });

  it('never leaks the token into the result', async () => {
    const fetch = routeFetch({ ...okRoutes(), 'GET /api/info': () => jsonResponse({ nope: 1 }) });
    const result = await pairWithCode({ baseUrl: BASE, code: CODE, fetch });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});

describe('detectServer', () => {
  it('returns the first loopback port answering 401 UnauthorizedError', async () => {
    const fetch = routeFetch({ 'GET /api/info': () => unauthorized() });
    expect(await detectServer(fetch)).toBe('http://127.0.0.1:28894');
    expect(fetch.calls.every((c) => !c.headers.has('authorization'))).toBe(true);
  });

  it('ignores non-opencode answers', async () => {
    const fetch = routeFetch({ 'GET /api/info': () => jsonResponse({ hi: 1 }, 401) });
    expect(await detectServer(fetch)).toBeNull();
  });

  it('returns null when nothing is listening', async () => {
    expect(await detectServer(routeFetch({}))).toBeNull();
  });
});
