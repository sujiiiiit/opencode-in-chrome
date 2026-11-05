// Assembles the browser agent's parts in the service worker: tab scope, debugger sessions,
// page reader, actor, screenshots and the tool table, plus the browser event listeners that
// keep them in step.
import { browser } from 'wxt/browser';
import { WORKSPACE_KEY } from '../opencode/workspace';
import { Actor } from './actions';
import { BRIDGE_ALARM } from './agent';
import { formApprovals } from './approvals';
import { chromeNavEvents, chromeScriptingApi, chromeTabApi, localValue, sessionValue } from './chrome';
import { LoopGuard, Policy, type PolicySettings } from './policy';
import { POLICY_KEY, STOPPED_KEY, TABS_KEY } from './settings';
import { withSafety } from './safety';
import { attachGuide } from './guidance';
import { browserStateHooks, TabWatch, trackRevisions } from './state';
import { Completion } from './completion';
import { doneTool } from './tools/done';
import { askUserTool } from './tools/ask-user';
import type { ComputerDeps } from './tools/computer';
import { chromeDebuggerApi, DebuggerSessions } from './debugger';
import { ConsoleLog, NetworkLog } from './diagnostics';
import { Dialogs } from './dialogs';
import { diagnosticsTools } from './tools/diagnostics';
import { encodeGif, gifDataUrl, GifRecorder, THUMB_EDGE } from './recorder';
import { canvasResize, Screenshots, type Viewport } from './screenshots';
import { serverAccess, VisionCheck } from './server';
import { PageReader } from './snapshot/reader';
import { TabScope } from './tabs';
import { batchTool } from './tools/batch';
import { computerTool } from './tools/computer';
import { formTools } from './tools/forms';
import { gifTool } from './tools/gif';
import { navigateTools } from './tools/navigate';
import { pageTools } from './tools/page';
import { toMcpTools, type ToolDef } from './tools/registry';
import { tabTools } from './tools/tabs';


