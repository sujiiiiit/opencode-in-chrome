import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatSession, pendingMessages, replyErrorText, type ChatSessionOptions } from '@/lib/opencode/chat';
import { NO_MODEL_MESSAGE, OFFLINE_MESSAGE } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import { EventHub } from '@/lib/opencode/events';
import { replyText } from '@/lib/opencode/reply';
import { fakeOpencode, type FakeOpencodeOptions } from '@/tests/support/queue-server';
import {
  BASE,
  PROVIDER_ERROR,
  SESSION_ID,
  TOKEN,
  WORKSPACE_WIN,
  jsonResponse,
  unauthorized,
} from '@/tests/support/testkit';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: 1796106971000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

const sessions: ChatSession[] = [];
afterEach(() => {
  for (const chat of sessions.splice(0)) chat.dispose();
});

function setup(server: FakeOpencodeOptions = {}, options: Partial<ChatSessionOptions> = {}) {
  const fake = fakeOpencode(server);
  const chat = new ChatSession({ connection, fetch: fake.fetch, idleMs: 200, retryMs: 0, ...options });
  sessions.push(chat);
  return { fake, chat };
}

/** A chat attached to an existing session. */
async function attached(server: FakeOpencodeOptions = {}, options: Partial<ChatSessionOptions> = {}) {
  const result = setup(server, { sessionID: SESSION_ID, ...options });
  await result.chat.load();
  return result;
}

const waiting = (chat: ChatSession) => pendingMessages(chat.getState()).map((m) => [m.text, m.status]);
const body = (fake: ReturnType<typeof fakeOpencode>, path: string) =>
  JSON.parse(fake.fetch.calls.find((c) => c.url.pathname === path)!.init.body as string);

