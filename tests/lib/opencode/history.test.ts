import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/lib/opencode/connection';
import { EventHub } from '@/lib/opencode/events';
import { HistoryStore, filterByTitle } from '@/lib/opencode/history';
import {
  extensionSession,
  fakeOpencode,
  type FakeOpencodeOptions,
  type SessionRow,
} from '@/tests/support/queue-server';
import { BASE, TOKEN, WORKSPACE_WIN, unauthorized } from '@/tests/support/testkit';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: 1796106971000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

const cleanup: Array<{ dispose(): void }> = [];
afterEach(() => {
  for (const item of cleanup.splice(0)) item.dispose();
});

const cli = (id: string, directory: string): SessionRow => ({
  id,
  title: 'CLI chat',
  time: { created: 1, updated: 1 },
  location: { directory },
});

async function setup(
  server: FakeOpencodeOptions = {},
  onUnauthorized = vi.fn(),
  /** Wraps the store's fetch (the event stream keeps the plain one). */
  wrap: (fetch: typeof globalThis.fetch) => typeof globalThis.fetch = (fetch) => fetch,
) {
  const fake = fakeOpencode(server);
  const events = new EventHub({ connection, fetch: fake.fetch, retryMs: 0, idleMs: 500 });
  const store = new HistoryStore({ connection, events, fetch: wrap(fake.fetch), onUnauthorized });
  cleanup.push(store, events);
  await events.start();
  await store.load();
  return { fake, store, events, onUnauthorized };
}

const ids = (store: HistoryStore) => store.getState().items.map((item) => item.id);

