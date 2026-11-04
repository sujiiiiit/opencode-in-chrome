// Pure helpers for the chat history: which sessions belong to the extension, how live events
// change the list, and how it is grouped for display.
import { isRecord } from './reply';
import type { ServerEvent } from './sse';

/** Tags every session the extension creates, so a CLI run inside the workspace stays out. */
export const EXTENSION_METADATA = { source: 'chrome-extension' } as const;

/**
 * Chats from before the metadata tag carry no metadata and the title the extension used to set
 * on every session. A CLI chat started inside the workspace gets its own title.
 */
const LEGACY_TITLE = 'Chrome chat';

export type ChatSummary = {
  id: string;
  /** Null until opencode names the session from its first message. */
  title: string | null;
  created: number;
  updated: number;
};

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/**
 * A session the extension started: created in its workspace folder, tagged with its metadata
 * (or an untagged chat from before the tag), and not a subagent's child session. Accepts a session (GET /api/session) or the data of a
 * `session.created` event; both carry `location`, `metadata` and `parentID`.
 */
export function isExtensionSession(info: unknown, workspace: string): boolean {
  if (!isRecord(info) || str(info.parentID)) return false;
  const location = isRecord(info.location) ? info.location : {};
  const metadata = isRecord(info.metadata) ? info.metadata : {};
  if (location.directory !== workspace) return false;
  if (metadata.source === EXTENSION_METADATA.source) return true;
  return metadata.source === undefined && info.title === LEGACY_TITLE;
}

/** A session from GET /api/session as a history row; null when it is malformed. */
export function toSummary(info: unknown): ChatSummary | null {
  if (!isRecord(info)) return null;
  const id = str(info.id);
  if (!id) return null;
  const time = isRecord(info.time) ? info.time : {};
  const created = num(time.created) ?? 0;
  return { id, title: str(info.title) ?? null, created, updated: num(time.updated) ?? created };
}

const newestFirst = (a: ChatSummary, b: ChatSummary) => b.updated - a.updated;

/** Adds or replaces rows by id, newest activity first. */
export function mergeSummaries(list: ChatSummary[], rows: ChatSummary[]): ChatSummary[] {
  const byId = new Map(list.map((row) => [row.id, row]));
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()].sort(newestFirst);
}

/** Changes a listed row (re-sorted); the same list when it is not listed. */
export function updateSummary(list: ChatSummary[], id: string, patch: Partial<ChatSummary>): ChatSummary[] {
  const index = list.findIndex((row) => row.id === id);
  if (index === -1) return list;
  return mergeSummaries(list, [{ ...list[index]!, ...patch }]);
}

/** Drops a listed row; the same list when it is not listed. */
export function removeSummary(list: ChatSummary[], id: string): ChatSummary[] {
  return list.some((row) => row.id === id) ? list.filter((row) => row.id !== id) : list;
}

/**
 * A fresh page with each unchanged row kept as the object `list` already holds, so memoized rows
 * skip re-rendering when a reload or search brings them back as they were.
 */
export function keepUnchanged(list: ChatSummary[], rows: ChatSummary[]): ChatSummary[] {
  const known = new Map(list.map((row) => [row.id, row]));
  return rows.map((row) => {
    const old = known.get(row.id);
    return old && old.title === row.title && old.updated === row.updated && old.created === row.created ? old : row;
  });
}

/**
 * Applies one event to the history list. The stream carries every session on the machine, so a
 * created session is only added when it is the extension's; the rest only touch listed rows.
 */
export function reduceSessions(list: ChatSummary[], event: ServerEvent, workspace: string): ChatSummary[] {
  const d = event.data;
  const id = str(d.sessionID);
  if (!id) return list;
  const at = event.created ?? Date.now();
  switch (event.type) {
    case 'session.created':
      if (!isExtensionSession(d, workspace) || list.some((row) => row.id === id)) return list;
      return mergeSummaries(list, [{ id, title: str(d.title) ?? null, created: at, updated: at }]);
    case 'session.renamed':
      // A rename (by hand or opencode's generated title) also advances the session's update time.
      return updateSummary(list, id, { title: str(d.title) ?? null, updated: at });
    case 'session.deleted':
    case 'session.archived':
      return removeSummary(list, id);
    case 'session.execution.started':
      return updateSummary(list, id, { updated: at });
    default:
      return list;
  }
}

export type HistoryGroup = { label: string; items: ChatSummary[] };

const DAY_MS = 86_400_000;

/** Today / Yesterday / Last 7 days / Older, by local calendar day; empty groups are left out. */
export function groupByDay(list: ChatSummary[], now: number): HistoryGroup[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  const bounds: Array<[string, number]> = [
    ['Today', today],
    ['Yesterday', today - DAY_MS],
    ['Last 7 days', today - 6 * DAY_MS],
    ['Older', -Infinity],
  ];
  const groups = bounds.map(([label]) => ({ label, items: [] as ChatSummary[] }));
  for (const row of list) {
    const index = bounds.findIndex(([, start]) => row.updated >= start);
    groups[index]!.items.push(row);
  }
  return groups.filter((group) => group.items.length > 0);
}

/** The timestamped placeholder older opencode releases stored as a title (as opencode matches it). */
const FALLBACK_TITLE = /^(New session|Child session) - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** No real title yet: none, or an old timestamped placeholder. Opencode names it from the first message. */
export const isUntitled = (title: string | null | undefined): title is null | undefined | '' =>
  !title || FALLBACK_TITLE.test(title);

export const displayTitle = (title: string | null) => (isUntitled(title) ? 'New chat' : title);

/** A short relative time for a history row: "now", "5m", "3h", "2d", then a date. */
export function relativeTime(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