describe('ChatSession.load', () => {
  it('connects the event stream and prepares the workspace without creating a session', async () => {
    const { fake, chat } = setup();
    const phases: string[] = [];
    chat.subscribe(() => phases.push(chat.getState().phase));
    await chat.load();

    expect(chat.getState()).toMatchObject({ phase: 'ready', connected: true, error: null, timeline: null });
    expect(phases).toContain('loading');
    expect(fake.streams).toHaveLength(1);
    expect(fake.log).not.toContain('create');
    // The model is chosen by the ModelStore; the default is asked for only by a send that names none.
    expect(fake.fetch.calls.some((c) => c.url.pathname === '/api/model/default')).toBe(false);
  });

  it('shares one load between concurrent callers', async () => {
    const { fake, chat } = setup();
    await Promise.all([chat.load(), chat.load()]);
    expect(fake.streams).toHaveLength(1);
  });

  it('fails with the offline message when the server is unreachable', async () => {
    const { chat } = setup({ overrides: { 'GET /api/event': () => Promise.reject(new TypeError('Failed to fetch')) } });
    await chat.load();
    expect(chat.getState()).toMatchObject({ phase: 'failed', error: OFFLINE_MESSAGE, connected: false });
  });

  it('a send that names no model, with no default model configured, fails with the no-model notice', async () => {
    const { fake, chat } = setup({ overrides: { 'GET /api/model/default': () => jsonResponse({ data: null }) } });
    await chat.load();
    expect(await chat.submit('hello')).toBe(false);
    expect(chat.getState().notice).toBe(NO_MODEL_MESSAGE);
    expect(fake.log).not.toContain('create');
    expect(
      fake.fetch.calls.find((c) => c.url.pathname === '/api/model/default')!.url.searchParams.get('location[directory]'),
    ).toBe(WORKSPACE_WIN);
  });

  it('reports a rejected token', async () => {
    const onUnauthorized = vi.fn();
    const { chat } = setup({ overrides: { 'GET /api/location': () => unauthorized() } }, { onUnauthorized });
    await chat.load();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('retries after a failure', async () => {
    let down = true;
    const fake = fakeOpencode();
    const fetch = Object.assign(
      (input: RequestInfo | URL, init?: RequestInit) =>
        down ? Promise.reject(new TypeError('Failed to fetch')) : fake.fetch(input, init),
      { calls: fake.fetch.calls },
    );
    const chat = new ChatSession({ connection, fetch, retryMs: 0 });
    sessions.push(chat);
    await chat.load();
    expect(chat.getState().phase).toBe('failed');
    down = false;
    await chat.load();
    expect(chat.getState()).toMatchObject({ phase: 'ready', error: null });
  });

  it('rebuilds an existing session from its snapshot, inbox and active state', async () => {
    const { chat } = await attached({
      running: true,
      messages: [{ id: 'msg_u1', type: 'user', text: 'first', time: { created: 1 } }],
      rows: [{ text: 'steer me', delivery: 'steer' }, 'queued one'],
    });
    const state = chat.getState();
    expect(state.timeline?.working).toBe(true);
    expect(state.timeline?.turns.map((t) => t.text)).toEqual(['first']);
    // A prompt queued from another client still shows as waiting, after the steers.
    expect(waiting(chat)).toEqual([
      ['steer me', 'steering'],
      ['queued one', 'queued'],
    ]);
  });
});

describe('ChatSession.openBrowserSession', () => {
  it('creates and prepares a session when the panel opens, before any prompt', async () => {
    const prepare = vi.fn(async () => 'Current tab is attached.');
    const onCreated = vi.fn();
    const { fake, chat } = setup({}, { prepare, onCreated });
    await chat.load();
    await chat.openBrowserSession();
    expect(fake.log).toContain('create');
    expect(fake.prompts).toHaveLength(0);
    expect(prepare).toHaveBeenCalledWith(expect.anything(), SESSION_ID);
    expect(onCreated).toHaveBeenCalledWith(SESSION_ID, undefined);
    await chat.submit('what is on this page?');
    expect(fake.log.filter((entry) => entry === 'create')).toHaveLength(1);
    expect(fake.prompts).toHaveLength(1);
  });

  it('uses a model selected before the first prompt without a switch notice', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.openBrowserSession();
    await chat.submit('hello', undefined, { agent: 'build', model: { providerID: 'anthropic', modelID: 'claude-opus-5-5' } });
    expect(fake.switches).toContain('model:anthropic/claude-opus-5-5/');
    await vi.waitFor(() => expect(chat.getState().durable?.model?.modelID).toBe('claude-opus-5-5'));
    expect(chat.getState().timeline?.switches).toEqual([]);
  });
});

describe('ChatSession.submit', () => {
  it('refuses to send before load', async () => {
    const { fake, chat } = setup();
    expect(await chat.submit('hi')).toBe(false);
    expect(fake.prompts).toEqual([]);
  });

  it('stops before prompting when browser preparation fails, then retries the same session', async () => {
    let ready = false;
    const { fake, chat } = setup({}, {
      prepare: async (_client, sessionID) => {
        fake.log.push(`prepare:${sessionID}`);
        if (!ready) throw new Error('instructions route missing');
      },
    });
    await chat.load();
    expect(await chat.submit('hello')).toBe(false);
    expect(fake.prompts).toHaveLength(0);
    ready = true;
    expect(await chat.submit('hello')).toBe(true);
    expect(fake.log).toEqual(['create', `prepare:${SESSION_ID}`, `prepare:${SESSION_ID}`, 'prompt:steer']);
  });

  it('keeps the user message exact even when browser preparation returns context', async () => {
    const { fake, chat } = setup({}, { prepare: async () => 'Current tab: Kettle Corner. Use execute first.' });
    await chat.load();
    expect(await chat.submit('How much is the blue kettle?')).toBe(true);
    expect(body(fake, `/api/session/${SESSION_ID}/prompt`).text).toBe('How much is the blue kettle?');
    expect(await chat.submit('And the red kettle?')).toBe(true);
    expect(fake.prompts.at(-1)?.text).toBe('And the red kettle?');
  });

  it('does not send a prompt while browser tools are unavailable, then retries on the same session', async () => {
    let ready = false;
    const { fake, chat } = setup({}, {
      beforePrompt: async () => {
        if (!ready) throw new Error('Browser tools are still connecting.');
      },
    });
    await chat.load();
    expect(await chat.submit('check this tab')).toBe(false);
    expect(fake.prompts).toHaveLength(0);
    expect(chat.getState().notice).toBe('Browser tools are still connecting.');
    ready = true;
    expect(await chat.submit('check this tab')).toBe(true);
    expect(fake.prompts).toHaveLength(1);
    expect(fake.log.filter((entry) => entry === 'create')).toHaveLength(1);
  });

  it('creates the session with the default model, then prompts with a client-minted ID', async () => {
    const { fake, chat } = setup();
    await chat.load();
    expect(await chat.submit('hello')).toBe(true);

    expect(fake.log).toEqual(['create', 'prompt:steer']);
    expect(body(fake, '/api/session')).toMatchObject({
      location: { directory: WORKSPACE_WIN },
      model: { providerID: 'opencode', id: 'flint-40b-free' },
    });
    expect(fake.prompts[0]).toMatchObject({ text: 'hello', delivery: 'steer' });
    expect(fake.prompts[0]!.id).toMatch(/^msg_/);
    const state = chat.getState();
    expect(state.local).toEqual([]);
    expect(state.timeline?.pending.map((p) => [p.id, p.text])).toEqual([[fake.prompts[0]!.id, 'hello']]);
  });

  it('sends attached images inline with the text, and no files field without any', async () => {
    const { fake, chat } = setup();
    await chat.load();
    const image = { uri: 'data:image/png;base64,iVBORw0KGgo=', name: 'shot.png' };
    expect(await chat.submit('look', undefined, undefined, [image])).toBe(true);
    expect(await chat.submit('again')).toBe(true);

    expect(fake.prompts[0]).toMatchObject({ text: 'look', files: [image] });
    expect(fake.prompts[1]).not.toHaveProperty('files');
  });

  it('shows the prompt as local while the request is in flight and only once after admission', async () => {
    const { fake, chat } = setup();
    let release!: () => void;
    fake.hooks.beforePrompt = () => new Promise<void>((resolve) => (release = resolve));
    await chat.load();
    const sending = chat.submit('hello');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));

    expect(chat.getState().submitting).toBe(true);
    expect(pendingMessages(chat.getState()).map((s) => [s.text, s.local])).toEqual([['hello', true]]);
    release();
    await sending;
    expect(chat.getState().submitting).toBe(false);
    expect(pendingMessages(chat.getState()).map((s) => [s.text, s.local])).toEqual([['hello', false]]);
  });

  it('shows the attached images with the prompt, both while it is in flight and once admitted', async () => {
    const { fake, chat } = setup();
    let release!: () => void;
    fake.hooks.beforePrompt = () => new Promise<void>((resolve) => (release = resolve));
    await chat.load();
    const shown = [{ kind: 'image', name: 'shot.png', mime: 'image/png', src: 'data:image/png;base64,iVBORw0KGgo=' }];
    const sending = chat.submit('look', undefined, undefined, [{ uri: 'data:image/png;base64,iVBORw0KGgo=', name: 'shot.png' }]);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));

    expect(pendingMessages(chat.getState()).map((s) => [s.local, s.files])).toEqual([[true, shown]]);
    release();
    await sending;
    expect(pendingMessages(chat.getState()).map((s) => [s.local, s.files])).toEqual([[false, shown]]);
  });

  it('stages image previews before encoding and keeps their URLs through admission', async () => {
    const { fake, chat } = setup();
    await chat.load();
    const file = new File(['image'], 'shot.png', { type: 'image/png' });
    const image = { id: 'image-1', name: file.name, mime: file.type, file, url: 'blob:preview' };
    expect(chat.stagePrompt('p1', 'look', [image])).toBe(true);
    expect(pendingMessages(chat.getState())[0]?.files?.[0]?.src).toBe('blob:preview');
    expect(chat.previewFiles('p1')?.[0]?.src).toBe('blob:preview');
    expect(await chat.submit('look', 'p1', undefined, [{ uri: 'data:image/png;base64,aW1hZ2U=', name: 'shot.png' }])).toBe(true);
    expect(fake.prompts[0]?.files).toHaveLength(1);
    expect(pendingMessages(chat.getState(), chat.previewFiles)[0]?.files?.[0]?.src).toBe('blob:preview');
  });

  it('ignores a second submit while one is in flight', async () => {
    const { fake, chat } = setup();
    await chat.load();
    const first = chat.submit('one');
    expect(await chat.submit('two')).toBe(false);
    await first;
    expect(fake.prompts.map((p) => p.text)).toEqual(['one']);
  });

  it('creates the session only once and steers every prompt, even while a turn runs', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.submit('one');
    fake.start();
    fake.deliver(fake.prompts[0]!.id);
    await vi.waitFor(() => expect(chat.getState().timeline?.working).toBe(true));
    await chat.submit('two');
    expect(fake.log.filter((entry) => entry === 'create')).toHaveLength(1);
    expect(fake.prompts.map((p) => [p.text, p.delivery])).toEqual([
      ['one', 'steer'],
      ['two', 'steer'],
    ]);
    expect(waiting(chat)).toEqual([['two', 'steering']]);
  });

  it('delivers a waiting prompt into the conversation as its own turn', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.submit('one');
    fake.start();
    fake.deliver(fake.prompts[0]!.id);
    await chat.submit('two');
    fake.deliver(fake.prompts[1]!.id);
    await vi.waitFor(() => expect(chat.getState().timeline?.turns.map((t) => t.text)).toEqual(['one', 'two']));
    expect(pendingMessages(chat.getState())).toEqual([]);
  });

  it('streams turns from the event stream', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.submit('hello');
    fake.start();
    fake.deliver(fake.prompts[0]!.id);
    fake.say('pong');
    fake.finish();

    await vi.waitFor(() => expect(chat.getState().timeline?.turns[0]?.reply.status).toBe('succeeded'));
    expect(chat.getState().timeline?.working).toBe(false);
    const turn = chat.getState().timeline!.turns[0]!;
    expect(turn.text).toBe('hello');
    expect(turn.reply.status).toBe('succeeded');
    expect(replyText(turn.reply)).toBe('pong');
  });

  it('surfaces a model failure on the turn', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.submit('hello');
    fake.start();
    fake.deliver(fake.prompts[0]!.id);
    fake.finish('failed', { error: PROVIDER_ERROR });
    await vi.waitFor(() => expect(chat.getState().timeline?.turns[0]!.reply.status).toBe('failed'));
    expect(replyErrorText(chat.getState().timeline!.turns[0]!.reply)).toBe(`Model error: ${PROVIDER_ERROR.message}`);
  });

  it('returns false with a notice and drops the local prompt when the request fails', async () => {
    const { fake, chat } = setup();
    fake.hooks.beforePrompt = () => Promise.reject(new TypeError('Failed to fetch'));
    await chat.load();
    expect(await chat.submit('hello')).toBe(false);
    expect(chat.getState()).toMatchObject({ notice: OFFLINE_MESSAGE, local: [], submitting: false });
    chat.dismissNotice();
    expect(chat.getState().notice).toBeNull();
  });

  it('reports a rejected token while sending', async () => {
    const onUnauthorized = vi.fn();
    const { chat } = setup({ overrides: { [`POST /api/session/${SESSION_ID}/prompt`]: () => unauthorized() } }, { onUnauthorized });
    await chat.load();
    expect(await chat.submit('hello')).toBe(false);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('never puts the token in a URL', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.submit('hello');
    for (const call of fake.fetch.calls) {
      expect(call.url.toString()).not.toContain(TOKEN);
      expect(call.url.origin).toBe(BASE);
    }
  });
});

