// @vitest-environment node
// The standalone MCP path end to end, with real processes: an MCP client (this test) talks to
// mcp/server.mjs over stdio; the server reaches mcp/host.mjs over the pipe; the test plays
// Chrome + the extension on the host's native-messaging stdin/stdout.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readLines, readNative, writeLine, writeNative } from '../../mcp/framing.mjs';
import { listBrowsers, pipePath } from '../../mcp/paths.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const stateDir = mkdtempSync(path.join(tmpdir(), 'ocb-'));
const pipe = process.platform === 'win32' ? `\\\\.\\pipe\\ocb-test-${process.pid}` : path.join(stateDir, 'mcp.sock');
const env = { ...process.env, OPENCODE_BROWSER_STATE_DIR: stateDir, OPENCODE_BROWSER_PIPE: pipe };
process.env.OPENCODE_BROWSER_STATE_DIR = stateDir;

let host: ChildProcessWithoutNullStreams;
let server: ChildProcessWithoutNullStreams;
const fromServer: Array<Record<string, unknown>> = [];
const seenByExtension: Array<Record<string, unknown>> = [];

const TOOL = { name: 'read_page', description: 'Read the page', inputSchema: { type: 'object', properties: {} } };

function next(predicate: (m: Record<string, unknown>) => boolean, timeoutMs = 8000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const found = fromServer.find(predicate);
      if (found) return resolve(found);
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out; got ${JSON.stringify(fromServer)}`));
      setTimeout(tick, 25);
    };
    tick();
  });
}

beforeAll(async () => {
  host = spawn(process.execPath, [path.join(root, 'mcp/host.mjs')], { env });
  // The fake extension: answers the server's requests through the host.
  await new Promise<void>((ready) => {
    readNative(host.stdout, (message: Record<string, unknown>) => {
      if (message.type === 'host.ready') return ready();
      seenByExtension.push(message);
      if (message.type === 'guide') writeNative(host.stdin, { id: message.id, result: 'GUIDE' });
      if (message.type === 'tools/list') writeNative(host.stdin, { id: message.id, result: { tools: [TOOL] } });
      if (message.type === 'tools/call') writeNative(host.stdin, { id: message.id, result: { content: [{ type: 'text', text: `called ${String(message.name)}` }] } });
    });
  });
  server = spawn(process.execPath, [path.join(root, 'mcp/server.mjs')], { env });
  readLines(server.stdout, (m: Record<string, unknown>) => fromServer.push(m));
}, 20_000);

afterAll(() => {
  server?.kill();
  host?.stdin.end();
  host?.kill();
  rmSync(stateDir, { recursive: true, force: true });
});

describe('standalone MCP server', () => {
  it('initializes with the extension guide as instructions', async () => {
    writeLine(server.stdin, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    const init = await next((m) => m.id === 1);
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'opencode-in-chrome' }, instructions: expect.stringContaining('GUIDE') });
  });

  it('lists and calls the extension tools as one mcp- session', async () => {
    writeLine(server.stdin, { jsonrpc: '2.0', method: 'notifications/initialized' });
    writeLine(server.stdin, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = ((await next((m) => m.id === 2)).result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toEqual(['read_page', 'list_connected_browsers', 'select_browser']);
    writeLine(server.stdin, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_page', arguments: { tabId: 4 } } });
    expect((await next((m) => m.id === 3)).result).toEqual({ content: [{ type: 'text', text: 'called read_page' }] });
    const call = seenByExtension.find((m) => m.type === 'tools/call')!;
    expect(call).toMatchObject({ name: 'read_page', arguments: { tabId: 4 } });
    expect(String(call.sessionID)).toMatch(/^mcp-[0-9a-f]{8}$/);
  });

  it('reads file_upload paths on its own machine and sends the contents along', async () => {
    const file = path.join(stateDir, 'note.txt');
    writeFileSync(file, 'hello upload');
    writeLine(server.stdin, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'file_upload', arguments: { ref: 'e1', paths: [file] } } });
    await next((m) => m.id === 4);
    const call = seenByExtension.filter((m) => m.type === 'tools/call').at(-1)!;
    expect((call.arguments as { files: unknown[] }).files).toEqual([{ name: 'note.txt', base64: Buffer.from('hello upload').toString('base64') }]);
    writeLine(server.stdin, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'file_upload', arguments: { ref: 'e1', paths: [path.join(stateDir, 'missing.txt')] } } });
    const missing = await next((m) => m.id === 5);
    expect(JSON.stringify(missing.result)).toMatch(/Could not read .*missing\.txt/);
  });

  it('a client without the token is refused', async () => {
    const net = await import('node:net');
    const closed = await new Promise<boolean>((resolve) => {
      const socket = net.connect(listBrowsers()[0]!.pipe, () => writeLine(socket, { type: 'hello', token: 'wrong' }));
      socket.on('close', () => resolve(true));
      socket.on('data', () => resolve(false));
    });
    expect(closed).toBe(true);
  });

  it('lists the connected browser and keeps its token out of the answer', async () => {
    writeLine(server.stdin, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_connected_browsers', arguments: {} } });
    const text = JSON.stringify((await next((m) => m.id === 6)).result);
    expect(text).toContain('Connected browsers');
    expect(text).toMatch(/- [0-9a-f]{6}: /);
    expect(text).not.toContain(listBrowsers()[0]!.token);
  });

  it('serves several browsers at once, prefers your own profile, and select_browser switches', async () => {
    const second = spawn(process.execPath, [path.join(root, 'mcp/host.mjs')], { env });
    const calls: Array<Record<string, unknown>> = [];
    await new Promise<void>((ready) => {
      readNative(second.stdout, (message: Record<string, unknown>) => {
        if (message.type === 'host.ready') return ready();
        calls.push(message);
        if (message.type === 'tools/call') writeNative(second.stdin, { id: message.id, result: { content: [{ type: 'text', text: 'second browser' }] } });
      });
    });
    try {
      const both = await vi.waitFor(() => {
        const found = listBrowsers();
        if (found.length < 2) throw new Error('second host not listed yet');
        return found;
      });
      expect(new Set(both.map((b: { id: string }) => b.id)).size).toBe(2);
      const secondId = both.find((b: { pid: number }) => b.pid === second.pid)!.id;
      writeLine(server.stdin, { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'select_browser', arguments: { browser: secondId } } });
      expect(JSON.stringify((await next((m) => m.id === 7)).result)).toContain('Now using');
      writeLine(server.stdin, { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'read_page', arguments: {} } });
      expect(JSON.stringify((await next((m) => m.id === 8)).result)).toContain('second browser');
      writeLine(server.stdin, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'select_browser', arguments: { browser: 'nope' } } });
      expect((await next((m) => m.id === 9)).result).toMatchObject({ isError: true });
    } finally {
      second.stdin.end();
      second.kill();
    }
  });

  it('removes a host from the list when it exits', async () => {
    await vi.waitFor(() => {
      if (listBrowsers().length !== 1) throw new Error('still listed');
    });
  });

  it('names a distinct pipe for each host, in the Windows pipe namespace there', () => {
    const saved = process.env.OPENCODE_BROWSER_PIPE;
    delete process.env.OPENCODE_BROWSER_PIPE;
    try {
      expect(pipePath('aaaaaa')).not.toBe(pipePath('bbbbbb'));
      if (process.platform === 'win32') expect(pipePath('aaaaaa').startsWith('\\\\.\\pipe\\')).toBe(true);
    } finally {
      if (saved !== undefined) process.env.OPENCODE_BROWSER_PIPE = saved;
    }
  });

  it('tells the extension which sessions a closed client had, so their tabs can be released', async () => {
    const other = spawn(process.execPath, [path.join(root, 'mcp/server.mjs')], { env });
    const answers: Array<Record<string, unknown>> = [];
    readLines(other.stdout, (m: Record<string, unknown>) => answers.push(m));
    writeLine(other.stdin, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_page', arguments: {} } });
    await vi.waitFor(() => expect(answers.some((m) => m.id === 1)).toBe(true), { timeout: 8000 });
    const session = String(seenByExtension.filter((m) => m.type === 'tools/call').at(-1)!.sessionID);
    other.kill();
    await vi.waitFor(() => expect(seenByExtension.find((m) => m.type === 'client.closed' && (m.sessions as string[]).includes(session))).toBeTruthy(), { timeout: 8000 });
  });
});
