// How each tool call reads in the timeline: its family, its title while it works and once it is
// done, and the one-line subject (the command, the file, the query). Pure and defensive: tool
// input and metadata are untyped at runtime (plugin tools send whatever they like).
import { isRecord, type ReplyToolPart } from './reply';

type ToolCategory = 'shell' | 'read' | 'search' | 'edit' | 'web' | 'agent' | 'other';

type Spec = {
  category: ToolCategory;
  /** While it streams or runs, and once it is done. */
  active: string;
  done: string;
  /** The input field (or fields, first found wins) that names what the call is about. */
  subject?: readonly string[];
  /** How the subject is shown: a file name, a command without its `cd`, a short URL, or quoted text. */
  format?: 'path' | 'command' | 'url' | 'quoted';
  /** What joins title and subject in a sentence label (" for ": `Searching for "TODO"`). */
  join?: string;
  /** Bookkeeping (plans, skills, questions) that a summary of the work leaves out. */
  internal?: boolean;
};

const SHELL: Spec = { category: 'shell', active: 'Running', done: 'Ran', subject: ['command'], format: 'command' };
const AGENT: Spec = { category: 'agent', active: 'Running agent', done: 'Ran agent', subject: ['description', 'prompt'], join: ': ' };

const SPECS: Record<string, Spec> = {
  shell: SHELL,
  bash: SHELL,
  execute: { ...SHELL, subject: ['command', 'description'] },
  read: { category: 'read', active: 'Reading', done: 'Read', subject: ['path', 'filePath'], format: 'path' },
  list: { category: 'search', active: 'Listing files', done: 'Listed files', subject: ['path'], format: 'path', join: ' in ' },
  glob: { category: 'search', active: 'Finding files', done: 'Found files', subject: ['pattern'], join: ' matching ' },
  grep: { category: 'search', active: 'Searching', done: 'Searched', subject: ['pattern'], format: 'quoted', join: ' for ' },
  edit: { category: 'edit', active: 'Editing', done: 'Edited', subject: ['path', 'filePath'], format: 'path' },
  write: { category: 'edit', active: 'Writing', done: 'Wrote', subject: ['path', 'filePath'], format: 'path' },
  patch: { category: 'edit', active: 'Editing', done: 'Edited' },
  webfetch: { category: 'web', active: 'Opening', done: 'Opened', subject: ['url'], format: 'url' },
  websearch: { category: 'web', active: 'Searching the web', done: 'Searched the web', subject: ['query'], format: 'quoted', join: ' for ' },
  browser: { category: 'web', active: 'Browsing', done: 'Browsed', subject: ['url', 'action'] },
  subagent: AGENT,
  task: AGENT,
  skill: { category: 'other', active: 'Loading skill', done: 'Loaded skill', subject: ['name', 'skill'], internal: true },
  todowrite: { category: 'other', active: 'Updating plan', done: 'Updated plan', join: ' · ', internal: true },
  question: { category: 'other', active: 'Asking you', done: 'Asked you', format: 'quoted', internal: true },
};

/** A plugin or MCP tool's name as words: `chrome-devtools_navigate_page` reads "Chrome devtools navigate page". */
function toolName(name: string): string {
  const words = name.split(/[_\-\s]+/).filter(Boolean).join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}

const fallback = (name: string): Spec => ({ category: 'other', active: `Using ${toolName(name)}`, done: `Used ${toolName(name)}` });

const toolSpec = (name: string): Spec => (Object.hasOwn(SPECS, name) ? SPECS[name]! : fallback(name));

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * A string field of a JSON object that may still be streaming (`{"command":"npm te`): the value
 * so far, unescaped. Lets a widget show a command while the model is still writing it. With
 * `closed`, only a value whose closing quote has arrived, so a label does not grow letter by letter.
 */
export function partialField(json: string, field: string, closed = false): string | undefined {
  const match = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)(")?`).exec(json);
  if (!match || (closed && !match[2])) return undefined;
  // A trailing lone backslash is half an escape: drop it until the rest arrives.
  const raw = match[1]!.replace(/\\$/, '');
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

/** A field of the tool's input: the parsed input, else what has streamed so far (only whole values when `closed`). */
export function toolField(part: ReplyToolPart, field: string, closed = false): string | undefined {
  return str(part.input[field]) ?? (part.status === 'streaming' ? str(partialField(part.inputText, field, closed)) : undefined);
}

const fileName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;

const firstLine = (text: string) => text.split('\n', 1)[0]!.trim();

/** A command without a leading `cd <dir> &&` (the working directory is noise in a one-line label). */
const commandLine = (command: string) => firstLine(command).replace(/^cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/, '');

/** A URL without its scheme, `www.` and trailing slash. */
const shortUrl = (url: string) => url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '');

