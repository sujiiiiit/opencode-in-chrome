interface FirefoxSidebarAction {
  toggle: () => Promise<void>;
}

export default defineBackground(() => {
  // Chromium (Chrome, Edge, Opera): open the side panel when the toolbar icon
  // is clicked. `sidePanel` is missing on Firefox.
  if (browser.sidePanel) {
    browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Failed to set side panel behavior', error));
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
