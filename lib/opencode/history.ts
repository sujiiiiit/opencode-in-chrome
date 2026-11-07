import { createClient, describeError, isTransportError, isUnauthorized, type OpenCodeClient } from './client';
import type { Connection } from './connection';
import type { EventHub } from './events';
import { isRecord } from './reply';
import {
  EXTENSION_METADATA,
  isExtensionSession,
  keepUnchanged,
  mergeSummaries,
  reduceSessions,
  removeSummary,
  toSummary,
  updateSummary,
  type ChatSummary,
} from './sessions';
import type { ServerEvent } from './sse';
import { Store } from './store';
import { ensureWorkspace } from './workspace';

const PAGE_LIMIT = 30;

export type HistoryState = {
  activity: Record<string, 'running' | 'unseen'>;
  knownIDs: string[];
  status: 'idle' | 'loading' | 'ready' | 'failed';
  items: ChatSummary[];
  /** The search the list shows; '' for all chats. */
  search: string;
  /** More (older) chats can be loaded. */
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  /** A failed rename or delete. */
  notice: string | null;
};

export const INITIAL_HISTORY_STATE: HistoryState = {
  activity: {},
  knownIDs: [],
  status: 'idle',
  items: [],
  search: '',
  hasMore: false,
  loadingMore: false,
  error: null,
  notice: null,
};

export type HistoryStoreOptions = {
  connection: Connection;
  events: EventHub;
  fetch?: typeof globalThis.fetch;
  onUnauthorized?: () => void;
};

type Page = { rows: ChatSummary[]; next: string | null };

function reconcileActivity(previous: HistoryState['activity'], active: Record<string, unknown>, viewed: string | null) {
  const activity = { ...previous };
  for (const [id, status] of Object.entries(activity)) {
    if (status !== 'running' || isRecord(active[id])) continue;
    if (id === viewed) delete activity[id];
    else activity[id] = 'unseen';
  }
  for (const [id, status] of Object.entries(active)) if (isRecord(status)) activity[id] = 'running';
  return activity;
}

/** A search as both the server and the local filter compare it: trimmed, ignoring case. */
export const normalizeSearch = (search: string) => search.trim().toLowerCase();

/** Rows whose title contains the search, ignoring case: the server's title match, run locally. */
export function filterByTitle(items: ChatSummary[], search: string): ChatSummary[] {
  const needle = normalizeSearch(search);
  if (!needle) return items;
  return items.filter((item) => item.title?.toLowerCase().includes(needle) ?? false);
}

/**
 * The extension's chats, newest activity first, as an external store (`subscribe` + `getState`).
 * The server filters by the workspace folder (an exact match); each row is checked again for the
 * extension's metadata. Live events keep the list current; a reconnect reloads the first page.
 */
export class HistoryStore extends Store<HistoryState> {
  private viewed: string | null = null;
  private activityVersion = 0;
  private readonly client: OpenCodeClient;
  private workspace: string | null = null;
  private next: string | null = null;
  /** Bumped by every load, so a slower, older search cannot overwrite a newer one. */
  private request = 0;
  /** Aborts the load a newer one replaced, so it stops using the network. */
  private inflight: AbortController | null = null;
  /**
   * The full list (no search) as last loaded, kept current by events, renames and deletes, so
   * clearing a search shows it at once while it refreshes.
   */
  private base: Page | null = null;