function formatSubject(value: string, format: Spec['format']): string {
  if (format === 'path') return fileName(value);
  if (format === 'command') return commandLine(value);
  if (format === 'url') return shortUrl(firstLine(value));
  return firstLine(value);
}

const records = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);

/** The files a patch changed, as its metadata reports them. */
const patchFiles = (part: ReplyToolPart) => records(part.metadata.files).flatMap((file) => str(file.file) ?? []);

function patchSubject(part: ReplyToolPart): string | undefined {
  const count = Array.isArray(part.metadata.files) ? part.metadata.files.length : 0;
  if (count === 0) return undefined;
  const files = patchFiles(part);
  if (count === 1 && files[0]) return fileName(files[0]);
  return count === 1 ? '1 file' : `${count} files`;
}

/** A plan's progress: "2/5 done". */
function planSubject(part: ReplyToolPart): string | undefined {
  const todos = records(part.input.todos);
  if (todos.length === 0) return undefined;
  return `${todos.filter((todo) => todo.status === 'completed').length}/${todos.length} done`;
}

function questionSubject(part: ReplyToolPart): string | undefined {
  const first = records(part.input.questions)[0];
  const text = first && (str(first.question) ?? str(first.header));
  return text ? firstLine(text) : undefined;
}

/** A plugin tool's first short one-line text input: the best guess at what it works on. */
function pluginSubject(part: ReplyToolPart): string | undefined {
  for (const value of Object.values(part.input)) {
    if (typeof value === 'string' && value.trim() && !value.includes('\n') && value.length <= 120) return value.trim();
  }
  return undefined;
}

const SUBJECTS: Record<string, (part: ReplyToolPart) => string | undefined> = {
  patch: patchSubject,
  todowrite: planSubject,
  question: questionSubject,
};

/**
 * What the call is about (the command, the file name, the query), if it names one. With `closed`,
 * a field that is still streaming counts only once it is whole.
 */
export function toolSubject(part: ReplyToolPart, closed = false): string | undefined {
  if (Object.hasOwn(SUBJECTS, part.name)) return SUBJECTS[part.name]!(part);
  if (!Object.hasOwn(SPECS, part.name)) return pluginSubject(part);
  const spec = SPECS[part.name]!;
  for (const field of spec.subject ?? []) {
    const value = toolField(part, field, closed) ?? str(part.metadata[field]);
    if (value) return formatSubject(value, spec.format);
  }
  return undefined;
}

/** The tool is still working: the model is writing its input or the server is running it. */
export const toolPending = (part: ReplyToolPart, live: boolean) =>
  live && (part.status === 'streaming' || part.status === 'running');

/**
 * The turn ended before the call finished: it was still working when the reply stopped, or the
 * server failed it as interrupted (opencode fails every unsettled call with an `aborted` error).
 */
export const toolStopped = (part: ReplyToolPart, live: boolean) =>
  part.aborted === true || (!live && (part.status === 'streaming' || part.status === 'running'));

/** The tool's title for its state: "Running" while it works, "Ran" once done. */
export function toolTitle(part: ReplyToolPart, live: boolean): string {
  const spec = toolSpec(part.name);
  return toolPending(part, live) ? spec.active : spec.done;
}

/** The call as one sentence for a summary line: `Searching for "TODO"`, `Ran npm test`. */
export function toolLabel(part: ReplyToolPart, live: boolean): string {
  const spec = toolSpec(part.name);
  const title = toolTitle(part, live);
  const subject = toolSubject(part, true);
  if (!subject) return title;
  return `${title}${spec.join ?? ' '}${spec.format === 'quoted' ? `"${subject}"` : subject}`;
}

/** The text a tool returned, joined. */
export function toolOutput(part: ReplyToolPart): string {
  return part.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('\n');
}

