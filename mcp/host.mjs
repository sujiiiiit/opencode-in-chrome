#!/usr/bin/env node
// The native messaging host. Chrome starts it when the Opencode extension connects
// (chrome.runtime.connectNative) and stops it when the extension disconnects, so there is one
// host per connected browser. It opens its own pipe private to this user and lists itself in
// the registry (mcp/paths.mjs); each MCP server (mcp/server.mjs, started by a CLI) picks a
// browser, connects, proves it knows the token, and then its requests are relayed to the
// extension and the answers back. Ids are prefixed per client so answers reach the right one.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { rmSync } from 'node:fs';
import net from 'node:net';
import { browserInfo } from './browser-info.mjs';
import { readLines, readNative, writeLine, writeNative } from './framing.mjs';
import { newBrowserId, pipePath, removeBrowser, writeBrowser } from './paths.mjs';

const clients = new Map();
let nextClient = 1;
const id = newBrowserId();
const token = randomBytes(24).toString('hex');
const entry = { id, pid: process.pid, pipe: pipePath(id), token, kind: 'own', label: 'Browser', startedAt: Date.now() };

const log = (text) => process.stderr.write(`[opencode-in-chrome host] ${text}\n`);

/** Constant-time check; a different length (or no token yet) throws inside, which is a no. */
const sameToken = (given) => {
  try {
    return timingSafeEqual(Buffer.from(String(given)), Buffer.from(token));
  } catch {
    return false;
  }
};

/** An answer for one client: `<client>:<id>` goes back to that client as `<id>`. */
function route(id, message) {
  const colon = id.indexOf(':');
  const socket = clients.get(Number(id.slice(0, colon)));
  if (socket) writeLine(socket, { ...message, id: id.slice(colon + 1) });
}

// From the extension: an answer for one client, or an event (no id) for all of them.
readNative(process.stdin, (message) => {
  if (message.id === undefined) for (const socket of clients.values()) writeLine(socket, message);
  else route(String(message.id), message);
});
// Chrome closed the port: the extension is gone, so is this host.
const leave = () => {
  removeBrowser(id);
  if (process.platform !== 'win32') rmSync(entry.pipe, { force: true });
};
process.on('exit', leave);
process.stdin.on('end', () => process.exit(0));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(0));

/** The first line of a client must be hello with the token; then it is served. */
function greet(clientId, socket, message) {
  if (message.type !== 'hello' || !sameToken(message.token)) {
    socket.destroy();
    return false;
  }
  clients.set(clientId, socket);
  writeLine(socket, { type: 'ready' });
  return true;
}

/** A request from a client goes to the extension; its session is remembered for the cleanup when the client leaves. */
function forward(clientId, sessions, message) {
  if (typeof message.sessionID === 'string') sessions.add(message.sessionID);
  writeNative(process.stdout, { ...message, id: `${clientId}:${message.id}` });
}

const server = net.createServer((socket) => {
  const clientId = nextClient++;
  let ready = false;
  const sessions = new Set();
  socket.on('error', () => undefined);
  socket.on('close', () => {
    clients.delete(clientId);
    if (ready) writeNative(process.stdout, { type: 'client.closed', client: clientId, sessions: [...sessions] });
  });
  readLines(socket, (message) => {
    if (ready) return forward(clientId, sessions, message);
    ready = greet(clientId, socket, message);
  });
});

server.once('error', (error) => log(`cannot open ${entry.pipe}: ${error.message}`));
if (process.platform !== 'win32') rmSync(entry.pipe, { force: true });
server.listen(entry.pipe, () => {
  writeBrowser(entry);
  writeNative(process.stdout, { type: 'host.ready' });
  // The browser's name takes a moment to look up; the host is usable meanwhile.
  browserInfo().then((info) => writeBrowser(Object.assign(entry, info)), () => undefined);
});
