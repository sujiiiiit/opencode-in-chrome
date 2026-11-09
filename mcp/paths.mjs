// Where the native hosts and the MCP servers meet. Every browser that runs the extension gets
// its own host process, and each host opens its own pipe (named pipe on Windows, unix socket
// elsewhere) and lists itself in a per-user registry folder with a private token, so several
// browsers (the agent browser, your own Chrome, another profile) can be connected at once and
// an MCP server picks one. Everything lives under the current user's profile.
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import path from 'node:path';

export const HOST_NAME = 'com.opencode.browser';

const localAppData = () => process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
const userFolder = (name) => (process.platform === 'win32' ? path.join(localAppData(), name) : path.join(homedir(), `.${name}`));

// Not `opencode-browser`: OpenCode Browse (anomalyco/browse) treats %LOCALAPPDATA%\opencode-browser
// as its own legacy data root and deletes it on every `browse` command (cli/src/setup/migrate.ts).
const DEFAULT_STATE_DIR = userFolder('opencode-in-chrome');

/** Where earlier builds kept their state; scripts/install-native-host.mjs moves what is ours out of it. */
export const LEGACY_STATE_DIR = userFolder('opencode-browser');

export function stateDir() {
  return process.env.OPENCODE_BROWSER_STATE_DIR || DEFAULT_STATE_DIR;
}

const registryDir = () => path.join(stateDir(), 'browsers');
const entryFile = (id) => path.join(registryDir(), `${id}.json`);

/** The pipe of one host. OPENCODE_BROWSER_PIPE is a prefix, for tests. */
export function pipePath(id) {
  if (process.env.OPENCODE_BROWSER_PIPE) return `${process.env.OPENCODE_BROWSER_PIPE}-${id}`;
  if (process.platform === 'win32') return `\\\\.\\pipe\\opencode-browser-${userInfo().username}-${id}`;
  return path.join(registryDir(), `${id}.sock`);
}

export const newBrowserId = () => randomBytes(3).toString('hex');

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Lists (or updates) this host: `{ id, pid, pipe, token, kind, label, startedAt }`, readable only by this user. */
export function writeBrowser(entry) {
  mkdirSync(registryDir(), { recursive: true, mode: 0o700 });
  writeFileSync(entryFile(entry.id), JSON.stringify(entry), { mode: 0o600 });
  try {
    chmodSync(entryFile(entry.id), 0o600);
  } catch {
    // Windows: the folder under LOCALAPPDATA is already private to the user.
  }
}

export function removeBrowser(id) {
  rmSync(entryFile(id), { force: true });
}

/** The connected browsers, oldest first. Entries of hosts that no longer run are cleaned up. */
export function listBrowsers() {
  let names = [];
  try {
    names = readdirSync(registryDir()).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const found = [];
  for (const name of names) {
    try {
      const entry = JSON.parse(readFileSync(path.join(registryDir(), name), 'utf8'));
      if (alive(entry.pid)) found.push(entry);
      else removeBrowser(entry.id);
    } catch {
      // Half-written or unreadable: skip it this time.
    }
  }
  return found.sort((a, b) => a.startedAt - b.startedAt);
}
