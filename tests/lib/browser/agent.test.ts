// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import WebSocket from 'ws';
import { BRIDGE_ALARM, startBrowserAgent } from '@/lib/browser/agent';
import { setBrowserAccess } from '@/lib/browser/settings';
import { CONNECTION_KEY } from '@/lib/opencode/connection';
import { startFakeOpencode, type FakeOpencode } from '../../support/fake-opencode';

let fake: FakeOpencode;
let agent: ReturnType<typeof startBrowserAgent> | undefined;

beforeEach(async () => {
  fakeBrowser.reset();
  fake = await startFakeOpencode();
  await fakeBrowser.storage.local.set({
    [CONNECTION_KEY]: { baseUrl: fake.baseUrl, token: fake.token, expiresAt: 1999999999000, serverVersion: '2.2.5', pairedAt: 0 },
  });
});
afterEach(async () => {
  await agent?.bridge.stop();
  agent = undefined;
  await fake.close();
});

const start = () =>
  startBrowserAgent({
    WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    tools: () => [{ name: 'tabs_context', handler: () => ({ content: [{ type: 'text', text: 'ok' }] }) }],
  });

describe('startBrowserAgent', () => {
  it('stays off until browser access is turned on, then connects', async () => {
    agent = start();
    await new Promise((r) => setTimeout(r, 300));
    expect(fake.ticketRequests).toHaveLength(0);
    expect(agent.bridge.state).toBe('stopped');

    await setBrowserAccess(true);
    const server = await fake.waitForConnection();
    expect(server.tools.map((t) => t.name)).toEqual(['tabs_context']);
  });

  it('closes the connection when browser access is turned off', async () => {
    await setBrowserAccess(true);
    agent = start();
    const server = await fake.waitForConnection();
    await setBrowserAccess(false);
    await vi.waitFor(() => expect(server.open).toBe(false));
    expect(agent.bridge.state).toBe('stopped');
  });

  it('reconnects on the keepalive alarm when no connection is live', async () => {
    await setBrowserAccess(true);
    agent = start();
    expect(await fakeBrowser.alarms.get(BRIDGE_ALARM)).toMatchObject({ periodInMinutes: 0.5 });
    const first = await fake.waitForConnection();
    await agent.bridge.stop(); // as if the worker had been stopped
    await vi.waitFor(() => expect(first.open).toBe(false));
    await fakeBrowser.alarms.onAlarm.trigger({ name: BRIDGE_ALARM, scheduledTime: Date.now(), persistAcrossSessions: false });
    const second = await fake.waitForConnection();
    expect(second).not.toBe(first);
  });

  it('reconnects with the new pairing when the stored connection changes', async () => {
    await setBrowserAccess(true);
    agent = start();
    const first = await fake.waitForConnection();
    const stored = (await fakeBrowser.storage.local.get(CONNECTION_KEY))[CONNECTION_KEY] as Record<string, unknown>;
    await fakeBrowser.storage.local.set({ [CONNECTION_KEY]: { ...stored, pairedAt: 1 } });
    await vi.waitFor(() => expect(first.open).toBe(false));
    await fake.waitForConnection();
    expect(fake.ticketRequests).toHaveLength(2);
  });
});
