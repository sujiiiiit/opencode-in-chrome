// @vitest-environment node
// The install side of the MCP path: the host launcher, the move out of the legacy state folder
// (which OpenCode Browse deletes), and OpenCode's config file.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { launcherText, migrateLegacyState } from '../../scripts/install-native-host.mjs';
import { addOpencodeServer, removeOpencodeServer } from '../../scripts/opencode-config.mjs';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ocb-install-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const write = (file: string, text: string) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

describe('host launcher', () => {
  it('falls back to node on PATH when the recorded node is gone', () => {
    const script = path.join(dir, 'hello.mjs');
    write(script, "process.stdout.write('hello ' + process.argv.slice(2).join(','));");
    const missingNode = path.join(dir, 'gone', process.platform === 'win32' ? 'node.exe' : 'node');
    const win = process.platform === 'win32';
    const launcher = path.join(dir, win ? 'host.cmd' : 'host.sh');
    writeFileSync(launcher, launcherText(missingNode, script), { mode: 0o755 });
    const out = win ? execFileSync('cmd.exe', ['/d', '/c', launcher, 'a', 'b']) : execFileSync(launcher, ['a', 'b']);
    expect(String(out).trim()).toBe('hello a,b');
  });

  it('uses the recorded node while it exists', () => {
    expect(launcherText('C:\\nvm\\node.exe', 'C:\\s\\host.mjs', 'win32')).toBe(
      '@echo off\r\nset "NODE=C:\\nvm\\node.exe"\r\nif not exist "%NODE%" set "NODE=node"\r\n"%NODE%" "C:\\s\\host.mjs" %*\r\n',
    );
    expect(launcherText('/usr/bin/node', '/s/host.mjs', 'linux')).toBe(
      '#!/bin/sh\nNODE="/usr/bin/node"\n[ -x "$NODE" ] || NODE=node\nexec "$NODE" "/s/host.mjs" "$@"\n',
    );
  });
});

describe('legacy state folder', () => {
  it('moves the agent profile and tool cache, drops our old files, keeps what is not ours', () => {
    const from = path.join(dir, 'opencode-browser');
    const to = path.join(dir, 'opencode-in-chrome');
    write(path.join(from, 'agent-browser-profile', 'Default', 'Cookies'), 'signed in');
    write(path.join(from, 'tools.json'), '[]');
    write(path.join(from, 'com.opencode.browser.json'), '{}');
    write(path.join(from, 'host.cmd'), 'old');
    write(path.join(from, 'browsers', 'abc123.json'), '{}');
    write(path.join(from, 'token'), 'not ours');

    expect(migrateLegacyState({ from, to })).toEqual({ moved: ['agent-browser-profile', 'tools.json'], left: [] });
    expect(readFileSync(path.join(to, 'agent-browser-profile', 'Default', 'Cookies'), 'utf8')).toBe('signed in');
    expect(existsSync(path.join(to, 'tools.json'))).toBe(true);
    for (const gone of ['agent-browser-profile', 'tools.json', 'com.opencode.browser.json', 'host.cmd', 'browsers']) {
      expect(existsSync(path.join(from, gone))).toBe(false);
    }
    expect(readFileSync(path.join(from, 'token'), 'utf8')).toBe('not ours');
    expect(migrateLegacyState({ from, to })).toEqual({ moved: [], left: [] });
  });

  it('never overwrites what the new folder already has', () => {
    const from = path.join(dir, 'old');
    const to = path.join(dir, 'new');
    write(path.join(from, 'tools.json'), 'old');
    write(path.join(to, 'tools.json'), 'new');
    expect(migrateLegacyState({ from, to }).moved).toEqual([]);
    expect(readFileSync(path.join(to, 'tools.json'), 'utf8')).toBe('new');
  });

  it('does nothing without a legacy folder', () => {
    expect(migrateLegacyState({ from: path.join(dir, 'missing'), to: path.join(dir, 'new') })).toEqual({ moved: [], left: [] });
  });
});

describe('OpenCode config', () => {
  const command = ['node', '/state/runtime/server.mjs'];

  it('writes mcp.servers into opencode.jsonc, keeping comments and other servers', () => {
    const file = path.join(dir, 'opencode.jsonc');
    write(file, '{\n  // mine\n  "mcp": { "servers": { "browse": { "type": "local", "command": ["browse", "mcp"] } } },\n}\n');
    expect(addOpencodeServer('opencode-in-chrome', command, dir)).toBe(file);
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('// mine');
    expect(text).toContain('"browse"');
    expect(text).toContain('"opencode-in-chrome"');
    expect(text).not.toContain('enabled');
  });

  it('replaces the V1 entry earlier setups wrote', () => {
    const json = path.join(dir, 'opencode.json');
    write(json, JSON.stringify({ mcp: { 'opencode-in-chrome': { type: 'local', command: ['node', 'x'], enabled: true } } }));
    addOpencodeServer('opencode-in-chrome', command, dir);
    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual({ mcp: { servers: { 'opencode-in-chrome': { type: 'local', command } } } });
  });

  it('moves the entry to opencode.jsonc when both files exist', () => {
    const json = path.join(dir, 'opencode.json');
    const jsonc = path.join(dir, 'opencode.jsonc');
    write(json, JSON.stringify({ theme: 'x', mcp: { 'opencode-in-chrome': { type: 'local', command: ['node', 'x'], enabled: true } } }));
    write(jsonc, '{}');
    expect(addOpencodeServer('opencode-in-chrome', command, dir)).toBe(jsonc);
    expect(JSON.parse(readFileSync(json, 'utf8'))).toEqual({ theme: 'x', mcp: {} });
    expect(JSON.parse(readFileSync(jsonc, 'utf8')).mcp.servers['opencode-in-chrome'].command).toEqual(command);
  });

  it('creates opencode.json when there is no config yet', () => {
    expect(addOpencodeServer('opencode-in-chrome', command, dir)).toBe(path.join(dir, 'opencode.json'));
  });

  it('refuses to touch a file it cannot parse', () => {
    const file = path.join(dir, 'opencode.json');
    write(file, '{ "mcp": ');
    expect(() => addOpencodeServer('opencode-in-chrome', command, dir)).toThrow(/left unchanged/);
    expect(readFileSync(file, 'utf8')).toBe('{ "mcp": ');
  });

  it('removes both shapes and leaves other servers', () => {
    const file = path.join(dir, 'opencode.jsonc');
    write(file, JSON.stringify({ mcp: { 'opencode-in-chrome': {}, servers: { 'opencode-in-chrome': {}, browse: {} } } }));
    expect(removeOpencodeServer('opencode-in-chrome', dir)).toEqual([file]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ mcp: { servers: { browse: {} } } });
    expect(removeOpencodeServer('opencode-in-chrome', dir)).toEqual([]);
  });
});
