// A stateful fake opencode server for queue/steer/interrupt flows. It models the session
// inbox the way the real server does (admission order, cancel, delivery changes) and pushes
// the matching `session.inbox.*` events; execution and delivery are driven by the test.
import {
  AGENTS,
  ASSISTANT_MSG_ID,
  CONFIG,
  HOME_WIN,
  MODEL_DEFAULT,
  MODELS,
  PROVIDERS,
  SESSION_ID,
  WORKSPACE_WIN,
  connectedFrame,
  frame,
  jsonResponse,
  routeFetch,
  sseStream,
  type Handler,
  type Stream,
} from './testkit';

export type Delivery = 'steer' | 'queue';
export type InboxRow = {
  id: string;
  sessionID: string;
  type: 'user' | 'compaction';
  payload: { text?: string };
  delivery: Delivery;
  time: { created: number };
};
type Message = Record<string, unknown> & { id: string; type: string };
/** A session as GET /api/session returns it (the fields the extension reads). */
export type SessionRow = {
  id: string;
  title?: string;
  parentID?: string;
  time: { created: number; updated: number };
  location: { directory: string };
  metadata?: Record<string, unknown>;
  agent?: string;
  model?: { id: string; providerID: string; variant?: string };
};

/** A history row for a chat the extension started (in its workspace, with its metadata). */
export function extensionSession(id: string, title: string | undefined, updated: number): SessionRow {
  return {
    id,
    title,
    time: { created: updated, updated },
    location: { directory: WORKSPACE_WIN },
    metadata: { source: 'chrome-extension' },
  };
}
type PromptBody = { id?: string; text: string; delivery?: Delivery; resume?: boolean };

let clock = 1_700_000_000_000;
const tick = () => (clock += 10);

export type FakeOpencodeOptions = {
  /** Seeds an existing session: queued user prompts (strings) or raw inbox rows. */
  rows?: Array<string | (Partial<InboxRow> & { text?: string })>;
  messages?: Message[];
  running?: boolean;
  /** Sessions GET /api/session can list, newest first. */
  sessions?: SessionRow[];
  overrides?: Record<string, Handler>;
};

