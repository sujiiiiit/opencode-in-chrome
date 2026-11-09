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
  index?: number;
  pinned?: boolean;
  audible?: boolean;
  mutedInfo?: { muted: boolean };
  discarded?: boolean;
  autoDiscardable?: boolean;
  frozen?: boolean;
  highlighted?: boolean;
  status?: 'unloaded' | 'loading' | 'complete';
  splitViewId?: number;
};

export type TabInfo = { id: number; title: string; url: string };

/** A tab with the state flags Chrome reports for it (tabs_context shows the ones that are set). */
export type TabDetails = TabInfo & {
  active: boolean;
  pinned: boolean;
  audible: boolean;
  muted: boolean;
  discarded: boolean;
  frozen: boolean;
  loading: boolean;
  /** The split view the tab is in, if any. */
  splitViewId?: number;
};

export type TabUpdate = {
  url?: string;
  active?: boolean;
  highlighted?: boolean;
  muted?: boolean;
  pinned?: boolean;
  autoDiscardable?: boolean;
  openerTabId?: number;
};

/** The browser's New Tab page (Ctrl+T, the + button): never a page an agent opened. */
const NEW_TAB_PAGE = /^(chrome|edge|brave|opera|vivaldi):\/\/(newtab|new-tab-page|startpage)\/?$|^about:newtab$/;

function isNewTabPage(tab: { url?: string; pendingUrl?: string }): boolean {
  const url = tab.pendingUrl || tab.url;
  return url !== undefined && NEW_TAB_PAGE.test(url);
}

export type ZoomSettings = {
  mode?: 'automatic' | 'manual' | 'disabled';
  scope?: 'per-origin' | 'per-tab';
  defaultZoomFactor?: number;
};

export type TabGroup = { id: number; title?: string; color?: string; collapsed?: boolean; windowId?: number };

export const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'] as const;

/** The Chrome calls this module needs, injectable for tests. */
export type TabApi = {
  get(tabId: number): Promise<Tab>;
  list(): Promise<Tab[]>;
  create(props: { url?: string; windowId?: number; active?: boolean; openerTabId?: number }): Promise<Tab>;
  remove(tabId: number): Promise<void>;
  group(options: { tabIds: number[]; groupId?: number; createProperties?: { windowId?: number } }): Promise<number>;
  ungroup(tabIds: number[]): Promise<void>;
  updateGroup(groupId: number, props: { title?: string; color?: string; collapsed?: boolean }): Promise<unknown>;
  lastFocusedWindowId(): Promise<number | undefined>;
  update(tabId: number, props: TabUpdate): Promise<Tab>;
  reload(tabId: number, bypassCache?: boolean): Promise<void>;
  duplicate(tabId: number): Promise<Tab | undefined>;
  /** Reorders inside the tab's window; -1 is the end. */
  move(tabId: number, index: number, windowId?: number): Promise<Tab>;
  discard(tabId: number): Promise<Tab | undefined>;
  /** `tabIndexes` are positions in the window, not tab ids. */
  highlight(windowId: number, tabIndexes: number[]): Promise<void>;
  getZoom(tabId: number): Promise<number>;
  /** 0 resets to the default zoom factor. */
  setZoom(tabId: number, factor: number): Promise<void>;
  getZoomSettings(tabId: number): Promise<ZoomSettings>;
  setZoomSettings(tabId: number, settings: ZoomSettings): Promise<void>;
  detectLanguage(tabId: number): Promise<string>;
  /** A PNG data URL of the active tab in the window. */
  captureVisibleTab(windowId?: number): Promise<string>;
  /** Chrome 155+: returns the split view id. */
  createSplit(tabIds: [number, number]): Promise<number>;
  unsplit(splitViewId: number): Promise<void>;
  getGroup(groupId: number): Promise<TabGroup>;
  moveGroup(groupId: number, index: number): Promise<void>;
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
  return 'Opencode';
}

const info = (tab: Tab): TabInfo => ({
  id: tab.id!,
  title: tab.title ?? '',
  url: tab.pendingUrl || tab.url || '',
});