describe('ChatSession.shellOutput', () => {
  it('reads a page of a background shell from a cursor, in the workspace', async () => {
    const { fake, chat } = await attached({
      overrides: {
        'GET /api/shell/sh_1/output': () =>
          jsonResponse({ location: {}, data: { output: 'PASS', cursor: 4, size: 4, truncated: false } }),
      },
    });
    expect(await chat.shellOutput('sh_1', 2)).toEqual({ output: 'PASS', cursor: 4, size: 4 });
    const call = fake.fetch.calls.find((c) => c.url.pathname === '/api/shell/sh_1/output')!;
    expect(call.url.searchParams.get('cursor')).toBe('2');
    expect(call.url.searchParams.get('directory') ?? call.url.searchParams.get('location[directory]')).toBe(WORKSPACE_WIN);
  });

  it('reports a shell the server no longer keeps as missing, and throws other failures', async () => {
    const { chat } = await attached({
      overrides: {
        'GET /api/shell/gone/output': () => jsonResponse({ _tag: 'ShellNotFoundError', message: 'gone' }, 404),
        'GET /api/shell/broken/output': () => jsonResponse({ message: 'boom' }, 500),
      },
    });
    expect(await chat.shellOutput('gone', 0)).toBe('missing');
    await expect(chat.shellOutput('broken', 0)).rejects.toBeDefined();
  });
});

