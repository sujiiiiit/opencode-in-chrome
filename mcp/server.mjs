#!/usr/bin/env node
// The Opencode browser as a stdio MCP server, for any MCP client (Claude Code, Cursor, Codex,
// opencode, ...): `node mcp/server.mjs`. It reaches the extension through the native host's
// pipe (mcp/host.mjs) and serves the extension's own browser tools, with the extension's
// safety rules. Each server process is one browser session with its own tab group.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { readLines, writeLine } from './framing.mjs';
import { listBrowsers, stateDir } from './paths.mjs';

const SESSION_ID = `mcp-${randomUUID().slice(0, 8)}`;
const VERSION = '0.1.0';
const NOT_CONNECTED =
  'The Opencode extension is not connected. Open Chrome with the Opencode extension enabled (`pnpm mcp:browser` starts a ' +
  'dedicated one); if it still fails, run `pnpm build:setup` in the extension repo once.';
const FALLBACK_GUIDE = 'Browser tools from the Opencode Chrome extension. Call tabs_context first; observe (read_page or find) before acting; finish page tasks with done.';
const BROWSER_HINT = [
  '',
  '',
  '## Browsers',
  'More than one browser can be connected: your own Chrome profile (real sign-ins) and an agent browser (separate profile). ' +
    'list_connected_browsers shows them and select_browser switches; tabs belong to one browser. If a site needs the user to be signed in, use their own profile.',
].join(String.fromCharCode(10));
const cacheFile = () => path.join(stateDir(), 'tools.json');

const log = (text) => process.stderr.write(`[opencode-in-chrome mcp] ${text}\n`);
const messageOf = (error) => (error instanceof Error ? error.message : String(error));

// ─── The pipe to the extension ───────────────────────────────────────────

let pipe = null;
let connecting = null;
let everFailed = false;
let seq = 0;
const pending = new Map();

/** Every waiting request fails: the pipe closed under it. */
function failPending() {
  for (const [id, waiter] of pending) {
    pending.delete(id);
    waiter.reject(new Error(NOT_CONNECTED));
  }
}

/** An answer from the extension, for the request with the same id. */
function settle(message) {
  const waiter = pending.get(String(message.id));
  if (!waiter) return;
  pending.delete(String(message.id));
  if (message.error) waiter.reject(new Error(message.error));
  else waiter.resolve(message.result);
}

// ─── Which browser ───────────────────────────────────────────────────────

/** Set by select_browser or OPENCODE_BROWSER (an id, "agent" or "own"); otherwise chosen automatically. */
let selected = process.env.OPENCODE_BROWSER || undefined;
let current;

const matches = (browser, wanted) => browser.id === wanted || browser.kind === wanted;

/** The browser to use: the selected one; else the only one; else your own profile (it has your sign-ins), newest first. */
function pickBrowser() {
  const browsers = listBrowsers();
  if (selected) return browsers.filter((b) => matches(b, selected)).at(-1);
  return browsers.filter((b) => b.kind === 'own').at(-1) ?? browsers.at(-1);
}

function dropPipe() {
  const old = pipe;
  pipe = null;
  current = undefined;
  old?.destroy();
}

function open(browser, resolve, reject) {
  const socket = net.connect(browser.pipe);
  const fail = () => {
    connecting = null;
    reject(new Error(NOT_CONNECTED));
  };
  const timer = setTimeout(() => socket.destroy(), 3000);
  socket.once('error', fail);
  socket.once('connect', () => writeLine(socket, { type: 'hello', token: browser.token }));
  socket.on('close', () => {
    clearTimeout(timer);
    if (pipe === socket) {
      pipe = null;
      current = undefined;
    }
    failPending();
    fail();
  });
  readLines(socket, (message) => {
    if (message.type === 'tools.changed') return toolsChanged();
    if (message.type !== 'ready') return settle(message);
    clearTimeout(timer);
    socket.off('error', fail);
    socket.on('error', () => undefined);
    pipe = socket;
    current = browser;
    connecting = null;
    resolve(socket);
    if (everFailed) toolsChanged();
  });
}

function connect() {
  if (pipe) return Promise.resolve(pipe);
  if (connecting) return connecting;
  connecting = new Promise((resolve, reject) => {
    const browser = pickBrowser();
    if (browser) open(browser, resolve, reject);
    else reject(new Error(selected ? noSuchBrowser() : NOT_CONNECTED));
  });
  connecting.catch(() => {
    everFailed = true;
    connecting = null;
  });
  return connecting;
}

const describe = (browser) => `${browser.id}: ${browser.label}${current?.id === browser.id ? ' (in use)' : ''}`;

function noSuchBrowser() {
  return `The selected browser (${selected}) is not connected. ${connectedText()} Use select_browser.`;
}

const LOCAL_TOOLS = [
  {
    name: 'list_connected_browsers',
    description:
      'List the browsers running the Opencode extension: your own Chrome profile (has your real sign-ins) and/or the agent browser (a separate profile). ' +
      'Call it when a task needs a site you are signed in to, or when tools report the wrong browser.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'select_browser',
    description:
      'Choose which connected browser the other tools act on, by id from list_connected_browsers, or "own" / "agent". ' +
      'Tabs belong to one browser: after switching, tabs_context shows the session tabs of that browser.',
    inputSchema: { type: 'object', properties: { browser: { type: 'string', description: 'An id, "own" or "agent".' } }, required: ['browser'] },
  },
];

