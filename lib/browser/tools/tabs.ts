// tabs_context, tabs_share, tabs_create, tabs_close (spec browser/tab-scope).
import { GROUP_COLORS, isRestrictedUrl, type TabDetails, type TabInfo, type TabScope } from '../tabs';
import { ToolError, type ToolDef } from './registry';
import { GUIDE_SHORT } from '../guidance';
import { isMcpSession } from '../native';

export const tabIdProperty = { type: 'integer', description: "A tab id from tabs_context. Defaults to the session's current tab." } as const;

/** The states Chrome reports for a tab, only those that are set, so a plain tab keeps a plain line. */
function flags(tab: TabDetails): string {
  const set = [
    tab.pinned && 'pinned',
    tab.audible && 'audible',
    tab.muted && 'muted',
    tab.loading && 'loading',
    tab.discarded && 'discarded',
    tab.frozen && 'frozen',
    tab.splitViewId !== undefined && `split ${tab.splitViewId}`,
  ].filter(Boolean);
  return set.length ? ` [${set.join(', ')}]` : '';
}

/** Another tab seen by an MCP client: the site only (not the title or the path), since that tab is the user's own. */
const otherLine = (tab: TabInfo, mcp: boolean) => {
  if (!mcp) return `  ${tab.id} ${JSON.stringify(tab.title)} ${tab.url}`;
  let site = tab.url;
  try {
    site = new URL(tab.url).origin;
  } catch {
    // Not a URL (a browser page): shown as is.
  }
  return `  ${tab.id} ${site === 'null' ? tab.url : site}`;
};

const line = (tab: TabDetails) => `- ${tab.id} ${JSON.stringify(tab.title)} ${tab.url}${flags(tab)}`;

/** The tab a call without `tabId` acts on, for messages. */
async function targetId(scope: TabScope, sessionID: string, tabId: unknown): Promise<number | undefined> {
  return typeof tabId === 'number' ? tabId : (await scope.context(sessionID)).currentTabId;
}

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
        const ctx = await scope.details(sessionID);
        const other = await scope.otherTabs(sessionID);
        const mcp = isMcpSession(sessionID);
        const ownText = ctx.tabs.length
          ? `Tabs in this session (current: ${ctx.currentTabId}):\n${ctx.tabs.map(line).join('\n')}`
          : 'This session has no tabs. Use tabs_share for an existing tab, or tabs_create if the task needs a new tab.';
        const otherText = other.length
          ? `Other open Chrome tabs (${mcp ? 'sites only' : 'titles and URLs only'}; use tabs_share to attach one):\n${other.map((tab) => `${otherLine(tab, mcp)}${isRestrictedUrl(tab.url) ? ' (navigate to a website before reading or clicking)' : ''}`).join('\n')}`
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
      name: 'tabs_switch',
      description:
        "Make one of this session's tabs the current tab (the one tools act on without a tabId). show: true also brings it to the front of its window, which moves the user's view: use it only to hand the page to the user.",
      inputSchema: {
        type: 'object',
        properties: { tabId: { ...tabIdProperty, description: "One of this session's tab ids from tabs_context." }, show: { type: 'boolean', description: 'Also select it in the browser window.' } },
        required: ['tabId'],
      },
      async handler(args, { sessionID }) {
        const tab = await scope.resolve(sessionID, args.tabId as number);
        if (args.show === true) await scope.highlight(sessionID, [tab.id]);
        return { text: [`Tab ${tab.id} ${JSON.stringify(tab.title)} ${tab.url} is now the current tab.${args.show === true ? ' It is selected in the browser.' : ''}`], tabId: tab.id };
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
    ...tabOperationTools(scope),
  ];
}

const pageZoom = (factor: number) => `zoom ${Math.round(factor * 100)}%`;