describe('ChatSession.stop', () => {
  it('does nothing without a session', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.stop();
    expect(fake.interrupts).toEqual([]);
  });

  it('interrupts with resume so pending steers continue, once at a time', async () => {
    const { fake, chat } = await attached({ running: true });
    let release!: () => void;
    fake.hooks.onInterrupt = () => new Promise<void>((resolve) => (release = resolve));
    const stopping = chat.stop();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(chat.getState().interrupting).toBe(true);
    await chat.stop();
    release();
    await stopping;
    expect(fake.interrupts).toEqual([{ resume: 'true' }]);
    expect(chat.getState().interrupting).toBe(false);
  });

  it('can interrupt a child without resuming its inbox', async () => {
    const { fake, chat } = await attached({ running: true });
    await chat.stop(false);
    expect(fake.interrupts).toEqual([{ resume: null }]);
  });

  it('swallows interrupt failures', async () => {
    const { fake, chat } = await attached({ running: true });
    fake.hooks.onInterrupt = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(chat.stop()).resolves.toBeUndefined();
    expect(chat.getState().notice).toBeNull();
  });

  it('reports a failed child interrupt while leaving it running', async () => {
    const { fake, chat } = await attached({ running: true });
    fake.hooks.onInterrupt = () => Promise.reject(new TypeError('Failed to fetch'));
    await chat.stop(false);
    expect(chat.getState().notice).toBe(OFFLINE_MESSAGE);
    expect(chat.getState().timeline?.working).toBe(true);
  });

  it('ends the turn as interrupted when the server confirms', async () => {
    const { fake, chat } = await attached({ running: true, messages: [{ id: 'msg_u1', type: 'user', text: 'go', time: { created: 1 } }] });
    await chat.stop();
    fake.finish('interrupted', { reason: 'user' });
    await vi.waitFor(() => expect(chat.getState().timeline?.working).toBe(false));
    expect(replyErrorText(chat.getState().timeline!.turns[0]!.reply)).toBe('Stopped before the reply finished.');
  });
});

