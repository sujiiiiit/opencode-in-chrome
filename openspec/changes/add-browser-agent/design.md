# Design

## Context

- The side panel (`entrypoints/sidepanel`) is a client of a local opencode server 2.2.5. The server runs the agent loop and model, streams the session over SSE, and asks the client things through session forms (`lib/opencode/forms.ts`). `lib/opencode/tool-info.ts` turns tool calls into timeline labels and already formats MCP tool names.
- `entrypoints/background.ts` only opens the side panel. The manifest has `storage`, `sidePanel`, `cookies` and loopback host access.
- The stored connection (`lib/opencode/connection.ts`, `storage.local` key `opencode.connection`) holds the server URL and a token sent as `authorization: Basic …`.
- `@opencode/client/mcp` exports `connectClientMcp({ url, name, tools, WebSocket? })`. It opens `ws://…/api/experimental/client-mcp?name=…`, answers `initialize`, `tools/list` and `tools/call`, passes the calling `sessionID` to handlers, and reconnects with 500 ms to 10 s backoff. A browser socket cannot send headers; the client says to put a ticket in the URL, and `experimental.mcp.client.token({ name })` returns `{ ticket, expires_in }`.
- `session.form.create({ sessionID, title, fields, metadata })` lets a client raise a form inside a session.
- A live probe of Claude in Chrome (`research_notes/Claude in Chrome agent architecture/live_probe.md`) gives the reference output formats and the gaps this design closes. The full research report is `reports/Claude in Chrome agent architecture.md`.

## Goals / Non-Goals