/** A shell's exit code, when its metadata reports one. */
export function shellExit(part: ReplyToolPart): number | undefined {
  return num(part.metadata.exit);
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What a finished search found ("12 matches", "3 files"), when its metadata says. */
export function toolResult(part: ReplyToolPart): string | undefined {
  if (part.status !== 'completed') return undefined;
  const matches = part.name === 'grep' ? num(part.metadata.matches) : undefined;
  if (matches !== undefined) return plural(matches, 'match', 'matches');
  const files = part.name === 'glob' ? num(part.metadata.count) : undefined;
  return files === undefined ? undefined : plural(files, 'file', 'files');
}

/** The background shell the call runs in, for following its output live. */
export const shellID = (part: ReplyToolPart): string | undefined => str(part.metadata.shellID);

/** The shell still runs after its call returned (moved to the background). */
export const shellRunning = (part: ReplyToolPart) => part.metadata.status === 'running';

/** An edit's before/after text, when the input carries it. */
export function editChange(part: ReplyToolPart): { before: string; after: string } | null {
  const before = part.input.oldString;
  const after = part.input.newString;
  return typeof before === 'string' && typeof after === 'string' ? { before, after } : null;
}

/** A unified diff the metadata reports (edit and patch tools), if any. */
export function toolDiff(part: ReplyToolPart): string | undefined {
  const diff = str(part.metadata.diff);
  if (diff) return diff;
  const patches = records(part.metadata.files).flatMap((file) => (typeof file.patch === 'string' ? [file.patch] : []));
  return patches.length ? patches.join('\n') : undefined;
}

/** The files a call changed or read, else the call itself, so repeat visits to a file count once. */
function touched(part: ReplyToolPart): string[] {
  const files = part.name === 'patch' ? patchFiles(part) : [str(part.input.path) ?? str(part.input.filePath)].flatMap((f) => f ?? []);
  return files.length ? files : [`#${part.id}`];
}

type Bucket = ToolCategory | 'websearch' | 'page';

/** Where a call counts in a summary; bookkeeping and calls the interrupt cut off count nowhere. */
function bucketOf(part: ReplyToolPart): Bucket | undefined {
  const spec = toolSpec(part.name);
  if (spec.internal || part.aborted) return undefined;
  if (spec.category === 'web') return part.name === 'websearch' ? 'websearch' : 'page';
  return spec.category;
}

/** Summary pieces in reading order: what changed first. Plugin calls ('other') come last, by name. */
const PIECES: readonly [Bucket, string, string][] = [
  ['edit', 'file edited', 'files edited'],
  ['shell', 'command', 'commands'],
  ['read', 'file read', 'files read'],
  ['search', 'search', 'searches'],
  ['websearch', 'web search', 'web searches'],
  ['page', 'page opened', 'pages opened'],
  ['agent', 'agent', 'agents'],
];

/** "3 Chrome navigate calls" when one plugin tool did them all, else "3 tool calls". */
function pluginPiece(names: readonly string[]): string | undefined {
  if (names.length === 0) return undefined;
  const distinct = new Set(names);
  const only = distinct.size === 1 ? toolName(names[0]!) : undefined;
  return only ? plural(names.length, `${only} call`, `${only} calls`) : plural(names.length, 'tool call', 'tool calls');
}

/**
 * "2 files edited · 3 commands · 4 files read": what a group of tool calls did, counting files
 * rather than calls and leaving bookkeeping (plans, skills, questions) and interrupted calls out.
 */
export function toolSummary(parts: readonly ReplyToolPart[]): string {
  const seen = new Map<Bucket, Set<string>>();
  const plugins: string[] = [];
  for (const part of parts) {
    const bucket = bucketOf(part);
    if (bucket === 'other') plugins.push(part.name);
    if (!bucket || bucket === 'other') continue;
    const keys = bucket === 'edit' || bucket === 'read' ? touched(part) : [part.id];
    const set = seen.get(bucket) ?? new Set<string>();
    keys.forEach((key) => set.add(key));
    seen.set(bucket, set);
  }
  const pieces = PIECES.flatMap(([bucket, one, many]) => {
    const count = seen.get(bucket)?.size ?? 0;
    return count ? [plural(count, one, many)] : [];
  });
  const plugin = pluginPiece(plugins);
  return (plugin ? [...pieces, plugin] : pieces).join(' · ');
}

/** A file extension's code-fence language, for showing written content highlighted. */
export function languageOf(path: string | undefined): string {
  const ext = path?.split('.').at(-1)?.toLowerCase();
  if (!ext || ext === path?.toLowerCase()) return 'text';
  const aliases: Record<string, string> = {
    ts: 'ts',
    tsx: 'tsx',
    js: 'js',
    jsx: 'jsx',
    mjs: 'js',
    cjs: 'js',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    css: 'css',
    html: 'html',
    sh: 'bash',
    ps1: 'powershell',
  };
  return aliases[ext] ?? ext;
}