/** The remaining chrome.tabs / chrome.tabGroups operations; each acts only on this session's tabs. */
function tabOperationTools(scope: TabScope): ToolDef[] {
  return [
    {
      name: 'tabs_reload',
      description: "Reload one of this session's tabs, optionally ignoring the cache. Waits for nothing: use read_page afterwards.",
      inputSchema: { type: 'object', properties: { tabId: tabIdProperty, bypassCache: { type: 'boolean', description: 'Ignore the cache (hard reload).' } } },
      async handler(args, { sessionID }) {
        const tab = await scope.reload(sessionID, args.tabId as number | undefined, args.bypassCache === true);
        return { text: [`Reloaded tab ${tab.id}${args.bypassCache === true ? ' (cache bypassed)' : ''}.`], tabId: tab.id };
      },
    },
    {
      name: 'tabs_duplicate',
      description: "Copy one of this session's tabs, including its history, into the session's tab group. The copy becomes the current tab.",
      inputSchema: { type: 'object', properties: { tabId: tabIdProperty } },
      async handler(args, { sessionID }) {
        const from = await targetId(scope, sessionID, args.tabId);
        const copy = await scope.duplicate(sessionID, args.tabId as number | undefined);
        return { text: [`Duplicated tab ${String(from)} as tab ${copy.id}.`], tabId: copy.id };
      },
    },
    {
      name: 'tabs_move',
      description: "Reorder one of this session's tabs inside its window. index 0 is the first position, -1 the end.",
      inputSchema: { type: 'object', properties: { tabId: tabIdProperty, index: { type: 'integer', minimum: -1, description: 'New position; -1 for the end.' } }, required: ['index'] },
      async handler(args, { sessionID }) {
        const tab = await scope.move(sessionID, (await targetId(scope, sessionID, args.tabId))!, args.index as number);
        return { text: [`Moved tab ${tab.id} to position ${String(args.index)}.`], tabId: tab.id };
      },
    },
    {
      name: 'tabs_discard',
      description: "Free the memory of a background tab of this session. It reloads when shown, so page state is lost. A tab that is showing can't be discarded.",
      inputSchema: { type: 'object', properties: { tabId: { ...tabIdProperty, description: 'The background tab to discard.' } }, required: ['tabId'] },
      async handler(args, { sessionID }) {
        const tab = await scope.discard(sessionID, args.tabId as number);
        return { text: [`Discarded tab ${tab.id}; it reloads when shown.`], tabId: tab.id };
      },
    },
    {
      name: 'tabs_set_state',
      description:
        "Mute or unmute a tab, mark it highlighted, or allow/forbid Chrome to auto-discard it. Tabs can't be pinned (a pinned tab leaves the chat's tab group); pinned: false unpins one.",
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          muted: { type: 'boolean' },
          highlighted: { type: 'boolean' },
          autoDiscardable: { type: 'boolean', description: 'false keeps Chrome from discarding the tab when memory is low.' },
          pinned: { type: 'boolean', description: 'Only false is accepted.' },
        },
      },
      async handler(args, { sessionID }) {
        const change = { muted: args.muted as boolean | undefined, highlighted: args.highlighted as boolean | undefined, autoDiscardable: args.autoDiscardable as boolean | undefined, pinned: args.pinned as boolean | undefined };
        const tab = await scope.setState(sessionID, args.tabId as number | undefined, change);
        const done = [
          change.muted !== undefined && (change.muted ? 'muted' : 'unmuted'),
          change.highlighted !== undefined && (change.highlighted ? 'highlighted' : 'not highlighted'),
          change.autoDiscardable !== undefined && `auto-discard ${change.autoDiscardable ? 'allowed' : 'forbidden'}`,
          change.pinned === false && 'unpinned',
        ].filter(Boolean);
        return { text: [`Updated tab ${tab.id}: ${done.join(', ')}.`], tabId: tab.id };
      },
    },
    {
      name: 'tabs_highlight',
      description: "Select several of this session's tabs in one window. Chrome shows the first one.",
      inputSchema: { type: 'object', properties: { tabIds: { type: 'array', items: { type: 'integer' }, minItems: 1 } }, required: ['tabIds'] },
      async handler(args, { sessionID }) {
        const ids = args.tabIds as number[];
        await scope.highlight(sessionID, ids);
        return { text: [`Highlighted tab${ids.length > 1 ? 's' : ''} ${ids.join(', ')}.`], tabId: ids[0] };
      },
    },
    {
      name: 'tabs_zoom',
      description:
        'Read or change a tab\'s page zoom. With no arguments it reports the zoom. factor sets it (1 = 100%, 0 resets); mode and scope change how Chrome applies zoom ("per-origin" only works in automatic mode).',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: tabIdProperty,
          factor: { type: 'number', minimum: 0, description: '1.5 = 150%; 0 resets to the default.' },
          mode: { type: 'string', enum: ['automatic', 'manual', 'disabled'] },
          scope: { type: 'string', enum: ['per-origin', 'per-tab'] },
        },
      },
      async handler(args, { sessionID }) {
        const tabId = args.tabId as number | undefined;
        if (typeof args.mode === 'string' || typeof args.scope === 'string') {
          await scope.setZoomSettings(sessionID, tabId, {
            ...(typeof args.mode === 'string' ? { mode: args.mode as 'automatic' | 'manual' | 'disabled' } : {}),
            ...(typeof args.scope === 'string' ? { scope: args.scope as 'per-origin' | 'per-tab' } : {}),
          });
        }
        if (typeof args.factor === 'number') await scope.setZoom(sessionID, tabId, args.factor);
        const [factor, settings, id] = [await scope.zoom(sessionID, tabId), await scope.zoomSettings(sessionID, tabId), await targetId(scope, sessionID, tabId)];
        return { text: [`Tab ${String(id)} ${pageZoom(factor)} (mode ${settings.mode ?? 'automatic'}, scope ${settings.scope ?? 'per-origin'}).`], tabId: id };
      },
    },
    {
      name: 'tabs_language',
      description: "Detect the main language of a tab's page (an ISO code such as en, or und when unknown).",
      inputSchema: { type: 'object', properties: { tabId: tabIdProperty } },
      async handler(args, { sessionID }) {
        const language = await scope.language(sessionID, args.tabId as number | undefined);
        const id = await targetId(scope, sessionID, args.tabId);
        return { text: [`Tab ${String(id)} language: ${language}`], tabId: id };
      },
    },
    {
      name: 'tabs_capture',
      description: 'Capture the visible area of a tab as an image through the extension. Only works for a tab that is showing in its window; for a background tab use the computer tool screenshot.',
      inputSchema: { type: 'object', properties: { tabId: tabIdProperty } },
      async handler(args, { sessionID }) {
        const dataUrl = await scope.capture(sessionID, args.tabId as number | undefined);
        const id = await targetId(scope, sessionID, args.tabId);
        return { text: [`Captured the visible area of tab ${String(id)}.`], images: [{ data: dataUrl.replace(/^data:image\/png;base64,/, ''), mimeType: 'image/png' }], tabId: id };
      },
    },
    {
      name: 'tabs_split',
      description: "Show two of this session's tabs side by side in Chrome's split view (Chrome 155+). The tabs must sit next to each other, in the same window and group.",
      inputSchema: { type: 'object', properties: { tabId: tabIdProperty, withTabId: { type: 'integer', description: 'The second tab.' } }, required: ['tabId', 'withTabId'] },
      async handler(args, { sessionID }) {
        const [first, second] = [args.tabId as number, args.withTabId as number];
        const viewId = await scope.split(sessionID, [first, second]);
        return { text: [`Split tabs ${first} and ${second} (split view ${viewId}).`], tabId: first };
      },
    },
    {
      name: 'tabs_unsplit',
      description: 'Separate the split view a tab is in. Both tabs stay open.',
      inputSchema: { type: 'object', properties: { tabId: { ...tabIdProperty, description: 'Either tab of the split view.' } }, required: ['tabId'] },
      async handler(args, { sessionID }) {
        await scope.unsplit(sessionID, args.tabId as number);
        return { text: [`Unsplit tab ${String(args.tabId)}.`], tabId: args.tabId as number };
      },
    },
    {
      name: 'tab_group',
      description: "Read or change this session's tab group: title, color, collapsed, and its position among the window's tabs (index; -1 for the end). With no arguments it reports the group.",
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          color: { type: 'string', enum: [...GROUP_COLORS] },
          collapsed: { type: 'boolean' },
          index: { type: 'integer', minimum: -1, description: 'Move the whole group to this position.' },
        },
      },
      async handler(args, { sessionID }) {
        const change = { title: args.title as string | undefined, color: args.color as string | undefined, collapsed: args.collapsed as boolean | undefined };
        if (Object.values(change).some((v) => v !== undefined)) await scope.updateGroupOf(sessionID, change);
        if (typeof args.index === 'number') await scope.moveGroup(sessionID, args.index);
        const group = await scope.groupInfo(sessionID);
        return { text: [`Tab group ${JSON.stringify(group.title ?? '')} (${group.color ?? 'grey'}, ${group.collapsed ? 'collapsed' : 'expanded'}).`] };
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
