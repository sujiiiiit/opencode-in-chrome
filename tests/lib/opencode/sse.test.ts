import { afterEach, describe, expect, it, vi } from 'vitest';
import { SseIdleError, SseParser, streamEvents, type ServerEvent } from '@/lib/opencode/sse';
import { BASE, HEARTBEAT, TOKEN, connectedFrame, evt, frame, routeFetch, sseStream, jsonResponse } from '@/tests/support/testkit';

describe('SseParser', () => {
  it('parses a data frame', () => {
    const p = new SseParser();
    expect(p.feed(connectedFrame())).toEqual([{ id: 'evt_connected', type: 'server.connected', data: {} }]);
  });

  it('keeps the event creation time when it is a number', () => {
    const p = new SseParser();
    const [event] = p.feed(frame({ id: 'e', type: 'session.execution.started', created: 1234, data: {} }));
    expect(event!.created).toBe(1234);
    expect(p.feed(frame({ id: 'e', type: 'x', created: 'soon', data: {} }))[0]!.created).toBeUndefined();
  });

  it('ignores heartbeat comments', () => {
    const p = new SseParser();
    expect(p.feed(HEARTBEAT)).toEqual([]);
    expect(p.feed(HEARTBEAT + connectedFrame())).toHaveLength(1);
  });

  it('handles multiple frames in one chunk', () => {
    const e1 = evt('session.text.delta', { sessionID: 's', delta: 'a' });
    const e2 = evt('session.text.delta', { sessionID: 's', delta: 'b' });
    const out = new SseParser().feed(frame(e1) + HEARTBEAT + frame(e2));
    expect(out.map((e) => e.id)).toEqual([e1.id, e2.id]);
  });

  it('handles a frame split mid-way across chunks', () => {
    const text = frame(evt('session.text.delta', { sessionID: 's', delta: 'héllo' }));
    const p = new SseParser();
    const out: ServerEvent[] = [];
    for (let i = 0; i < text.length; i += 7) out.push(...p.feed(text.slice(i, i + 7)));
    expect(out).toHaveLength(1);
    expect(out[0]!.data.delta).toBe('héllo');
  });

  it('handles a split between the two newlines and CRLF line endings', () => {
    const p = new SseParser();
    expect(p.feed('data: {"type":"a","data":{}}\n')).toEqual([]);
    expect(p.feed('\n')).toHaveLength(1);
    expect(p.feed('data: {"type":"b","data":{}}\r\n\r\n')).toHaveLength(1);
  });

  it('skips malformed JSON and events without a string type', () => {
    const p = new SseParser();
    expect(p.feed('data: {oops\n\n')).toEqual([]);
    expect(p.feed('data: {"data":{}}\n\n')).toEqual([]);
    expect(p.feed('data: [1,2]\n\n')).toEqual([]);
    expect(p.feed(connectedFrame())).toHaveLength(1);
  });

  it('defaults missing data to an empty object', () => {
    expect(new SseParser().feed('data: {"type":"x"}\n\n')[0]!.data).toEqual({});
  });
});

describe('streamEvents', () => {
  afterEach(() => vi.useRealTimers());

  it('sends auth and yields events, ending when the stream closes', async () => {
    const stream = sseStream();
    stream.push(connectedFrame() + HEARTBEAT);
    stream.close();
    const fetch = routeFetch({ 'GET /api/event': () => stream.response });
    const got: string[] = [];
    for await (const e of streamEvents({ baseUrl: BASE, token: TOKEN, fetch })) got.push(e.type);
    expect(got).toEqual(['server.connected']);
    const call = fetch.calls[0]!;
    expect(call.headers.get('authorization')).toBe('Basic ' + btoa('opencode:' + TOKEN));
    expect(call.headers.get('accept')).toBe('text/event-stream');
    expect(call.init.redirect).toBe('error');
    expect(call.url.search).toBe('');
  });

  it('throws an unauthorized error on 401', async () => {
    const fetch = routeFetch({ 'GET /api/event': () => jsonResponse({ _tag: 'UnauthorizedError', message: 'x' }, 401) });
    await expect(streamEvents({ baseUrl: BASE, token: TOKEN, fetch }).next()).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a response that is not an event stream', async () => {
    const fetch = routeFetch({ 'GET /api/event': () => jsonResponse({}) });
    await expect(streamEvents({ baseUrl: BASE, token: TOKEN, fetch }).next()).rejects.toThrow(/event stream/i);
  });

  it('stops when the caller aborts', async () => {
    const abort = new AbortController();
    const fetch = routeFetch({ 'GET /api/event': (c) => sseStream(c.init.signal).response });
    const it = streamEvents({ baseUrl: BASE, token: TOKEN, fetch, signal: abort.signal });
    const next = it.next();
    abort.abort();
    await expect(next).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('treats 45s of silence as a dead stream', async () => {
    vi.useFakeTimers();
    const fetch = routeFetch({ 'GET /api/event': (c) => sseStream(c.init.signal).response });
    const it = streamEvents({ baseUrl: BASE, token: TOKEN, fetch });
    const next = it.next().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(44_000);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await next).toBeInstanceOf(SseIdleError);
  });

  it('heartbeats keep the stream alive', async () => {
    vi.useFakeTimers();
    const stream = sseStream();
    const fetch = routeFetch({ 'GET /api/event': () => stream.response });
    const it = streamEvents({ baseUrl: BASE, token: TOKEN, fetch });
    const next = it.next();
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(15_000);
      stream.push(HEARTBEAT);
    }
    stream.push(connectedFrame());
    expect((await next).value).toMatchObject({ type: 'server.connected' });
  });
});
