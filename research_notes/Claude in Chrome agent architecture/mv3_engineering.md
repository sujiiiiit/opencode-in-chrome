# MV3 Engineering of a Browser-Control Core (WXT side-panel agent extension)

Scope: practical APIs, pitfalls and fixes for an MV3 (WXT-built) extension whose side-panel chat can do plain LLM chat and also drive tabs. Research date 2026-11-05. Items marked "(training knowledge, not re-verified)" in Inferences were not fetched this session; the report writer should treat them as lower confidence.

## 1. chrome.debugger + CDP (attach, infobar, trusted input, screenshots, AX tree, detach, restricted pages)

### Takeaway
`chrome.debugger` gives an extension a restricted subset of CDP (Input, Page, DOM, Accessibility, Runtime, Network, Log, Target, Fetch, Emulation, etc.) per tab, with flat child sessions since Chrome 125. It produces real "trusted" input and screenshots of non-active tabs, but costs you the "started debugging this browser" infobar, gets detached when the user opens DevTools or cancels the bar, and screenshots of hidden tabs can hang.

### Cited Findings
- Signature: `chrome.debugger.sendCommand(target: DebuggerSession, method: string, commandParams?: object): Promise<object|undefined>`. — [Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- Only a subset of CDP domains is available to extensions: Accessibility, Audits, CacheStorage, Console, CSS, Database, Debugger, DOM, DOMDebugger, DOMSnapshot, Emulation, Fetch, IO, Input, Inspector, Log, Network, Overlay, Page, Performance, Runtime, Storage, Target, Tracing, WebAudio, WebAuthn. (No Browser domain, so no `Browser.*` window/download control.) — [Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- `DebuggerSession.sessionId` "Identifies a child session within the root session identified by tabId, extensionId or targetId." Flat sessions arrived in Chrome 125; you message child targets (OOPIFs, workers) by passing `sessionId` to `sendCommand`. Auto-attach via `Target.setAutoAttach({autoAttach:true, flatten:true, waitForDebuggerOnStart:false})`, and it is **not recursive**: call `Target.setAutoAttach` again inside each child session to reach grandchildren. — [Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- `chrome.debugger.onDetach` reasons are `"target_closed"` and `"canceled_by_user"`; it fires when the tab closes or when DevTools is opened on that tab. — [Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- Enterprise `runtime_blocked_hosts` blocks attach with "This page cannot be scripted due to an ExtensionsSettings policy", and Chrome detaches the debugger if the tab (or any frame) navigates to a blocked host. — [Chrome debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- Input coordinates: `Input.dispatchMouseEvent` x/y are "relative to the main frame's viewport in CSS pixels" (y=0 is top of viewport); `type` ∈ mousePressed | mouseReleased | mouseMoved | mouseWheel; `clickCount` defaults to 0 (so pass `clickCount:1` for a click, 2 for dblclick). `Input.dispatchKeyEvent` `type` ∈ keyDown | keyUp | rawKeyDown | char, with `text` and experimental `commands` (e.g. `'selectAll'`). `Input.insertText` (experimental) "emulates inserting text that doesn't come from a key press, for example an emoji keyboard or an IME." — [CDP Input.pdl](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Input.pdl)
- Infobar: the common workaround is launching Chrome with `--silent-debugger-extension-api`; it must be on every shortcut and requires a full Chrome restart. Clicking "Cancel" on the bar detaches (functionally `canceled_by_user`) and the bar can reappear. Extensions force-installed by group policy typically don't trigger the banner (vendor claim). — [UiPath docs](https://docs.uipath.com/studio-web/automation-cloud/latest/user-guide/debugging-banner-notification-after-extension-upgrade-to-manifest-v3); [Claude in Chrome issue requesting a built-in way to suppress the banner on every tab](https://claudeissues.com/issue/69287-claude-in-chrome-started-debugging-this-browser-banner-shows-on-every-tab-please)
- The old chrome://flags "Enable Silent Debugging" flag (Chrome 27 era) was gone by ~Chrome 79; the command-line switch remains the known route. — [NetBeans bug](https://bz.apache.org/netbeans/show_bug.cgi?id=230292); [SO mirror](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/59890623/jetbrains-ide-support-is-debugging-the-browser)
- Screenshot pitfall: `Page.captureScreenshot` (default `fromSurface:true`) can time out (~30s) on tabs whose `visibilityState` is "hidden" because Chrome stops producing compositor frames for backgrounded renderers, while DOM reads and clicks still work. Reported workarounds: activate the tab (`Target.activateTarget` / `chrome.tabs.update({active:true})`) before capture, treat timeout as recoverable; a Chrome-side fix was speculated around M149 (unconfirmed). — [Claude in Chrome issue #78533](https://claudeissues.com/issue/78533-claude-in-chrome-page-capturescreenshot-times-out-30s-on-any-tab-whose-visibilit); [issue #78221](https://claudeissues.com/issue/78221-bug-hidden-browser-pane-screenshots-time-out-30s-preview-start-no-longer-auto-op)
- Some extensions use CDP screenshots and fall back to `chrome.tabs.captureVisibleTab` on failure. — [yetibrowser-mcp screenshot doc](https://glama.ai/mcp/servers/@yetidevworks/yetibrowser-mcp/blob/1e3087933b10001dd1c08801b4a223dd91e30ead/docs/screenshot.md)
- `chrome.tabs.captureVisibleTab`: limited to `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND = 2` (Chrome 92+), "expensive"; captures only the **active** tab of a window; needs `<all_urls>` or `activeTab`; `activeTab` is required for chrome: pages, other extensions' pages and data: URLs; file URLs need file access. — [chrome.tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- `DOMSnapshot.captureSnapshot` returns a flattened DOM (shadow DOM flattened) with layout tree nodes indexing back into the DOM node array and optional `includePaintOrder` (global paint-order index from stacking order); `getSnapshot` is deprecated and the domain is experimental. Useful for an occlusion-aware, shadow-piercing element snapshot in one round trip. — [DOMSnapshot.pdl](https://chromium.googlesource.com/devtools/devtools-frontend/+/HEAD/node_modules/devtools-protocol/pdl/domains/DOMSnapshot.pdl); [CDP mirror](https://cdpstatus.reactnative.dev/devtools-protocol/tot/DOMSnapshot)

### Inferences
- Attach lazily per tab, keep a `Map<tabId, {attached, sessions}>`, and re-attach on demand when a command fails with "Debugger is not attached"; listen to `chrome.debugger.onDetach` and if reason is `canceled_by_user` stop auto-reattaching (user intent) and surface that in the UI.
- Because `debugger` cannot be optional (see §7) and the infobar is noisy, a robust design uses a **hybrid**: content-script/`scripting` path for reading DOM, filling simple inputs and clicking (no infobar), and escalate to CDP only for things that need trusted events (file inputs, `isTrusted`-checking sites, keyboard shortcuts, drag, canvas apps), screenshots of background tabs, network/console capture, and dialogs. Open Claude in Chrome's tool set (computer/read_page/form_input/javascript_tool/read_console_messages/read_network_requests) maps onto exactly this split.
- Standard CDP calls to use (training knowledge, not re-verified this session): `Page.captureScreenshot({format:'jpeg', quality:60-80, captureBeyondViewport:false})`; `Accessibility.getFullAXTree({depth})` (needs `Accessibility.enable` on some versions); `DOM.getDocument({depth:-1, pierce:true})` to traverse shadow roots and same-process iframes; `Runtime.evaluate({expression, returnByValue:true, awaitPromise:true})` runs with DevTools privileges and is not subject to page CSP `unsafe-eval` restrictions (and `Page.setBypassCSP({enabled:true})` exists for injected scripts); `Runtime.enable` + `Runtime.consoleAPICalled`/`Runtime.exceptionThrown`, `Log.enable` + `Log.entryAdded`, `Network.enable` + `Network.requestWillBeSent`/`responseReceived`/`loadingFinished`/`Network.getResponseBody` for capture (events are delivered via `chrome.debugger.onEvent(source, method, params)` and are only seen after enable, so buffer from attach time); `DOM.setFileInputFiles({files:[absPath], backendNodeId})` for uploads (paths must exist on the local filesystem, which an extension cannot write; bridge through native host or use the DataTransfer trick in-page); `Page.enable` + `Page.javascriptDialogOpening` -> `Page.handleJavaScriptDialog({accept, promptText})` (an unhandled alert blocks `Runtime.evaluate` and screenshots); `Page.setLifecycleEventsEnabled({enabled:true})` + `Page.lifecycleEvent` names like `networkIdle`/`networkAlmostIdle`.
- Typing: for normal text prefer `Input.insertText` (one call, handles unicode) and use `dispatchKeyEvent` (`rawKeyDown`+`char`+`keyUp` with `windowsVirtualKeyCode`, `code`, `key`) only for Enter/Tab/Backspace/shortcuts; `commands:['selectAll']` with keyDown of "a" is the reliable cross-platform select-all.
- Clicks: send `mouseMoved` then `mousePressed`+`mouseReleased` with `button:'left', clickCount:1` at CSS-pixel coordinates; hover-only menus need the `mouseMoved`.

### Gaps
- No official Chrome doc describing the infobar or whether `--silent-debugger-extension-api` still works in current stable (only third-party/vendor sources).
- Did not verify current CSP-bypass guarantees of `Runtime.evaluate` against pages with Trusted Types enforcement.
- Restricted pages: I did not fetch the official list; widely known that `chrome://`, `chrome-extension://` (other extensions), and the Chrome Web Store (`chromewebstore.google.com`) cannot be scripted or attached by extensions — treat as training knowledge.

## 2. chrome.scripting.executeScript: worlds, frames, CSP, Trusted Types

### Takeaway
Use `chrome.scripting.executeScript` with `func` (serialized, no closures) in the ISOLATED world for DOM reading and ref tagging; use `world:'MAIN'` only when you must touch page JS objects, accepting the page's CSP/Trusted Types. Arbitrary model-written JS belongs in `chrome.userScripts.execute` (USER_SCRIPT world) or CDP `Runtime.evaluate`, not string-eval in `executeScript`.

### Cited Findings
- `ExecutionWorld` ISOLATED (extension-unique) vs MAIN (shared with page JS), Chrome 95+; default ISOLATED. Target: `tabId` (required), `allFrames` (default false, exclusive with `frameIds`), `frameIds`, `documentIds` (Chrome 106+, exclusive with `frameIds`). `injectImmediately` (102+) does not guarantee pre-load. `func` is serialized/deserialized so closures and bound params are lost; `args` must be JSON-serializable. `InjectionResult` has `frameId`, `documentId`, `result`; main frame is index 0, other frames in non-deterministic order; returned promises are awaited. `executeScript` accepts only files or functions, not strings. — [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- The isolated world cannot `eval()`; string eval only works in `USER_SCRIPT` or `MAIN` world, and MAIN world inherits the page CSP so it fails on sites that block `unsafe-eval` or require Trusted Types. Chromium DevRel points to `chrome.userScripts` as the intended route for runtime-supplied code; `chrome.userScripts.execute(injection)` injects into a target; USER_SCRIPT world CSP is set by `chrome.userScripts.configureWorld()`; users must enable an "Allow User Scripts" toggle per extension. — [chromium-extensions thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/W2J8_81NzkM); [userScripts API](https://developer.chrome.com/docs/extensions/reference/api/userScripts?authuser=3)

### Inferences
- Cross-origin iframes: `allFrames:true` reaches them only if you hold host permission for each frame's origin (`<all_urls>` solves this); the returned `frameId`s let you route later actions, and coordinates from a child frame must be offset by the iframe's `getBoundingClientRect()` in the parent to map to top-level viewport coordinates for CDP input. With CDP, OOPIFs require auto-attach child sessions (§1).
- Inject a single bundled unlisted script (WXT `defineUnlistedScript`, injected via `files:['/snapshot.js']`) rather than large `func` bodies, so helpers survive and can install a persistent ref registry on `window` of the isolated world (the isolated world's globals persist across injections for the same document).
- Trusted Types sites (Google properties etc.) break `innerHTML` writes from MAIN world; the ISOLATED world is not subject to the page's Trusted Types policy for DOM it creates in practice (training knowledge; verify).

### Gaps
- No primary source fetched confirming the Trusted Types behavior in ISOLATED vs MAIN worlds or whether `userScripts` eval is permitted on Trusted-Types pages.

## 3. Element reference system (refs, AX-like snapshot, visibility, coordinates, DPR)

### Takeaway
Proven pattern (Claude in Chrome / open clones, browser-use, nanobrowser): inject a script that walks the DOM (piercing open shadow roots and same-origin iframes), keeps only visible/interactive or semantically meaningful nodes, assigns short ref IDs held in a WeakRef/WeakMap registry, and emits an indented accessibility-tree-like text snapshot; actions then take a ref, which is resolved, scrolled into view, and converted to viewport CSS pixels.

### Cited Findings
- Open Claude in Chrome (clean-room reimplementation) exposes `read_page` ("accessibility tree with element refs"), `find`, `get_page_text`, `form_input` (sets values by ref), `file_upload` (by ref), and a `computer` tool for mouse/keyboard/screenshot/zoom. — [open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)
- Claude processes images in 28x28 patches: cost = `ceil(w/28) * ceil(h/28)` visual tokens. High-res tier (Claude 4.7 and later): max long edge 2,576 px / 4,784 tokens; standard tier: 1,568 px / 1,568 tokens. Examples: 1920x1080 -> standard downsized to 1456x819 (~1,560 tokens), high-res not resized (2,691 tokens); 1000x1000 = 1,296 tokens. Images over limits are downscaled preserving aspect ratio, **except** screenshots returned to the computer-use/browser-use tool results, which are rejected with a validation error, so resize client-side. `"oversized_image":"error"` makes other images error instead of resizing. — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Claude returns pixel coordinates relative to the image it processed after resizing; see the vision-coordinates guide for pre-resizing/rescaling. — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- CDP mouse coordinates are CSS pixels relative to the main-frame viewport. — [CDP Input.pdl](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Input.pdl)

### Inferences
- Note: the old "tokens ≈ w*h/750" rule of thumb is superseded by the 28x28-patch formula in current docs (w*h/784, essentially the same magnitude); use the current formula.
- Coordinate mapping: `captureVisibleTab` / `Page.captureScreenshot` return **device pixels** (CSS px x `devicePixelRatio`, times zoom). Pipeline: capture -> downscale to a target that fits the model tier (e.g. long edge <= 1,568 or 1,280 for cost) -> remember `scale = cssViewportWidth / sentImageWidth` -> model returns (x,y) in sent-image space -> multiply by scale to get CSS px -> `Input.dispatchMouseEvent`. Alternatively capture with `Page.captureScreenshot({clip:{x:0,y:0,width:innerWidth,height:innerHeight,scale:1/dpr}})` to get CSS-pixel-sized images directly (training knowledge).
- Ref registry sketch (isolated world):
  ```ts
  const refs = (window.__agentRefs ??= { byId: new Map<string, WeakRef<Element>>(), ids: new WeakMap<Element,string>(), n: 0 });
  function refFor(el: Element) { let id = refs.ids.get(el); if (!id) { id = `e${++refs.n}`; refs.ids.set(el, id); refs.byId.set(id, new WeakRef(el)); } return id; }
  ```
  WeakMap keeps IDs stable across snapshots for the same node without DOM mutation (data attributes are visible to the page and can be stripped/re-rendered by frameworks; keep them only as an optional debugging aid). Invalidate on navigation (new document = new isolated world).
- Visibility filter: `checkVisibility({checkOpacity:true, checkVisibilityCSS:true})`, non-zero `getBoundingClientRect()`, intersect with viewport (+ an expansion margin, as nanobrowser/browser-use do with `viewportExpansion`), and an occlusion test via `document.elementFromPoint(cx,cy)` being the element or its descendant. Interactive = native controls, `[role=button|link|checkbox|tab|menuitem|option|switch]`, `[contenteditable]`, `[tabindex>=0]`, elements with `cursor:pointer`, `onclick`.
- Before acting: `el.scrollIntoView({block:'center', inline:'center', behavior:'instant'})`, re-read rect, then click centre; if `elementFromPoint` at centre is not the element, fall back to `el.click()` / dispatch or report "obscured".
- `form_input`-style setting for React-controlled inputs must use the native value setter + `input`/`change` events (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true}))`); synthetic events have `isTrusted:false`, which some sites reject, hence the CDP escalation path.

### Gaps
- nanobrowser `buildDomTree.js` and browser-use DOM serializer sources could not be fetched (404/504); their exact heuristics are not cited here.
- No primary source on how Anthropic's Claude in Chrome generates refs internally.

## 4. MV3 service-worker lifetime and where to run the agent loop

### Takeaway
The SW dies after 30s idle, 5 min for a single event/API call, or a fetch whose response takes >30s to start; modern Chrome extends lifetime for extension API calls (110+), port messages (114+), WebSockets (116+), native messaging ports (105+) and **active debugger sessions (118+)**. Running the agent loop and LLM streaming in the side panel page (a full extension document) avoids most of this; the SW becomes a thin privileged executor/router.

### Cited Findings
- Termination: 30s inactivity; single event/API call >5 min; `fetch()` response not arriving within 30s. Events and extension API calls reset timers. — [SW lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Version-gated keepalives: Chrome 105 `runtime.connectNative()` keeps SW alive (reconnect in `onDisconnect`); 109 messages from an offscreen document reset timers; 110 any extension API call resets timers; 114 sending a message over a long-lived port keeps it alive but merely opening a port no longer does; 116 active WebSocket connections extend lifetime (messages reset idle timer); 118 active `chrome.debugger` sessions keep the SW alive; 120 alarms min period 30s. — [SW lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Guidance: design for termination at any time, don't rely on globals, persist state in `chrome.storage` (local/session/managed/sync), IndexedDB or CacheStorage; Web Storage (localStorage) not available in SW. — [SW lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Offscreen: reasons enum (TESTING, AUDIO_PLAYBACK, IFRAME_SCRIPTING, DOM_SCRAPING, BLOBS, DOM_PARSER, USER_MEDIA, DISPLAY_MEDIA, WEB_RTC, CLIPBOARD, LOCAL_STORAGE, WORKERS, BATTERY_STATUS, MATCH_MEDIA, GEOLOCATION); only one offscreen doc at a time; only `runtime` API available; AUDIO_PLAYBACK closes after 30s without audio, others have no lifetime limit; `chrome.offscreen.hasDocument()` (Chrome 150+) or `runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})` (116+). — [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- Side panel: `sidePanel.open()` only in response to a user gesture, requires `tabId` and/or `windowId`; `setPanelBehavior({openPanelOnActionClick:true})`; per-tab panels via `setOptions({tabId, path, enabled})` (tab-specific and default panel with same path are separate instances); `onOpened` (141+), `onClosed` (142+), `close()` (141+, behavior change in 145), `getLayout()` (140+). — [sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

### Inferences
- Recommended placement: run the LLM call + tool loop in the **side panel** (has DOM, `fetch` streaming with no 30s-first-byte SW limit, React state, AbortController) and call privileged APIs either directly (side panel pages can call `chrome.tabs`, `chrome.scripting`, `chrome.debugger` themselves) or via SW messages. Trade-off: closing the panel kills the loop; use `sidePanel.onClosed` + persisted run state (`chrome.storage.session` for transient, IndexedDB for transcripts) to mark runs interrupted and allow resume.
- If the loop must survive the panel closing (or be driven by external agents), host it in the SW and rely on the 118+ rule that an attached debugger keeps the SW alive, plus a native-messaging/WebSocket connection; or put it in an offscreen document (justify with e.g. `WORKERS`/`DOM_PARSER` — note reviewers may question a reason that does not match actual use).
- Streaming from SW is risky because a provider that takes >30s to send headers trips the fetch rule; streaming from the panel avoids it.
- Debugger event listeners and CDP session maps live in whichever context called `attach`; keep all CDP traffic in one context (SW is safest for multi-panel/multi-window).

### Gaps
- No primary-source benchmark of side-panel vs SW agent loop reliability.

## 5. Tab management, navigation waits, new tabs/popups, downloads, uploads, dialogs

### Takeaway
Scope the agent to its own tab group, track tabs via `openerTabId` and `tabs.onCreated`, wait for navigation using `webNavigation.onCompleted`/`onCommitted` plus a CDP `networkIdle`-style lifecycle or a DOM-quiet heuristic, and handle dialogs and file inputs via CDP.

### Cited Findings
- `Tab.openerTabId` is present only while the opener exists; `tabs.create`/`update` with `openerTabId` require the same window; in `onCreated`, URL and group membership may not yet be set, so listen to `onUpdated`. — [chrome.tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- Open Claude in Chrome's `tabs_context_mcp` tool returns "tab group context", i.e., the agent works inside a dedicated tab group; it also has `tabs_create_mcp`, `tabs_close_mcp`, `set_tab_focus`, `navigate`, `resize_window`. — [open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)

### Inferences
- Tab group scoping (training knowledge): `const gid = await chrome.tabs.group({tabIds:[tab.id]}); await chrome.tabGroups.update(gid,{title:'Agent', color:'orange'})`; on `tabs.onCreated` with `openerTabId` in the agent's set, add the new tab to the group (popups/`target=_blank` from agent clicks). Refuse actions on tabs outside the group unless the user grants them.
- Navigation wait recipe: after an action, race (a) `webNavigation.onCompleted` for frameId 0 of the tab, (b) CDP `Page.lifecycleEvent` `networkAlmostIdle`/`networkIdle`, (c) a 500 ms-quiet MutationObserver in the page, with an overall timeout (~10-15s) so SPAs that never go idle don't hang the agent. Also detect `webNavigation.onHistoryStateUpdated` for SPA route changes and invalidate refs.
- Downloads: `chrome.downloads` (permission `downloads`) `onCreated`/`onChanged` to report files; CDP Browser.setDownloadBehavior is not available to extensions (Browser domain absent, §1).
- Uploads: `DOM.setFileInputFiles` needs real local paths; without a native host, construct `File` objects in-page and assign via `DataTransfer` (`input.files = dt.files` + `change` event) — works on most sites.
- Dialogs: enable `Page` on attach and auto-handle `Page.javascriptDialogOpening` (report text to model, `Page.handleJavaScriptDialog`), and `beforeunload` dialogs; otherwise the tab is blocked.

### Gaps
- Did not fetch webNavigation or tabGroups reference pages this session.

## 6. Exposing the extension to external agents/CLIs (native messaging, MCP, WebSocket relays)

### Takeaway
Two proven bridges: (a) native messaging host <-> local MCP server (Claude Code + Claude in Chrome style), and (b) a localhost WebSocket relay that the extension dials into and that speaks CDP or a custom protocol to the MCP server (Playwright MCP Bridge, Playwriter, BrowserMCP style). Both keep the SW alive (105+/116+) while connected.

### Cited Findings
- Claude Code installs a native messaging host config on first enable; Chrome reads it at startup so a restart may be required; requires Claude in Chrome extension >= 1.0.36 and Claude Code >= 2.0.73 (secondary source). — [horadecodar guide](https://horadecodar.com.br/extensao-claude-code-chrome/)
- Windows bug: Claude Desktop and Claude Code both register native hosts for the same extension ID; when one host's exe is missing the extension doesn't fall through to the other. — [Claude issue #24507](https://claudeissues.com/issue/24507-bug-chrome-extension-native-messaging-host-conflict-claude-desktop-claude-code-o)
- Open Claude in Chrome chain: Claude Code -> stdio MCP `mcp-server.js` -> TCP (or named pipe/unix socket) -> `native-host.js` -> native messaging -> MV3 extension doing CDP automation; supports multiple sessions with a primary owning the rendezvous. (Its README is internally inconsistent about transport.) — [open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)
- Playwright MCP relay (`cdpRelay.ts`): a WebSocket server with `/cdp/<guid>` for the Playwright CDP client and `/extension/<guid>` for the extension forwarding `chrome.debugger`; the extension's connect page receives the relay URL as a parameter; a second Playwright client is rejected. — [cdpRelay.ts mirror](https://glama.ai/mcp/servers/@maywzh/playwright-mcp/blob/4890b9d509ede4dd662b7f0c4f3718cec207081e/src/extension/cdpRelay.ts)
- Playwriter: extension dials a local relay on `localhost:19988` (MCP spawns the WS server if nothing listens; extension retries in a loop); `/cdp/<client-id>` for Playwright clients and `/extension` for the extension; the wire protocol must stay backward compatible because store releases lag. — [Playwriter notes](https://tomevault.io/tome/remorses/playwriter); [Playwriter on CWS](https://chromewebstore.google.com/detail/jfeammnjpkecdekppnclgkkffahnhfhe)

### Inferences
- WebSocket relay is simpler to ship (no per-OS host registry install) but any local process can connect; mitigate with a token handshake and checking `Origin: chrome-extension://<id>` on the server. Native messaging gives OS-level caller identity (only registered host binary, `allowed_origins` restricted to your extension ID) but needs installer steps per OS (HKCU registry key on Windows) and a Chrome restart.
- Exposing a raw CDP relay (Playwright-compatible) gives external tools full power; exposing your own high-level tool protocol (refs, snapshots) keeps permissions/confirmation gates enforceable in the extension.

### Gaps
- BrowserMCP repo and the Playwright MCP extension README could not be fetched (504/404); BrowserMCP specifics not cited.

## 7. Manifest permissions and Chrome Web Store implications

### Takeaway
A full-control agent needs `debugger`, `tabs`, `tabGroups`, `scripting`, `sidePanel`, `webNavigation`, `storage`, optionally `offscreen`, `nativeMessaging`, `downloads`, `userScripts`, plus `host_permissions: ["<all_urls>"]`. `debugger` cannot be optional and triggers heavy review.

### Cited Findings
- Chrome does not allow `debugger` as an optional permission; the Web Store dropped an optional entry with a warning. — [OpenCLI PR #415](https://github.com/jackwener/OpenCLI/pull/415)
- `debugger` is described by submitters as one of the strictest-reviewed permissions; reviews can take extra rounds (days to weeks); justifications that worked state local-only, user-initiated use and list concrete CDP actions (input dispatch, screenshots, console/network logs). Anecdotal. — [chrome-use submission guide](https://gitea.oimcloud.myaddr.tools/oimwiodev/chrome-use/raw/commit/14ffd304175eeb4e2bbaeba983c9b157b0bb12ec/extensions/store/SUBMISSION.html); [Adom permission justifications](https://wiki.adom.inc/adom/nb-bridge/files/store/PERMISSION-JUSTIFICATIONS.md)
- `captureVisibleTab` needs `<all_urls>` or `activeTab`. — [chrome.tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)

### Inferences
- WXT config sketch:
  ```ts
  // wxt.config.ts
  export default defineConfig({
    manifest: {
      minimum_chrome_version: '118', // debugger keeps SW alive; flat sessions need 125
      permissions: ['sidePanel','tabs','tabGroups','scripting','debugger','webNavigation','storage','offscreen','downloads'],
      optional_permissions: ['nativeMessaging','userScripts'],
      host_permissions: ['<all_urls>'],
      side_panel: { default_path: 'sidepanel.html' }, // WXT generates from entrypoints/sidepanel/
    },
  });
  ```
- Consider shipping a "lite" build without `debugger` (content-script control only) for the store and a full build, or accept the review cost.

### Gaps
- No official CWS policy text on `debugger` found; only anecdotal guides.

## 8. Integrating tool use with chat (AI SDK / Anthropic SDK), approvals, abort, screenshot cost

### Takeaway
Current AI SDK docs use `stopWhen: isStepCount(n)` (earlier v5 docs: `stepCountIs`), `toolApproval` (replacing deprecated `needsApproval`), per-tool `abortSignal`, `toModelOutput` to return screenshots as image content, and `prepareStep` + `pruneMessages` to trim old tool results/screenshots.

### Cited Findings
- `stopWhen: isStepCount(5)` (also `hasToolCall(...)`, `isLoopFinished()`); conditions evaluated only when the last step contains tool results. — [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- `needsApproval` is deprecated; use `toolApproval: { runCommand: 'user-approval' }`; the call returns `tool-approval-request` parts and you call again after pushing `{type:'tool-approval-response', approvalId, approved}` (approval does not pause execution). — [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- `abortSignal` passed to `generateText`/`streamText` reaches tool `execute(input, { abortSignal })`. — [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- `toModelOutput({output}) => ({type:'content', value:[{type:'file', mediaType:'image/png', data:{type:'data', data: output.data}}]})` returns images to the model (experimental; Anthropic, OpenAI, Gemini 3). — [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- `prepareStep: ({messages}) => ({ messages: pruneMessages({messages, reasoning:'all', toolCalls:'before-last-3-messages', emptyMessages:'remove'}) })`; step callback is `onStepEnd({stepNumber, finishReason, usage})`. — [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- Claude image cost `ceil(w/28)*ceil(h/28)`; >20 images per request imposes a stricter per-image dimension limit (keep each <= 3,000 px or <= 20 image blocks, counting images inside `tool_result` and earlier turns); max 600 images/request, 10 MB per image (5 MB on Bedrock), 128 MB request limit; tool_result screenshots exceeding limits are rejected rather than resized. Example cost: Opus 5.5 at $4/M input, a 1000x1000 image ≈ $5.18 per thousand. — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)

### Inferences
- Context policy: keep only the last 1-3 screenshots as images; replace older ones with a text placeholder ("[screenshot removed; see snapshot @step N]"). This also prevents crossing the 20-image threshold that tightens limits. Prefer text AX snapshots as the default observation and screenshots on demand.
- Use JPEG/WebP at quality ~70 at a CSS-pixel viewport size (e.g. 1280x800 ≈ 46x29 = 1,334 tokens) rather than DPR-2 PNGs (2560x1600 ≈ 4,784-token cap on high-res tier).
- Confirmation gates: classify tools (read-only vs mutating vs sensitive: purchases, form submit on payment/login, sending messages, downloads) and route sensitive ones through `toolApproval`; enforce in the executor too, not just in the prompt.
- Abort: one `AbortController` per run in the side panel; on abort, also cancel pending CDP waits and release pressed mouse buttons/modifier keys (send mouseReleased / keyUp) so the page isn't left in a stuck state.
- Streaming tool progress to UI: tools can be async generators/streams in AI SDK UI; at minimum emit `tool-input-start`/`tool-result` parts from `streamText().toUIMessageStream()` (training knowledge; verify against the installed AI SDK version since API names changed between v5 and current).

### Gaps
- Did not fetch Anthropic SDK `toolRunner`/browser-use tool docs this session; the vision page mentions a server "browser use" toolset whose coordinate rules apply, worth reading at platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool.

## 9. WXT specifics

### Takeaway
WXT entrypoints map directly onto this architecture: `entrypoints/background.ts` (SW executor/router), `entrypoints/sidepanel/` (chat + agent loop), `entrypoints/*.content.ts` (optional always-on helpers), `entrypoints/*.ts` with `defineUnlistedScript` (injected on demand via `scripting.executeScript({files})`), and typed messaging via a wrapper library.

### Cited Findings
- WXT's messaging guide lists `@webext-core/messaging` ("Light weight, type-safe wrapper around the web extension messaging APIs"), `webext-bridge` ("Messaging in WebExtensions made super easy. Out of the box."), `trpc-chrome` (tRPC adapter) and `Comctx` (cross-context RPC with adapters). — [WXT messaging](https://wxt.dev/guide/essentials/messaging)

### Inferences
- `@webext-core/messaging` pattern (training knowledge): `export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()`, with `sendMessage('click', {tabId, ref}, tabId)` to content scripts. Long-running streams (LLM tokens, CDP events) are better on `chrome.runtime.connect` ports than request/response messaging.
- Unlisted script for snapshots: `entrypoints/snapshot.ts` -> `export default defineUnlistedScript(() => {...})`, injected with `browser.scripting.executeScript({target:{tabId, allFrames:true}, files:['/snapshot.js']})`; it must be listed in `web_accessible_resources` only if loaded via `<script src>` in MAIN world, not for `scripting` injection.
- Handle "Extension context invalidated" in content scripts after extension reload during dev (`ctx.isInvalid`, `ctx.onInvalidated` in WXT's `ContentScriptContext`).

### Gaps
- WXT entrypoint and unlisted-script docs not re-fetched this session; snippets above come from training knowledge.
