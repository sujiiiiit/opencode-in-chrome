# Tasks

Test levels (design D14): **unit** = Vitest + happy-dom/fakeBrowser; **integration** = Vitest in Node against `tests/support/fake-opencode.ts` (live variants gated by `OPENCODE_LIVE=1`, model `kilo/kilo-auto/free`); **e2e** = Playwright with the built extension in Chromium against `e2e/pages/` fixture pages.

## 1. Bridge, manifest and test harness

- [x] 1.1 Add the manifest permissions, `<all_urls>` host access and `minimum_chrome_version: '125'` from design D12 to `wxt.config.ts`. Try `debugger` under `optional_permissions` first, and keep it required if Chrome rejects it. Verify `pnpm build` succeeds and `.output/chrome-mv3/manifest.json` lists them.
- [x] 1.2 Create `tests/support/fake-opencode.ts`. It is a Node HTTP + WebSocket server with:
  - the client-MCP token route and socket (sends `initialize`, `notifications/initialized`, `tools/list`, and `tools/call` with a session `_meta`);
  - `session.form.create` and the form get/cancel routes used by approvals;
  - `GET /api/model`;
  - a scripted `callTool(session, name, args)` helper.

  Verify with a self-test that a stub MCP client round-trips a call.
- [x] 1.3 Create `lib/browser/bridge.ts`: read the stored connection, fetch a ticket, call `connectClientMcp` with the tool table, refresh the ticket when a socket closes before `initialize`, and start it from `entrypoints/background.ts` (Chromium path only). Verify with a unit test that the socket URL carries `ticket=` and never the token, and an integration test against fake-opencode that `tools/list` returns the tools and a call carries the session id.
- [x] 1.4 Add the 30 s alarm, the `onStartup` restart and the browser-access setting `opencode.browser.enabled` that starts or stops the bridge. Verify with unit tests: turning the setting off closes the connection, and an alarm with no live connection reconnects.
- [x] 1.5 Set up Playwright: add `@playwright/test`, `playwright.config.ts`, the `e2e/fixtures.ts` extension fixture (persistent context, extension id, service-worker handle, storage seeding), a static fixture-page server and fake-opencode startup, and `pnpm e2e` / `pnpm test:live` scripts. Verify with an e2e smoke spec: the built extension loads, connects to fake-opencode when browser access is on, and lists the tools.
- [x] 1.6 Add a live integration test (`OPENCODE_LIVE=1`): start a private `opencode serve` and connect the bridge with the server password, then check that `kilo/kilo-auto/free` runs an `execute` call to `tools.browser.tabs_context` and gets a reply attributed to its session. Verify it passes locally and is skipped without the variable.
- [x] 1.7 Record the spike's answers in `design.md` (D13 code mode, the resolved Open Questions). Verify by reading the updated sections.

## 2. Tool framework and tab scope

- [x] 2.1 Create `lib/browser/tools/registry.ts` with the tool shape from design D10 and the handler wrapper (session check, error mapping to the fixed codes, untrusted wrapping helper, footer line). Verify with unit tests for `NO_SESSION`, `INVALID_INPUT` and the footer format in spec `browser/tool-bridge`.
- [x] 2.2 Create `lib/browser/tabs.ts`:
  - a session-to-group map persisted in `storage.session`;
  - group creation in the last focused window;
  - current-tab tracking;
  - popup adoption via `tabs.onCreated` `openerTabId`;
  - cleanup when tabs and groups are removed.

  Verify with unit tests on fakeBrowser plus a `tabGroups` mock covering every scenario in spec `browser/tab-scope`.
- [x] 2.3 Implement `tabs_context`, `tabs_create`, `tabs_close` and the restricted-page check. Verify with unit tests for `NOT_IN_GROUP`, closing the last tab and `RESTRICTED_PAGE`, and an e2e spec that creates a group, lists it and closes it.
- [x] 2.4 Create `lib/browser/debugger.ts`:
  - attach when a tab is adopted, and enable the CDP domains;
  - flat auto-attach for child targets, with events routed by `sessionId`;
  - handle `onDetach` reasons;
  - detach after 10 idle minutes.

  Verify with unit tests on a mocked `chrome.debugger`, and an e2e spec that a CDP command succeeds on an adopted fixture tab.

## 3. Page snapshot and refs

