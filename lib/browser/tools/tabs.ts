// tabs_context, tabs_create, tabs_close (spec browser/tab-scope).
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
        "List this chat session's browser tabs (ids, titles, URLs) and which one is current. Call it first. " +
        'With createIfEmpty: true it opens a tab group with one blank tab when the session has none. ' +
        "The agent can only see and act on tabs listed here, never the user's other tabs. " +
        GUIDE_SHORT,
      inputSchema: {
        type: 'object',
        properties: { createIfEmpty: { type: 'boolean', description: 'Create a tab group with a blank tab if there is none.' } },
      },
      async handler(args, { sessionID }) {
        const ctx = await scope.context(sessionID, args.createIfEmpty === true);
        if (ctx.tabs.length === 0) {
          return { text: ['This session has no tabs. Call tabs_context with createIfEmpty: true, or tabs_create, or navigate to a URL.'] };
        }
        return {
          text: [`Tabs in this session (current: ${ctx.currentTabId}):\n${ctx.tabs.map(line).join('\n')}`],
          tabId: ctx.currentTabId,
        };
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
              ? `Closed tab ${String(args.tabId)}. The session has no tabs left; tabs_context with createIfEmpty: true starts a new group.`
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
