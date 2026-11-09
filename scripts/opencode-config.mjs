// Adds and removes our MCP server in OpenCode's global config, the way `opencode mcp add`
// writes it: `mcp.servers.<name>` (the V2 shape; `mcp.<name>` with `enabled` is V1). Edits go
// through jsonc-parser, so comments, formatting and every other setting survive.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { applyEdits, modify, parse } from 'jsonc-parser';

const FORMAT = { formattingOptions: { tabSize: 2, insertSpaces: true } };

export const opencodeConfigDir = () => path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'opencode');

/** Both global config files OpenCode reads, the existing ones; .jsonc first. */
const configFiles = (dir) => ['opencode.jsonc', 'opencode.json'].map((name) => path.join(dir, name)).filter((file) => existsSync(file));

function edit(file, changes) {
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '{}\n';
  const errors = [];
  parse(text, errors, { allowTrailingComma: true });
  if (errors.length) throw new Error(`${file} is not valid JSON(C); fix it first, it was left unchanged`);
  const before = text;
  for (const [keys, value] of changes) {
    if (value === undefined && !hasPath(text, keys)) continue;
    text = applyEdits(text, modify(text, keys, value, FORMAT));
  }
  if (text === before) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
  return true;
}

function hasPath(text, keys) {
  let node = parse(text, [], { allowTrailingComma: true });
  for (const key of keys) {
    if (typeof node !== 'object' || node === null || !(key in node)) return false;
    node = node[key];
  }
  return true;
}

/** The V1 entry earlier setups wrote, and the V2 one. */
const legacyKey = (name) => ['mcp', name];
const serverKey = (name) => ['mcp', 'servers', name];

/**
 * Writes the server into opencode.jsonc when that exists, else opencode.json, and removes any
 * V1 entry of the same name from both files. Returns the file written.
 */
export function addOpencodeServer(name, command, dir = opencodeConfigDir()) {
  const files = configFiles(dir);
  const target = files[0] ?? path.join(dir, 'opencode.json');
  for (const file of files) if (file !== target) edit(file, [[legacyKey(name), undefined], [serverKey(name), undefined]]);
  edit(target, [[legacyKey(name), undefined], [serverKey(name), { type: 'local', command }]]);
  return target;
}

/** Removes the server (V1 or V2 entry) from both files; the files that changed. */
export function removeOpencodeServer(name, dir = opencodeConfigDir()) {
  return configFiles(dir).filter((file) => edit(file, [[legacyKey(name), undefined], [serverKey(name), undefined]]));
}
