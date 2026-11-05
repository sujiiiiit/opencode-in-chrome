// The browser-state block every result ends with (spec browser/agent-guidance, design D2): the
// session's tabs with revisions, the current tab, open dialogs, tabs that changed without the
// session acting, and the actions it has not verified. It replaces the one-line tab footer.
import type { TabInfo } from './tabs';

export type TabState = TabInfo & { rev: number };

export type BrowserStateInput = {
  tabs: TabState[];
  currentTabId?: number;
  dialogs: Array<{ tabId: number; type: string; message: string }>;
  /** Tabs whose URL changed since the session last saw them, by no call of its own. */
  changed: Array<{ tabId: number; url: string }>;
  /** Labels of the session's unverified actions. */
  unverified: string[];
};

const q = (s: string) => JSON.stringify(s);
const tabLine = (t: TabState) => `${t.id} ${q(t.title || '(untitled)')} ${q(t.url)} · rev ${t.rev}`;

export function renderBrowserState(input: BrowserStateInput): string {
  const current = input.tabs.find((t) => t.id === input.currentTabId) ?? input.tabs.at(-1);
  const others = input.tabs.filter((t) => t !== current);
  const lines = [current ? `current tab: ${tabLine(current)}` : 'current tab: none'];
  if (others.length) lines.push(`other tabs: ${others.map(tabLine).join(' | ')}`);
  for (const d of input.dialogs) lines.push(`dialog open on tab ${d.tabId}: ${d.type} ${q(d.message)} (answer it with computer action "dialog" before anything else on that tab)`);
  for (const c of input.changed) lines.push(`tab ${c.tabId} changed since you last saw it (now ${q(c.url)}); earlier refs on it may be stale`);
  if (input.unverified.length) lines.push(`unverified: ${input.unverified.join('; ')} (read the tab to check, or finish with done "partial")`);
  return ['<browser-state>', ...lines, '</browser-state>'].join('\n');
}

/**
 * Per-tab revisions (one per top-frame commit or same-document navigation) and, per session,
 * the URL each tab had when the session last saw a result. A tab whose URL moved between two
 * of the session's calls changed by someone else (the user, a timer, a redirect after the call).
 */
export class TabWatch {
  private readonly revs = new Map<number, number>();
  private readonly seen = new Map<string, Map<number, string>>();
  private readonly changed = new Map<string, Map<number, string>>();

  bump(tabId: number): void {
    this.revs.set(tabId, (this.revs.get(tabId) ?? 0) + 1);
  }

  rev(tabId: number): number {
    return this.revs.get(tabId) ?? 0;
  }

  /** Before a call runs: note the session's tabs whose URL is not the one it last saw. */
  begin(sessionID: string, tabs: TabInfo[]): void {
    const seen = this.seen.get(sessionID);
    if (!seen) return;
    const changed = this.changed.get(sessionID) ?? new Map<number, string>();
    for (const tab of tabs) {
      const last = seen.get(tab.id);
      if (last !== undefined && last !== tab.url) changed.set(tab.id, tab.url);
    }
    this.changed.set(sessionID, changed);
  }

  /** After a call: the changed tabs to report (once), and the session has now seen every tab as it is. */
  end(sessionID: string, tabs: TabInfo[]): Array<{ tabId: number; url: string }> {
    const changed = [...(this.changed.get(sessionID) ?? [])].filter(([id]) => tabs.some((t) => t.id === id)).map(([tabId, url]) => ({ tabId, url }));
    this.changed.delete(sessionID);
    this.seen.set(sessionID, new Map(tabs.map((t) => [t.id, t.url])));
    return changed;
  }

  forgetTab(tabId: number): void {
    this.revs.delete(tabId);
    for (const map of [...this.seen.values(), ...this.changed.values()]) map.delete(tabId);
  }
}

/** The navigation events that bump revisions: top-frame commits and same-document navigations. */
export type RevisionEvents = { onTopNavigation(cb: (tabId: number) => void): void };

export function trackRevisions(watch: TabWatch, events: RevisionEvents): void {
  events.onTopNavigation((tabId) => watch.bump(tabId));
}

/** What the block is built from; `unverified` comes from the completion tracker. */
export type StateDeps = {
  watch: TabWatch;
  context(sessionID: string): Promise<{ tabs: TabInfo[]; currentTabId?: number }>;
  dialog(tabId: number): { type: string; message: string } | undefined;
  unverified?: (sessionID: string) => string[];
};

/** The registry hooks that keep the watch and render the block for a session's results. */
export function browserStateHooks(deps: StateDeps) {
  return {
    async beforeCall(sessionID: string): Promise<void> {
      deps.watch.begin(sessionID, (await deps.context(sessionID)).tabs);
    },
    async footer(sessionID: string, tabId?: number): Promise<string | undefined> {
      const { tabs, currentTabId } = await deps.context(sessionID);
      if (tabs.length === 0) return undefined;
      const changed = deps.watch.end(sessionID, tabs);
      const dialogs = tabs.flatMap((t) => {
        const d = deps.dialog(t.id);
        return d ? [{ tabId: t.id, type: d.type, message: d.message }] : [];
      });
      return renderBrowserState({
        tabs: tabs.map((t) => ({ ...t, rev: deps.watch.rev(t.id) })),
        currentTabId: tabId !== undefined && tabs.some((t) => t.id === tabId) ? tabId : currentTabId,
        dialogs,
        changed,
        unverified: deps.unverified?.(sessionID) ?? [],
      });
    },
  };
}