- [x] 3.1 Create the unlisted snapshot script `entrypoints/snapshot.ts` and the `lib/browser/snapshot/` walker. It covers:
  - role and name computation;
  - interactive/all filters and state markers;
  - `(hidden)` and `(offscreen)`;
  - open and closed shadow roots;
  - node and time caps.

  Verify with unit fixtures for labelled inputs, checked boxes, password masking, `role=button` divs, contenteditable, shadow roots and the 5 000-node cap.
- [x] 3.2 Add the per-document element registry and ref allocation, and the worker-side ref directory keyed by frame id and document id. Verify with unit tests: refs are stable across two reads, new nodes get new numbers, and a ref from a replaced document returns `STALE_REF` even when the number exists again.
- [x] 3.3 Implement `read_page` across all frames, stitching each frame's subtree under its `iframe` line, with `ref_id`, `depth`, `max_chars` (default 30 000), the truncation note and untrusted-content markers. Verify with unit tests for stitching and truncation, and an e2e spec on fixture pages: open shadow DOM, closed shadow DOM, a same-origin srcdoc frame and a cross-origin frame (a second local port) are all listed with refs.
- [x] 3.4 Implement local `find` (token scoring, top 20, "more matched" note) and `get_page_text` (main-content pick, title/URL header, cap). Verify with unit tests: "login link" ranks the login link first on a Hacker News-like fixture, plus the no-match message.

## 4. Page actions

- [x] 4.1 Create `lib/browser/input.ts`:
  - CDP mouse events in CSS pixels with `clickCount`;
  - a key table for chords and `repeat`;
  - `insertText` typing;
  - ref-to-point resolution through frame offsets;
  - occlusion and enablement checks.

  Verify with unit tests for the key table and point mapping, and an e2e spec where clicking a covered button returns `OBSCURED` naming the cover.
- [x] 4.2 Implement the `computer` pointer, keyboard, scroll, `scroll_to`, hover, drag and wait actions, with a required `action_summary` and the secret check. Verify with unit tests for the input validation errors, and an e2e spec on the form fixture: clicks, typing and `ctrl+a` change the page, and a trusted-event-only button responds.
- [x] 4.3 Implement `navigate`: default scheme, back/forward, load plus 500 ms DOM-quiet under a 15 s cap, history-state navigations and optional `snapshot`. Verify with a unit test for the timeout message, and an e2e spec covering a normal page, a slow page and a pushState route change.
- [x] 4.4 Implement change reports (design D7) and attach them to every action result. Verify with unit tests for the diff (new menu items listed, `No visible change`), and an e2e spec where a `target=_blank` link names the new tab id and the tab is in the group.
- [x] 4.5 Implement `form_input` for text, textarea, select, checkbox, radio and contenteditable, reporting previous and new values. Verify with unit tests for each control and the unknown-option error, and an e2e spec on a React-controlled input fixture where the app's rendered state updates.
- [x] 4.6 Implement dialog tracking, the `dialog` action, and `DIALOG_OPEN` on later calls. Verify with an e2e spec: a click that opens `confirm()` reports it, `read_page` fails with `DIALOG_OPEN`, and `dialog accept` clears it.
- [x] 4.7 Implement `file_upload` (chat attachments and server paths, 10 MB cap) and `resize_window`. Verify with a unit test for the size cap, and an e2e spec that uploads a file to a fixture file input and resizes the window.
- [x] 4.8 Implement `batch`: sequential, stops on the first error, keeps earlier results and images, and runs the policy per item. Verify with unit tests for the "2 completed, 2 not run" result.

## 5. Screenshots and recording

- [x] 5.1 Implement the `screenshot` and `zoom` actions (JPEG, 1568 px long-edge frame, `scale`, 5 s timeout) and the per-session store of the last 10 frame ids used for coordinate mapping. Verify with unit tests for the frame maths at DPR 1 and 2, and an e2e spec where clicking a coordinate from a 0.5-scale screenshot hits the intended button.
- [x] 5.2 Add the agent-tab indicator (installed through the page API), hidden around captures and never taking clicks. Verify with an e2e spec that the indicator element is present on agent tabs and hidden while a capture runs.
- [x] 5.3 Add the vision check against the session model's capabilities, and the `INVALID_INPUT` path for text-only models. Verify with a unit test using a mocked model list where `kilo/kilo-auto/free` is text-only.
- [x] 5.4 Implement `upload_image` by ref or drop coordinate. Verify with an e2e spec that uploads a screenshot to a fixture file input.
- [x] 5.5 Add `gifenc` (encoding in the worker with OffscreenCanvas, design D11) and `gif` start/stop/export/clear with click markers and labels, saved via `downloads`. Verify with a unit test for frame capping, and an e2e spec where export triggers a `.gif` download.

