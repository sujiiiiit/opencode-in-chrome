// tabs_context, tabs_share, tabs_create, tabs_close (spec browser/tab-scope).
import { isRestrictedUrl, type TabInfo, type TabScope } from '../tabs';
import { ToolError, type ToolDef } from './registry';
import { GUIDE_SHORT } from '../guidance';

export const tabIdProperty = { type: 'integer', description: "A tab id from tabs_context. Defaults to the session's current tab." } as const;

const line = (tab: TabInfo) => `- ${tab.id} ${JSON.stringify(tab.title)} ${tab.url}`;

export type TabToolHooks = {
  /**
   * Opens a URL in a freshly created blank tab after the debugger is attached, so console
   * and network capture include the page's own load. Without it the tab is created at the URL.
   */
  openInNewTab?: (tabId: number, url: string) => Promise<void>;
};

export function tabTools(scope: TabScope, hooks: TabToolHooks = {}): ToolDef[] {
  return [
    {
      name: 'tabs_context',
      description:
        "List all open Chrome tabs by title and URL, distinguishing this chat's tabs from other tabs. Call it first. " +
        'This tool never creates a tab; use tabs_create only when the task needs a new tab. ' +
        "Other tabs are read-only until tabs_share adds one to this chat. Blank and browser pages can be attached for navigation, but cannot be read or clicked. Page actions can use only this chat's tabs. " +
        GUIDE_SHORT,
      inputSchema: { type: 'object', properties: {} },
      async handler(_args, { sessionID }) {
        const ctx = await scope.context(sessionID);
        const other = await scope.otherTabs(sessionID);
        const ownText = ctx.tabs.length
          ? `Tabs in this session (current: ${ctx.currentTabId}):\n${ctx.tabs.map(line).join('\n')}`
          : 'This session has no tabs. Use tabs_share for an existing tab, or tabs_create if the task needs a new tab.';
        const otherText = other.length
          ? `Other open Chrome tabs (titles and URLs only; use tabs_share to attach one):\n${other.map((tab) => `  ${tab.id} ${JSON.stringify(tab.title)} ${tab.url}${isRestrictedUrl(tab.url) ? ' (navigate to a website before reading or clicking)' : ''}`).join('\n')}`
          : 'No other Chrome tabs are open.';
        return {
          text: [`${ownText}\n\n${otherText}`],
          tabId: ctx.currentTabId,
        };
      },
    },
    {
      name: 'tabs_share',
      description: 'Attach an existing tab from tabs_context to this chat. Blank and browser pages can be navigated to a website, then read or acted on. Tabs owned by another chat stay there. Shared tabs remain open when released.',
      inputSchema: { type: 'object', properties: { tabId: { ...tabIdProperty, description: 'An existing tab id from the other open Chrome tabs list.' } }, required: ['tabId'] },
      async handler(args, { sessionID }) {
        const tabId = args.tabId as number;
        const own = await scope.context(sessionID);
        if (own.tabs.some((tab) => tab.id === tabId)) return { text: [`Tab ${tabId} is already in this chat.`], tabId };
        const tab = (await scope.otherTabs(sessionID)).find((entry) => entry.id === tabId);
        if (!tab) throw new ToolError('NO_TAB', `Tab ${tabId} is no longer open. Call tabs_context again.`);
        await scope.share(sessionID, tabId);
        return { text: [`Shared tab ${tabId} ${JSON.stringify(tab.title)} ${tab.url} with this chat.${isRestrictedUrl(tab.url) ? ' Navigate it to a website before reading or clicking.' : ''}`], tabId };
      },
    },
    {
      name: 'tabs_create',
      description:
        "Open a new browser tab in this session's tab group, in the background, optionally at a URL. Returns its tab id; it becomes the current tab.",
      inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'URL to open (https:// assumed).' } } },
      async handler(args, { sessionID }) {
        const url = typeof args.url === 'string' && args.url ? withScheme(args.url) : undefined;
        if (url && hooks.openInNewTab) {
          const tab = await scope.create(sessionID);
          await hooks.openInNewTab(tab.id, url);
          return { text: [`Created tab ${tab.id} at ${url}.`], tabId: tab.id };
        }
        const tab = await scope.create(sessionID, url);
        return { text: [`Created tab ${tab.id}${url ? ` at ${url}` : ''}.`], tabId: tab.id };
      },
    },
    {
      name: 'tabs_close',
      description: "Close one of this session's tabs by id. Tabs the user shared are handed back to the user instead of closed.",
      inputSchema: { type: 'object', properties: { tabId: { ...tabIdProperty, description: 'The tab to close.' } }, required: ['tabId'] },
      async handler(args, { sessionID }) {
        const { remaining } = await scope.close(sessionID, args.tabId as number);
        return {
          text: [
            remaining === 0
              ? `Closed tab ${String(args.tabId)}. The session has no tabs left; use tabs_share for an existing tab or tabs_create for a new tab.`
              : `Closed tab ${String(args.tabId)}. ${remaining} tab(s) remain.`,
          ],
        };
      },
    },
  ];
}

/** `example.com` → `https://example.com`; leaves URLs with a scheme alone. */
export function withScheme(url: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
}

/** The tab a page tool acts on; fails with RESTRICTED_PAGE where pages cannot be scripted. */
export async function requirePage(scope: TabScope, sessionID: string, tabId: unknown): Promise<TabInfo> {
  const tab = await scope.resolve(sessionID, typeof tabId === 'number' ? tabId : undefined);
  if (isRestrictedUrl(tab.url)) {
    throw new ToolError(
      'RESTRICTED_PAGE',
      `Can't read or act on ${tab.url || 'this tab'} (a browser-internal, store, file or blank page). Navigate to a web page first.`,
    );
  }
  return tab;
}
