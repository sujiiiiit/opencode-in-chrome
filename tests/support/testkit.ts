// Test helpers: a routed fetch stub and a fake SSE stream built from the real
// payloads documented in docs/01-pairing-and-first-message.md (sections 8-10).
// No test may touch the network.

export const BASE = 'http://127.0.0.1:28894';
export const CODE = 'AbCdEfGh1234567890_-xY';
export const TOKEN = '1796106971.abc_DEF-123';
export const SESSION_ID = 'ses_e6a2bc180ffe8nqJMVk63T7cKj';
export const USER_MSG_ID = 'msg_195d43e8f001Z6vg6iCE1qI7by';
export const ASSISTANT_MSG_ID = 'msg_195d43ea3001AAAAAAAAAAAAAA';
export const HOME_WIN = 'C:\\Users\\sujit';
export const WORKSPACE_WIN = 'C:\\Users\\sujit\\.opencode-chrome\\workspace';

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export const unauthorized = (message = 'Authentication required') =>
  jsonResponse({ _tag: 'UnauthorizedError', message }, 401);

export type Call = { method: string; url: URL; init: RequestInit; headers: Headers };
export type Handler = (call: Call) => Response | Promise<Response>;

/** Fetch stub routed by "METHOD /path". Unmatched requests throw (like an offline server). */
export function routeFetch(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fn = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const call: Call = { method, url, init, headers: new Headers(init.headers) };
    calls.push(call);
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) throw new TypeError(`Failed to fetch (no stub for ${method} ${url.pathname})`);
    return handler(call);
  };
  return Object.assign(fn, { calls });
}

let seq = 0;
const LOCATION = { directory: WORKSPACE_WIN, project: { id: 'global' } };

/** One SSE event as it appears on the wire (the envelope is `{id, type, data, location?}`). */
export function evt(type: string, data: Record<string, unknown>, opts: { location?: boolean } = {}) {
  seq += 1;
  return {
    id: `evt_${String(seq).padStart(8, '0')}`,
    type,
    ...(opts.location === false ? {} : { location: LOCATION }),
    data,
  };
}

export const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;
export const HEARTBEAT = ': heartbeat\n\n';
export const connectedFrame = () => frame({ id: 'evt_connected', type: 'server.connected', data: {} });

/** Real success sequence for "Reply with exactly the single word: pong". */
export function successEvents(sessionID = SESSION_ID, deltas: string[] = ['po', 'ng'], finalText = 'pong') {
  const s = { sessionID, assistantMessageID: ASSISTANT_MSG_ID };
  return [
    evt('session.inbox.enqueued', { sessionID, inboxID: USER_MSG_ID }),
    evt('session.execution.started', { sessionID }, { location: false }),
    evt('session.inbox.delivered', { sessionID, inboxID: USER_MSG_ID }),
    evt('session.step.started', { ...s, agent: 'build', model: { providerID: 'opencode', id: 'flint-40b-free' } }),
    evt('session.reasoning.started', { ...s, ordinal: 0 }),
    evt('session.reasoning.delta', { ...s, ordinal: 0, delta: 'The user wants ' }),
    evt('session.reasoning.delta', { ...s, ordinal: 0, delta: 'pong.' }),
    evt('session.reasoning.ended', { ...s, ordinal: 0, text: 'The user wants pong.' }),
    evt('session.text.started', { ...s, ordinal: 0 }),
    ...deltas.map((delta) => evt('session.text.delta', { ...s, ordinal: 0, delta })),
    evt('session.text.ended', { ...s, ordinal: 0, text: finalText }),
    evt('session.step.streamed', s),
    evt('session.step.ended', { ...s, finish: 'stop' }),
    evt('session.usage.updated', { sessionID }, { location: false }),
    evt('session.execution.succeeded', { sessionID }, { location: false }),
  ];
}

export const PROVIDER_ERROR = {
  type: 'provider.invalid-request',
  message: 'The requested model is not supported.',
  status: 400,
  response: { body: '{"error":"model_not_supported"}' },
};

/** Real provider-error failure sequence (session created without an explicit model). */
export function failureEvents(sessionID = SESSION_ID) {
  const s = { sessionID, assistantMessageID: ASSISTANT_MSG_ID };
  return [
    evt('session.execution.started', { sessionID }, { location: false }),
    evt('session.step.started', { ...s, agent: 'build', model: { providerID: 'github-copilot', id: 'gpt-6.1-terra' } }),
    evt('session.step.failed', { ...s, error: PROVIDER_ERROR }),
    evt('session.execution.failed', { sessionID, error: PROVIDER_ERROR }, { location: false }),
  ];
}

/**
 * A streaming SSE response. Push frames at any time with `push`; `close` ends the
 * stream. Aborting the request signal errors the reader like a real fetch.
 */
export function sseStream(signal?: AbortSignal | null) {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const close = () => {
    if (closed) return;
    closed = true;
    controller.close();
  };
  signal?.addEventListener('abort', () => {
    if (closed) return;
    closed = true;
    controller.error(new DOMException('aborted', 'AbortError'));
  });
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    push: (text: string) => {
      if (!closed) controller.enqueue(encoder.encode(text));
    },
    close,
  };
}

export const SERVER_INFO = { version: '2.2.5', pid: 1234, urls: [BASE], paths: { tmp: 'C:\\tmp' } };
export const MODEL_DEFAULT = {
  location: { directory: WORKSPACE_WIN },
  data: { id: 'flint-40b-free', providerID: 'opencode', name: 'Flint 40B Free' },
};
const SESSION_INFO = {
  data: {
    id: SESSION_ID,
    model: { id: 'flint-40b-free', providerID: 'opencode', variant: 'default' },
    title: 'Chrome chat',
    location: { directory: WORKSPACE_WIN },
  },
};
const PROMPT_ACK = {
  data: {
    id: USER_MSG_ID,
    sessionID: SESSION_ID,
    type: 'user',
    payload: { text: 'hello' },
    delivery: 'steer',
  },
};

export type Stream = ReturnType<typeof sseStream>;

/** A complete fake opencode server for chat flows; `streams` holds each opened event stream. */
export function fakeServer(options: { onPrompt?: (streams: Stream[]) => void; overrides?: Record<string, Handler> } = {}) {
  const streams: Stream[] = [];
  const order: string[] = [];
  const fetch = routeFetch({
    'GET /api/event': (call) => {
      order.push('event');
      const stream = sseStream(call.init.signal);
      stream.push(connectedFrame());
      streams.push(stream);
      return stream.response;
    },
    'GET /api/location': () => jsonResponse({ directory: HOME_WIN, project: { id: 'global' } }),
    'POST /api/experimental/fs/write': () => jsonResponse({ data: {} }),
    'GET /api/model/default': () => jsonResponse(MODEL_DEFAULT),
    'POST /api/session': () => {
      order.push('create');
      return jsonResponse(SESSION_INFO);
    },
    [`POST /api/session/${SESSION_ID}/prompt`]: () => {
      order.push('prompt');
      options.onPrompt?.(streams);
      return jsonResponse(PROMPT_ACK);
    },
    ...options.overrides,
  });
  return { fetch, streams, order };
}

export const pushEvents = (stream: Stream | undefined, events: unknown[]) => {
  for (const e of events) stream?.push(frame(e));
};
