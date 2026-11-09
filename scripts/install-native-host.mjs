#!/usr/bin/env node
// Registers the native messaging host (mcp/host.mjs) so the Opencode extension can serve its
// browser tools to MCP clients (mcp/server.mjs). `pnpm build:setup` runs this as part of the
// full setup; on its own:
//
//   node scripts/install-native-host.mjs [--extension-id <extra id>]...
//   node scripts/install-native-host.mjs --uninstall
//
// It copies the host and the MCP server into the per-user state folder (so moving or deleting
// this checkout does not break Chrome or the MCP clients), writes a host manifest and a
// launcher there, then points Chrome, Edge, Chromium and Brave at it (HKCU registry keys on
// Windows, NativeMessagingHosts folders on macOS and Linux). Nothing outside the current
// user's profile is touched. Run it again after changing anything in mcp/.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXTENSION_ID } from '../mcp/extension-key.mjs';
import { HOST_NAME, LEGACY_STATE_DIR, stateDir } from '../mcp/paths.mjs';

const sourceDir = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'mcp');
/** The modules the host and the server need at run time (they import only each other and node:). */
const RUNTIME_FILES = ['host.mjs', 'server.mjs', 'framing.mjs', 'paths.mjs', 'browser-info.mjs'];
/** What earlier builds kept in the legacy folder and is worth keeping: the agent's sign-ins and the tool cache. */
const KEPT_FROM_LEGACY = ['agent-browser-profile', 'tools.json'];
/** What earlier builds wrote there and this install recreates. */
const DROPPED_FROM_LEGACY = [`${HOST_NAME}.json`, 'host.cmd', 'host.sh', 'browsers', 'runtime'];

const runtimeDir = (dir = stateDir()) => path.join(dir, 'runtime');
/** The MCP server MCP clients run: the copy in the state folder. */
export const serverScript = (dir = stateDir()) => path.join(runtimeDir(dir), 'server.mjs');

const WINDOWS_KEYS = ['Google\\Chrome', 'Microsoft\\Edge', 'Chromium', 'BraveSoftware\\Brave-Browser'].map(
  (vendor) => `HKCU\\Software\\${vendor}\\NativeMessagingHosts\\${HOST_NAME}`,
);

function unixManifestDirs() {
  const home = homedir();
  if (process.platform === 'darwin') {
    const base = path.join(home, 'Library', 'Application Support');
    return ['Google/Chrome', 'Microsoft Edge', 'Chromium', 'BraveSoftware/Brave-Browser'].map((b) => path.join(base, b, 'NativeMessagingHosts'));
  }
  const base = path.join(home, '.config');
  return ['google-chrome', 'microsoft-edge', 'chromium', 'BraveSoftware/Brave-Browser'].map((b) => path.join(base, b, 'NativeMessagingHosts'));
}