describe('HistoryStore.load', () => {
  it('asks only for root, unarchived sessions in the workspace folder, newest first', async () => {
    const { fake, store } = await setup({
      sessions: [extensionSession('ses_a', 'A', 20), extensionSession('ses_b', 'B', 10)],
    });
    const query = fake.listQueries[0]!;
    expect(query.get('directory')).toBe(WORKSPACE_WIN);
    expect(query.get('parentID')).toBe('null');
    expect(query.get('archived')).toBe('false');
    expect(query.get('order')).toBe('desc');
    expect(store.getState()).toMatchObject({ status: 'ready', hasMore: false });
    expect(ids(store)).toEqual(['ses_a', 'ses_b']);
  });

  it('lists untagged chats made before the tag (their old fixed title)', async () => {
    const legacy: SessionRow = { ...cli('ses_legacy', WORKSPACE_WIN), title: 'Chrome chat' };
    const { store } = await setup({ sessions: [extensionSession('ses_new', 'New', 30), legacy] });
    expect(ids(store)).toEqual(['ses_new', 'ses_legacy']);
  });

  it('never lists CLI chats, even one started inside the workspace folder', async () => {
    const { store } = await setup({
      sessions: [
        extensionSession('ses_ours', 'Ours', 30),
        cli('ses_repo', 'D:\\repo'),
        cli('ses_inside', WORKSPACE_WIN),
      ],
    });
    expect(ids(store)).toEqual(['ses_ours']);
  });

  it('searches on the server and drops a slower, older search', async () => {
    const { fake, store } = await setup({
      sessions: [extensionSession('ses_login', 'Fix login', 20), extensionSession('ses_regex', 'Regex', 10)],
    });
    await store.load('login');
    expect(fake.listQueries.at(-1)!.get('search')).toBe('login');
    expect(store.getState()).toMatchObject({ search: 'login' });
    expect(ids(store)).toEqual(['ses_login']);

    const slow = store.load('regex');
    const fast = store.load('');
    await Promise.all([slow, fast]);
    expect(store.getState().search).toBe('');
    expect(ids(store)).toEqual(['ses_login', 'ses_regex']);
  });

  it('pages with the cursor', async () => {
    const sessions = Array.from({ length: 35 }, (_, i) =>
      extensionSession(`ses_${String(i).padStart(2, '0')}`, `Chat ${i}`, 100 - i),
    );
    const { fake, store } = await setup({ sessions });
    expect(store.getState()).toMatchObject({ hasMore: true });
    expect(ids(store)).toHaveLength(30);
    await store.loadMore();
    expect(fake.listQueries.at(-1)!.get('cursor')).toBe('30');
    expect(ids(store)).toHaveLength(35);
    expect(store.getState().hasMore).toBe(false);
  });

  it('fails with a message, and reports a rejected token', async () => {
    const onUnauthorized = vi.fn();
    const { store } = await setup({ overrides: { 'GET /api/session': () => unauthorized() } }, onUnauthorized);
    expect(store.getState().status).toBe('failed');
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('HistoryStore live updates', () => {
  it('adds a chat this extension creates and ignores ones made elsewhere', async () => {
    const { fake, store } = await setup({ sessions: [extensionSession('ses_old', 'Old', 1)] });
    fake.emit('session.created', { sessionID: 'ses_cli', location: { directory: 'D:\\repo' } });
    fake.emit('session.created', {
      sessionID: 'ses_new',
      location: { directory: WORKSPACE_WIN },
      metadata: { source: 'chrome-extension' },
    });
    await vi.waitFor(() => expect(ids(store)).toEqual(['ses_new', 'ses_old']));
  });

  it('follows renames and deletions from any client', async () => {
    const { fake, store } = await setup({
      sessions: [extensionSession('ses_a', 'A', 2), extensionSession('ses_b', 'B', 1)],
    });
    fake.emit('session.renamed', { sessionID: 'ses_b', title: 'Named by opencode' });
    fake.emit('session.deleted', { sessionID: 'ses_a' });
    await vi.waitFor(() => expect(store.getState().items).toMatchObject([{ id: 'ses_b', title: 'Named by opencode' }]));
  });

  it('reloads the first page after a reconnect', async () => {
    const { fake, store } = await setup({ sessions: [extensionSession('ses_a', 'A', 1)] });
    fake.sessions.unshift(extensionSession('ses_missed', 'Made while offline', 5));
    fake.streams[0]!.close();
    await vi.waitFor(() => expect(ids(store)).toEqual(['ses_missed', 'ses_a']));
  });
});

describe('HistoryStore rename and delete', () => {
  it('renames right away and saves it on the server', async () => {
    const { fake, store } = await setup({ sessions: [extensionSession('ses_a', 'A', 1)] });
    const saving = store.rename('ses_a', '  Better name ');
    expect(store.getState().items[0]!.title).toBe('Better name');
    expect(store.getState().items[0]!.updated).toBeGreaterThan(1);
    expect(await saving).toBe(true);
    expect(fake.log).toContain('rename:ses_a:Better name');
    // Tagged, so an older untagged chat stays listed once its legacy title is gone.
    const patch = fake.fetch.calls.find(
      (call) => call.method === 'PATCH' && call.url.pathname === '/api/session/ses_a',
    )!;
    expect(JSON.parse(patch.init.body as string)).toMatchObject({ metadata: { source: 'chrome-extension' } });
  });

  it('ignores a blank or unchanged title', async () => {
    const { fake, store } = await setup({ sessions: [extensionSession('ses_a', 'A', 1)] });
    expect(await store.rename('ses_a', '   ')).toBe(false);
    expect(await store.rename('ses_a', 'A')).toBe(false);
    expect(fake.log.filter((entry) => entry.startsWith('rename'))).toEqual([]);
  });

  it('puts the old title back and shows a notice when the server refuses', async () => {
    const { fake, store } = await setup({ sessions: [extensionSession('ses_a', 'A', 1)] });
    fake.hooks.onSessionChange = () => {
      throw new Error('Rename failed on the server');
    };
    expect(await store.rename('ses_a', 'B')).toBe(false);
    expect(store.getState().items[0]!.title).toBe('A');
    expect(store.getState().notice).toBe("Couldn't rename this chat. Try again.");
  });

  it('deletes a chat', async () => {
    const { fake, store } = await setup({
      sessions: [extensionSession('ses_a', 'A', 2), extensionSession('ses_b', 'B', 1)],
    });
    expect(await store.remove('ses_a')).toBe(true);
    expect(fake.log).toContain('delete:ses_a');
    expect(ids(store)).toEqual(['ses_b']);
  });

  it('keeps the chat and shows a notice when a delete fails', async () => {
    const { fake, store } = await setup({ sessions: [extensionSession('ses_a', 'A', 1)] });
    fake.hooks.onSessionChange = () => {
      throw new Error('Delete failed');
    };
    expect(await store.remove('ses_a')).toBe(false);
    expect(ids(store)).toEqual(['ses_a']);
    expect(store.getState().notice).toBe("Couldn't delete this chat. Try again.");
  });
});

/** Holds back session-list answers until released, and records each list request's signal. */
function gate(inner: typeof globalThis.fetch) {
  const held: Array<() => void> = [];
  const signals: Array<{ search: string | null; signal: AbortSignal | undefined }> = [];
  let holding = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/api/session') {
      signals.push({ search: url.searchParams.get('search'), signal: init?.signal ?? undefined });
      if (holding) await new Promise<void>((resolve) => held.push(resolve));
    }
    return inner(input, init);
  };
  return {
    fetch,
    signals,
    hold: () => void (holding = true),
    release: () => {
      holding = false;
      for (const resolve of held.splice(0)) resolve();
    },
  };
}

async function gatedSetup(server: FakeOpencodeOptions) {
  let gated!: ReturnType<typeof gate>;
  const { fake, store } = await setup(server, vi.fn(), (fetch) => (gated = gate(fetch)).fetch);
  return { fake, store, gated };
}

describe('HistoryStore: smooth search', () => {
  const sessions = [extensionSession('ses_login', 'Fix login', 20), extensionSession('ses_regex', 'Regex', 10)];

  it('keeps the rows on screen while a search loads', async () => {
    const { store, gated } = await gatedSetup({ sessions });
    gated.hold();
    const search = store.load('login');
    expect(store.getState()).toMatchObject({ status: 'loading', search: 'login' });
    expect(ids(store)).toEqual(['ses_login', 'ses_regex']);
    gated.release();
    await search;
    expect(ids(store)).toEqual(['ses_login']);
  });

  it('shows the full list at once when a search is cleared, then refreshes it', async () => {
    const { store, gated } = await gatedSetup({ sessions });
    await store.load('login');
    gated.hold();
    const clear = store.load('');
    expect(ids(store)).toEqual(['ses_login', 'ses_regex']);
    gated.release();
    await clear;
    expect(store.getState()).toMatchObject({ status: 'ready', search: '' });
  });

  it('keeps the full list current while a search is shown', async () => {
    const { fake, store, gated } = await gatedSetup({ sessions });
    await store.load('login');
    fake.emit('session.deleted', { sessionID: 'ses_regex' });
    fake.emit('session.renamed', { sessionID: 'ses_login', title: 'Fix login flow' });
    await vi.waitFor(() => expect(store.getState().items[0]?.title).toBe('Fix login flow'));
    gated.hold();
    const clear = store.load('');
    expect(store.getState().items.map((item) => [item.id, item.title])).toEqual([['ses_login', 'Fix login flow']]);
    gated.release();
    await clear;
  });

  it('aborts a search that a newer one replaced', async () => {
    const { store, gated } = await gatedSetup({ sessions });
    gated.hold();
    const first = store.load('log');
    const second = store.load('login');
    gated.release();
    await Promise.all([first, second]);
    const bySearch = (search: string) => gated.signals.find((entry) => entry.search === search)!.signal!;
    expect(bySearch('log').aborted).toBe(true);
    expect(bySearch('login').aborted).toBe(false);
    expect(ids(store)).toEqual(['ses_login']);
  });
});

describe('filterByTitle', () => {
  const rows = [
    { id: 'a', title: 'Fix Login redirect', created: 1, updated: 1 },
    { id: 'b', title: null, created: 1, updated: 1 },
    { id: 'c', title: 'Regex', created: 1, updated: 1 },
  ];

  it('matches the title, ignoring case and surrounding spaces, like the server', () => {
    expect(filterByTitle(rows, '  login ').map((row) => row.id)).toEqual(['a']);
  });

  it('returns the same list for an empty search, and skips untitled chats', () => {
    expect(filterByTitle(rows, ' ')).toBe(rows);
    expect(filterByTitle(rows, 'e').map((row) => row.id)).toEqual(['a', 'c']);
  });
});
