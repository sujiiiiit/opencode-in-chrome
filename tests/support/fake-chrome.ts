// In-memory stand-ins for the Chrome APIs the browser agent uses (tabs, groups, windows).
import type { KeyValue, Tab, TabApi } from '@/lib/browser/tabs';
import { ToolError } from '@/lib/browser/tools/registry';

export class FakeChrome implements TabApi {
  tabs = new Map<number, Tab>();
  groups = new Map<number, { title?: string; color?: string; windowId?: number }>();
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
  async updateGroup(groupId: number, props: { title?: string; color?: string }) {
    Object.assign(this.groups.get(groupId)!, props);
  }
  async lastFocusedWindowId() {
    return this.focusedWindow;
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
