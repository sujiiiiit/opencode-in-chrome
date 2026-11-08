import { createClient, isUnauthorized, type OpenCodeClient } from './client';
import type { Connection } from './connection';
import type { EventHub } from './events';
import type { ServerEvent } from './sse';
import { Store } from './store';
import { ensureWorkspace } from './workspace';

/**
 * What the composer can mention or invoke, following opencode's composer: `@` offers subagents,
 * skills, references and workspace files; `/` offers the server's commands and the skills.
 */
export type MentionKind = 'command' | 'skill' | 'agent' | 'reference' | 'file';

export type MentionItem = {
  /** Unique across kinds (`agent:explore`, `skill:review`, …). */
  id: string;
  kind: MentionKind;
  /** What the server knows it by: a command or agent name, a skill ID, a path. */
  name: string;
  /** Its text in the prompt: `@explore`, `/review`. */
  label: string;
  description?: string;
  /** An absolute path (a reference) or a workspace-relative one (a file). */
  path?: string;
};

export type MentionCatalog = {
  commands: MentionItem[];
  skills: MentionItem[];
  agents: MentionItem[];
  references: MentionItem[];
};

/** A mention placed in the prompt text, with its `[start, end)` offsets in that text. */
export type PlacedMention = Pick<MentionItem, 'kind' | 'name' | 'path'> & { start: number; end: number; text: string };

type Span = { start: number; end: number; text: string };

/** The mention fields of a prompt request (opencode's `Prompt.agents` / `skills` / `files`). */
export type PromptRefs = {
  agents: { name: string; mention: Span }[];
  skills: { id: string; mention: Span }[];
  files: { uri: string; name: string; mention: Span }[];
};

export const EMPTY_CATALOG: MentionCatalog = { commands: [], skills: [], agents: [], references: [] };

// ─── Parsing ──────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

/** The `data` array of a location response (`{location, data}`), or the value itself when an array. */
function rows(value: unknown): Record<string, unknown>[] {
  const data = isRecord(value) && 'data' in value ? value.data : value;
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

const byName = (a: MentionItem, b: MentionItem) => a.name.localeCompare(b.name);

export function parseCommands(value: unknown): MentionItem[] {
  return rows(value)
    .flatMap((row) => {
      const name = str(row.name);
      return name ? [{ id: `command:${name}`, kind: 'command' as const, name, label: `/${name}`, description: str(row.description) }] : [];
    })
    .sort(byName);
}

export function parseSkills(value: unknown): MentionItem[] {
  return rows(value)
    .flatMap((row) => {
      const id = str(row.id) ?? str(row.name);
      return id ? [{ id: `skill:${id}`, kind: 'skill' as const, name: id, label: `/${id}`, description: str(row.description) }] : [];
    })
    .sort(byName);
}

/** Subagents only: a primary agent is chosen in the agent picker, not mentioned. */
export function parseAgents(value: unknown): MentionItem[] {
  return rows(value)
    .flatMap((row) => {
      const name = str(row.name);
      if (!name || row.hidden === true || row.mode === 'primary') return [];
      return [{ id: `agent:${name}`, kind: 'agent' as const, name, label: `@${name}`, description: str(row.description) }];
    })
    .sort(byName);
}

export function parseReferences(value: unknown): MentionItem[] {
  return rows(value)
    .flatMap((row) => {
      const name = str(row.name);
      const path = str(row.path);
      if (!name || !path || row.hidden === true) return [];
      const source = isRecord(row.source) ? row.source : {};
      const description = str(row.description) ?? str(source.repository) ?? str(source.path);
      return [{ id: `reference:${name}`, kind: 'reference' as const, name, label: `@${name}`, description, path }];
    })
    .sort(byName);
}

function parseFiles(value: unknown): MentionItem[] {
  return rows(value).flatMap((row) => {
    const path = str(row.path);
    if (!path || row.type !== 'file') return [];
    return [{ id: `file:${path}`, kind: 'file' as const, name: path, label: `@${path}` }];
  });
}

// ─── Filtering ────────────────────────────────────────────────────────────

/**
 * How well `name` matches `query` (lower is better), or -1 for no match: a prefix, then a match at a
 * word start (after `-`, `_`, `/`, `.` or a space), then anywhere, then the letters in order.
 */
export function matchScore(name: string, query: string): number {
  const q = query.toLowerCase();
  if (!q) return 0;
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 0;
  const at = n.indexOf(q);
  if (at > 0 && /[-_/.\s]/.test(n[at - 1]!)) return 1;
  if (at > 0) return 2;
  let i = 0;
  for (const char of n) if (char === q[i]) i++;
  return i === q.length ? 3 : -1;
}

/** Dependency and VCS folders: left out of file mentions unless the query names one. */
const VENDORED = /(^|[\\/])(node_modules|\.git)([\\/]|$)/;
const baseName = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;

/**
 * The server's fuzzy file matches, cleaned up for the list: vendored paths dropped (unless the query
 * asks for them), then a match on the file's own name before a match on its folders.
 */
export function rankFiles(files: readonly MentionItem[], query: string, limit: number): MentionItem[] {
  const vendored = /node_modules|(^|[\\/])\.git/.test(query);
  return files
    .filter((file) => vendored || !VENDORED.test(file.name))
    .map((file, index) => {
      const own = matchScore(baseName(file.name), query);
      const path = matchScore(file.name, query);
      return { file, index, score: own >= 0 ? own : path >= 0 ? 4 + path : 8 };
    })
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.file);
}

