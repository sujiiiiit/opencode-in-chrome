#!/usr/bin/env node
// One command that sets everything up (`pnpm build:setup`):
//   1. builds the production extension            (skip: --no-build)
//   2. copies mcp/ into the per-user state folder and registers the native host there for the
//      pinned id (so Chrome can start it; moves what earlier builds kept in the old folder)
//   3. adds that copy of the MCP server to Claude Code and to OpenCode
//   4. starts a dedicated Chrome with the extension loaded (scripts/agent-browser.mjs; --headless
//      for no window, --chrome <path> for another browser), then waits until the extension is
//      connected and reports how many tools it serves. --my-chrome (alias --manual): use your own
//      Chrome profile instead (your real sign-ins) and load the extension there by hand (Load
//      unpacked). Both can run at once; the MCP server prefers your own profile when it is
//      connected, and `select_browser` / OPENCODE_BROWSER=agent|own switches.
// `pnpm build:setup --uninstall` undoes 2 and 3. It only writes under your user profile.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTENSION_ID, EXTENSION_KEY } from '../mcp/extension-key.mjs';
import { readLines, writeLine } from '../mcp/framing.mjs';
import { listBrowsers } from '../mcp/paths.mjs';
import { launchAgentBrowser } from './agent-browser.mjs';
import { describeMigration, installHost, removeHost, serverScript } from './install-native-host.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = path.join(repo, '.output', 'chrome-mv3');
const NAME = 'opencode-in-chrome';
const flags = new Set(process.argv.slice(2));
const win = process.platform === 'win32';

