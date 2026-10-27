# Where should this UI live?

| Option | Lives | Lifetime | Good for |
|---|---|---|---|
| Popup `entrypoints/popup/` | toolbar dropdown | destroyed when it closes (any click outside) | quick actions, status, toggles |
| Side panel `entrypoints/sidepanel/` | browser side panel (Chrome 114+, Edge, Opera; Firefox `sidebar_action`) | persists across tab navigation | chat/assistant UIs, long tasks, reference panels |
| Options `entrypoints/options/` | `chrome://extensions` → Details → Options, or own tab (`open_in_tab`) | normal page | settings |
| Unlisted page `entrypoints/<name>.html` | its own tab/window via `runtime.getURL` | normal page | onboarding, dashboards, auth callback pages |
| On-page UI (content script) | inside the website | per page load | UI that needs page context (buttons next to page elements, overlays) |

**Recommend:** a popup for quick actions. A **side panel** for anything stateful or conversational: the popup closes and loses state the moment the user clicks the page.
**Why:** popup state loss is the #1 surprise; the side panel avoids it without fighting the page's CSS.
**Deviate when:** the UI must sit next to specific page elements (on-page UI), or the target browser lacks a side panel (Safari: fall back to popup or on-page UI).