**Goals:**
- One model loop (opencode's) for both chat and browsing; the extension is a deterministic tool executor with no model calls of its own.
- Tool results small enough that a typical page step costs under 3 k tokens of text.
- Safety rules enforced in the executor, so they hold for any future caller.
- Every browser module testable with Vitest and a DOM environment, without a real browser.

**Non-Goals:**
- No planner/navigator multi-agent split; no LLM-backed `find`.
- No stealth or bot-detection evasion; `navigator.webdriver` and the debugger infobar are left as Chrome sets them.
- No browser control on Firefox in this change (the background keeps its Firefox sidebar path unchanged).

## Decisions

### D1. Transport: client MCP from the background worker
The background worker calls `connectClientMcp` with name `browser`, the stored server URL plus a fresh ticket, and the tool table. The model sees `browser_<tool>`.
- Alternatives: a local Node stdio MCP server plus WebSocket relay (the research report's original plan) needs an install step and a second process; native messaging needs per-OS registry setup and a Chrome restart. Both stay possible later for external CLIs.
- Ticket handling: `connectClientMcp` takes a fixed URL, so the worker wraps it: on each (re)connect it fetches a ticket and creates a new connection; a custom `WebSocket` subclass passed in the options detects a close before `initialize` and triggers a ticket refresh.

### D2. Where code runs
- Background worker: bridge, tab-group manager, debugger sessions, ref directory, policy, screenshot store. One owner for all CDP traffic because debugger events go to the context that attached.
- Unlisted snapshot script (`entrypoints/snapshot.ts`, WXT `defineUnlistedScript`), injected with `scripting.executeScript({ files, target: { tabId, allFrames: true } })` into the ISOLATED world. It keeps the per-document element registry, so refs survive between calls.
- Offscreen document: only for GIF encoding (needs a DOM canvas and CPU off the worker).
- Side panel: view only (timeline, approvals, share, stop).
- Alternative rejected: running tools in the side panel, because they would stop when the panel closes.

### D3. Keeping the worker alive
- While a session works on a tab, the attached debugger (Chrome 118+) and socket traffic (Chrome 116+) keep the worker alive.
- When idle, the worker may stop; a `chrome.alarms` alarm every 30 s and `runtime.onStartup`/`onInstalled` re-run the bridge start so tools reappear within one alarm period.
- Durable state lives in `storage.session` (session→group, tab→session, ref documents, screenshot frames) and `storage.local` (site permissions, settings).

### D4. Debugger lifecycle
- Attach (`chrome.debugger.attach({tabId}, "1.3")`) when a tab joins a session, enable `Page`, `Runtime`, `Network` and `Log`, and set `Target.setAutoAttach({ autoAttach: true, flatten: true, waitForDebuggerOnStart: false })` for out-of-process frames (minimum Chrome 125).
- Detach when the tab leaves the group, the session ends, or the kill switch fires.
- `onDetach` with `canceled_by_user` marks the tab `DEBUGGER_DETACHED` and stops re-attaching until the next explicit tool call.
- Attaching at adoption, not lazily at first input as Claude in Chrome does, is what lets console and network capture start at adoption. The cost is that the infobar shows as soon as a tab is an agent tab.

### D5. Snapshot and refs
- The walker runs in each frame. It descends into open shadow roots and closed ones (via `chrome.dom.openOrClosedShadowRoot`), keeps nodes per the filter, and computes role, name (aria-labelledby, aria-label, `<label>`, placeholder, alt, title, text) and state.
- It caps work at 5 000 kept nodes or 150 ms per frame and notes when it was capped.
- Element ids: `WeakMap<Element, n>` plus `Map<n, WeakRef<Element>>`, monotonic per document.
- Ref string: `e<n>`, numbered by the worker per tab across all frames and documents and never reused. The worker's directory maps each ref to `{ frameId, documentId, local n }`, using the `documentId` that `scripting.executeScript` reports. Acting on a ref targets that `documentId`. When the document is gone, that call fails and the ref is `STALE_REF`, even though the new document also numbers its elements from 1. (Implemented this way instead of per-frame `f<k>e<n>` prefixes because it keeps refs short and makes reuse impossible.)
- Stitching: the walker ends each iframe line with the URL the frame loads (`about:srcdoc` for srcdoc). The worker matches iframe lines to child frames from `webNavigation.getAllFrames` with the same parent, URL first and then frame order. Live finding: `runtime.getFrameId` exists only in Firefox, so Chromium cannot map an iframe element to its frame id directly. Frames no iframe line claims are listed at the end.
- Output format follows Claude in Chrome's line format, keeping familiarity for the model, plus state markers and `(offscreen)`. `find` scores the same nodes locally: token overlap on name, role, placeholder, href and text, with exact name matches first.
- Alternative: CDP `Accessibility.getFullAXTree` / `DOMSnapshot.captureSnapshot`. Rejected for the main path because it is slower on large pages, leaves no in-page registry for `form_input`, and uses Chrome-computed names that skip useful hints like placeholders. It is kept as a later option for canvas-heavy pages.

### D6. Input
- Pointer actions use CDP `Input.dispatchMouseEvent` in CSS pixels with `clickCount` set. A ref target is resolved in its frame: `scrollIntoView({block:'center'})`, read `getBoundingClientRect`, offset by each ancestor iframe's rect, then check occlusion with `elementFromPoint` at the centre inside that frame.
- `type` uses `Input.insertText`; `key` uses `Input.dispatchKeyEvent` from a key-name table that covers chords.
- `form_input` runs in the isolated world: native value setter plus `input` and `change` events, so framework value trackers see a change. It handles select by option value or text, checkbox/radio by boolean, and contenteditable through a selection replace.
- `file_upload` uses `DOM.setFileInputFiles` when given paths the server exposes. For chat attachments, the worker fetches the bytes from the server and assigns them in-page with `DataTransfer`.
- Dialogs: `Page.javascriptDialogOpening` marks the tab `DIALOG_OPEN`; the `dialog` action calls `Page.handleJavaScriptDialog`.
- Navigation wait: race `webNavigation.onCompleted` for the top frame, then a 500 ms DOM-quiet check by the snapshot script, under a 15 s cap. `history.pushState` navigations count through `webNavigation.onHistoryStateUpdated`.

### D7. Change reports
- Before an action the worker takes a cheap fingerprint: URL, title, tab ids, focused ref, and the interactive lines within the target's nearest landmark or 600 px around it.
- After the action it waits for DOM quiet (max 1 s) and diffs: new or removed lines (at most 15), URL/title change, tabs created (`tabs.onCreated` with an `openerTabId` in the session) and dialogs.

### D8. Screenshots
- `Page.captureScreenshot({ format: 'jpeg', quality: 80, clip: viewport, scale })` where `scale = min(1, 1568 / longEdgeCssPx)`. Times out at 5 s.
- The worker stores `{ id, frameW, frameH, cssW, cssH }` per screenshot (last 10 per session) to map coordinates; the image bytes for `upload_image` are kept in memory and drop on worker restart.
- The agent-tab indicator is a content-script element that the worker hides through a message before capture and input, and shows again after.
- Vision check: the tool description notes the actions need an image-capable model. The handler asks the server's model list (cached per session model) whether the session's model accepts images.

### D9. Safety layer
- `policy.ts` classifies each call (spec `browser/action-safety`) using the tool, the target's role/name/`type`, whether the target submits a form, and keywords in `action_summary`.
- Site key = registrable domain (eTLD+1, using a bundled public-suffix list subset; fallback hostname).
- Approvals use `session.form.create` with `metadata: { kind: 'browser-approval', site, tool, summary }` and a single choice field. The worker waits for the answer through a server event subscription for that session, with a 5 minute cap.
- The existing form card renders it; `chat/browser-activity` gives it browser wording through the metadata.
- Fallback, if extension-created forms cannot be answered by the panel: the worker sends the request to the panel over `runtime` messaging and the panel shows its own card.
- Untrusted wrapping: page-derived text goes inside `<untrusted_page_content id="…">…</untrusted_page_content>` with a per-call random id. The tool descriptions tell the model that text inside is data.
- Loop guard: a per-session map of the last action signature and its failure count.

### D10. Tool definitions
- One `lib/browser/tools/*.ts` module per tool family exports `{ name, description, inputSchema, tier, handler }`. The bridge maps them into `connectClientMcp` tools and wraps each handler with: session check → policy → tab/ref resolution → run → change report → footer → error mapping.
- Names drop Claude in Chrome's `_mcp` suffix (`tabs_context`, not `tabs_context_mcp`). Descriptions are adapted from the probed contract.
- `tool-info.ts` gets explicit specs for every `browser_*` name.

### D11. GIF
- While recording, each action stores a down-scaled frame (max 800 px, JPEG data in memory, cap 60 frames) plus the action point and label.
- Export draws the overlays on an `OffscreenCanvas` in the service worker and encodes with `gifenc` (about 10 kB, MIT). It saves the GIF with `downloads.download` from a `data:` URL. This needs only the `downloads` permission. (Changed from an offscreen document during implementation: `OffscreenCanvas` and `createImageBitmap` work in the worker, so the extra page and the `offscreen` permission were unnecessary.)

### D12. Permissions
- Add `debugger`, `tabs`, `tabGroups`, `scripting`, `webNavigation`, `alarms`, `downloads` and `host_permissions: ['<all_urls>']`, with `minimum_chrome_version: '125'`.
- The browser-access switch only controls whether the bridge runs; it does not request permissions at run time (see Open Questions).

## Risks / Trade-offs

- [The client-MCP and ticket endpoints are experimental in 2.2.5] → Isolate them in `lib/browser/bridge.ts`, pin the client version, and test against the server in the first task.
- [Adding `debugger` and `<all_urls>` disables the extension on update until the user accepts the new warnings] → Ship in a release note; browser access stays off by default so nothing acts before the user opts in.
- [The infobar is visible while agent tabs exist] → Detach when the session ends or after 10 minutes without a browser call on that tab; re-attach on the next call. This means a gap in console/network history after a re-attach, and the result notes it.
- [The worker stops while idle and the server sees the tools disappear] → Alarm-based restart; the tool description tells the model to retry once if the tool is missing.
- [Prompt injection is not solved by marking] → Tiers, per-call approval for consequential actions, the hand-off rule, the site re-check and the sensitive-site rule limit what a hijacked model can do. Detection is not relied on.
- [Keyword-based consequential detection misses some buttons] → Treat any form submission, Enter inside a form, or a click on `type=submit` as consequential regardless of words. Users can block sites.
- [Huge or canvas-based pages make the tree useless] → Caps plus a truncation note; screenshots and coordinates remain the fallback.
- [Cross-origin frame coordinates are wrong under CSS transforms] → Use the frame element's border box and a `DOMSnapshot` fallback for transformed frames; this is covered by a test page.

## Migration Plan

- Ship behind the browser-access switch, off by default.
- Rollback is turning the switch off (the bridge disconnects and the server stops listing the tools) or reverting the release. No stored data needs migrating; new storage keys are namespaced `opencode.browser.*`.

### D13. Code mode (spike finding, 2026-11-05)
opencode 2.2.5 does not give client-MCP tools to the model as top-level tools. It lists them in a code-mode catalog. The model calls a built-in `execute` tool whose `input.code` runs `await tools.browser.<tool>(args)`, and the `execute` part's `state.metadata.toolCalls` lists `{ tool: 'browser.<tool>', status, input }`. Consequences:
- Timeline labels come from those inner calls (spec `chat/browser-activity`). A direct `browser_<tool>` part is still handled in case a server version exposes tools directly.
- Image content returned by a tool reaches the transcript as a `file` part (`data:image/png;base64,…`). Whether the model sees it depends on the model. `kilo/kilo-auto/free` is text-only, so screenshot tests use the vision check's refusal path with that model.
- Tool descriptions are what the catalog `search` matches, so each description starts with the plain words a model would search for ("click", "screenshot", "read page").
- A tool named `screenshot` was missing from the catalog while `computer` worked. Screenshots stay an action of `computer` and no tool is named `screenshot`.
- `batch` is less needed because code can chain calls, but it is kept for parity and for callers without code mode.

### D14. Test strategy
- Unit (Vitest, happy-dom, WXT `fakeBrowser`): pure modules (walker, refs, policy, key table, frame maths, diff, formatters) and background modules against a mocked `chrome.debugger`.
- Integration (Vitest, Node): the bridge against a fake client-MCP endpoint (`tests/support/fake-opencode.ts`: token route, WebSocket that sends `initialize`, `tools/list`, `tools/call`, plus the form and event routes approvals use). Optional live tests, run only with `OPENCODE_LIVE=1`, use a private `opencode serve` and model `kilo/kilo-auto/free`, prompting with explicit code so the free model's choices don't make them flaky.
- E2E (Playwright, Chromium with the built extension):
  - Deterministic specs drive the real extension through the same fake endpoint and act on local fixture pages served from `e2e/fixtures/`: shadow DOM, iframes, forms, dialogs, popups, a strict CSP, a React-style controlled input and an injection page.
  - One live spec (`OPENCODE_LIVE=1`) runs a normal chat turn with the free model against a private server.
  - The connection is seeded by evaluating `chrome.storage.local.set` in the service worker.

## Open Questions

Resolved by the spike (2026-11-05):
- Idle keepalive: the server sent no frames on an idle socket for 70 s, so the alarm path (D3) is the steady state.
- opencode permission rules did not prompt for client-MCP tool calls, so the executor's approvals are the only gate.
- A tool call that waited 70 s completed, so approval waits do not hit a short server timeout. The 5-minute cap is still checked in the live suite.
- Ticket flow: `POST /api/experimental/client-mcp/token?name=browser` with header `x-opencode-ticket: 1` returns `{ data: { ticket, expires_in } }`. The socket URL carries `?ticket=`.

Still open (each has a defined fallback):
- Can `debugger` be listed under `optional_permissions`? If it can, request it when the user turns browser access on; if not, keep it required (D12).
- Does an extension-created `session.form.create` form show in the panel's existing form flow? If not, use the runtime-messaging fallback (D9).