const NL = String.fromCharCode(10);
const textResult = (text, isError = false) => ({ content: [{ type: 'text', text }], ...(isError ? { isError } : {}) });

function listBrowsersTool() {
  const browsers = listBrowsers();
  if (!browsers.length) return textResult(NOT_CONNECTED, true);
  const using = pipe ? current : pickBrowser();
  return textResult(
    `Connected browsers:${NL}${browsers.map((b) => `- ${b.id}: ${b.label}${using?.id === b.id ? ' (in use)' : ''}`).join(NL)}${NL}` +
      (selected ? `Selected: ${selected}.` : 'No browser selected: your own profile is used when it is connected, otherwise the only one. Use select_browser to choose.'),
  );
}

const connectedText = () => {
  const browsers = listBrowsers();
  return browsers.length ? `Connected: ${browsers.map(describe).join('; ')}.` : NOT_CONNECTED;
};

function switchTo(browser) {
  selected = browser.id;
  if (pipe && current?.id !== browser.id) dropPipe();
}

function selectBrowserTool(args) {
  const wanted = String(args.browser).trim();
  const browser = listBrowsers().filter((b) => matches(b, wanted)).at(-1);
  if (!browser) return textResult(`No connected browser matches ${JSON.stringify(wanted)}. ${connectedText()}`, true);
  switchTo(browser);
  return textResult(`Now using ${browser.label} (${browser.id}). Call tabs_context: tabs from the other browser are not here.`);
}

async function request(type, extra = {}) {
  const socket = await connect();
  const id = String(++seq);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    writeLine(socket, { id, type, sessionID: SESSION_ID, ...extra });
  });
}

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

// Keep trying in the background, so tools appear once Chrome starts.
setInterval(() => {
  if (!pipe) connect().catch(() => undefined);
}, 3000).unref();

// ─── Tool list cache (so a client started before Chrome still sees the tools) ──

function cachedTools() {
  try {
    return JSON.parse(readFileSync(cacheFile(), 'utf8'));
  } catch {
    return undefined;
  }
}

function cacheTools(tools) {
  try {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify(tools));
  } catch {
    // The cache is only a convenience.
  }
}

async function listTools() {
  try {
    const result = await withTimeout(request('tools/list'), 5000);
    cacheTools(result.tools);
    return [...result.tools, ...LOCAL_TOOLS];
  } catch {
    const cached = cachedTools();
    if (cached) return [...cached, ...LOCAL_TOOLS];
    return LOCAL_TOOLS;
  }
}

const UPLOAD_LIMIT = 10 * 1024 * 1024;

/**
 * file_upload names files on this machine, which the extension cannot read: they are read
 * here (relative paths from the CLI's working folder) and sent along with the call.
 */
function withUploadedFiles(name, args) {
  if (name !== 'file_upload' || !Array.isArray(args.paths)) return args;
  let total = 0;
  const files = args.paths.map((given) => {
    const file = path.resolve(String(given));
    let size;
    try {
      size = statSync(file).size;
    } catch {
      throw new Error(`Could not read ${JSON.stringify(String(given))} (looked for ${file}). Check the path.`);
    }
    total += size;
    if (total > UPLOAD_LIMIT) throw new Error('The files add up to more than 10 MB. Upload fewer or smaller files.');
    return { name: path.basename(file), base64: readFileSync(file).toString('base64') };
  });
  return { ...args, files };
}

async function callTool(name, args) {
  if (name === 'list_connected_browsers') return listBrowsersTool();
  if (name === 'select_browser') return selectBrowserTool(args);
  try {
    return await request('tools/call', { name, arguments: withUploadedFiles(name, args) });
  } catch (error) {
    return { content: [{ type: 'text', text: messageOf(error) }], isError: true };
  }
}

// ─── MCP over stdio ──────────────────────────────────────────────────────

const reply = (id, result) => writeLine(process.stdout, { jsonrpc: '2.0', id, result });
const replyError = (id, code, message) => writeLine(process.stdout, { jsonrpc: '2.0', id, error: { code, message } });

function toolsChanged() {
  writeLine(process.stdout, { jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
}

async function initialize(params) {
  const guide = await withTimeout(request('guide'), 2000).catch(() => FALLBACK_GUIDE);
  return {
    protocolVersion: params?.protocolVersion ?? '2025-06-18',
    capabilities: { tools: { listChanged: true } },
    serverInfo: { name: 'opencode-in-chrome', version: VERSION },
    instructions: `${typeof guide === 'string' ? guide : FALLBACK_GUIDE}${BROWSER_HINT}`,
  };
}

const METHODS = new Map([
  ['initialize', initialize],
  ['ping', async () => ({})],
  ['tools/list', async () => ({ tools: await listTools() })],
  ['tools/call', (params) => callTool(params?.name, params?.arguments ?? {})],
]);

async function handle({ id, method, params }) {
  if (id == null) return; // notifications: nothing to answer
  const run = METHODS.get(method);
  if (!run) return replyError(id, -32601, `Method not found: ${method}`);
  try {
    reply(id, await run(params));
  } catch (error) {
    replyError(id, -32000, messageOf(error));
  }
}

readLines(process.stdin, (message) => void handle(message));
process.stdin.on('end', () => process.exit(0));
connect().catch(() => log('extension not connected yet; retrying in the background'));
