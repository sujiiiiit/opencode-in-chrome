// Which browser started this host: its name and whether it is the agent browser
// (scripts/agent-browser.mjs) or someone's own profile. Chrome launches the host through a
// launcher script, so the browser is an ancestor, found by walking up the process tree.
import { execFile } from 'node:child_process';

const BROWSERS = [
  [/msedge/i, 'Edge'],
  [/brave/i, 'Brave'],
  [/chromium/i, 'Chromium'],
  [/chrome/i, 'Chrome'],
];

const run = (command, args) =>
  new Promise((resolve) => execFile(command, args, { timeout: 8000, windowsHide: true }, (error, stdout) => resolve(error ? '' : String(stdout))));

async function windowsRow(pid) {
  const script = `$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; "$($p.ParentProcessId)|$($p.CommandLine)"`;
  const [parent, ...rest] = (await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script])).trim().split('|');
  return { parent: Number(parent) || 0, command: rest.join('|') };
}

async function unixRow(pid) {
  const out = (await run('ps', ['-o', 'ppid=,args=', '-p', String(pid)])).trim();
  const match = /^(\d+)\s+(.*)$/.exec(out);
  const [, parent = '0', command = ''] = match ?? [];
  return { parent: Number(parent), command };
}

/** `{ parent, command }` for one process, from the OS. */
const processRow = (pid) => (process.platform === 'win32' ? windowsRow(pid) : unixRow(pid));

/** The program file name of a command line: only the program counts (a launcher script mentions chrome in its arguments). */
const exeOf = (command) => {
  const [, ...found] = /^"([^"]*)"|^(\S+)/.exec(command.trim()) ?? [];
  return String(found.find(Boolean)).split(SEPARATORS).pop();
};

const AGENT_DIR = /agent-browser-profile/;

const dataDirOf = (command) => {
  const dir = /--user-data-dir=(?:"([^"]+)"|(\S+))/.exec(command);
  return dir ? (dir[1] ?? dir[2]) : undefined;
};

const SEPARATORS = new RegExp('[' + String.fromCharCode(92) + '/]');
const lastPart = (dir) => (dir ? `: ${dir.split(SEPARATORS).filter(Boolean).pop()}` : '');

function labelled(name, dir = '') {
  if (AGENT_DIR.test(dir)) return { kind: 'agent', label: `${name} (agent browser)` };
  return { kind: 'own', label: `${name} (your own profile${lastPart(dir)})` };
}

function describeBrowser(command) {
  const name = BROWSERS.find(([pattern]) => pattern.test(exeOf(command)))?.[1];
  return name && labelled(name, dataDirOf(command));
}

/** Walks up from this process (at most 4 levels) to the browser. */
export async function browserInfo(start = process.ppid) {
  let pid = start;
  for (let depth = 0; depth < 4 && pid > 1; depth++) {
    const { parent, command } = await processRow(pid);
    const found = describeBrowser(command);
    if (found) return found;
    pid = parent;
  }
  return { kind: 'own', label: 'Browser' };
}
