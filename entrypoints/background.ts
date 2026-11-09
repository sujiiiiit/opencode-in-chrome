import { startBrowserAgent } from '@/lib/browser/agent';
import { createBrowserRuntime } from '@/lib/browser/runtime';
import { NATIVE_HOST, startNativeBridge } from '@/lib/browser/native';
import { isBrowserAccessEnabled } from '@/lib/browser/settings';

interface FirefoxSidebarAction {
  toggle: () => Promise<void>;
}

export default defineBackground(() => {
  // Chromium (Chrome, Edge, Opera): open the side panel when the toolbar icon
  // is clicked. `sidePanel` is missing on Firefox.
  if (browser.sidePanel) {
    // Clear a global panel left by an older build; tab-specific options below override it.
    void browser.sidePanel.setOptions({ enabled: false })
      .catch((error) => console.error('Failed to disable global side panel', error));
    const configureTabPanel = (tabId: number) =>
      browser.sidePanel.setOptions({ tabId, path: `sidepanel.html?tabId=${tabId}`, enabled: true })
        .catch((error) => console.error('Failed to configure tab side panel', error));
    browser.tabs.onCreated.addListener((tab) => {
      if (tab.id !== undefined) void configureTabPanel(tab.id);
    });
    void browser.tabs.query({}).then((tabs) =>
      Promise.all(tabs.filter((tab) => tab.id !== undefined).map((tab) => configureTabPanel(tab.id!))),
    );
    browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Failed to set side panel behavior', error));
    // The browser agent: tools served to the paired opencode server (lib/browser).
    const runtime = createBrowserRuntime();
    startBrowserAgent({ tools: runtime.tools });
    // The same tools for any MCP client on this machine (mcp/server.mjs through the native host).
    const native = startNativeBridge(runtime.tools, () => browser.runtime.connectNative(NATIVE_HOST), isBrowserAccessEnabled, (sessionID) => runtime.scope.release(sessionID));
    browser.alarms.onAlarm.addListener(() => native.ensure());
    return;
  }

  // Firefox: the sidebar_action entrypoint provides the panel, and the action
  // toggles it.
  const sidebarAction = (
    browser as unknown as { sidebarAction?: FirefoxSidebarAction }
  ).sidebarAction;
  if (!sidebarAction) return;

  const action = browser.browserAction ?? browser.action;
  action?.onClicked.addListener(() => {
    sidebarAction
      .toggle()
      .catch((error) => console.error('Failed to toggle sidebar', error));
  });
});
