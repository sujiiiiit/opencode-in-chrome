// Tab scope (spec browser/tab-scope): each opencode session owns at most one Chrome tab
// group, and its calls may only use tabs in that group. State lives in storage.session
// so a restarted service worker picks up the same groups and tab ids.
import { ToolError } from './tools/registry';

export type Tab = {
  id?: number;
  title?: string;
  url?: string;
  pendingUrl?: string;
  groupId?: number;
  windowId?: number;
  openerTabId?: number;
  active?: boolean;
};

export type TabInfo = { id: number; title: string; url: string };

/** The Chrome calls this module needs, injectable for tests. */
export type TabApi = {
  get(tabId: number): Promise<Tab>;
  create(props: { url?: string; windowId?: number; active?: boolean; openerTabId?: number }): Promise<Tab>;
  remove(tabId: number): Promise<void>;
  group(options: { tabIds: number[]; groupId?: number; createProperties?: { windowId?: number } }): Promise<number>;
  ungroup(tabIds: number[]): Promise<void>;
  updateGroup(groupId: number, props: { title?: string; color?: string; collapsed?: boolean }): Promise<unknown>;
  lastFocusedWindowId(): Promise<number | undefined>;
};

export type KeyValue<T> = { get(): Promise<T | undefined>; set(value: T): Promise<void> };

type SessionTabs = {
  groupId: number;
  /** Most recently used last. */
  tabIds: number[];
  /** Tabs the user shared; released (ungrouped, not closed) when the session lets go. */
  shared: number[];
};

type State = Record<string, SessionTabs>;

const BLANK = 'about:blank';
const RESTRICTED_SCHEMES = /^(chrome|chrome-extension|chrome-untrusted|chrome-search|edge|brave|opera|vivaldi|about|devtools|view-source|file|data|javascript):/i;
const RESTRICTED_HOSTS = new Set(['chrome.google.com', 'chromewebstore.google.com', 'microsoftedge.microsoft.com']);

/**
 * Pages the extension cannot script: browser-internal pages, other extensions, the web
 * stores, blank tabs, local files and data URLs. Only navigation works there.
 */
export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  if (RESTRICTED_SCHEMES.test(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (parsed.hostname === 'chrome.google.com') return parsed.pathname.startsWith('/webstore');
    return RESTRICTED_HOSTS.has(parsed.hostname);
  } catch {
    return true;
  }
}

export function groupTitle(sessionID: string): string {
  return `Opencode ${sessionID.slice(-4)}`;
}

const info = (tab: Tab): TabInfo => ({
  id: tab.id!,
  title: tab.title ?? '',
  url: tab.pendingUrl || tab.url || '',
});