## 6. Diagnostics

- [x] 6.1 Implement `console` from the `Runtime`/`Log` domains with `pattern`, `onlyErrors`, `limit`, `clear` and clearing on cross-site navigation. Verify with unit tests on recorded CDP events, and an e2e spec that reads `probe-log 1` and an uncaught error.
- [x] 6.2 Implement `network` with method, URL, type, status, size and duration, `urlPattern`, filtering of `data:` and extension URLs, and fetching a body by id with a 20 000-char cap. Verify with unit tests on recorded events, and an e2e spec showing that page-load requests appear on the first call.
- [x] 6.3 Implement `javascript` via `Runtime.evaluate`: main world, `awaitPromise`, REPL last-expression, 30 s timeout and 20 000-char cap. Verify with a unit test for error mapping, and an e2e spec on a strict-CSP fixture page where `document.title` returns.

## 7. Safety layer

- [x] 7.1 Create `lib/browser/policy.ts`:
  - tier classification (submit detection, keywords, tool tiers);
  - registrable-domain site keys;
  - the site permission store in `storage.local`;
  - approval modes;
  - the sensitive-site rule.

  Verify with a unit test table covering every scenario in spec `browser/action-safety`.
- [x] 7.2 Implement approvals through `session.form.create` with browser metadata and a 5-minute wait, falling back to runtime messaging if the panel cannot answer them. Verify with an integration test against fake-opencode (approve runs the call, deny returns `DENIED` with no input, timeout returns `NEEDS_APPROVAL`).
- [x] 7.3 Add the hand-off rule (password, OTP and card fields, CAPTCHA frames, OAuth consent hosts), the pre-input site re-check, the loop guard and the kill switch. Verify with unit tests for each rule, and an e2e spec where typing into a password field is refused and the kill switch stops a running batch.
- [x] 7.4 Build the injection fixture page (hidden-field instructions, a pop-up, instructions in body text). Verify with an e2e spec that read results keep that text inside the untrusted markers and that a submit on it requires approval, plus a live spec (`OPENCODE_LIVE=1`) where a chat asked to summarise it makes no consequential call.

## 8. Side panel

- [x] 8.1 Add browser specs to `lib/opencode/tool-info.ts` for direct `browser_<tool>` parts and for `execute` parts whose `metadata.toolCalls` are `browser.*`, with `action_summary`-based titles and screenshot thumbnails. Verify with tests in `tests/lib/opencode/tool-info.test.ts` for each tool's active and done labels and the code-mode case.
- [x] 8.2 Render browser approval forms with site, action and summary wording in the existing form card. Verify with a component test in `tests/components/chat/form-card.test.tsx`.
- [x] 8.3 Add a Browser section to settings: access switch, approval mode, and a site list (allow/ask/block, sensitive, remove), built with `components/ui` and Base UI patterns. Verify with a component test, and that `pnpm compile` passes.
- [x] 8.4 Add the share-current-tab control and the stop/resume control to the chat. Verify with component tests, and an e2e spec where sharing from the side panel moves the fixture tab into the session's group.

## 9. Integration checks

- [x] 9.1 Add a live e2e spec (`OPENCODE_LIVE=1`): the built extension paired with a private `opencode serve`, and a normal chat turn using `kilo/kilo-auto/free` that opens a fixture page, reads it and answers from it, with browser steps in the timeline. Verify it passes locally.
- [x] 9.2 Run a live suite of at least 20 tasks on fixture and real sites (forms, filters and sorting, date pickers, multi-tab, iframes, shadow DOM) and record pass/fail in `research_notes/`. Verify the suite file exists and the pass rate is noted.
- [x] 9.3 Run `pnpm compile`, `pnpm test`, `pnpm build`, `pnpm e2e` and `pnpm exec fallow audit --format json --quiet`, and confirm all pass with verdict `pass`.