/** The items that match `query`, best first (ties keep their order). */
export function filterItems(items: readonly MentionItem[], query: string, limit = Infinity): MentionItem[] {
  return items
    .map((item, index) => ({ item, index, score: matchScore(item.name, query) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

// ─── Sending ──────────────────────────────────────────────────────────────

/** A `file://` URI for a path, absolute or relative to `directory` (Windows paths too). */
export function fileURI(directory: string | null, path: string): string {
  const absolute = /^([A-Za-z]:[\\/]|[\\/])/.test(path) || !directory ? path : `${directory.replace(/[\\/]+$/, '')}/${path}`;
  const slashed = absolute.replaceAll('\\', '/');
  return `file://${encodeURI(slashed.startsWith('/') ? slashed : `/${slashed}`)}`;
}

/** The request fields for the mentions in a prompt (a command is sent on its own, not here). */
export function promptRefs(mentions: readonly PlacedMention[], directory: string | null): PromptRefs {
  const refs: PromptRefs = { agents: [], skills: [], files: [] };
  for (const { kind, name, path, start, end, text } of mentions) {
    const mention = { start, end, text };
    if (kind === 'agent') refs.agents.push({ name, mention });
    else if (kind === 'skill') refs.skills.push({ id: name, mention });
    else if ((kind === 'file' || kind === 'reference') && path) refs.files.push({ uri: fileURI(directory, path), name: baseName(path), mention });
  }
  return refs;
}

export const hasRefs = (refs: PromptRefs | undefined) => !!refs && (refs.agents.length > 0 || refs.skills.length > 0 || refs.files.length > 0);

/**
 * The command a prompt invokes, if any: a command chip at its start, else typed `/name args` for a
 * command the server lists. The rest of the text is the command's arguments.
 */
export function slashCommand(
  text: string,
  mentions: readonly PlacedMention[],
  commands: readonly MentionItem[],
): { name: string; args: string } | null {
  const chip = mentions.find((mention) => mention.kind === 'command' && mention.start === 0);
  if (chip) return { name: chip.name, args: text.slice(chip.end).trim() };
  const typed = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text);
  if (!typed || !commands.some((command) => command.name === typed[1])) return null;
  return { name: typed[1]!, args: (typed[2] ?? '').trim() };
}

/** Moves mentions placed in `raw` into its trimmed text, dropping any the trim cut. */
export function trimMentions(raw: string, mentions: readonly PlacedMention[]): PlacedMention[] {
  const lead = raw.length - raw.trimStart().length;
  const length = raw.trim().length;
  return mentions
    .map((mention) => ({ ...mention, start: mention.start - lead, end: mention.end - lead }))
    .filter((mention) => mention.start >= 0 && mention.end <= length);
}

// ─── Store ────────────────────────────────────────────────────────────────

export type MentionState = {
  phase: 'idle' | 'loading' | 'ready' | 'failed';
  catalog: MentionCatalog;
  /** The workspace the lists (and file paths) belong to. */
  directory: string | null;
  notice: string | null;
};

const INITIAL_STATE: MentionState = { phase: 'idle', catalog: EMPTY_CATALOG, directory: null, notice: null };

/** Server events after which the commands, skills, agents or references may differ. */
const CATALOG_EVENT = /^(command|skill|agent|reference|config|mcp)\./;
const RELOAD_MS = 150;
const FILE_LIMIT = 8;
const FILE_FETCH = 50;

export type MentionStoreOptions = {
  connection: Connection;
  events?: EventHub;
  fetch?: typeof globalThis.fetch;
  onUnauthorized?: () => void;
};

/**
 * The composer's mention catalog: commands, skills, subagents and references, loaded on first use
 * and reloaded when the server's config changes. Each list is best effort: one that fails stays
 * empty instead of failing the others.
 */
export class MentionStore extends Store<MentionState> {
  private readonly client: OpenCodeClient;

  constructor(private readonly options: MentionStoreOptions) {
    super(INITIAL_STATE);
    const { connection, fetch, events } = options;
    this.client = createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch });
    this.follow(events, this.onEvent, () => this.reload());
  }

  /** Fetches the catalog again once it is loaded (after a reconnect or a config change). */
  private reload(): Promise<void> {
    return this.state.phase === 'ready' ? this.fetchCatalog().catch(() => undefined) : Promise.resolve();
  }

  /** Loads the catalog unless it is loaded or loading. */
  load(): Promise<void> {
    if (this.state.phase === 'ready' || this.state.phase === 'loading') return Promise.resolve();
    return this.once(async () => {
      this.set({ phase: 'loading' });
      try {
        await this.fetchCatalog();
        this.set({ phase: 'ready' });
      } catch (error) {
        if (this.disposed) return;
        if (isUnauthorized(error)) this.options.onUnauthorized?.();
        this.set({ phase: 'failed' });
      }
    });
  }

  private async fetchCatalog(): Promise<void> {
    const signal = this.lifetime.signal;
    const directory = await ensureWorkspace(this.client, this.options.connection.baseUrl);
    const location = { directory };
    const settle = <T>(request: Promise<unknown>, parse: (value: unknown) => T, fallback: T) =>
      request.then(parse, (error: unknown) => {
        if (isUnauthorized(error)) throw error;
        return fallback;
      });
    const [commands, skills, agents, references] = await Promise.all([
      settle(this.client.command.list({ location }, { signal }), parseCommands, []),
      settle(this.client.skill.list({ location }, { signal }), parseSkills, []),
      settle(this.client.agent.list({ location }, { signal }), parseAgents, []),
      settle(this.client.reference.list({ location }, { signal }), parseReferences, []),
    ]);
    this.set({ directory, catalog: { commands, skills, agents, references } });
  }

  /** Workspace files matching `query` (none for an empty query); an aborted or failed search finds none. */
  async findFiles(query: string, signal?: AbortSignal): Promise<MentionItem[]> {
    const directory = this.state.directory;
    if (!query || !directory) return [];
    const signals = signal ? AbortSignal.any([signal, this.lifetime.signal]) : this.lifetime.signal;
    try {
      // Ask for more than are shown: vendored paths are dropped and the rest re-ranked here.
      const found = await this.client.file.find({ location: { directory }, query, type: 'file', limit: FILE_FETCH }, { signal: signals });
      return rankFiles(parseFiles(found), query, FILE_LIMIT);
    } catch {
      return [];
    }
  }

  private onEvent = (event: ServerEvent): void => {
    if (CATALOG_EVENT.test(event.type)) this.debounce(() => void this.reload(), RELOAD_MS);
  };
}