export class TabScope {
  private state: State | undefined;
  /** Serialises state changes so concurrent calls cannot lose an update. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly api: TabApi,
    private readonly store: KeyValue<State>,
    /** Told when a tab joins or leaves any session (the debugger attaches and detaches). */
    private readonly hooks: { onJoin?: (tabId: number) => void; onLeave?: (tabId: number) => void } = {},
  ) {}

  private async load(): Promise<State> {
    if (!this.state) this.state = (await this.store.get()) ?? {};
    return this.state;
  }

  private locked<T>(work: (state: State) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const state = await this.load();
      const before = new Set(Object.values(state).flatMap((e) => e.tabIds));
      let result: T;
      try {
        result = await work(state);
      } finally {
        await this.store.set(state);
        const after = new Set(Object.values(state).flatMap((e) => e.tabIds));
        for (const id of after) if (!before.has(id)) this.hooks.onJoin?.(id);
        for (const id of before) if (!after.has(id)) this.hooks.onLeave?.(id);
      }
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Tabs of a session that still exist, most recently used last (drops tabs that vanished). */
  private async liveTabs(state: State, sessionID: string): Promise<Tab[]> {
    const entry = state[sessionID];
    if (!entry) return [];
    const tabs: Tab[] = [];
    for (const id of entry.tabIds) {
      const tab = await this.api.get(id).catch(() => undefined);
      if (tab?.id !== undefined) tabs.push(tab);
    }
    entry.tabIds = tabs.map((t) => t.id!);
    entry.shared = entry.shared.filter((id) => entry.tabIds.includes(id));
    if (tabs.length === 0) delete state[sessionID];
    return tabs;
  }

  private async newGroupTab(state: State, sessionID: string, url: string): Promise<Tab> {
    const windowId = await this.api.lastFocusedWindowId();
    const tab = await this.api.create({ url, windowId, active: false });
    const entry = state[sessionID];
    if (entry) {
      await this.api.group({ tabIds: [tab.id!], groupId: entry.groupId });
      entry.tabIds.push(tab.id!);
    } else {
      const groupId = await this.api.group({ tabIds: [tab.id!], createProperties: { windowId: tab.windowId ?? windowId } });
      await this.api.updateGroup(groupId, { title: groupTitle(sessionID), color: 'orange' });
      state[sessionID] = { groupId, tabIds: [tab.id!], shared: [] };
    }
    return tab;
  }

  /** `tabs_context`: the session's tabs and which one is current. */
  context(sessionID: string, createIfEmpty = false): Promise<{ tabs: TabInfo[]; currentTabId?: number; groupId?: number }> {
    return this.locked(async (state) => {
      let tabs = await this.liveTabs(state, sessionID);
      if (tabs.length === 0 && createIfEmpty) tabs = [await this.newGroupTab(state, sessionID, BLANK)];
      const entry = state[sessionID];
      return { tabs: tabs.map(info), currentTabId: entry?.tabIds.at(-1), groupId: entry?.groupId };
    });
  }

  /** `tabs_create`: a new background tab in the session's group (creating the group). */
  create(sessionID: string, url = BLANK): Promise<TabInfo> {
    return this.locked(async (state) => {
      await this.liveTabs(state, sessionID);
      return info(await this.newGroupTab(state, sessionID, url));
    });
  }

  /** `tabs_close`: only tabs in the session's group; closing the last one removes the group. */
  close(sessionID: string, tabId: number): Promise<{ remaining: number }> {
    return this.locked(async (state) => {
      await this.liveTabs(state, sessionID);
      const entry = state[sessionID];
      if (!entry?.tabIds.includes(tabId)) throw this.notInGroup(state, sessionID, tabId);
      if (entry.shared.includes(tabId)) {
        await this.api.ungroup([tabId]);
      } else {
        await this.api.remove(tabId);
      }
      entry.tabIds = entry.tabIds.filter((id) => id !== tabId);
      entry.shared = entry.shared.filter((id) => id !== tabId);
      if (entry.tabIds.length === 0) delete state[sessionID];
      return { remaining: entry.tabIds.length };
    });
  }

  /**
   * The tab a page tool acts on: `tabId` when given (must be in the group), otherwise the
   * current tab. It becomes the current tab.
   */
  resolve(sessionID: string, tabId?: number): Promise<TabInfo> {
    return this.locked(async (state) => {
      const tabs = await this.liveTabs(state, sessionID);
      const entry = state[sessionID];
      if (!entry || tabs.length === 0) {
        throw new ToolError('NO_TAB', 'This session has no tabs yet. Call tabs_context with createIfEmpty: true, or navigate to a URL.');
      }
      const id = tabId ?? entry.tabIds.at(-1)!;
      const tab = tabs.find((t) => t.id === id);
      if (!tab) throw this.notInGroup(state, sessionID, id);
      entry.tabIds = [...entry.tabIds.filter((t) => t !== id), id];
      return info(tab);
    });
  }

  private notInGroup(state: State, sessionID: string, tabId: number): ToolError {
    const valid = state[sessionID]?.tabIds ?? [];
    return new ToolError(
      'NOT_IN_GROUP',
      `Tab ${tabId} is not one of this session's tabs. Valid tab ids: ${valid.length ? valid.join(', ') : 'none (create one with tabs_create)'}.`,
    );
  }

  /** The user shares a tab with a session: it joins the group and becomes current. */
  share(sessionID: string, tabId: number, move = false): Promise<TabInfo> {
    return this.locked(async (state) => {
      const tab = await this.api.get(tabId);
      await this.liveTabs(state, sessionID);
      const owner = this.ownerIn(state, tabId);
      if (owner && owner !== sessionID) {
        if (!move) throw new ToolError('NOT_IN_GROUP', 'That tab already belongs to another session.');
        const previous = state[owner]!;
        previous.tabIds = previous.tabIds.filter((id) => id !== tabId);
        previous.shared = previous.shared.filter((id) => id !== tabId);
        if (previous.tabIds.length === 0) delete state[owner];
      }
      const entry = state[sessionID];
      if (entry) {
        await this.api.group({ tabIds: [tabId], groupId: entry.groupId });
        entry.tabIds = [...entry.tabIds.filter((t) => t !== tabId), tabId];
        if (!entry.shared.includes(tabId)) entry.shared.push(tabId);
      } else {
        const groupId = await this.api.group({ tabIds: [tabId], createProperties: { windowId: tab.windowId } });
        await this.api.updateGroup(groupId, { title: groupTitle(sessionID), color: 'orange' });
        state[sessionID] = { groupId, tabIds: [tabId], shared: [tabId] };
      }
      return info(tab);
    });
  }

  /** Give a shared tab back: it leaves the group and stays open. */
  unshare(sessionID: string, tabId: number): Promise<void> {
    return this.locked(async (state) => {
      const entry = state[sessionID];
      if (!entry?.shared.includes(tabId)) return;
      await this.api.ungroup([tabId]).catch(() => undefined);
      entry.tabIds = entry.tabIds.filter((t) => t !== tabId);
      entry.shared = entry.shared.filter((t) => t !== tabId);
      if (entry.tabIds.length === 0) delete state[sessionID];
    });
  }

  private ownerIn(state: State, tabId: number): string | undefined {
    return Object.entries(state).find(([, entry]) => entry.tabIds.includes(tabId))?.[0];
  }

  /** The session a tab belongs to, if any. */
  async sessionOf(tabId: number): Promise<string | undefined> {
    await this.queue;
    return this.ownerIn(await this.load(), tabId);
  }

  /** `tabs.onCreated`: a tab opened from an agent tab joins its opener's group. */
  adoptPopup(tab: Tab): Promise<{ sessionID: string; tabId: number } | undefined> {
    return this.locked(async (state) => {
      if (tab.id === undefined || tab.openerTabId === undefined) return undefined;
      const sessionID = this.ownerIn(state, tab.openerTabId);
      if (!sessionID) return undefined;
      const entry = state[sessionID]!;
      if (!entry.tabIds.includes(tab.id)) {
        await this.api.group({ tabIds: [tab.id], groupId: entry.groupId }).catch(() => undefined);
        entry.tabIds.push(tab.id);
      }
      return { sessionID, tabId: tab.id };
    });
  }

  /** `tabs.onRemoved` and tabs leaving their group by hand: forget them. */
  forget(tabId: number): Promise<string | undefined> {
    return this.locked(async (state) => {
      const sessionID = this.ownerIn(state, tabId);
      if (!sessionID) return undefined;
      const entry = state[sessionID]!;
      entry.tabIds = entry.tabIds.filter((t) => t !== tabId);
      entry.shared = entry.shared.filter((t) => t !== tabId);
      if (entry.tabIds.length === 0) delete state[sessionID];
      return sessionID;
    });
  }

  /** `tabs.onUpdated` with a groupId change: a tab dragged out of its session's group leaves it. */
  async groupChanged(tabId: number, groupId: number): Promise<void> {
    await this.queue;
    const state = await this.load();
    const sessionID = this.ownerIn(state, tabId);
    if (sessionID && state[sessionID]!.groupId !== groupId) await this.forget(tabId);
  }

  async tabIdsOf(sessionID: string): Promise<number[]> {
    await this.queue;
    return [...((await this.load())[sessionID]?.tabIds ?? [])];
  }

}