export function createBrowserRuntime() {
  const debuggers = new DebuggerSessions(chromeDebuggerApi());
  const dialogs = new Dialogs(debuggers);
  const tabApi = chromeTabApi();
  // The agent-tab indicator: shown on every agent tab (and again after each navigation).
  const indicate = (tabId: number, mode: 'show' | 'hide' | 'unhide' | 'remove') =>
    reader.callTop(tabId, 'indicator', [mode]).then(
      () => undefined,
      () => undefined,
    );
  const scope = new TabScope(tabApi, sessionValue(TABS_KEY), {
    onJoin: (tabId) => {
      void debuggers.ensure(tabId, false).catch(() => undefined);
      void indicate(tabId, 'show');
    },
    onLeave: (tabId) => {
      void debuggers.detach(tabId);
      void indicate(tabId, 'remove');
    },
  });
  const reader = new PageReader(chromeScriptingApi(), undefined, (tabId) => dialogs.assertClear(tabId));
  const screenshots = new Screenshots({
    debuggers,
    resize: canvasResize,
    viewport: async (tabId) => {
      const v = await reader.callTop<Viewport>(tabId, 'viewport');
      if (!v) throw new Error('no viewport');
      return v;
    },
    hideIndicator: (tabId, hidden) => indicate(tabId, hidden ? 'hide' : 'unhide'),
  });
  const recorder = new GifRecorder({
    thumbnail: (tabId) => screenshots.thumbnail(tabId, THUMB_EDGE),
    encode: encodeGif,
    save: async (bytes, filename) => {
      await browser.downloads.download({ url: gifDataUrl(bytes), filename, saveAs: false, conflictAction: 'uniquify' });
    },
  });
  const actor = new Actor({
    reader,
    debuggers,
    dialogs,
    scope,
    tab: (tabId) => tabApi.get(tabId),
    afterAction: (tabId, sessionID, label, point) => recorder.capture(sessionID, tabId, label.split('\n')[0]!, point),
  });
  const server = serverAccess();
  const vision = new VisionCheck(server);
  const watch = new TabWatch();
  const completion = new Completion();
  const loop = new LoopGuard();

  // Listeners first, synchronously: they must exist when the worker is woken by them.
  browser.tabs.onCreated.addListener((tab) => void scope.adoptPopup(tab));
  // openerTabId is not reliable for links clicked in background tabs; this event names the
  // tab the link was really clicked in.
  browser.webNavigation.onCreatedNavigationTarget.addListener((d) => void scope.adoptPopup({ id: d.tabId, openerTabId: d.sourceTabId }));
  browser.tabs.onRemoved.addListener((tabId) => {
    void scope.forget(tabId);
    reader.forgetTab(tabId);
    screenshots.forgetTab(tabId);
    watch.forgetTab(tabId);
    completion.dropTab(tabId);
  });
  // Revisions for the state block: one per top-frame document or same-document navigation.
  trackRevisions(watch, {
    onTopNavigation: (cb) => {
      const top = (d: { tabId: number; frameId: number }) => d.frameId === 0 && cb(d.tabId);
      browser.webNavigation.onCommitted.addListener(top);
      browser.webNavigation.onHistoryStateUpdated.addListener(top);
      browser.webNavigation.onReferenceFragmentUpdated.addListener(top);
    },
  });
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.groupId !== undefined) void scope.groupChanged(tabId, change.groupId);
  });
  // A new document has no indicator: show it again when an agent tab finishes loading.
  browser.webNavigation.onCompleted.addListener((d) => {
    if (d.frameId !== 0) return;
    void scope.sessionOf(d.tabId).then((sessionID) => {
      if (sessionID) void indicate(d.tabId, 'show');
    });
  });
  // The bridge's keepalive alarm also detaches debuggers from tabs idle for 10 minutes.
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BRIDGE_ALARM) void debuggers.sweep();
  });

  const consoleLog = new ConsoleLog(debuggers);
  const networkLog = new NetworkLog(debuggers);

  // The safety layer: site rules and approval mode in storage.local, approvals as session
  // forms, and the kill switch that also lets go of every debugger.
  const policy = new Policy({
    store: localValue<PolicySettings>(POLICY_KEY),
    approve: (request) => approve(request),
    currentUrl: async (tabId) => {
      const tab = await tabApi.get(tabId);
      return tab.pendingUrl || tab.url || '';
    },
  });
  const approve = formApprovals(server, { onStop: (cb) => policy.onStop(cb) });
  policy.onStop(() => void debuggers.detachAll());
  // A stop outlives a worker restart (until the browser closes or the user resumes).
  void browser.storage.session.get(STOPPED_KEY).then((stored) => {
    if (stored[STOPPED_KEY] === true) policy.stop();
  });
  const guard: ComputerDeps['guard'] = async (call) => {
    await policy.guard(call);
  };

  const defs: ToolDef[] = [
    ...tabTools(scope, {
      openInNewTab: async (tabId, url) => {
        await debuggers.ensure(tabId).catch(() => undefined);
        await browser.tabs.update(tabId, { url });
      },
    }),
    ...navigateTools({
      scope,
      reader,
      dialogs,
      guard,
      events: chromeNavEvents(),
      tabs: {
        get: (tabId) => tabApi.get(tabId),
        update: async (tabId, url) => void (await browser.tabs.update(tabId, { url })),
        back: (tabId) => browser.tabs.goBack(tabId),
        forward: (tabId) => browser.tabs.goForward(tabId),
        resizeWindowOf: async (tabId, width, height) => {
          const tab = await browser.tabs.get(tabId);
          if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { width, height, state: 'normal' });
        },
      },
    }),
    ...pageTools(scope, reader),
    computerTool({ scope, reader, actor, dialogs, screenshots, vision, guard }),
    ...formTools({
      scope,
      reader,
      actor,
      screenshots,
      server,
      guard,
      directory: async () => {
        const stored = (await browser.storage.local.get(WORKSPACE_KEY))[WORKSPACE_KEY] as { directory?: string } | undefined;
        return stored?.directory;
      },
    }),
  ];
  defs.push(...diagnosticsTools({ scope, debuggers, dialogs, console: consoleLog, network: networkLog, guard }), gifTool(scope, recorder));
  // batch runs the guarded tools, so every item passes the same checks as a single call.
  // One loop guard and one completion tracker for every tool, so batch items and single calls count alike.
  defs.push(askUserTool(server, 500, undefined, (cb) => policy.onStop(cb)), doneTool({ completion, loop }));
  const safety = { policy, scope, loop, completion };
  const guarded: ToolDef[] = withSafety(defs, safety);
  guarded.push(...withSafety([batchTool(() => guarded, () => policy.isStopped)], safety));

  const tools = () =>
    toMcpTools(guarded, {
      ...browserStateHooks({ watch, context: (sessionID) => scope.context(sessionID), dialog: (tabId) => dialogs.get(tabId), unverified: (sessionID) => completion.labels(sessionID) }),
      // A session another client created gets the browsing guide on its first call (spec browser/agent-guidance).
      onCall: (sessionID) => void server().then((client) => client && attachGuide(client, sessionID)),
      onInternalError: (tool, error) => console.error(`[browser] ${tool} failed`, error),
    });

  listenToPanel({ scope, policy, debuggers });

  return { scope, debuggers, dialogs, reader, actor, screenshots, policy, tools };
}

