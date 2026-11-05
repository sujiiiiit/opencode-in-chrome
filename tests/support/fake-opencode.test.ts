// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { connectClientMcp } from '@opencode/client/mcp';
import WebSocket from 'ws';
import { startFakeOpencode, type FakeOpencode } from './fake-opencode';

let fake: FakeOpencode | undefined;
afterEach(async () => {
  await fake?.close();
  fake = undefined;
});

const auth = (token: string) => ({ authorization: 'Basic ' + Buffer.from('opencode:' + token).toString('base64') });

describe('fake opencode', () => {
  it('round-trips a client-MCP tool call with the session id', async () => {
    fake = await startFakeOpencode();
    const res = await fetch(`${fake.baseUrl}/api/experimental/client-mcp/token?name=browser`, {
      method: 'POST',
      headers: { ...auth(fake.token), 'x-opencode-ticket': '1' },
    });
    const { data } = (await res.json()) as { data: { ticket: string } };
    const seen: Array<string | undefined> = [];
    const conn = connectClientMcp({
      url: `${fake.baseUrl}/?ticket=${data.ticket}`,
      name: 'browser',
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
      tools: [
        {
          name: 'echo',
          handler: (args, ctx) => {
            seen.push(ctx.sessionID);
            return { content: [{ type: 'text', text: `echo ${String(args.v)}` }] };
          },
        },
      ],
    });
    const server = await fake.waitForConnection();
    expect(server.name).toBe('browser');
    expect(server.tools.map((t) => t.name)).toEqual(['echo']);
    const result = await server.callTool('ses_1', 'echo', { v: 7 });
    expect(result.content).toEqual([{ type: 'text', text: 'echo 7' }]);
    expect(seen).toEqual(['ses_1']);
    await conn.close();
  });

  it('refuses a socket without a valid ticket and requests without the token', async () => {
    fake = await startFakeOpencode();
    expect((await fetch(`${fake.baseUrl}/api/model`)).status).toBe(401);
    const socket = new WebSocket(`${fake.baseUrl.replace('http', 'ws')}/api/experimental/client-mcp?ticket=nope`);
    const outcome = await new Promise<string>((resolve) => {
      socket.on('open', () => resolve('open'));
      socket.on('error', () => resolve('error'));
    });
    expect(outcome).toBe('error');
  });

  it('stores forms and lets a test answer them', async () => {
    fake = await startFakeOpencode();
    const res = await fetch(`${fake.baseUrl}/api/session/ses_1/form`, {
      method: 'POST',
      headers: { ...auth(fake.token), 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Allow?', fields: [] }),
    });
    const { data } = (await res.json()) as { data: { id: string } };
    fake.answerForm(data.id, { choice: 'allow' });
    const got = await fetch(`${fake.baseUrl}/api/session/ses_1/form/${data.id}`, { headers: auth(fake.token) });
    expect(((await got.json()) as { data: { state: unknown } }).data.state).toEqual({
      status: 'answered',
      answer: { choice: 'allow' },
    });
  });
});
