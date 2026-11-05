// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { Bridge, ticketUrl, type BridgeState } from '@/lib/browser/bridge';
import type { Connection } from '@/lib/opencode/connection';
import { FAKE_WORKSPACE, startFakeOpencode, type FakeOpencode } from '../../support/fake-opencode';

let fake: FakeOpencode | undefined;
let bridge: Bridge | undefined;
afterEach(async () => {
  await bridge?.stop();
  await fake?.close();
  bridge = undefined;
  fake = undefined;
});

const connectionFor = (f: FakeOpencode): Connection => ({
  baseUrl: f.baseUrl,
  token: f.token,
  expiresAt: 1999999999000,
  serverVersion: '2.2.5',
  pairedAt: 0,
});

function makeBridge(f: FakeOpencode, overrides: Partial<ConstructorParameters<typeof Bridge>[0]> = {}) {
  const states: BridgeState[] = [];
  const seen: Array<string | undefined> = [];
  const b = new Bridge({
    WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    loadConnection: async () => connectionFor(f),
    onState: (s) => states.push(s),
    tools: () => [
      {
        name: 'tabs_context',
        description: 'List tabs',
        handler: (_args, ctx) => {
          seen.push(ctx.sessionID);
          return { content: [{ type: 'text', text: `session ${ctx.sessionID}` }] };
        },
      },
    ],
    ...overrides,
  });
  return { bridge: b, states, seen };
}

describe('ticketUrl', () => {
  it('puts only the ticket in the query', () => {
    expect(ticketUrl('http://127.0.0.1:4096', 'tk_1')).toBe('http://127.0.0.1:4096/?ticket=tk_1');
    expect(ticketUrl('http://127.0.0.1:4096/base?x=1', 'a b')).toBe('http://127.0.0.1:4096/base/?ticket=a+b');
  });
});

describe('Bridge against the fake server', () => {
  it('serves its tools to sessions in the workspace and passes the session id', async () => {
    fake = await startFakeOpencode();
    const made = makeBridge(fake);
    bridge = made.bridge;
    bridge.start();
    const server = await fake.waitForConnection();
    expect(server.name).toBe('browser');
    expect(server.directory).toBe(FAKE_WORKSPACE);
    expect(server.tools.map((t) => t.name)).toEqual(['tabs_context']);
    const result = await server.callTool('ses_A', 'tabs_context');
    expect(result.content).toEqual([{ type: 'text', text: 'session ses_A' }]);
    expect(made.seen).toEqual(['ses_A']);
    await vi.waitFor(() => expect(bridge!.state).toBe('connected'));
  });

  it('asks for a ticket with the name and never sends the token in a URL', async () => {
    fake = await startFakeOpencode();
    const urls: string[] = [];
    class Spy extends (WebSocket as unknown as typeof globalThis.WebSocket) {
      constructor(url: string | URL) {
        urls.push(String(url));
        super(url);
      }
    }
    bridge = makeBridge(fake, { WebSocket: Spy }).bridge;
    bridge.start();
    await fake.waitForConnection();
    expect(fake.ticketRequests).toEqual([{ name: 'browser' }]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('ticket=tk_');
    expect(urls[0]).not.toContain(fake.token);
  });

  it('reconnects with a fresh ticket after the server drops the socket', async () => {
    fake = await startFakeOpencode();
    bridge = makeBridge(fake).bridge;
    bridge.start();
    const first = await fake.waitForConnection();
    fake.dropConnections();
    await vi.waitFor(() => expect(first.open).toBe(false));
    const second = await fake.waitForConnection();
    expect(second).not.toBe(first);
    expect(fake.ticketRequests).toHaveLength(2);
    expect((await second.callTool('ses_B', 'tabs_context')).content[0]).toEqual({ type: 'text', text: 'session ses_B' });
  });

  it('closes the connection on stop and stays stopped', async () => {
    fake = await startFakeOpencode();
    bridge = makeBridge(fake).bridge;
    bridge.start();
    const server = await fake.waitForConnection();
    await bridge.stop();
    await vi.waitFor(() => expect(server.open).toBe(false));
    expect(bridge.state).toBe('stopped');
    await new Promise((r) => setTimeout(r, 700));
    expect(fake.connections.filter((c) => c.open)).toHaveLength(0);
  });

  it('is unpaired without a stored connection or with an expired token', async () => {
    fake = await startFakeOpencode();
    const none = makeBridge(fake, { loadConnection: async () => null });
    bridge = none.bridge;
    bridge.start();
    await vi.waitFor(() => expect(none.states).toContain('unpaired'));
    expect(fake.ticketRequests).toHaveLength(0);

    const expired = makeBridge(fake, { now: () => 2_000_000_000_000 });
    await expired.bridge.start();
    await vi.waitFor(() => expect(expired.bridge.state).toBe('unpaired'));
    expect(fake.ticketRequests).toHaveLength(0);
  });

  it('is unpaired when the server rejects the token', async () => {
    fake = await startFakeOpencode();
    bridge = makeBridge(fake, {
      loadConnection: async () => ({ ...connectionFor(fake!), token: '1999999999.wrong' }),
    }).bridge;
    bridge.start();
    await vi.waitFor(() => expect(bridge!.state).toBe('unpaired'));
  });

  it('retries while the server is offline and connects when it is back', async () => {
    fake = await startFakeOpencode();
    const offline = { ...connectionFor(fake), baseUrl: 'http://127.0.0.1:1' };
    let target = offline;
    const made = makeBridge(fake, { loadConnection: async () => target });
    bridge = made.bridge;
    bridge.start();
    await vi.waitFor(() => expect(made.states).toContain('retrying'));
    target = connectionFor(fake);
    await fake.waitForConnection(15_000);
    await vi.waitFor(() => expect(bridge!.state).toBe('connected'));
  });
});
