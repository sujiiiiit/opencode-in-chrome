// @vitest-environment node
// Live: a real opencode server and model call the extension's bridge (OPENCODE_LIVE=1).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Bridge } from '@/lib/browser/bridge';
import { LIVE, runTurn, startOpencodeServe, type LiveServer } from './opencode-serve';

describe.skipIf(!LIVE)('bridge with a real opencode server and kilo/kilo-auto/free', () => {
  let server: LiveServer;
  let bridge: Bridge;
  const calls: Array<string | undefined> = [];

  beforeAll(async () => {
    server = await startOpencodeServe();
    bridge = new Bridge({
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
      // The server password works as the Basic credential the stored token normally is.
      loadConnection: async () => ({ baseUrl: server.baseUrl, token: server.password, expiresAt: 0, serverVersion: '', pairedAt: 0 }),
      directory: async () => server.directory,
      tools: () => [
        {
          name: 'tabs_context',
          description: "List this chat session's browser tabs.",
          inputSchema: { type: 'object', properties: { createIfEmpty: { type: 'boolean' } } },
          handler: (_args, ctx) => {
            calls.push(ctx.sessionID);
            return { content: [{ type: 'text', text: 'Tabs in this session (current: 101):\n- 101 "Live Fixture" https://example.test/' }] };
          },
        },
      ],
    });
    bridge.start();
    const deadline = Date.now() + 20_000;
    while (bridge.state !== 'connected' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
    expect(bridge.state).toBe('connected');
  }, 90_000);

  afterAll(async () => {
    await bridge?.stop();
    server?.close();
  });

  it('the model calls tools.browser.tabs_context in code mode and the call carries its session', async () => {
    const turn = await runTurn(
      server,
      'Run this with your execute tool exactly: `return await tools.browser.tabs_context({ createIfEmpty: false });` ' +
        'Then reply with only the tab title it reports.',
    );
    const execute = turn.toolParts.find((p) => p.name === 'execute');
    expect(execute, JSON.stringify(turn.toolParts)).toBeDefined();
    const inner = (execute!.state.metadata as { toolCalls?: Array<{ tool: string }> }).toolCalls ?? [];
    expect(inner.map((c) => c.tool)).toContain('browser.tabs_context');
    expect(calls).toContain(turn.sessionID);
    expect(turn.text).toMatch(/Live Fixture/);
  }, 180_000);
});
