import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { BROWSER_ENABLED_KEY, isBrowserAccessEnabled, STOPPED_KEY, TABS_KEY } from '@/lib/browser/settings';

type SessionTabs = Record<string, { tabIds: number[]; shared: number[] } | undefined>;

export type BrowserActivity = {
  enabled: boolean;
  stopped: boolean;
  /** The chat's agent tabs (its tab group). */
  tabIds: number[];
  /** Tabs the user shared with the chat. */
  shared: number[];
};

const EMPTY: BrowserActivity = { enabled: false, stopped: false, tabIds: [], shared: [] };

/** A request to the service worker's browser agent (lib/browser/runtime.ts). */
async function ask<T>(message: Record<string, unknown>): Promise<T> {
  const reply = (await browser.runtime.sendMessage(message)) as T & { error?: string };
  if (reply && typeof reply === 'object' && 'error' in reply && reply.error) throw new Error(reply.error);
  return reply;
}

/**
 * The chat's browser activity, kept in step with storage (the worker writes the tab groups
 * and the stop flag), plus the share, stop and resume actions (spec chat/browser-activity).
 */
export function useBrowserActivity(sessionID: string | undefined) {
  const [activity, setActivity] = useState<BrowserActivity>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [enabled, session] = await Promise.all([isBrowserAccessEnabled(), browser.storage.session.get([TABS_KEY, STOPPED_KEY])]);
      const tabs = (session[TABS_KEY] as SessionTabs | undefined)?.[sessionID ?? ''];
      if (alive) setActivity({ enabled, stopped: session[STOPPED_KEY] === true, tabIds: tabs?.tabIds ?? [], shared: tabs?.shared ?? [] });
    };
    void load();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if ((area === 'local' && BROWSER_ENABLED_KEY in changes) || (area === 'session' && (TABS_KEY in changes || STOPPED_KEY in changes))) void load();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, [sessionID]);

  const run = useCallback(async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  /** Shares the tab in front of the user (this window's active tab) with the chat. */
  const shareActiveTab = useCallback(
    () =>
      run(async () => {
        if (!sessionID) throw new Error('Send a message first: the tab is shared with this chat.');
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id === undefined) throw new Error('No tab to share.');
        if (!/^https?:/.test(tab.url ?? '')) throw new Error('Only web pages can be shared.');
        await ask({ type: 'opencode.browser.share', sessionID, tabId: tab.id });
      }),
    [run, sessionID],
  );
  const stop = useCallback(() => run(() => ask({ type: 'opencode.browser.stop' })), [run]);
  const resume = useCallback(() => run(() => ask({ type: 'opencode.browser.resume' })), [run]);

  return { activity, error, shareActiveTab, stop, resume };
}
