import { describe, expect, it } from 'vitest';
import { createClient, describeError, isUnauthorized } from '@/lib/opencode/client';
import { BASE, SERVER_INFO, TOKEN, jsonResponse, routeFetch, unauthorized } from '@/tests/support/testkit';

describe('createClient', () => {
  it('sends the Basic auth header to the paired base URL only', async () => {
    const fetch = routeFetch({ 'GET /api/info': () => jsonResponse(SERVER_INFO) });
    const client = createClient({ baseUrl: BASE, token: TOKEN, fetch });
    await client.server.info();
    const call = fetch.calls[0]!;
    expect(call.url.origin).toBe(BASE);
    expect(call.headers.get('authorization')).toBe('Basic ' + btoa('opencode:' + TOKEN));
    expect(call.url.search).not.toContain('auth_token');
    expect(call.url.toString()).not.toContain(TOKEN);
  });

  it('sends no auth header without a token', async () => {
    const fetch = routeFetch({ 'GET /api/info': () => jsonResponse(SERVER_INFO) });
    await createClient({ baseUrl: BASE, fetch }).server.info();
    expect(fetch.calls[0]!.headers.has('authorization')).toBe(false);
  });

  it('refuses redirects and applies a timeout signal', async () => {
    const fetch = routeFetch({ 'GET /api/info': () => jsonResponse(SERVER_INFO) });
    await createClient({ baseUrl: BASE, token: TOKEN, fetch }).server.info();
    const init = fetch.calls[0]!.init;
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps a caller abort signal working alongside the timeout', async () => {
    const abort = new AbortController();
    const fetch = routeFetch({ 'GET /api/info': () => jsonResponse(SERVER_INFO) });
    await createClient({ baseUrl: BASE, token: TOKEN, fetch }).server.info({ signal: abort.signal });
    const signal = fetch.calls[0]!.init.signal!;
    expect(signal.aborted).toBe(false);
    abort.abort();
    expect(signal.aborted).toBe(true);
  });
});

describe('error helpers', () => {
  it('detects 401 as a parsed UnauthorizedError body', async () => {
    const fetch = routeFetch({ 'GET /api/info': () => unauthorized() });
    const err = await createClient({ baseUrl: BASE, token: TOKEN, fetch }).server.info().catch((e: unknown) => e);
    expect(isUnauthorized(err)).toBe(true);
  });

  it('maps transport failures to the offline message', async () => {
    const fetch = routeFetch({});
    const err = await createClient({ baseUrl: BASE, token: TOKEN, fetch }).server.info().catch((e: unknown) => e);
    expect(isUnauthorized(err)).toBe(false);
    expect(describeError(err)).toMatch(/opencode service start/);
  });

  it('describes server errors and unknown values as plain text', () => {
    expect(describeError({ _tag: 'SessionNotFoundError', message: 'nope' })).toBe('nope');
    expect(describeError({ _tag: 'ModelNotSelectedError' })).toMatch(/No model configured/);
    expect(describeError(new Error('boom'))).toBe('boom');
    expect(describeError(42)).toBeTypeOf('string');
  });
});