export function fakeOpencode(options: FakeOpencodeOptions = {}) {
  const streams: Stream[] = [];
  const prompts: PromptBody[] = [];
  const changes: { inboxID: string; action: 'cancel' | Delivery }[] = [];
  const interrupts: { resume: string | null }[] = [];
  /** Every agent and model switch, in order (`agent:<name>` / `model:<provider>/<id>/<variant>`). */
  const switches: string[] = [];
  const log: string[] = [];
  const messages: Message[] = [...(options.messages ?? [])];
  let running = options.running ?? false;
  let minted = 0;
  const sessions: SessionRow[] = [...(options.sessions ?? [])];
  /** The query of every GET /api/session. */
  const listQueries: URLSearchParams[] = [];

  const rows: InboxRow[] = (options.rows ?? []).map((seed, index) => {
    const base = typeof seed === 'string' ? { text: seed } : seed;
    return {
      id: base.id ?? `msg_seed_${index + 1}`,
      sessionID: SESSION_ID,
      type: base.type ?? 'user',
      payload: base.payload ?? { text: base.text ?? '' },
      delivery: base.delivery ?? 'queue',
      time: base.time ?? { created: tick() },
    };
  });

  /** Test hooks: throw to make a request fail. `onPrompt` runs after admission (a lost response). */
  const hooks: {
    onPrompt?: (body: PromptBody) => void;
    beforePrompt?: (body: PromptBody) => void | Promise<void>;
    onCancel?: (inboxID: string) => void | Promise<void>;
    onUpdate?: (inboxID: string, delivery: Delivery) => void | Promise<void>;
    onInterrupt?: () => void | Promise<void>;
    onList?: () => void | Promise<void>;
    /** Return a response to replace the event stream (e.g. a 401 on reconnect). */
    onEvent?: () => Response | undefined;
    /** Runs before a rename (PATCH) or delete of a session; throw or reject to fail it. */
    onSessionChange?: (sessionID: string, method: string) => void | Promise<void>;
  } = {};

  const emit = (type: string, data: Record<string, unknown>) => {
    const event = { id: `evt_${tick()}`, created: clock, type, data: { sessionID: SESSION_ID, ...data } };
    streams.at(-1)?.push(frame(event));
  };

  const failure = (status: number, message: string) => jsonResponse({ message }, status);
  // While quiet, request handlers change state without pushing inbox events (a lagging server).
  const flags = { quiet: false };
  const emitInbox = (type: string, data: Record<string, unknown>) => {
    if (!flags.quiet) emit(type, data);
  };

  const fetch = routeFetch({
    'GET /api/event': (call) => {
      const replaced = hooks.onEvent?.();
      if (replaced) return replaced;
      const stream = sseStream(call.init.signal);
      stream.push(connectedFrame());
      streams.push(stream);
      return stream.response;
    },
    'GET /api/location': () => jsonResponse({ directory: HOME_WIN, project: { id: 'global' } }),
    'POST /api/experimental/fs/write': () => jsonResponse({ data: {} }),
    'GET /api/model/default': () => jsonResponse(MODEL_DEFAULT),
    'GET /api/provider': () => jsonResponse(PROVIDERS),
    'GET /api/model': () => jsonResponse(MODELS),
    'GET /api/agent': () => jsonResponse(AGENTS),
    'GET /api/config': () => jsonResponse(CONFIG),
    [`POST /api/session/${SESSION_ID}/agent`]: (call) => {
      const { agent } = JSON.parse(call.init.body as string) as { agent: string };
      switches.push(`agent:${agent}`);
      log.push(`agent:${agent}`);
      const row = sessions.find((item) => item.id === SESSION_ID);
      if (row) row.agent = agent;
      emit('session.agent.selected', { agent });
      return new Response(null, { status: 204 });
    },
    [`POST /api/session/${SESSION_ID}/model`]: (call) => {
      const { model } = JSON.parse(call.init.body as string) as { model: NonNullable<SessionRow['model']> };
      const key = `model:${model.providerID}/${model.id}/${model.variant ?? ''}`;
      switches.push(key);
      log.push(key);
      const row = sessions.find((item) => item.id === SESSION_ID);
      if (row) row.model = model;
      emit('session.model.selected', { model });
      return new Response(null, { status: 204 });
    },
    'POST /api/session': (call) => {
      log.push('create');
      const body = JSON.parse(call.init.body as string) as {
        title?: string;
        metadata?: Record<string, unknown>;
        agent?: string;
        model?: SessionRow['model'];
      };
      const row: SessionRow = {
        id: SESSION_ID,
        title: body.title,
        time: { created: tick(), updated: clock },
        location: { directory: WORKSPACE_WIN },
        metadata: body.metadata,
        agent: body.agent ?? 'build',
        model: body.model,
      };
      sessions.unshift(row);
      emit('session.created', { location: row.location, metadata: row.metadata, slug: 'chat', title: row.title });
      return jsonResponse({ data: row });
    },
    'GET /api/session': (call) => {
      const query = call.url.searchParams;
      listQueries.push(query);
      const directory = query.get('directory');
      const search = query.get('search')?.toLowerCase();
      const matches = sessions.filter(
        (row) =>
          (!directory || row.location.directory === directory) &&
          (!search || (row.title ?? '').toLowerCase().includes(search)),
      );
      const offset = Number(query.get('cursor') ?? 0);
      const page = matches.slice(offset, offset + Number(query.get('limit') ?? matches.length));
      return jsonResponse({ data: page, cursor: { next: String(offset + page.length) } });
    },
    'GET /api/session/active': () => jsonResponse({ data: running ? { [SESSION_ID]: { type: 'running' } } : {} }),
    // Newest first; the cursor is an offset into that order.
    [`GET /api/session/${SESSION_ID}/message`]: (call) => {
      const newest = [...messages].reverse();
      const offset = Number(call.url.searchParams.get('cursor') ?? 0);
      const limit = Number(call.url.searchParams.get('limit') ?? newest.length);
      const page = newest.slice(offset, offset + limit);
      return jsonResponse({ data: page, cursor: { next: String(offset + page.length) } });
    },
    [`GET /api/session/${SESSION_ID}/inbox`]: async () => {
      await hooks.onList?.();
      return jsonResponse({ data: rows });
    },
    [`POST /api/session/${SESSION_ID}/prompt`]: async (call) => {
      const body = JSON.parse(call.init.body as string) as PromptBody;
      await hooks.beforePrompt?.(body);
      const id = body.id ?? `msg_fake_${++minted}`;
      const delivery = body.delivery ?? 'steer';
      const row: InboxRow = {
        id,
        sessionID: SESSION_ID,
        type: 'user',
        payload: { text: body.text },
        delivery,
        time: { created: tick() },
      };
      rows.push(row);
      prompts.push(body);
      log.push(`prompt:${delivery}`);
      emitInbox('session.inbox.enqueued', { inboxID: id, item: { type: 'user', payload: row.payload, delivery } });
      hooks.onPrompt?.(body);
      return jsonResponse({ data: row });
    },
    [`POST /api/session/${SESSION_ID}/interrupt`]: async (call) => {
      interrupts.push({ resume: call.url.searchParams.get('resume') });
      log.push('interrupt');
      await hooks.onInterrupt?.();
      return jsonResponse({ interrupted: running });
    },
    ...options.overrides,
  });

  const cancelItem = async (inboxID: string) => {
    await hooks.onCancel?.(inboxID);
    log.push(`cancel:${inboxID}`);
    changes.push({ inboxID, action: 'cancel' });
    const index = rows.findIndex((row) => row.id === inboxID);
    if (index >= 0) {
      rows.splice(index, 1);
      emitInbox('session.inbox.cancelled', { inboxID });
    }
    return new Response(null, { status: 204 });
  };

  const updateItem = async (inboxID: string, body: string) => {
    const { delivery } = JSON.parse(body) as { delivery: Delivery };
    await hooks.onUpdate?.(inboxID, delivery);
    const row = rows.find((entry) => entry.id === inboxID);
    if (!row) return failure(409, `Pending input cannot change to ${delivery}`);
    log.push(`update:${inboxID}:${delivery}`);
    changes.push({ inboxID, action: delivery });
    row.delivery = delivery;
    emitInbox('session.inbox.delivery.changed', { inboxID, delivery });
    return new Response(null, { status: 204 });
  };

  const notFound = () => jsonResponse({ _tag: 'SessionNotFoundError', message: 'Session not found' }, 404);

  /** GET, PATCH (rename) and DELETE /api/session/:id. */
  const sessionItem = async (id: string, method: string, body: string) => {
    const index = sessions.findIndex((row) => row.id === id);
    if (index === -1) return notFound();
    if (method === 'GET') return jsonResponse({ data: sessions[index] });
    try {
      await hooks.onSessionChange?.(id, method);
    } catch (error) {
      return failure(500, error instanceof Error ? error.message : 'Server error');
    }
    if (method === 'DELETE') {
      log.push(`delete:${id}`);
      sessions.splice(index, 1);
      emit('session.deleted', { sessionID: id });
      return new Response(null, { status: 204 });
    }
    const { title } = JSON.parse(body) as { title: string };
    log.push(`rename:${id}:${title}`);
    sessions[index] = { ...sessions[index]!, title };
    emit('session.renamed', { sessionID: id, title });
    return new Response(null, { status: 204 });
  };

  // DELETE/PATCH /inbox/:id and /api/session/:id are dynamic, so wrap the routed fetch.
  const inboxItem = new RegExp(`^/api/session/${SESSION_ID}/inbox/([^/]+)$`);
  const sessionPath = /^\/api\/session\/(ses_[^/]+)$/;
  /** The handler for a dynamic path, or null to use the routed fetch. */
  const dynamicRoute = (method: string, url: URL, body: string): (() => Promise<Response>) | null => {
    const session = sessionPath.exec(url.pathname);
    if (session && !options.overrides?.[`${method} ${url.pathname}`]) {
      return () => sessionItem(decodeURIComponent(session[1]!), method, body);
    }
    const inbox = inboxItem.exec(url.pathname);
    if (!inbox) return null;
    const inboxID = decodeURIComponent(inbox[1]!);
    if (method === 'DELETE') return () => cancelItem(inboxID);
    if (method === 'PATCH') return () => updateItem(inboxID, body);
    return null;
  };

  const wrapped = Object.assign(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const method = (init.method ?? 'GET').toUpperCase();
      const route = dynamicRoute(method, url, init.body as string);
      if (!route) return fetch(input, init);
      fetch.calls.push({ method, url, init, headers: new Headers(init.headers) });
      return route();
    },
    { calls: fetch.calls },
  );

  return {
    fetch: wrapped,
    streams,
    rows,
    prompts,
    changes,
    interrupts,
    switches,
    log,
    messages,
    sessions,
    listQueries,
    hooks,
    flags,
    emit,
    get running() {
      return running;
    },
    /** session.execution.started */
    start() {
      running = true;
      emit('session.execution.started', {});
    },
    /** Delivers an inbox row into the timeline (session.inbox.delivered). */
    deliver(id = rows.find((row) => row.delivery === 'steer')?.id ?? rows[0]?.id) {
      const index = rows.findIndex((row) => row.id === id);
      const [row] = index >= 0 ? rows.splice(index, 1) : [];
      if (row) messages.push({ id: row.id, type: 'user', text: row.payload.text ?? '', time: { created: tick() } });
      emit('session.inbox.delivered', { inboxID: id });
    },
    /** Streams one assistant step with a single text block. */
    say(text: string, assistantMessageID = ASSISTANT_MSG_ID) {
      const s = { assistantMessageID };
      emit('session.step.started', { ...s, agent: 'build', model: { providerID: 'opencode', id: 'flint-40b-free' } });
      emit('session.text.started', { ...s, ordinal: 0 });
      emit('session.text.delta', { ...s, ordinal: 0, delta: text });
      emit('session.text.ended', { ...s, ordinal: 0, text });
      emit('session.step.ended', { ...s, finish: 'stop' });
      messages.push({
        id: assistantMessageID,
        type: 'assistant',
        content: [{ type: 'text', text }],
        time: { created: tick() },
      });
    },
    /** Ends the execution with an outcome and records the idle boundary. */
    finish(outcome: 'succeeded' | 'failed' | 'interrupted' = 'succeeded', extra: Record<string, unknown> = {}) {
      running = false;
      emit(`session.execution.${outcome}`, extra);
      messages.push({ id: `msg_idle_${tick()}`, type: 'idle', outcome, time: { created: clock } });
    },
  };
}

export type FakeOpencode = ReturnType<typeof fakeOpencode>;
