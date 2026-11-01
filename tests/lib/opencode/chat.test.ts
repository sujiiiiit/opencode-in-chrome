import { describe, expect, it } from 'vitest';
import { ChatSession, replyErrorText } from '@/lib/opencode/chat';
import { isUnauthorized, NO_MODEL_MESSAGE } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import { initialReply, replyText, type ReplyState } from '@/lib/opencode/reply';
import {
  BASE,
  PROVIDER_ERROR,
  SESSION_ID,
  TOKEN,
  USER_MSG_ID,
  WORKSPACE_WIN,
  failureEvents,
  jsonResponse,
  routeFetch,
  successEvents,
  unauthorized,
  MODEL_DEFAULT,
  fakeServer,
  pushEvents,
} from '@/tests/support/testkit';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: 1796106971000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

function setup(options: Parameters<typeof fakeServer>[0] = {}) {
  const server = fakeServer(options);
  const chat = new ChatSession({ connection, fetch: server.fetch, idleMs: 50 });
  return { ...server, chat };
}

const pushAll = pushEvents;
const body = (fetch: ReturnType<typeof routeFetch>, path: string) =>
  JSON.parse(fetch.calls.find((c) => c.url.pathname === path)!.init.body as string);

describe('ChatSession.send', () => {
  it('subscribes first, creates the session with the explicit default model, prompts, and streams the reply', async () => {
    const { fetch, chat, order } = setup({ onPrompt: (s) => pushAll(s[0], successEvents()) });
    const states: ReplyState[] = [];
    const final = await chat.send('hello', { onUpdate: (s) => states.push(s) });

    expect(order).toEqual(['event', 'create', 'prompt']);
    expect(body(fetch, '/api/session')).toMatchObject({
      location: { directory: WORKSPACE_WIN },
      model: { providerID: 'opencode', id: 'flint-40b-free' },
    });
    expect(fetch.calls.find((c) => c.url.pathname === '/api/model/default')!.url.searchParams.get('location[directory]')).toBe(
      WORKSPACE_WIN,
    );
    expect(body(fetch, `/api/session/${SESSION_ID}/prompt`)).toMatchObject({ text: 'hello' });
    expect(final.status).toBe('succeeded');
    expect(replyText(final)).toBe('pong');
    expect(states.some((s) => replyText(s) === 'po')).toBe(true);
  });

  it('never puts the token in a URL', async () => {
    const { fetch, chat } = setup({ onPrompt: (s) => pushAll(s[0], successEvents()) });
    await chat.send('hello', { onUpdate: () => undefined });
    for (const call of fetch.calls) {
      expect(call.url.toString()).not.toContain(TOKEN);
      expect(call.url.search).not.toContain('auth_token');
      expect(call.url.origin).toBe(BASE);
    }
  });

  it('ends in a failed state with the provider error on the real failure sequence', async () => {
    const { chat } = setup({ onPrompt: (s) => pushAll(s[0], failureEvents()) });
    const final = await chat.send('hello', { onUpdate: () => undefined });
    expect(final.status).toBe('failed');
    expect(replyErrorText(final)).toBe(`Model error: ${PROVIDER_ERROR.message}`);
  });

  it('ignores events from other sessions', async () => {
    const { chat } = setup({
      onPrompt: (s) => pushAll(s[0], [...successEvents('ses_other', ['x'], 'WRONG'), ...successEvents()]),
    });
    const final = await chat.send('hello', { onUpdate: () => undefined });
    expect(replyText(final)).toBe('pong');
  });

  it('reuses the session for a second message', async () => {
    const { fetch, chat } = setup({ onPrompt: (s) => pushAll(s.at(-1), successEvents()) });
    await chat.send('one', { onUpdate: () => undefined });
    await chat.send('two', { onUpdate: () => undefined });
    expect(fetch.calls.filter((c) => c.method === 'POST' && c.url.pathname === '/api/session')).toHaveLength(1);
    expect(fetch.calls.filter((c) => c.url.pathname.endsWith('/prompt'))).toHaveLength(2);
  });

  it('throws an unauthorized error when the event stream returns 401', async () => {
    const { chat } = setup({ overrides: { 'GET /api/event': () => unauthorized() } });
    const error = await chat.send('hi', { onUpdate: () => undefined }).catch((e: unknown) => e);
    expect(isUnauthorized(error)).toBe(true);
  });

  it('throws an unauthorized error when session creation returns 401', async () => {
    const { chat } = setup({ overrides: { 'POST /api/session': () => unauthorized() } });
    const error = await chat.send('hi', { onUpdate: () => undefined }).catch((e: unknown) => e);
    expect(isUnauthorized(error)).toBe(true);
  });

  it('reports no model configured when the server has no default model', async () => {
    const { chat } = setup({ overrides: { 'GET /api/model/default': () => jsonResponse({ ...MODEL_DEFAULT, data: null }) } });
    const error = await chat.send('hi', { onUpdate: () => undefined }).catch((e: unknown) => e);
    expect(error).toMatchObject({ _tag: 'ModelNotSelectedError' });
  });

  it('rejects when the server is offline', async () => {
    const fetch = routeFetch({});
    const chat = new ChatSession({ connection, fetch });
    await expect(chat.send('hi', { onUpdate: () => undefined })).rejects.toBeTruthy();
  });

  it('aborts the event stream when the caller aborts', async () => {
    const abort = new AbortController();
    const { chat } = setup({ onPrompt: () => abort.abort() });
    await expect(chat.send('hi', { onUpdate: () => undefined, signal: abort.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('recovers from a dropped stream: reconnects, then reads the message snapshot', async () => {
    const { chat, fetch } = setup({
      onPrompt: (s) => s[0]!.close(),
      overrides: {
        [`GET /api/session/${SESSION_ID}/message`]: () =>
          jsonResponse({
            data: [
              { id: 'msg_195d43ea3999', type: 'idle', outcome: 'succeeded' },
              { id: 'msg_195d43ea3001', type: 'assistant', content: [{ type: 'text', text: 'pong' }] },
              { id: USER_MSG_ID, type: 'user', text: 'hello' },
            ],
            cursor: {},
          }),
      },
    });
    const final = await chat.send('hello', { onUpdate: () => undefined });
    expect(replyText(final)).toBe('pong');
    expect(final.status).toBe('succeeded');
    expect(fetch.calls.filter((c) => c.url.pathname === '/api/event')).toHaveLength(2);
  });

  it('reconnects when the snapshot is not finished, then completes from the new stream', async () => {
    let prompted = false;
    const { chat, streams, fetch } = setup({
      onPrompt: (s) => {
        prompted = true;
        s[0]!.close();
      },
      overrides: {
        [`GET /api/session/${SESSION_ID}/message`]: () => {
          // After the reconnect, the new stream delivers the rest of the reply.
          queueMicrotask(() => pushAll(streams[1], successEvents()));
          return jsonResponse({ data: [{ id: USER_MSG_ID, type: 'user', text: 'hello' }], cursor: {} });
        },
      },
    });
    const final = await chat.send('hello', { onUpdate: () => undefined });
    expect(prompted).toBe(true);
    expect(final.status).toBe('succeeded');
    expect(fetch.calls.filter((c) => c.url.pathname === '/api/event')).toHaveLength(2);
  });

  it('starts from an empty reply', () => {
    expect(initialReply(SESSION_ID).steps).toEqual([]);
  });
});

describe('replyErrorText', () => {
  const failed = (type: string, message: string): ReplyState => ({
    ...initialReply(SESSION_ID),
    status: 'failed',
    error: { type, message },
  });

  it('prefixes model errors', () => {
    expect(replyErrorText(failed('provider.invalid-request', 'bad'))).toBe('Model error: bad');
  });

  it('maps a missing model to the setup hint', () => {
    expect(replyErrorText(failed('model.not-selected', 'x'))).toBe(NO_MODEL_MESSAGE);
  });

  it('describes interruptions and returns null otherwise', () => {
    expect(replyErrorText({ ...initialReply(SESSION_ID), status: 'interrupted', interruptReason: 'user' })).toMatch(/stopped/i);
    expect(replyErrorText({ ...initialReply(SESSION_ID), status: 'succeeded' })).toBeNull();
  });
});