type PanelMessage =
  | { type: 'opencode.browser.stop' }
  | { type: 'opencode.browser.resume' }
  | { type: 'opencode.browser.status'; sessionID?: string }
  | { type: 'opencode.browser.share'; sessionID: string; tabId: number; move?: boolean }
  | { type: 'opencode.browser.unshare'; sessionID: string; tabId: number };

/**
 * Requests from the extension's own pages (side panel, settings): stop/resume and tab
 * sharing. Messages from content scripts or other extensions are ignored.
 */
function listenToPanel(deps: { scope: TabScope; policy: Policy; debuggers: DebuggerSessions }): void {
  const ownPages = browser.runtime.getURL('/');
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // Only the extension's own pages (side panel, settings), never content scripts: their
    // sender URL is the web page's.
    if (!isPanelSender(sender, ownPages)) return undefined;
    const m = message as PanelMessage;
    if (!isPanelMessage(m)) return undefined;
    void handlePanelMessage(m, deps).then(sendResponse, (error: unknown) => sendResponse({ error: String(error instanceof Error ? error.message : error) }));
    return true;
  });
}

function isPanelMessage(message: PanelMessage): boolean {
  return typeof message?.type === 'string' && message.type.startsWith('opencode.browser.');
}

function isPanelSender(sender: { id?: string; url?: string }, ownPages: string): boolean {
  return sender.id === browser.runtime.id && !!sender.url?.startsWith(ownPages);
}

async function handlePanelMessage(m: PanelMessage, deps: { scope: TabScope; policy: Policy; debuggers: DebuggerSessions }) {
  if (m.type === 'opencode.browser.stop') return stopBrowser(deps);
  if (m.type === 'opencode.browser.resume') return resumeBrowser(deps.policy);
  return handleTabPanelMessage(m, deps);
}

async function handleTabPanelMessage(m: PanelMessage, deps: { scope: TabScope; policy: Policy }) {
  if (m.type === 'opencode.browser.status') return panelStatus(m.sessionID, deps);
  if (m.type === 'opencode.browser.share') return { tab: await deps.scope.share(m.sessionID, m.tabId, m.move === true) };
  if (m.type === 'opencode.browser.unshare') {
    await deps.scope.unshare(m.sessionID, m.tabId);
    return { ok: true };
  }
  return { error: 'unknown request' };
}

async function panelStatus(sessionID: string | undefined, deps: { scope: TabScope; policy: Policy }) {
  return { stopped: deps.policy.isStopped, tabs: sessionID ? await deps.scope.tabIdsOf(sessionID) : [] };
}

async function stopBrowser(deps: { policy: Policy; debuggers: DebuggerSessions }) {
  deps.policy.stop();
  await browser.storage.session.set({ [STOPPED_KEY]: true });
  await deps.debuggers.detachAll();
  return { stopped: true };
}

async function resumeBrowser(policy: Policy) {
  policy.resume();
  await browser.storage.session.set({ [STOPPED_KEY]: false });
  return { stopped: false };
}