const detail = (tab: Tab): TabDetails => ({
  ...info(tab),
  active: tab.active === true,
  pinned: tab.pinned === true,
  audible: tab.audible === true,
  muted: tab.mutedInfo?.muted === true,
  discarded: tab.discarded === true,
  frozen: tab.frozen === true,
  loading: tab.status === 'loading',
  ...(tab.splitViewId !== undefined && tab.splitViewId >= 0 ? { splitViewId: tab.splitViewId } : {}),
});

const invalid = (message: string) => new ToolError('INVALID_INPUT', message);

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

  /** Chrome tabs outside this chat, for read-only discovery before the user asks to work in one. */
  otherTabs(sessionID: string): Promise<TabInfo[]> {
    return this.locked(async (state) => {
      await this.liveTabs(state, sessionID);
      const own = new Set(state[sessionID]?.tabIds ?? []);
      return (await this.api.list()).filter((tab) => tab.id !== undefined && !own.has(tab.id)).map(info);
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
      const tab = await this.ownedTab(state, sessionID, tabId);
      const entry = state[sessionID]!;
      entry.tabIds = [...entry.tabIds.filter((t) => t !== tab.id), tab.id!];
      return info(tab);
    });
  }

  /** A live session tab (the current one by default); fails with NO_TAB or NOT_IN_GROUP. Does not change which tab is current. */
  private async ownedTab(state: State, sessionID: string, tabId?: number): Promise<Tab> {
    const tabs = await this.liveTabs(state, sessionID);
    const entry = state[sessionID];
    if (!entry || tabs.length === 0) {
      throw new ToolError('NO_TAB', 'This session has no tabs yet. Call tabs_context with createIfEmpty: true, or navigate to a URL.');
    }
    const id = tabId ?? entry.tabIds.at(-1)!;
    const tab = tabs.find((t) => t.id === id);
    if (!tab) throw this.notInGroup(state, sessionID, id);
    return tab;
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
        await this.liveTabs(state, owner);
        const previous = state[owner]!;
        if (!state[sessionID]) {
          // A new chat on the same browser group takes over that group. No Chrome
          // tab or group operation is needed, so its visible group stays put.
          state[sessionID] = {
            ...previous,
            tabIds: [...previous.tabIds.filter((id) => id !== tabId), tabId],
            shared: [...previous.shared],
          };
          delete state[owner];
          return info(tab);
        }
        previous.tabIds = previous.tabIds.filter((id) => id !== tabId);
        previous.shared = previous.shared.filter((id) => id !== tabId);
        if (previous.tabIds.length === 0) delete state[owner];
      }
      const entry = state[sessionID];
      if (entry) {
        await this.api.group({ tabIds: [tabId], groupId: entry.groupId });
        await this.api.updateGroup(entry.groupId, { title: groupTitle(sessionID), color: 'orange' });
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

  /**
   * The session is over: tabs it opened are closed, tabs the user shared with it leave the
   * group and stay open. Returns how many tabs it had.
   */
  release(sessionID: string): Promise<number> {
    return this.locked(async (state) => {
      const tabs = await this.liveTabs(state, sessionID);
      const entry = state[sessionID];
      if (!entry) return 0;
      const shared = tabs.filter((tab) => entry.shared.includes(tab.id!)).map((tab) => tab.id!);
      const opened = tabs.filter((tab) => !entry.shared.includes(tab.id!)).map((tab) => tab.id!);
      if (shared.length) await this.api.ungroup(shared).catch(() => undefined);
      await Promise.all(opened.map((id) => this.api.remove(id).catch(() => undefined)));
      delete state[sessionID];
      return tabs.length;
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

  /**
   * `tabs.onCreated`: a tab opened from an agent tab joins its opener's group. A blank New Tab
   * page is the user's own (Chrome names the tab they were on as its opener), so it stays out
   * and its side panel starts a new chat.
   */
  adoptPopup(tab: Tab): Promise<{ sessionID: string; tabId: number } | undefined> {
    return this.locked(async (state) => {
      if (tab.id === undefined || tab.openerTabId === undefined || isNewTabPage(tab)) return undefined;
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

  // --- the rest of chrome.tabs, always limited to the session's own tabs ------------------

  private async ownedId(state: State, sessionID: string, tabId?: number): Promise<number> {
    return (await this.ownedTab(state, sessionID, tabId)).id!;
  }

  /** Runs `work` on a session tab, serialised with every other state change. */
  private onOwned<T>(sessionID: string, tabId: number | undefined, work: (id: number) => Promise<T>): Promise<T> {
    return this.locked(async (state) => work(await this.ownedId(state, sessionID, tabId)));
  }

  /** The state flags of every session tab. */
  details(sessionID: string): Promise<{ tabs: TabDetails[]; currentTabId?: number; groupId?: number }> {
    return this.locked(async (state) => {
      const tabs = await this.liveTabs(state, sessionID);
      const entry = state[sessionID];
      return { tabs: tabs.map(detail), currentTabId: entry?.tabIds.at(-1), groupId: entry?.groupId };
    });
  }

  reload(sessionID: string, tabId?: number, bypassCache = false): Promise<TabDetails> {
    return this.onOwned(sessionID, tabId, async (id) => {
      await this.api.reload(id, bypassCache);
      return detail(await this.api.get(id));
    });
  }

  /** The copy joins the session's group and becomes its current tab. */
  duplicate(sessionID: string, tabId?: number): Promise<TabDetails> {
    return this.locked(async (state) => {
      const id = await this.ownedId(state, sessionID, tabId);
      const copy = await this.api.duplicate(id);
      if (copy?.id === undefined) throw new ToolError('INTERNAL', `Chrome could not duplicate tab ${id}.`);
      const entry = state[sessionID]!;
      await this.api.group({ tabIds: [copy.id], groupId: entry.groupId });
      entry.tabIds.push(copy.id);
      return detail(copy);
    });
  }

  /** Reorders a tab inside its window (-1 is the end). Moving between windows would drop it from the group. */
  async move(sessionID: string, tabId: number, index: number): Promise<TabDetails> {
    if (!Number.isInteger(index) || index < -1) throw invalid('index must be an integer, -1 (the end) or higher.');
    return this.onOwned(sessionID, tabId, async (id) => detail(await this.api.move(id, index)));
  }

  /** Frees a background tab's memory; it reloads when shown. Chrome refuses the active tab. */
  discard(sessionID: string, tabId: number): Promise<TabDetails> {
    return this.onOwned(sessionID, tabId, async (id) => {
      if ((await this.api.get(id)).active) throw invalid(`Tab ${id} is showing, and Chrome will not discard a tab that is showing.`);
      const result = await this.api.discard(id);
      if (!result) throw invalid(`Chrome did not discard tab ${id} (it may already be discarded).`);
      return detail(result);
    });
  }

  /** Mute, highlight and auto-discard flags. Pinning is refused: Chrome removes a pinned tab from its group. */
  async setState(sessionID: string, tabId: number | undefined, change: { muted?: boolean; highlighted?: boolean; autoDiscardable?: boolean; pinned?: boolean }): Promise<TabDetails> {
    if (Object.values(change).every((v) => v === undefined)) throw invalid('Nothing to change: give muted, highlighted, autoDiscardable or pinned: false.');
    if (change.pinned === true) {
      throw invalid("A pinned tab leaves the chat's tab group, so tabs can't be pinned. Use pinned: false to unpin one.");
    }
    return this.onOwned(sessionID, tabId, async (id) => detail(await this.api.update(id, change)));
  }

  /** Multi-selects session tabs of one window. Chrome makes the first one the shown tab. */
  async highlight(sessionID: string, tabIds: number[]): Promise<void> {
    if (tabIds.length === 0) throw invalid('Give at least one tab id to highlight.');
    return this.locked(async (state) => {
      const tabs: Tab[] = [];
      for (const id of tabIds) tabs.push(await this.api.get(await this.ownedId(state, sessionID, id)));
      const windowId = tabs[0]!.windowId;
      if (windowId === undefined || tabs.some((t) => t.windowId !== windowId)) throw invalid('Tabs to highlight must all be in the same window.');
      await this.api.highlight(windowId, tabs.map((t) => t.index ?? 0));
    });
  }

  zoom(sessionID: string, tabId?: number): Promise<number> {
    return this.onOwned(sessionID, tabId, (id) => this.api.getZoom(id));
  }

  /** `factor` 0 resets to the default zoom. */
  async setZoom(sessionID: string, tabId: number | undefined, factor: number): Promise<void> {
    if (!Number.isFinite(factor) || factor < 0) throw invalid('Zoom factor must be 0 (reset) or a positive number such as 1.5.');
    return this.onOwned(sessionID, tabId, (id) => this.api.setZoom(id, factor));
  }

  zoomSettings(sessionID: string, tabId?: number): Promise<ZoomSettings> {
    return this.onOwned(sessionID, tabId, (id) => this.api.getZoomSettings(id));
  }

  async setZoomSettings(sessionID: string, tabId: number | undefined, settings: ZoomSettings): Promise<void> {
    if (settings.scope === 'per-origin' && settings.mode !== undefined && settings.mode !== 'automatic') {
      throw invalid('Scope per-origin only works in automatic mode.');
    }
    return this.onOwned(sessionID, tabId, (id) => this.api.setZoomSettings(id, settings));
  }

  language(sessionID: string, tabId?: number): Promise<string> {
    return this.onOwned(sessionID, tabId, (id) => this.api.detectLanguage(id));
  }

  /** A PNG data URL of the visible tab. Only a tab that is showing can be captured; this never changes focus. */
  capture(sessionID: string, tabId?: number): Promise<string> {
    return this.onOwned(sessionID, tabId, async (id) => {
      const tab = await this.api.get(id);
      if (!tab.active) throw new ToolError('NOT_INTERACTABLE', `Tab ${id} is in the background, so its visible area can't be captured. Use computer screenshot instead.`);
      return this.api.captureVisibleTab(tab.windowId);
    });
  }

  /** Chrome 155+: shows two adjacent session tabs side by side. Returns the split view id. */
  async split(sessionID: string, tabIds: [number, number]): Promise<number> {
    if (tabIds[0] === tabIds[1]) throw invalid('A tab cannot be split with itself.');
    return this.locked(async (state) => {
      for (const id of tabIds) await this.ownedId(state, sessionID, id);
      return this.api.createSplit(tabIds);
    });
  }

  /** Separates the split view the tab is in. */
  unsplit(sessionID: string, tabId: number): Promise<void> {
    return this.onOwned(sessionID, tabId, async (id) => {
      const viewId = (await this.api.get(id)).splitViewId;
      if (viewId === undefined || viewId < 0) throw invalid(`Tab ${id} is not in a split view.`);
      await this.api.unsplit(viewId);
    });
  }

  // --- the session's tab group ----------------------------------------------------------------

  private async groupIdOf(sessionID: string): Promise<number> {
    const { groupId } = await this.context(sessionID);
    if (groupId === undefined) throw new ToolError('NO_TAB', 'This session has no tabs, so it has no tab group.');
    return groupId;
  }

  async groupInfo(sessionID: string): Promise<TabGroup> {
    return this.api.getGroup(await this.groupIdOf(sessionID));
  }

  async updateGroupOf(sessionID: string, props: { title?: string; color?: string; collapsed?: boolean }): Promise<TabGroup> {
    if (Object.values(props).every((v) => v === undefined)) throw invalid('Nothing to change: give title, color or collapsed.');
    if (props.color !== undefined && !(GROUP_COLORS as readonly string[]).includes(props.color)) {
      throw invalid(`Group color must be one of ${GROUP_COLORS.join(', ')}.`);
    }
    const groupId = await this.groupIdOf(sessionID);
    await this.api.updateGroup(groupId, props);
    return this.api.getGroup(groupId);
  }

  /** Moves the session's whole group within its window (-1 is the end). */
  async moveGroup(sessionID: string, index: number): Promise<void> {
    if (!Number.isInteger(index) || index < -1) throw invalid('index must be an integer, -1 (the end) or higher.');
    await this.api.moveGroup(await this.groupIdOf(sessionID), index);
  }

  /** `tabs.onReplaced` (prerender or instant swap): the new tab id takes over the old one's place. */
  replaced(addedTabId: number, removedTabId: number): Promise<void> {
    return this.locked(async (state) => {
      const sessionID = this.ownerIn(state, removedTabId);
      if (!sessionID) return;
      const entry = state[sessionID]!;
      const swap = (id: number) => (id === removedTabId ? addedTabId : id);
      entry.tabIds = entry.tabIds.map(swap);
      entry.shared = entry.shared.map(swap);
    });
  }
}