describe('event stream recovery', () => {
  it('reconnects after a drop and resyncs the session from the server', async () => {
    const { fake, chat } = await attached({ rows: [{ text: 'old', delivery: 'steer' }] });
    fake.rows.splice(0, 1);
    fake.rows.push({ id: 'msg_new', sessionID: SESSION_ID, type: 'user', payload: { text: 'from elsewhere' }, delivery: 'steer', time: { created: 9 } });
    fake.streams[0]!.close();

    await vi.waitFor(() => expect(fake.streams).toHaveLength(2));
    await vi.waitFor(() => expect(waiting(chat).map(([text]) => text)).toEqual(['from elsewhere']));
    expect(chat.getState().connected).toBe(true);
    fake.start();
    await vi.waitFor(() => expect(chat.getState().timeline?.working).toBe(true));
  });

  it('reconnects when the stream goes silent', async () => {
    const { fake } = await attached({}, { idleMs: 30 });
    await vi.waitFor(() => expect(fake.streams.length).toBeGreaterThan(1));
  });

  it('gives up after repeated failures and fails with the offline message', async () => {
    const fake = fakeOpencode();
    let down = false;
    const fetch = Object.assign(
      (input: RequestInfo | URL, init?: RequestInit) =>
        down ? Promise.reject(new TypeError('Failed to fetch')) : fake.fetch(input, init),
      { calls: fake.fetch.calls },
    );
    const chat = new ChatSession({ connection, fetch, retryMs: 0, idleMs: 200 });
    sessions.push(chat);
    await chat.load();
    down = true;
    fake.streams[0]!.close();
    await vi.waitFor(() => expect(chat.getState()).toMatchObject({ phase: 'failed', connected: false, error: OFFLINE_MESSAGE }));
  });

  it('reports a rejected token on reconnect', async () => {
    const onUnauthorized = vi.fn();
    const { fake, chat } = await attached({}, { onUnauthorized });
    fake.hooks.onEvent = () => unauthorized();
    fake.streams[0]!.close();
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(chat.getState().connected).toBe(false);
  });

  it('stops everything on dispose', async () => {
    const { fake, chat } = await attached();
    chat.dispose();
    fake.streams[0]!.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.streams).toHaveLength(1);
  });
});

describe('ChatSession history support', () => {
  it('creates the session untitled and tagged as the extension, and reports its id', async () => {
    const onCreated = vi.fn();
    const { fake, chat } = setup({}, { onCreated });
    await chat.load();
    await chat.submit('hello');
    const created = body(fake, '/api/session');
    expect(created).not.toHaveProperty('title');
    expect(created.metadata).toEqual({ source: 'chrome-extension' });
    expect(onCreated).toHaveBeenCalledWith(SESSION_ID, undefined);
    expect(chat.getState().title).toBeNull();
  });

  it('loads the title of an attached session and follows renames', async () => {
    const { fake, chat } = await attached({
      sessions: [{ id: SESSION_ID, title: 'Fix login', time: { created: 1, updated: 1 }, location: { directory: WORKSPACE_WIN } }],
    });
    expect(chat.getState().title).toBe('Fix login');
    fake.emit('session.renamed', { title: 'Fix the login redirect' });
    await vi.waitFor(() => expect(chat.getState().title).toBe('Fix the login redirect'));
  });

  it('reports a stored session that no longer exists', async () => {
    const onMissing = vi.fn();
    const { chat } = setup(
      { overrides: { [`GET /api/session/${SESSION_ID}/message`]: () => jsonResponse({ _tag: 'SessionNotFoundError', message: 'gone' }, 404) } },
      { sessionID: SESSION_ID, onMissing },
    );
    await chat.load();
    expect(onMissing).toHaveBeenCalledOnce();
    expect(chat.getState()).toMatchObject({ phase: 'failed', error: 'This chat no longer exists.' });
  });

  it('reports the open session being deleted elsewhere, but not other sessions', async () => {
    const onMissing = vi.fn();
    const { fake } = await attached({}, { onMissing });
    fake.emit('session.deleted', { sessionID: 'ses_someone_else' });
    fake.emit('session.deleted', {});
    await vi.waitFor(() => expect(onMissing).toHaveBeenCalledOnce());
  });

  it('loads earlier messages a page at a time, keeping turns split across pages whole', async () => {
    // 60 turns of user + assistant + idle: 180 messages, 50 per page.
    const messages = Array.from({ length: 60 }, (_, i) => [
      { id: `msg_u${i}`, type: 'user', text: `q${i}`, time: { created: i * 3 } },
      { id: `msg_a${i}`, type: 'assistant', content: [{ type: 'text', text: `a${i}` }], time: { created: i * 3 + 1 } },
      { id: `msg_i${i}`, type: 'idle', outcome: 'succeeded', time: { created: i * 3 + 2 } },
    ]).flat();
    const { chat } = await attached({ messages });
    const texts = () => chat.getState().timeline!.turns.map((t) => [t.text, replyText(t.reply)]);
    expect(chat.getState().hasEarlier).toBe(true);
    expect(texts()[0]).toEqual(['q44', 'a44']);

    while (chat.getState().hasEarlier) await chat.loadEarlier();
    expect(texts()).toHaveLength(60);
    expect(texts()[0]).toEqual(['q0', 'a0']);
    // The turn whose user message and reply landed on different pages.
    expect(texts()[43]).toEqual(['q43', 'a43']);
    expect(new Set(texts().map(([q]) => q)).size).toBe(60);
  });

  it('keeps earlier pages after a reconnect resync', async () => {
    const messages = Array.from({ length: 30 }, (_, i) => [
      { id: `msg_u${i}`, type: 'user', text: `q${i}`, time: { created: i * 2 } },
      { id: `msg_i${i}`, type: 'idle', outcome: 'succeeded', time: { created: i * 2 + 1 } },
    ]).flat();
    const { fake, chat } = await attached({ messages });
    await chat.loadEarlier();
    expect(chat.getState().timeline!.turns).toHaveLength(30);
    fake.streams[0]!.close();
    await vi.waitFor(() => expect(fake.streams).toHaveLength(2));
    await vi.waitFor(() => expect(chat.getState().connected).toBe(true));
    expect(chat.getState().timeline!.turns).toHaveLength(30);
  });

  it('shares one event stream between chats and only applies its own session', async () => {
    const fake = fakeOpencode();
    const events = new EventHub({ connection, fetch: fake.fetch, retryMs: 0, idleMs: 500 });
    const ours = new ChatSession({ connection, events, fetch: fake.fetch, sessionID: SESSION_ID });
    const other = new ChatSession({ connection, events, fetch: fake.fetch, sessionID: 'ses_other' });
    sessions.push(ours, other);
    await ours.load();
    expect(fake.streams).toHaveLength(1);
    fake.start();
    await vi.waitFor(() => expect(ours.getState().timeline?.working).toBe(true));
    other.dispose();
    // Disposing a chat leaves the shared stream open for the rest of the panel.
    expect(events.getStatus().state).toBe('connected');
    events.dispose();
  });
});