const say = (mark, text) => console.log(`${mark} ${text}`);
const run = (command, args, options = {}) => spawnSync(command, args, { encoding: 'utf8', shell: win, ...options });
const has = (command) => run(win ? 'where' : 'which', [command]).status === 0;
/** Runs one setup step (sync or async); a failure is reported and the setup goes on. */
const step = async (title, fn) => {
  try {
    return await fn();
  } catch (error) {
    say('✗', `${title}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

// ─── 1. Build ────────────────────────────────────────────────────────────

/** Runs a pnpm command in the repo with its output shown; a failure stops the setup. */
function pnpm(title, args) {
  say('…', title);
  if (run('pnpm', args, { cwd: repo, stdio: 'inherit' }).status !== 0) throw new Error(`${args.join(' ')} failed`);
}

function build() {
  if (!existsSync(path.join(repo, 'node_modules'))) pnpm('Installing dependencies', ['install']);
  if (!flags.has('--no-build')) pnpm('Building the extension (under a minute)', ['exec', 'wxt', 'build']);
  const manifest = JSON.parse(readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));
  if (manifest.key !== EXTENSION_KEY) throw new Error('the built manifest has no pinned key; run without --no-build');
  say('✓', `Built ${extensionDir}`);
  return true;
}

// ─── 3. MCP clients ──────────────────────────────────────────────────────

function registerClaude() {
  if (!has('claude')) return say('–', `Claude Code not found; skipped. Later: claude mcp add --scope user ${NAME} -- node "${serverScript()}"`);
  run('claude', ['mcp', 'remove', NAME, '--scope', 'user']);
  const added = run('claude', ['mcp', 'add', '--scope', 'user', NAME, '--', 'node', `"${serverScript()}"`]);
  if (added.status !== 0) throw new Error(`claude mcp add failed: ${added.stderr || added.stdout}`);
  say('✓', `Added "${NAME}" to Claude Code (all projects)`);
}

// Loaded on use: jsonc-parser is a dependency, which the build step installs first.
const opencodeConfig = () => import('./opencode-config.mjs');

async function registerOpencode() {
  const { addOpencodeServer, opencodeConfigDir } = await opencodeConfig();
  if (!has('opencode') && !existsSync(opencodeConfigDir())) return say('–', 'OpenCode not found; skipped');
  const file = addOpencodeServer(NAME, ['node', serverScript()]);
  say('✓', `Added "${NAME}" to OpenCode (${file})`);
}

async function unregisterOpencode() {
  const { removeOpencodeServer } = await opencodeConfig();
  for (const file of removeOpencodeServer(NAME)) say('✓', `Removed from OpenCode (${file})`);
}

// ─── 4. Load the extension and wait for it ───────────────────────────────

/** Asks one connected browser's extension for its tools; undefined when it does not answer. */
function countTools(browser) {
  return new Promise((resolve) => {
    const socket = net.connect(browser.pipe);
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    setTimeout(() => done(undefined), 4000).unref();
    socket.once('error', () => done(undefined));
    socket.once('connect', () => writeLine(socket, { type: 'hello', token: browser.token }));
    readLines(socket, (message) => {
      if (message.type === 'ready') writeLine(socket, { id: '1', type: 'tools/list', sessionID: 'mcp-setup' });
      else if (message.id === '1') done(message.result?.tools?.length);
    });
  });
}

/** The connected browsers that answer, with their tool counts. */
async function connectedBrowsers() {
  const rows = await Promise.all(listBrowsers().map(async (browser) => ({ browser, tools: await countTools(browser) })));
  return rows.filter((row) => row.tools);
}

function copyToClipboard(text) {
  const tool = win ? ['clip'] : process.platform === 'darwin' ? ['pbcopy'] : ['xclip', '-selection', 'clipboard'];
  return run(tool[0], tool.slice(1), { input: text }).status === 0;
}

function openExtensionsPage() {
  const url = 'chrome://extensions';
  if (win) spawn('cmd', ['/c', 'start', '""', 'chrome', url], { detached: true, stdio: 'ignore' }).unref();
  else if (process.platform === 'darwin') spawn('open', ['-a', 'Google Chrome', url], { detached: true, stdio: 'ignore' }).unref();
  else spawn('google-chrome', [url], { detached: true, stdio: 'ignore' }).unref();
}

function loadByHand() {
  explainLoading();
  if (!flags.has('--no-open')) openExtensionsPage();
}

function explainLoading() {
  const copied = copyToClipboard(extensionDir) ? '   (copied to your clipboard)' : '';
  const lines = [
    '',
    'Last step, once (Chrome does not let a program install extensions silently):',
    '  1. In chrome://extensions turn on "Developer mode" (top right)',
    '  2. Click "Load unpacked" and choose:',
    `       ${extensionDir}${copied}`,
    '  If the extension is already loaded from there, click its reload icon instead.',
    '',
  ];
  console.log(lines.join(String.fromCharCode(10)));
}

/** Polls until a browser answers; the answering browsers, or none after `seconds`. */
async function waitForBrowsers(seconds) {
  for (let waited = 0; waited < seconds; waited += 2) {
    const rows = await connectedBrowsers();
    if (rows.length) return rows;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return [];
}

const listed = (rows) => rows.map(({ browser, tools }) => `${browser.label} [${browser.id}], ${tools} tools`).join('; ');

const wantsOwn = flags.has('--manual') || flags.has('--my-chrome');

async function launchAgent() {
  const at = process.argv.indexOf('--chrome');
  const { exe, started } = await launchAgentBrowser({ headless: flags.has('--headless'), browserPath: at >= 0 ? process.argv[at + 1] : undefined });
  say('✓', `${started ? 'Started' : 'Using'} the agent browser (${exe}) with the extension loaded. Sign in there to any site you want the agent to use.`);
}

/** Your own Chrome profile (load the extension by hand), or the agent's own Chrome with it loaded. */
const startBrowser = () => (wantsOwn ? loadByHand() : launchAgent());

async function connect() {
  const already = await connectedBrowsers();
  const satisfied = already.some((row) => !wantsOwn || row.browser.kind === 'own');
  if (satisfied) return say('✓', `Already connected: ${listed(already)}`);
  await startBrowser();
  say('…', 'Waiting for the extension to connect (up to 3 minutes)');
  const rows = await waitForBrowsers(180);
  if (rows.length) return say('✓', `Connected: ${listed(rows)} (extension id ${EXTENSION_ID})`);
  say('✗', 'The extension did not connect. Check that it is loaded from the folder above and enabled, then run this again (use --no-build to skip the build).');
}

// ─── Run ─────────────────────────────────────────────────────────────────

async function main() {
  if (flags.has('--uninstall')) {
    await step('native host', () => (removeHost(), say('✓', 'Removed the native host')));
    await step('Claude Code', () => has('claude') && (run('claude', ['mcp', 'remove', NAME, '--scope', 'user']), say('✓', 'Removed from Claude Code')));
    await step('OpenCode', unregisterOpencode);
    return;
  }
  if (!(await step('build', build))) process.exit(1);
  await step('native host', () => {
    const { extensionIds, migration } = installHost();
    say('✓', `Registered the native host for extension ${extensionIds.join(', ')} (MCP server: ${serverScript()})`);
    const moved = describeMigration(migration);
    if (moved) say(migration.left.length ? '!' : '✓', moved);
  });
  await step('Claude Code', registerClaude);
  await step('OpenCode', registerOpencode);
  await connect();
  console.log('\nRestart Claude Code / OpenCode once so they pick up the new MCP server. Run this again after changing mcp/.');
}

await main();
