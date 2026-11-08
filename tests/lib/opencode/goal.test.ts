import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/lib/opencode/connection';
import { EventHub } from '@/lib/opencode/events';
import { GoalStore, parseGoal } from '@/lib/opencode/goal';
import { fakeOpencode } from '@/tests/support/queue-server';
import { BASE, SESSION_ID, TOKEN, jsonResponse, unauthorized } from '@/tests/support/testkit';

const connection: Connection = { baseUrl: BASE, token: TOKEN, expiresAt: 1796106971000, serverVersion: '2.2.5', pairedAt: 1 };

const GOAL = { id: 'g1', objective: 'Ship the release', status: 'active', rounds: 2, maxRounds: 50, boot: 'b', updatedAt: 1 };

const cleanup: Array<{ dispose(): void }> = [];
afterEach(() => {
  for (const item of cleanup.splice(0)) item.dispose();
});

async function setup(get: () => Response = () => jsonResponse({ output: GOAL })) {
  const commands: unknown[] = [];
  const reads: unknown[] = [];
  const fake = fakeOpencode({
    overrides: {
      'POST /api/rpc/opencode.goal/get': async (call) => {
        reads.push(JSON.parse(String(call.init.body)));
        return get();
      },
      [`POST /api/session/${SESSION_ID}/command`]: async (call) => {
        commands.push(JSON.parse(String(call.init.body)));
        return new Response(null, { status: 204 });
      },
    },
  });
  const events = new EventHub({ connection, fetch: fake.fetch, retryMs: 0, idleMs: 500 });
  const onUnauthorized = vi.fn();
  const store = new GoalStore({ connection, events, fetch: fake.fetch, onUnauthorized });
  cleanup.push(store, events);
  await events.start();
  return { fake, store, commands, reads, onUnauthorized };
}

describe('parseGoal', () => {
  it('reads the plugin state and drops what it does not know', () => {
    expect(parseGoal(GOAL)).toEqual({ id: 'g1', objective: 'Ship the release', status: 'active', reason: undefined, rounds: 2, maxRounds: 50 });
    expect(parseGoal(null)).toBeNull();
    expect(parseGoal({ ...GOAL, status: 'odd' })).toBeNull();
  });
});

describe('GoalStore', () => {
  it("reads the session's goal when it starts watching", async () => {
    const { store, reads } = await setup();
    store.watch(SESSION_ID);
    await vi.waitFor(() => expect(store.getState().goal?.objective).toBe('Ship the release'));
    expect(reads).toEqual([{ input: { sessionID: SESSION_ID } }]);
  });

  it('follows changed events for its own session only', async () => {
    const { store, fake } = await setup(() => jsonResponse({ output: null }));
    store.watch(SESSION_ID);
    await vi.waitFor(() => expect(store.getState().goal).toBeNull());
    fake.emit('rpc.opencode.goal.changed', { sessionID: 'ses_other', goal: GOAL });
    fake.emit('rpc.opencode.goal.changed', { sessionID: SESSION_ID, goal: { ...GOAL, status: 'paused', reason: 'Paused by the user' } });
    await vi.waitFor(() => expect(store.getState().goal).toMatchObject({ status: 'paused', reason: 'Paused by the user' }));
    fake.emit('rpc.opencode.goal.changed', { sessionID: SESSION_ID, goal: null });
    await vi.waitFor(() => expect(store.getState().goal).toBeNull());
  });

  it('shows no goal on a server without the goal plugin', async () => {
    const { store } = await setup(() => jsonResponse({ _tag: 'NotFound', message: 'no rpc' }, 404));
    store.watch(SESSION_ID);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().goal).toBeNull();
  });

  it('runs pause, resume and clear as /goal commands', async () => {
    const { store, commands } = await setup();
    store.watch(SESSION_ID);
    await store.run('pause');
    await store.run('clear');
    expect(commands).toEqual([
      expect.objectContaining({ name: 'goal', text: 'pause' }),
      expect.objectContaining({ name: 'goal', text: 'clear' }),
    ]);
    expect(store.getState().notice).toBeNull();
  });

  it('reports a lapsed token', async () => {
    const { store, onUnauthorized } = await setup(() => unauthorized());
    store.watch(SESSION_ID);
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });
});