describe('ChatSession: agent, model and variant', () => {
  const OPUS = { providerID: 'anthropic', modelID: 'claude-opus-5-5' };
  const build = { agent: 'build', model: OPUS, variant: 'high' };

  it('creates the session with the chosen agent, model and variant', async () => {
    const onCreated = vi.fn();
    const { fake, chat } = setup({}, { onCreated });
    await chat.load();
    await chat.submit('hello', undefined, build);
    expect(body(fake, '/api/session')).toMatchObject({
      agent: 'build',
      model: { providerID: 'anthropic', id: 'claude-opus-5-5', variant: 'high' },
    });
    expect(onCreated).toHaveBeenCalledWith(SESSION_ID, build);
    expect(chat.getState().durable).toEqual({ agent: 'build', model: { ...OPUS, variant: 'high' } });
    // The selection went out with the session: no switch before the first prompt.
    expect(fake.switches).toEqual([]);
    expect(fake.fetch.calls.some((c) => c.url.pathname === '/api/model/default')).toBe(false);
  });

  it('sends no variant for the model default', async () => {
    const { fake, chat } = setup();
    await chat.load();
    await chat.submit('hello', undefined, { agent: 'build', model: OPUS });
    expect(body(fake, '/api/session').model).toEqual({ providerID: 'anthropic', id: 'claude-opus-5-5' });
  });

  it('switches the agent, then the model, before a prompt, and skips what did not change', async () => {
    const { fake, chat } = await attached({
      sessions: [
        {
          id: SESSION_ID,
          time: { created: 1, updated: 1 },
          location: { directory: WORKSPACE_WIN },
          agent: 'build',
          model: { providerID: 'opencode', id: 'flint-40b-free' },
        },
      ],
    });
    expect(chat.getState().durable).toEqual({ agent: 'build', model: { providerID: 'opencode', modelID: 'flint-40b-free' } });

    await chat.submit('same', undefined, { agent: 'build', model: { providerID: 'opencode', modelID: 'flint-40b-free' } });
    expect(fake.switches).toEqual([]);

    await chat.submit('effort', undefined, build);
    expect(fake.switches).toEqual(['model:anthropic/claude-opus-5-5/high']);
    expect(fake.log.slice(-2)).toEqual(['model:anthropic/claude-opus-5-5/high', 'prompt:steer']);
    await vi.waitFor(() => expect(chat.getState().durable?.model).toEqual({ ...OPUS, variant: 'high' }));
    await vi.waitFor(() => expect(chat.getState().timeline?.switches.some((notice) => notice.model.modelID === OPUS.modelID)
      || chat.getState().timeline?.turns.some((turn) => turn.switches?.some((notice) => notice.model.modelID === OPUS.modelID))).toBe(true));

    await chat.submit('plan it', undefined, { ...build, agent: 'plan' });
    expect(fake.switches.slice(1)).toEqual(['agent:plan', 'model:anthropic/claude-opus-5-5/high']);
  });

  it('switches again when the reported model lags a switch this panel made', async () => {
    const { fake, chat } = await attached({
      sessions: [
        {
          id: SESSION_ID,
          time: { created: 1, updated: 1 },
          location: { directory: WORKSPACE_WIN },
          agent: 'build',
          model: { providerID: 'anthropic', id: 'claude-opus-5-5', variant: 'high' },
        },
      ],
    });
    fake.flags.quiet = true;
    await chat.submit('low', undefined, { ...build, variant: 'low' });
    // The server's echo has not arrived: the read model still says "high".
    await chat.submit('back to high', undefined, build);
    expect(fake.switches).toEqual(['model:anthropic/claude-opus-5-5/low', 'model:anthropic/claude-opus-5-5/high']);
  });

  it('does not send the prompt when the switch fails', async () => {
    const { fake, chat } = await attached({
      overrides: { [`POST /api/session/${SESSION_ID}/model`]: () => jsonResponse({ message: 'nope' }, 400) },
    });
    expect(await chat.submit('hello', undefined, build)).toBe(false);
    expect(fake.prompts).toEqual([]);
    expect(chat.getState().notice).toBeTruthy();
  });

  it('follows agent and model changes made elsewhere', async () => {
    const { fake, chat } = await attached({ messages: [{ id: 'msg_first', type: 'user', text: 'hi', time: { created: 1 } }] });
    fake.emit('session.agent.selected', { agent: 'plan' });
    fake.emit('session.model.selected', { model: { providerID: 'anthropic', id: 'claude-opus-5-5', variant: 'low' } });
    await vi.waitFor(() =>
      expect(chat.getState().durable).toEqual({ agent: 'plan', model: { ...OPUS, variant: 'low' } }),
    );
    expect(chat.getState().timeline?.switches).toEqual([expect.objectContaining({ model: { ...OPUS, variant: 'low' } })]);
  });

  it('restores the model of the last reply for a session that records none', async () => {
    const { chat } = await attached({
      messages: [
        { id: 'msg_u', type: 'user', text: 'hi', time: { created: 1 } },
        { id: 'msg_a', type: 'assistant', agent: 'plan', model: { providerID: 'anthropic', id: 'claude-opus-5-5' }, content: [], time: { created: 2 } },
      ],
    });
    expect(chat.getState().durable).toEqual({ agent: 'plan', model: OPUS });
  });
});

