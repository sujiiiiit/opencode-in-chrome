#!/usr/bin/env node
// Starts a dedicated Chrome for the agent, with the Opencode extension loaded:
//
//   pnpm mcp:browser              open it (a normal window; sign in to the sites you want it to use)
//   pnpm mcp:browser --headless   no window (approvals need the extension's auto mode: there is no popup to click)
//   pnpm mcp:browser --restart    close it first (to load a rebuilt extension)
//   pnpm mcp:browser --chrome <path>   use another Chromium-based browser (or set CHROME_PATH)
//
// It has its own profile folder, so your everyday Chrome is untouched, and the agent's logins
// and the extension's settings persist between runs. Chrome 137+ ignores --load-extension, so
// the extension is loaded the way Puppeteer and Playwright do it: the browser starts with a
// debugging port on 127.0.0.1 and the DevTools command Extensions.loadUnpacked adds it.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXTENSION_ID } from '../mcp/extension-key.mjs';
import { stateDir } from '../mcp/paths.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const extensionDir = path.join(repo, '.output', 'chrome-mv3');
export const profileDir = () => path.join(stateDir(), 'agent-browser-profile');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function candidates() {
  const env = process.env;
  if (process.platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((root) => [
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(root, 'Chromium', 'Application', 'chrome.exe'),
      path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', path.join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
}

/** A Chromium-based browser: the given path, CHROME_PATH, or the first usual install location. */
export function findBrowser(given) {
  const found = [given, process.env.CHROME_PATH, ...candidates()].filter(Boolean).find((file) => existsSync(file));
  if (!found) throw new Error('No Chrome found. Pass --chrome <path to chrome.exe> or set CHROME_PATH.');
  return found;
}

const activePortFile = () => path.join(profileDir(), 'DevToolsActivePort');

/** The running agent browser's debugging endpoint ({ port, version }), or undefined. */
async function runningBrowser() {
  try {
    const port = Number(readFileSync(activePortFile(), 'utf8').split(/\r?\n/)[0]);
    const version = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json());
    return { port, version };
  } catch {
    return undefined;
  }
}

async function waitForBrowser(seconds) {
  for (let waited = 0; waited < seconds * 2; waited++) {
    const found = await runningBrowser();
    if (found) return found;
    await sleep(500);
  }
  throw new Error('The browser did not open its debugging port in time.');
}

async function extensionLoaded(port) {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  return targets.some((t) => String(t.url).startsWith(`chrome-extension://${EXTENSION_ID}/`));
}

/** One DevTools command on the browser's own endpoint. */
async function browserCommand(version, method, params) {
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('Could not reach the browser debugging port.'));
  });
  const answer = await new Promise((resolve) => {
    socket.onmessage = (message) => resolve(JSON.parse(String(message.data)));
    socket.send(JSON.stringify({ id: 1, method, params }));
  });
  socket.close();
  if (answer.error) throw new Error(`${method}: ${answer.error.message}`);
  return answer.result;
}

/**
 * Starts the agent browser (detached: it keeps running after this process ends) unless it is
 * already running, and makes sure the extension is loaded in it.
 */
export async function launchAgentBrowser({ headless = false, browserPath, restart = false } = {}) {
  assertBuilt();
  if (restart) await closeRunning();
  const { running, exe } = await ensureRunning(headless, browserPath);
  if (!(await extensionLoaded(running.port))) await browserCommand(running.version, 'Extensions.loadUnpacked', { path: extensionDir });
  return { exe: exe ?? 'the running agent browser', started: Boolean(exe), version: running.version.Browser };
}

/** Closes the running agent browser (a rebuilt extension is picked up by starting it again). */
async function closeRunning() {
  const running = await runningBrowser();
  if (!running) return;
  await browserCommand(running.version, 'Browser.close', {}).catch(() => undefined);
  for (let waited = 0; waited < 20 && (await runningBrowser()); waited++) await sleep(500);
}

/** The agent browser's endpoint, starting Chrome first when it is not running (then `exe` names it). */
async function ensureRunning(headless, browserPath) {
  const existing = await runningBrowser();
  if (existing) return { running: existing };
  const exe = findBrowser(browserPath);
  return { running: await startChrome(exe, headless), exe };
}

function assertBuilt() {
  if (!existsSync(path.join(extensionDir, 'manifest.json'))) throw new Error('The extension is not built yet: run pnpm exec wxt build (or pnpm build:setup).');
}

/** Spawns Chrome on the agent profile with a debugging port, and waits until it answers. */
async function startChrome(exe, headless) {
  mkdirSync(profileDir(), { recursive: true });
  rmSync(activePortFile(), { force: true });
  // Chrome keeps the extension's worker script in the profile and can keep running an older build of it.
  for (const stale of ['Service Worker', 'Code Cache']) rmSync(path.join(profileDir(), 'Default', stale), { recursive: true, force: true });
  const args = [`--user-data-dir=${profileDir()}`, '--remote-debugging-port=0', '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check', ...(headless ? ['--headless=new'] : []), 'about:blank'];
  spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
  return waitForBrowser(20);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--chrome');
  try {
    const result = await launchAgentBrowser({ headless: args.includes('--headless'), browserPath: at >= 0 ? args[at + 1] : undefined, restart: args.includes('--restart') });
    console.log(`${result.started ? 'Started' : 'Using'} ${result.exe} (${result.version}); the extension is loaded.\nProfile: ${profileDir()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
