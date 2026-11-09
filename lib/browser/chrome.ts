// Adapters from the real browser APIs to the small interfaces the browser agent modules
// take (so those modules stay testable without Chrome).
import { browser } from 'wxt/browser';
import type { NavEvents } from './navigation';
import type { ScriptingApi } from './snapshot/reader';
import type { KeyValue, TabApi } from './tabs';
import { ToolError } from './tools/registry';

export function chromeTabApi(): TabApi {
  return {
    get: (tabId) => browser.tabs.get(tabId),
    list: () => browser.tabs.query({}),
    create: (props) => browser.tabs.create(props),
    remove: (tabId) => browser.tabs.remove(tabId),
    group: (options) =>
      browser.tabs.group({
        tabIds: options.tabIds as [number, ...number[]],
        groupId: options.groupId,
        createProperties: options.createProperties,
      }),
    ungroup: (tabIds) => browser.tabs.ungroup(tabIds as [number, ...number[]]),
    updateGroup: (groupId, props) =>
      browser.tabGroups.update(groupId, props as Parameters<typeof browser.tabGroups.update>[1]),
    lastFocusedWindowId: async () => {
      const win = await browser.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => undefined);
      return win?.id;
    },
    update: async (tabId, props) => (await browser.tabs.update(tabId, props)) ?? browser.tabs.get(tabId),
    reload: (tabId, bypassCache = false) => browser.tabs.reload(tabId, { bypassCache }),
    duplicate: (tabId) => browser.tabs.duplicate(tabId),
    move: async (tabId, index, windowId) => {
      const moved = await browser.tabs.move(tabId, windowId === undefined ? { index } : { index, windowId });
      return Array.isArray(moved) ? moved[0]! : moved;
    },
    discard: (tabId) => browser.tabs.discard(tabId),
    highlight: async (windowId, tabIndexes) => void (await browser.tabs.highlight({ windowId, tabs: tabIndexes })),
    getZoom: (tabId) => browser.tabs.getZoom(tabId),
    setZoom: (tabId, factor) => browser.tabs.setZoom(tabId, factor),
    getZoomSettings: (tabId) => browser.tabs.getZoomSettings(tabId),
    setZoomSettings: (tabId, settings) => browser.tabs.setZoomSettings(tabId, settings),
    detectLanguage: (tabId) => browser.tabs.detectLanguage(tabId),
    captureVisibleTab: (windowId) => browser.tabs.captureVisibleTab(windowId as number, { format: 'png' }),
    createSplit: (tabIds) => splitApi().createSplit(tabIds),
    unsplit: (splitViewId) => splitApi().unsplit(splitViewId),
    getGroup: (groupId) => browser.tabGroups.get(groupId),
    moveGroup: async (groupId, index) => void (await browser.tabGroups.move(groupId, { index })),
  };
}

/** The Chrome 155 split view calls, which older Chrome (and the typings) lack. */
function splitApi(): { createSplit(tabIds: [number, number]): Promise<number>; unsplit(splitViewId: number): Promise<void> } {
  const tabs = browser.tabs as unknown as Partial<ReturnType<typeof splitApi>>;
  if (!tabs.createSplit || !tabs.unsplit) {
    throw new ToolError('INVALID_INPUT', 'Split view needs Chrome 155 or newer.');
  }
  return tabs as ReturnType<typeof splitApi>;
}

/** chrome.scripting for the page reader: the snapshot script and page functions, every frame. */
export function chromeScriptingApi(): ScriptingApi {
  return {
    inject: async (tabId) => {
      await browser.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['/snapshot.js'] });
    },
    run: async (target, func, args) => {
      const results = await browser.scripting.executeScript({
        target: target as Parameters<typeof browser.scripting.executeScript>[0]['target'],
        func: func as (arg: unknown) => unknown,
        args: [args],
      });
      return results.map((r) => ({
        frameId: r.frameId,
        documentId: (r as { documentId?: string }).documentId,
        result: r.result as never,
      }));
    },
    frames: async (tabId) => {
      const frames = (await browser.webNavigation.getAllFrames({ tabId })) ?? [];
      return frames.map((f) => ({ frameId: f.frameId, parentFrameId: f.parentFrameId, url: f.url }));
    },
  };
}

/**
 * Top-frame navigation events from webNavigation. An aborted load (`net::ERR_ABORTED`: another
 * navigation replaced it, or it became a download) is reported as `aborted`, not as an error.
 */
export function chromeNavEvents(): NavEvents {
  return {
    watch(tabId, cb) {
      const top = (d: { tabId: number; frameId: number }) => d.tabId === tabId && d.frameId === 0;
      const committed = (d: { tabId: number; frameId: number; url: string }) => top(d) && cb({ kind: 'committed', url: d.url });
      const completed = (d: { tabId: number; frameId: number; url: string }) => top(d) && cb({ kind: 'loaded', url: d.url });
      const history = (d: { tabId: number; frameId: number; url: string }) => top(d) && cb({ kind: 'history', url: d.url });
      const started = (d: { tabId: number; frameId: number; url: string }) => top(d) && cb({ kind: 'started', url: d.url });
      const error = (d: { tabId: number; frameId: number; url: string; error: string }) => {
        if (top(d)) cb({ kind: d.error === 'net::ERR_ABORTED' ? 'aborted' : 'error', url: d.url, error: d.error });
      };
      browser.webNavigation.onBeforeNavigate.addListener(started);
      browser.webNavigation.onCommitted.addListener(committed);
      browser.webNavigation.onCompleted.addListener(completed);
      browser.webNavigation.onHistoryStateUpdated.addListener(history);
      browser.webNavigation.onReferenceFragmentUpdated.addListener(history);
      browser.webNavigation.onErrorOccurred.addListener(error);
      return () => {
        browser.webNavigation.onBeforeNavigate.removeListener(started);
        browser.webNavigation.onCommitted.removeListener(committed);
        browser.webNavigation.onCompleted.removeListener(completed);
        browser.webNavigation.onHistoryStateUpdated.removeListener(history);
        browser.webNavigation.onReferenceFragmentUpdated.removeListener(history);
        browser.webNavigation.onErrorOccurred.removeListener(error);
      };
    },
  };
}

/** One JSON value in storage.local (user settings that must survive restarts). */
export function localValue<T>(key: string): KeyValue<T> {
  return {
    get: async () => (await browser.storage.local.get(key))[key] as T | undefined,
    set: (value) => browser.storage.local.set({ [key]: value }),
  };
}

/** One JSON value in storage.session (cleared when the browser closes, survives worker restarts). */
export function sessionValue<T>(key: string): KeyValue<T> {
  return {
    get: async () => (await browser.storage.session.get(key))[key] as T | undefined,
    set: (value) => browser.storage.session.set({ [key]: value }),
  };
}
