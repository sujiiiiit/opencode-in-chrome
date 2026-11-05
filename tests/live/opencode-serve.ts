// Starts a private `opencode serve` for live tests (OPENCODE_LIVE=1) and drives sessions on
// it with the kilo/kilo-auto/free model. The free model is weak, so prompts spell out the
// exact code-mode call to make (design D14).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OpenCode } from '@opencode/client';

export const LIVE = process.env.OPENCODE_LIVE === '1';
export const LIVE_MODEL = { providerID: 'kilo', id: 'kilo-auto/free' };

export type LiveServer = {
  baseUrl: string;
  password: string;
  directory: string;
  client: ReturnType<typeof OpenCode.make>;
  close(): void;
};

function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill('SIGTERM');
}

export async function startOpencodeServe(corsOrigin?: string): Promise<LiveServer> {
  const directory = mkdtempSync(path.join(tmpdir(), 'opencode-live-'));
  const child = spawn('opencode', ['serve', '--hostname', '127.0.0.1', '--port', '0', '--print-logs', ...(corsOrigin ? ['--cors', corsOrigin] : [])], {
    cwd: directory,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const found = await new Promise<{ baseUrl: string; password: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`opencode serve did not start:\n${output}`)), 60_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const url = /server listening on (http:\/\/[^\s]+)/.exec(output)?.[1];
      const password = /server password (\S+)/.exec(output)?.[1];
      if (url && password) {
        clearTimeout(timer);
        resolve({ baseUrl: url.replace(/\/$/, ''), password });
      }
    };
    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    child.on('exit', (code) => reject(new Error(`opencode serve exited with ${code}:\n${output}`)));
  });
  const client = OpenCode.make({
    baseUrl: found.baseUrl,
    headers: { authorization: 'Basic ' + Buffer.from('opencode:' + found.password).toString('base64') },
  });
  return { ...found, directory, client, close: () => killTree(child) };
}

export type LiveTurn = { text: string; toolParts: Array<{ name: string; state: Record<string, unknown> }> };

/** A fresh session with the live model in `directory`. */
export async function createSession(server: LiveServer, directory = server.directory, model = LIVE_MODEL): Promise<string> {
  const session = (await server.client.session.create({ location: { directory }, model })) as unknown as {
    data?: { id: string };
    id?: string;
  };
  return session.data?.id ?? session.id!;
}

export type LiveMessage = { type: string; content?: Array<Record<string, unknown>> };

/** The session's messages, oldest first. */
export async function sessionMessages(server: LiveServer, sessionID: string): Promise<LiveMessage[]> {
  const page = (await server.client.message.list({ sessionID, order: 'asc', limit: 200 })) as unknown as { data?: unknown[] };
  return (page.data ?? (page as unknown as unknown[])) as LiveMessage[];
}

/** Waits until the session has gone idle `idles` times in total (one per finished turn). */
export async function waitForIdle(server: LiveServer, sessionID: string, idles = 1, timeoutMs = 150_000): Promise<LiveMessage[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const items = await sessionMessages(server, sessionID);
    if (items.filter((m) => m.type === 'idle').length >= idles) return items;
  }
  throw new Error(`Session ${sessionID} did not finish in ${timeoutMs / 1000} s`);
}

/** The text and tool parts of a message list. */
export function turnOf(items: LiveMessage[]): LiveTurn {
  const parts = items.flatMap((m) => m.content ?? []);
  return {
    text: parts.filter((p) => p.type === 'text').map((p) => String(p.text)).join('\n'),
    toolParts: parts.filter((p) => p.type === 'tool').map((p) => ({ name: String(p.name), state: (p.state ?? {}) as Record<string, unknown> })),
  };
}

/** One prompt in a fresh session; waits until the session is idle. */
export async function runTurn(server: LiveServer, text: string, timeoutMs = 150_000): Promise<LiveTurn & { sessionID: string }> {
  const sessionID = await createSession(server);
  await server.client.session.prompt({ sessionID, text });
  return { sessionID, ...turnOf(await waitForIdle(server, sessionID, 1, timeoutMs)) };
}

/** A real pairing token for the extension: mint a one-time code with the password, redeem it. */
export async function pairToken(server: LiveServer): Promise<string> {
  const auth = 'Basic ' + Buffer.from('opencode:' + server.password).toString('base64');
  const pair = await fetch(`${server.baseUrl}/api/pair`, { method: 'POST', headers: { authorization: auth } });
  const { code } = (await pair.json()) as { code: string };
  const connect = await fetch(`${server.baseUrl}/auth/connect/${encodeURIComponent(code)}`, { headers: { accept: 'application/json' }, redirect: 'manual' });
  const { token } = (await connect.json()) as { token: string };
  return token;
}

/** Like runTurn, but in a given directory (the extension's workspace, where its tools are offered). */
export async function runTurnIn(server: LiveServer, directory: string, text: string, timeoutMs = 180_000) {
  return runTurn({ ...server, directory }, text, timeoutMs);
}