  constructor(private readonly options: HistoryStoreOptions) {
    super(INITIAL_HISTORY_STATE);
    const { connection, fetch } = options;
    this.client = createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch });
    this.cleanups.push(
      options.events.subscribe(this.onEvent),
      options.events.onReconnect(async () => {
        await Promise.all([this.load(this.state.search), this.syncActivity()]);
      }),
    );
  }

  private failed(error: unknown): string | null {
    if (this.disposed) return null;
    if (isUnauthorized(error)) {
      this.options.onUnauthorized?.();
      return null;
    }
    return describeError(error);
  }

  /** A failed change: offline says so, anything else names what did not happen. */
  private changeFailed(error: unknown, what: string): string | null {
    const message = this.failed(error);
    if (message === null) return null;
    return isTransportError(error) ? message : `Couldn't ${what} this chat. Try again.`;
  }

  /** Applies a change to the shown rows and to the kept full list alike. */
  private change(update: (rows: ChatSummary[]) => ChatSummary[], patch?: Partial<HistoryState>): void {
    const base = this.base && update(this.base.rows);
    if (this.base && base !== this.base.rows) this.base = { ...this.base, rows: base! };
    const items = update(this.state.items);
    if (items !== this.state.items || patch) this.set({ ...patch, items });
  }

  private onEvent = (event: ServerEvent): void => {
    const id = typeof event.data.sessionID === 'string' ? event.data.sessionID : null;
    if (id) {
      const type = event.type;
      const activity = { ...this.state.activity };
      if (type === 'session.execution.started') activity[id] = 'running';
      else if (['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted'].includes(type)) {
        if (id === this.viewed) delete activity[id];
        else activity[id] = 'unseen';
      } else if (type === 'session.deleted' || type === 'session.archived') delete activity[id];
      else return this.updateRows(event);
      this.activityVersion++;
      this.set({ activity });
    }
    this.updateRows(event);
  };

  private updateRows(event: ServerEvent): void {
    const workspace = this.workspace;
    // Rows only exist once a page loaded; a search's rows get every event too (the view filters).
    if (!workspace || this.state.status === 'idle') return;
    if (event.type === 'session.created' && isExtensionSession(event.data, workspace)) {
      const id = event.data.sessionID;
      if (typeof id === 'string' && !this.state.knownIDs.includes(id)) this.set({ knownIDs: [...this.state.knownIDs, id] });
    }
    this.change((rows) => reduceSessions(rows, event, workspace));
  }

  private rememberRows(rows: ChatSummary[]): void {
    const knownIDs = [...new Set([...this.state.knownIDs, ...rows.map((row) => row.id)])];
    if (knownIDs.length !== this.state.knownIDs.length) this.set({ knownIDs });
  }

  /** Only a visible conversation counts as seen; History itself does not. */
  setViewed(id: string | null): void {
    this.viewed = id;
    if (!id || this.state.activity[id] !== 'unseen') return;
    const activity = { ...this.state.activity };
    delete activity[id];
    this.set({ activity });
  }

  /** Reconcile running sessions after opening the panel or reconnecting. */
  async syncActivity(): Promise<void> {
    const version = this.activityVersion;
    try {
      const active: unknown = await this.client.session.active({ signal: this.lifetime.signal });
      if (version !== this.activityVersion || !isRecord(active)) return;
      this.set({ activity: reconcileActivity(this.state.activity, active, this.viewed) });
    } catch { /* The event stream remains authoritative if the snapshot is unavailable. */ }
  }

  private async fetchPage(cursor: string | null, search: string, signal: AbortSignal): Promise<Page> {
    this.workspace ??= await ensureWorkspace(this.client, this.options.connection.baseUrl);
    const workspace = this.workspace;
    // A cursor carries its own filters and order.
    const query = cursor
      ? { cursor, limit: PAGE_LIMIT }
      : {
          directory: workspace,
          parentID: null,
          archived: false,
          order: 'desc' as const,
          limit: PAGE_LIMIT,
          ...(search ? { search } : {}),
        };
    const page: unknown = await this.client.session.list(query, { signal });
    const record = isRecord(page) ? page : {};
    const data = Array.isArray(record.data) ? record.data : [];
    const cursorOut = isRecord(record.cursor) ? record.cursor : {};
    const rows = data
      .filter((info) => isExtensionSession(info, workspace))
      .map(toSummary)
      .filter((row): row is ChatSummary => row !== null);
    // The server returns a cursor even on the last page: a short page is the last one.
    const next = typeof cursorOut.next === 'string' && data.length >= PAGE_LIMIT ? cursorOut.next : null;
    return { rows, next };
  }

  /**
   * Loads the first page, for a search ('' for all chats). The rows on screen stay until the
   * answer replaces them (the view filters them meanwhile), so a search never blanks the list;
   * clearing the search shows the kept full list at once.
   */
  async load(search = ''): Promise<void> {
    const { request, term, signal } = this.begin(search);
    try {
      const page = await this.fetchPage(null, term, signal);
      if (request !== this.request) return;
      this.rememberRows(page.rows);
      this.next = page.next;
      if (term === '') this.base = page;
      const items = keepUnchanged(this.state.items, mergeSummaries([], page.rows));
      this.set({ status: 'ready', items, hasMore: page.next !== null });
    } catch (error) {
      if (request !== this.request) return;
      const message = this.failed(error);
      this.set({ status: 'failed', error: message ?? this.state.error });
    }
  }

  /** Starts a load: replaces (aborts) the one in flight, and shows the kept full list for ''. */
  private begin(search: string): { request: number; term: string; signal: AbortSignal } {
    const term = search.trim();
    this.inflight?.abort();
    this.inflight = new AbortController();
    const cached = term === '' ? this.base : null;
    if (cached) this.next = cached.next;
    const rows = cached ? { items: cached.rows, hasMore: cached.next !== null } : {};
    this.set({ status: 'loading', search, error: null, ...rows });
    return { request: ++this.request, term, signal: AbortSignal.any([this.lifetime.signal, this.inflight.signal]) };
  }

  async loadMore(): Promise<void> {
    if (!this.next || this.state.loadingMore || this.state.status !== 'ready') return;
    const request = this.request;
    this.set({ loadingMore: true });
    try {
      const { rows, next } = await this.fetchPage(this.next, this.state.search, this.lifetime.signal);
      if (request !== this.request) {
        this.set({ loadingMore: false });
        return;
      }
      this.next = next;
      this.rememberRows(rows);
      const items = mergeSummaries(this.state.items, rows);
      if (this.state.search.trim() === '') this.base = { rows: items, next };
      // One update for the page and the button, so the list renders once.
      this.set({ items, hasMore: next !== null, loadingMore: false });
    } catch (error) {
      const message = this.failed(error);
      this.set({ loadingMore: false, ...(message ? { notice: message } : {}) });
    }
  }

  /** Renames a chat right away, and puts the old title back if the server refuses. */
  async rename(id: string, title: string): Promise<boolean> {
    const trimmed = title.trim();
    const row = this.state.items.find((item) => item.id === id);
    if (!row || !trimmed || trimmed === row.title) return false;
    // Renaming advances the session's update time on the server, so it moves to the top here too.
    const updated = Date.now();
    this.change((rows) => updateSummary(rows, id, { title: trimmed, updated }), { notice: null });
    try {
      // The tag keeps an older, untagged chat listed once its legacy title is gone.
      await this.client.session.update(
        { sessionID: id, title: trimmed, metadata: EXTENSION_METADATA },
        { signal: this.lifetime.signal },
      );
      return true;
    } catch (error) {
      const message = this.changeFailed(error, 'rename');
      this.change((rows) => updateSummary(rows, id, { title: row.title, updated: row.updated }), {
        notice: message ?? this.state.notice,
      });
      return false;
    }
  }

  /** Deletes a chat for good; the row goes as soon as the server confirms. */
  async remove(id: string): Promise<boolean> {
    this.set({ notice: null });
    try {
      await this.client.session.remove({ sessionID: id }, { signal: this.lifetime.signal });
      const activity = { ...this.state.activity };
      delete activity[id];
      this.set({ activity });
      this.change((rows) => removeSummary(rows, id));
      return true;
    } catch (error) {
      const message = this.changeFailed(error, 'delete');
      if (message) this.set({ notice: message });
      return false;
    }
  }
}
