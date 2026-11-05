# Proposal

## Why

The side panel chats with an opencode server, but the model cannot see or act on the user's browser, so anything that needs a web page (filling a form, reading a logged-in dashboard, testing the app being built) has to leave the chat. Claude in Chrome shows the target: one chat whose model can read pages, click, type, screenshot and debug in the user's real, signed-in Chrome. opencode 2.2.5 now ships a client-MCP channel (`@opencode/client/mcp`, `/api/experimental/client-mcp`) that lets the extension itself serve tools to the server, so we can reach parity without a native host or a separate local process, and do better where a live probe of Claude in Chrome (2026-11-05, `research_notes/Claude in Chrome agent architecture/live_probe.md`) showed gaps: its page reader skips shadow DOM and iframes, omits checked/value state, spends an LLM call on every `find`, and returns bare "Clicked" results that force an extra read.

## What Changes

- The background service worker connects to the paired opencode server as a client MCP server named `browser`, so the model gets `browser_*` tools in every normal chat turn. No router: the model answers plainly when no tool is needed.
- Each opencode session gets its own Chrome tab group; the agent can only see and act on tabs in its group (plus tabs the user explicitly shares). Popups opened from agent tabs join the group.
- Tool surface at parity with Claude in Chrome: `tabs_context`, `tabs_create`, `tabs_close`, `navigate`, `read_page`, `find`, `get_page_text`, `computer` (click variants, type, key, scroll, scroll_to, drag, hover, wait, screenshot, zoom), `form_input`, `file_upload`, `upload_image`, `javascript`, `console`, `network`, `resize_window`, `batch`, `gif`.
- Improvements over Claude in Chrome: page snapshots that pierce open shadow roots and frames (including cross-origin frames via the debugger), report element state, a local zero-LLM `find`, action results that include what changed, `navigate` returning title and an optional snapshot, and network capture with type/status/size/duration from the moment a tab is adopted.
- Real input through `chrome.debugger` (CDP) for clicks, keys and screenshots; screenshots downscaled to a token budget with a coordinate frame the model clicks in.
- A safety layer enforced in the extension: five action tiers (read, navigate, mutate, consequential, hand-off), per-site allow/ask/block, domain re-check before each action, untrusted-content marking, and approvals shown through opencode session forms the side panel already renders.
- Side panel: readable timeline labels for `browser_*` calls, a browser-access toggle and site-permission list in settings, and an indicator on agent tabs.
- New manifest permissions: `debugger`, `tabs`, `tabGroups`, `scripting`, `webNavigation`, `alarms`, `downloads`, and access to all sites (`<all_urls>`), raising the minimum Chrome to 125.
- Out of scope for this change (follow-ups): saved shortcuts/workflows and scheduled tasks, several connected browsers per server, a stdio MCP proxy for external CLIs (Claude Code, Codex), and Firefox support for browser control.

## Capabilities

### New Capabilities
- `browser/tool-bridge`: how the extension serves browser tools to the opencode server (connection, auth ticket, reconnect, tool registration, session attribution, result format and error codes).
- `browser/tab-scope`: which tabs the agent may use: per-session tab groups, creation, closing, sharing a user tab, adopting popups, restricted pages.
- `browser/page-snapshot`: how the agent reads a page: accessibility-style tree with refs, interactive/all filters, shadow DOM and frames, element state, truncation, `find`, `get_page_text`.
- `browser/page-actions`: how the agent acts on a page: navigation and its wait rule, clicks/typing/keys/scroll/drag/hover by ref or coordinate, `form_input`, `file_upload`, dialogs, batching, change reports.
- `browser/screenshots`: screenshot and zoom capture, scaling and coordinate frames, image retention, GIF recording.
- `browser/page-diagnostics`: console messages, network requests and page JavaScript execution.
- `browser/action-safety`: action tiers, site permissions, approvals, domain re-check, untrusted-content handling, the hand-off rule.
- `chat/browser-activity`: how the side panel shows browser work: timeline labels, approvals, the browser-access setting and site list, the agent-tab indicator.

### Modified Capabilities
(none: `openspec/specs/` has no existing capabilities)

## Impact

- Code: `entrypoints/background.ts` (bridge + executor host), new `lib/browser/` (tab groups, debugger sessions, refs, actions, tools, policy), a new unlisted snapshot script entrypoint, `lib/opencode/tool-info.ts` (labels for `browser_*`), settings UI for browser access and sites, `wxt.config.ts` manifest.
- APIs: uses opencode experimental endpoints `client-mcp`, `experimental.mcp.client.token` and `session.form.create`; these are marked experimental in 2.2.5 and may change.
- Dependencies: `@opencode/client/mcp` is already installed; one small GIF encoder package for recording (see design.md).
- Store and users: the `debugger` permission shows Chrome's "started debugging this browser" bar while attached and draws stricter Chrome Web Store review; `<all_urls>` changes the install warning.
- Security: the extension becomes able to act in signed-in sites, so the safety layer is part of the change, not a follow-up.
