import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_MESSAGE } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import { EventHub, type EventHubOptions, type HubStatus } from '@/lib/opencode/events';
import type { ServerEvent } from '@/lib/opencode/sse';
import { fakeOpencode } from '@/tests/support/queue-server';
import { BASE, TOKEN, unauthorized } from '@/tests/support/testkit';

const connection: Connection = {
  baseUrl: BASE,
  token: TOKEN,
  expiresAt: 1796106971000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

const hubs: EventHub[] = [];
afterEach(() => {
  for (const hub of hubs.splice(0)) hub.dispose();
});

function setup(options: Partial<EventHubOptions> = {}) {
  const fake = fakeOpencode();
  let down = false;
  const fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) =>
      down ? Promise.reject(new TypeError('Failed to fetch')) : fake.fetch(input, init),
    { calls: fake.fetch.calls },
  );
  const hub = new EventHub({ connection, fetch, retryMs: 0, idleMs: 200, ...options });
  hubs.push(hub);
  const statuses: HubStatus['state'][] = [];
  hub.onStatus((status) => statuses.push(status.state));
  return { fake, hub, statuses, goOffline: () => (down = true) };
}

describe('EventHub', () => {
  it('connects once for concurrent starts and fans events out to every subscriber', async () => {
    const { fake, hub, statuses } = setup();
    await Promise.all([hub.start(), hub.start()]);
    expect(fake.streams).toHaveLength(1);
    expect(statuses).toEqual(['connecting', 'connected']);

    const a: ServerEvent[] = [];
    const b: ServerEvent[] = [];
    hub.subscribe((event) => a.push(event));
    const stop = hub.subscribe((event) => b.push(event));
    fake.start();
    await vi.waitFor(() => expect(a.map((e) => e.type)).toEqual(['session.execution.started']));
    expect(b).toHaveLength(1);

    stop();
    fake.emit('session.execution.succeeded', {});
    await vi.waitFor(() => expect(a).toHaveLength(2));
    expect(b).toHaveLength(1);
  });

  it('reconnects after a drop and runs every resync before reporting connected', async () => {
    const { fake, hub, statuses } = setup();
    await hub.start();
    const order: string[] = [];
    hub.onReconnect(async () => void order.push('resync-a'));
    hub.onReconnect(async () => void order.push('resync-b'));
    hub.onStatus((status) => order.push(status.state));
    fake.streams[0]!.close();

    await vi.waitFor(() => expect(order).toEqual(['reconnecting', 'resync-a', 'resync-b', 'connected']));
    expect(fake.streams).toHaveLength(2);
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting', 'connected']);
  });

  it('counts a failed resync as a failed attempt and retries', async () => {
    const { fake, hub } = setup();
    await hub.start();
    let calls = 0;
    hub.onReconnect(async () => {
      calls += 1;
      if (calls === 1) throw new Error('resync failed');
    });
    fake.streams[0]!.close();
    await vi.waitFor(() => expect(calls).toBe(2));
    await vi.waitFor(() => expect(hub.getStatus().state).toBe('connected'));
  });

  it('gives up after repeated failures with the offline message, and start() tries again', async () => {
    const { fake, hub, goOffline } = setup();
    await hub.start();
    goOffline();
    fake.streams[0]!.close();
    await vi.waitFor(() => expect(hub.getStatus()).toEqual({ state: 'failed', error: OFFLINE_MESSAGE }));
    await expect(hub.start()).rejects.toThrow();
  });

  it('reports a rejected token on the first connect and on reconnect', async () => {
    const onUnauthorized = vi.fn();
    const first = setup({ onUnauthorized });
    first.fake.hooks.onEvent = () => unauthorized();
    await expect(first.hub.start()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();

    const later = setup({ onUnauthorized });
    await later.hub.start();
    later.fake.hooks.onEvent = () => unauthorized();
    later.fake.streams[0]!.close();
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(2));
    expect(later.hub.getStatus().state).toBe('failed');
  });

  it('closes the stream and stops reconnecting on dispose', async () => {
    const { fake, hub } = setup();
    await hub.start();
    hub.dispose();
    fake.streams[0]!.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.streams).toHaveLength(1);
    await expect(hub.start()).rejects.toThrow();
  });
});
