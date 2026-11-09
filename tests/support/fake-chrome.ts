// In-memory stand-ins for the Chrome APIs the browser agent uses (tabs, groups, windows).
import type { KeyValue, Tab, TabApi, TabGroup, TabUpdate, ZoomSettings } from '@/lib/browser/tabs';
import { ToolError } from '@/lib/browser/tools/registry';

export class FakeChrome implements TabApi {
  tabs = new Map<number, Tab>();
  groups = new Map<number, { title?: string; color?: string; windowId?: number; collapsed?: boolean }>();
  focusedWindow = 1;
  private nextTab = 100;
  private nextGroup = 10;

  addUserTab(url: string, windowId = 1): Tab {
    const tab: Tab = { id: this.nextTab++, url, title: url, windowId, groupId: -1, active: true };
    this.tabs.set(tab.id!, tab);
    return tab;
  }
  async get(id: number) {
    const tab = this.tabs.get(id);
    if (!tab) throw new Error(`No tab with id: ${id}`);
    return { ...tab };
  }
  async list() {
    return [...this.tabs.values()].map((tab) => ({ ...tab }));
  }
  async create(props: { url?: string; windowId?: number; active?: boolean; openerTabId?: number }) {
    const tab: Tab = { id: this.nextTab++, url: props.url, title: '', windowId: props.windowId, active: props.active, groupId: -1 };
    this.tabs.set(tab.id!, tab);
    return { ...tab };
  }
  async remove(id: number) {
    this.tabs.delete(id);
  }
  async group(options: { tabIds: number[]; groupId?: number; createProperties?: { windowId?: number } }) {
    const groupId = options.groupId ?? this.nextGroup++;
    if (!this.groups.has(groupId)) this.groups.set(groupId, { windowId: options.createProperties?.windowId });
    for (const id of options.tabIds) this.tabs.get(id)!.groupId = groupId;
    return groupId;
  }
  async ungroup(tabIds: number[]) {
    for (const id of tabIds) this.tabs.get(id)!.groupId = -1;
  }
  async updateGroup(groupId: number, props: { title?: string; color?: string; collapsed?: boolean }) {
    Object.assign(this.groups.get(groupId)!, props);
  }
  async lastFocusedWindowId() {
    return this.focusedWindow;
  }

  // --- the rest of chrome.tabs / chrome.tabGroups -------------------------------------
  reloads: Array<{ tabId: number; bypassCache: boolean }> = [];
  zoom = new Map<number, number>();
  zoomSettings = new Map<number, ZoomSettings>();
  groupMoves: Array<{ groupId: number; index: number }> = [];
  private nextSplit = 500;

  private must(id: number): Tab {
    const tab = this.tabs.get(id);
    if (!tab) throw new Error(`No tab with id: ${id}`);
    return tab;
  }
  async update(id: number, props: TabUpdate) {
    const tab = this.must(id);
    const { muted, ...rest } = props;
    Object.assign(tab, rest);
    if (muted !== undefined) tab.mutedInfo = { muted };
    if (props.pinned) tab.groupId = -1; // Chrome ungroups a tab when it is pinned.
    return { ...tab };
  }
  async reload(tabId: number, bypassCache = false) {
    this.must(tabId);
    this.reloads.push({ tabId, bypassCache });
  }
  async duplicate(tabId: number) {
    const copy: Tab = { ...this.must(tabId), id: this.nextTab++, groupId: -1, active: false };
    this.tabs.set(copy.id!, copy);
    return { ...copy };
  }
  async move(tabId: number, index: number) {
    const tab = this.must(tabId);
    tab.index = index === -1 ? this.tabs.size - 1 : index;
    return { ...tab };
  }
  async discard(tabId: number) {
    const tab = this.must(tabId);
    if (tab.active) return undefined; // Chrome will not discard the active tab.
    tab.discarded = true;
    return { ...tab };
  }
  async highlight(windowId: number, indexes: number[]) {
    for (const tab of this.tabs.values()) if (tab.windowId === windowId) tab.highlighted = indexes.includes(tab.index ?? -1);
  }
  async getZoom(tabId: number) {
    this.must(tabId);
    return this.zoom.get(tabId) ?? 1;
  }
  async setZoom(tabId: number, factor: number) {
    this.must(tabId);
    this.zoom.set(tabId, factor === 0 ? 1 : factor);
  }
  async getZoomSettings(tabId: number): Promise<ZoomSettings> {
    this.must(tabId);
    return this.zoomSettings.get(tabId) ?? { mode: 'automatic', scope: 'per-origin', defaultZoomFactor: 1 };
  }
  async setZoomSettings(tabId: number, settings: ZoomSettings) {
    this.must(tabId);
    this.zoomSettings.set(tabId, { defaultZoomFactor: 1, ...settings });
  }
  async detectLanguage(tabId: number) {
    this.must(tabId);
    return 'en';
  }
  async captureVisibleTab(windowId?: number) {
    const shown = [...this.tabs.values()].find((t) => t.active && t.windowId === windowId);
    if (!shown) throw new Error('No active tab in that window');
    return 'data:image/png;base64,FAKE';
  }
  async createSplit(tabIds: [number, number]) {
    const [a, b] = tabIds.map((id) => this.must(id));
    if (a!.splitViewId! >= 0 || b!.splitViewId! >= 0) throw new Error('Tab is already in a split view');
    if (a!.windowId !== b!.windowId || a!.groupId !== b!.groupId) throw new Error('Tabs must share a window and group');
    const id = this.nextSplit++;
    a!.splitViewId = id;
    b!.splitViewId = id;
    return id;
  }
  async unsplit(splitViewId: number) {
    for (const tab of this.tabs.values()) if (tab.splitViewId === splitViewId) tab.splitViewId = -1;
  }
  async getGroup(groupId: number): Promise<TabGroup> {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`No group with id: ${groupId}`);
    return { id: groupId, collapsed: false, color: 'grey', windowId: 1, ...group };
  }
  async moveGroup(groupId: number, index: number) {
    this.groupMoves.push({ groupId, index });
  }
}

export function memoryStore<T>(): KeyValue<T> & { value?: T } {
  const store: KeyValue<T> & { value?: T } = {
    get: async () => (store.value === undefined ? undefined : structuredClone(store.value)),
    set: async (v) => {
      store.value = structuredClone(v);
    },
  };
  return store;
}

/** The ToolError code a promise rejects with, or 'ok'. */
export async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ToolError ? e.code : String(e);
  }
}