describe('ChatSession forms', () => {
  const form = {
    id: 'frm_1',
    sessionID: SESSION_ID,
    title: 'Web Search',
    fields: [{ key: 'choice', type: 'string', required: true, options: [{ value: 'allow', label: 'Allow' }] }],
  };

  it('loads pending forms and answers one, which removes it', async () => {
    const { fake, chat } = await attached({
      overrides: {
        [`GET /api/session/${SESSION_ID}/form`]: () => jsonResponse({ data: [form] }),
        [`POST /api/session/${SESSION_ID}/form/frm_1/reply`]: () => new Response(null, { status: 204 }),
      },
    });
    expect(chat.getState().forms.map((f) => f.id)).toEqual(['frm_1']);
    expect(await chat.answerForm('frm_1', { choice: 'allow' })).toBe(true);
    expect(chat.getState().forms).toEqual([]);
    const reply = fake.fetch.calls.find((c) => c.url.pathname.endsWith('/form/frm_1/reply'))!;
    expect(JSON.parse(reply.init.body as string)).toEqual({ answer: { choice: 'allow' } });
  });

  it('cancels a pending form', async () => {
    const { fake, chat } = await attached({
      overrides: {
        [`GET /api/session/${SESSION_ID}/form`]: () => jsonResponse({ data: [form] }),
        [`DELETE /api/session/${SESSION_ID}/form/frm_1`]: () => new Response(null, { status: 204 }),
      },
    });
    expect(await chat.cancelForm('frm_1')).toBe(true);
    expect(chat.getState().forms).toEqual([]);
    expect(fake.fetch.calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('keeps loading when the form list is unavailable', async () => {
    const { chat } = await attached();
    expect(chat.getState()).toMatchObject({ phase: 'ready', forms: [] });
  });

  it('drops a form that was already settled elsewhere', async () => {
    const { chat } = await attached({
      overrides: {
        [`GET /api/session/${SESSION_ID}/form`]: () => jsonResponse({ data: [form] }),
        [`POST /api/session/${SESSION_ID}/form/frm_1/reply`]: () =>
          jsonResponse({ _tag: 'FormAlreadySettledError', message: 'settled' }, 409),
      },
    });
    expect(await chat.answerForm('frm_1', { choice: 'allow' })).toBe(false);
    expect(chat.getState()).toMatchObject({ forms: [], notice: null });
  });
});

describe('ChatSession permissions', () => {
  const request = { id: 'perm_1', sessionID: SESSION_ID, action: 'edit', resources: ['file.ts'], save: ['*.ts'] };
  const routes = {
    [`GET /api/session/${SESSION_ID}/permission`]: () => jsonResponse({ data: [request] }),
    [`POST /api/session/${SESSION_ID}/permission/perm_1/reply`]: () => new Response(null, { status: 204 }),
  };

  it('loads a pending request and sends the selected decision', async () => {
    const { chat, fake } = await attached({ overrides: routes });
    expect(chat.getState().permissions).toEqual([request]);
    expect(await chat.answerPermission(chat.getState().permissions[0]!, 'always')).toBe(true);
    expect(chat.getState().permissions).toEqual([]);
    expect(body(fake, `/api/session/${SESSION_ID}/permission/perm_1/reply`)).toEqual({ decision: 'always' });
  });

  it('automatically allows pending requests once when auto mode is enabled', async () => {
    const { chat, fake } = await attached({ overrides: routes });
    chat.setPermissionMode('auto');
    await vi.waitFor(() => expect(chat.getState().permissions).toEqual([]));
    expect(body(fake, `/api/session/${SESSION_ID}/permission/perm_1/reply`)).toEqual({ decision: 'once' });
  });
});

describe('subagent requests', () => {
  const child = 'ses_child';
  const request = { id: 'perm_child', sessionID: child, action: 'edit', resources: ['child.ts'] };
  const form = { id: 'frm_child', sessionID: child, title: 'Site approval', fields: [{ key: 'choice', type: 'string', options: [{ value: 'once', label: 'Allow' }] }] };
  const routes = {
    [`GET /api/session/${child}`]: () => jsonResponse({ data: { id: child, parentID: SESSION_ID } }),
    'GET /api/permission/request': () => jsonResponse({ location: { directory: WORKSPACE_WIN }, data: [request] }),
    'GET /api/form': () => jsonResponse({ location: { directory: WORKSPACE_WIN }, data: [form] }),
    [`POST /api/session/${child}/permission/perm_child/reply`]: () => new Response(null, { status: 204 }),
    [`POST /api/session/${child}/form/frm_child/reply`]: () => new Response(null, { status: 204 }),
  };

  it('recovers child requests and answers them in the child session', async () => {
    const { chat, fake } = await attached({ overrides: routes }, { includeSubagents: true });
    expect(chat.getState().permissions.map((item) => item.id)).toEqual(['perm_child']);
    expect(chat.getState().forms.map((item) => item.id)).toEqual(['frm_child']);
    await chat.answerPermission(chat.getState().permissions[0]!, 'once');
    await chat.answerForm('frm_child', { choice: 'once' });
    expect(body(fake, `/api/session/${child}/permission/perm_child/reply`)).toEqual({ decision: 'once' });
    expect(body(fake, `/api/session/${child}/form/frm_child/reply`)).toEqual({ answer: { choice: 'once' } });
  });

  it('automatically answers child requests and ignores unrelated sessions', async () => {
    const { chat, fake } = await attached({ overrides: routes }, { includeSubagents: true });
    chat.setPermissionMode('auto');
    await vi.waitFor(() => expect(chat.getState().permissions).toEqual([]));
    fake.emit('permission.asked', { ...request, id: 'perm_unrelated', sessionID: 'ses_unrelated' });
    await vi.waitFor(() => expect(fake.fetch.calls.some((call) => call.url.pathname === '/api/session/ses_unrelated')).toBe(true));
    expect(chat.getState().permissions).toEqual([]);
  });

  it('tracks live child form and permission settlement in order', async () => {
    const { chat, fake } = await attached({ overrides: {
      ...routes,
      'GET /api/permission/request': () => jsonResponse({ location: { directory: WORKSPACE_WIN }, data: [] }),
      'GET /api/form': () => jsonResponse({ location: { directory: WORKSPACE_WIN }, data: [] }),
    } }, { includeSubagents: true });
    fake.emit('permission.asked', request);
    fake.emit('form.created', { sessionID: child, form });
    await vi.waitFor(() => expect(chat.getState().permissions).toHaveLength(1));
    await vi.waitFor(() => expect(chat.getState().forms).toHaveLength(1));
    fake.emit('permission.replied', { sessionID: child, requestID: request.id });
    fake.emit('form.cancelled', { sessionID: child, id: form.id });
    await vi.waitFor(() => expect(chat.getState().permissions).toEqual([]));
    await vi.waitFor(() => expect(chat.getState().forms).toEqual([]));
  });
});