/** Moves a file or folder; across drives (a custom state folder) it is copied, then removed. */
function move(from, to) {
  try {
    renameSync(from, to);
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

/**
 * Moves what is ours out of the folder earlier builds used (%LOCALAPPDATA%\opencode-browser,
 * ~/.opencode-browser), which OpenCode Browse deletes as its own legacy folder. Files that
 * cannot move yet (the agent browser is running on its profile) are listed in `left`; the rest
 * of the folder is not ours and stays. Running it again is a no-op.
 */
export function migrateLegacyState({ from = LEGACY_STATE_DIR, to = stateDir() } = {}) {
  const result = { moved: [], left: [] };
  if (path.resolve(from) === path.resolve(to) || !existsSync(from)) return result;
  mkdirSync(to, { recursive: true });
  for (const name of KEPT_FROM_LEGACY) {
    const source = path.join(from, name);
    if (!existsSync(source) || existsSync(path.join(to, name))) continue;
    try {
      move(source, path.join(to, name));
      result.moved.push(name);
    } catch {
      result.left.push(name);
    }
  }
  for (const name of DROPPED_FROM_LEGACY) {
    try {
      rmSync(path.join(from, name), { recursive: true, force: true });
    } catch {
      // A host that is still running keeps its entry; it goes when that browser reconnects.
    }
  }
  try {
    rmdirSync(from);
  } catch {
    // Not empty: something else's files, or what could not move yet.
  }
  return result;
}

function copyRuntime(dir) {
  mkdirSync(runtimeDir(dir), { recursive: true });
  for (const file of RUNTIME_FILES) copyFileSync(path.join(sourceDir, file), path.join(runtimeDir(dir), file));
}

/**
 * The launcher Chrome starts. It runs the Node that ran this install while that still exists,
 * and otherwise `node` from PATH, so switching or removing a Node version (nvm, fnm, volta)
 * does not break the host.
 */
export function launcherText(node, script, platform = process.platform) {
  if (platform === 'win32') {
    return ['@echo off', `set "NODE=${node}"`, 'if not exist "%NODE%" set "NODE=node"', `"%NODE%" "${script}" %*`, ''].join('\r\n');
  }
  return ['#!/bin/sh', `NODE="${node}"`, '[ -x "$NODE" ] || NODE=node', `exec "$NODE" "${script}" "$@"`, ''].join('\n');
}

function writeLauncher(dir) {
  const script = path.join(runtimeDir(dir), 'host.mjs');
  const file = path.join(dir, process.platform === 'win32' ? 'host.cmd' : 'host.sh');
  writeFileSync(file, launcherText(process.execPath, script));
  if (process.platform !== 'win32') chmodSync(file, 0o755);
  return file;
}

function register(manifest) {
  const manifestFile = path.join(stateDir(), `${HOST_NAME}.json`);
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  if (process.platform === 'win32') {
    for (const key of WINDOWS_KEYS) execFileSync('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', manifestFile, '/f'], { stdio: 'ignore' });
    return manifestFile;
  }
  for (const target of unixManifestDirs()) {
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  }
  return manifestFile;
}

/** Registers the host for the pinned extension id (and any extra ids, e.g. a store build). */
export function installHost(extraIds = []) {
  const extensionIds = [...new Set([EXTENSION_ID, ...extraIds])];
  if (!extensionIds.every((id) => /^[a-p]{32}$/.test(id))) throw new Error('An extension id is 32 letters a-p (from chrome://extensions).');
  const migration = migrateLegacyState();
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  copyRuntime(dir);
  const manifest = {
    name: HOST_NAME,
    description: 'Opencode browser tools for MCP clients',
    path: writeLauncher(dir),
    type: 'stdio',
    allowed_origins: extensionIds.map((id) => `chrome-extension://${id}/`),
  };
  return { manifestFile: register(manifest), extensionIds, migration };
}

function unregisterKey(key) {
  try {
    execFileSync('reg', ['delete', key, '/f'], { stdio: 'ignore' });
  } catch {
    // Not registered for this browser.
  }
}

/** Unregisters the host and removes its files; the agent browser's profile is kept. */
export function removeHost() {
  if (process.platform === 'win32') WINDOWS_KEYS.forEach(unregisterKey);
  else for (const target of unixManifestDirs()) rmSync(path.join(target, `${HOST_NAME}.json`), { force: true });
  for (const name of [`${HOST_NAME}.json`, 'host.cmd', 'host.sh', 'runtime']) rmSync(path.join(stateDir(), name), { recursive: true, force: true });
}

/** One line about the legacy folder, or nothing when there was nothing to move. */
export function describeMigration({ moved, left }) {
  const lines = [];
  if (moved.length) lines.push(`Moved ${moved.join(', ')} from ${LEGACY_STATE_DIR} to ${stateDir()}.`);
  if (left.length) {
    lines.push(`Could not move ${left.join(', ')} from ${LEGACY_STATE_DIR} (in use: close the agent browser), then run this again.`);
  }
  return lines.join(' ');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--uninstall')) {
    removeHost();
    console.log(`Removed ${HOST_NAME}.`);
  } else {
    const extra = args.flatMap((a, i) => (a === '--extension-id' && args[i + 1] ? [args[i + 1]] : []));
    const { manifestFile, extensionIds, migration } = installHost(extra);
    const moved = describeMigration(migration);
    console.log(`Installed ${HOST_NAME} for ${extensionIds.join(', ')}.
Manifest: ${manifestFile}
MCP server: ${serverScript()}${moved ? `\n${moved}` : ''}
Reload the extension (or restart Chrome) so it starts the new host.`);
  }
}
