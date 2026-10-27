# Extension platform knowledge (APIs WXT doesn't wrap)

WXT doesn't change how extension APIs work. For any API detail not covered here, read the source of truth:
- Chrome: `https://developer.chrome.com/docs/extensions/reference/api/<name>` (e.g. `/sidePanel`, `/offscreen`)
- Firefox/MDN: `https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/<name>`
- Types available in the project: `node_modules/@types/chrome/index.d.ts` (that's what `Browser.*` is based on)

## Execution contexts

| Context | DOM | Extension APIs | Lifetime | Typical code |
|---|---|---|---|---|
| Background (MV3 service worker) | ❌ | all | killed after ~30 s idle; wakes on events | event listeners, fetch, alarms, orchestration |
| Background (Firefox MV3 event page / MV2) | ✅ | all | event page: suspended when idle; MV2 persistent: always | same |
| Extension pages (popup, options, side panel, unlisted, offscreen) | ✅ | all (offscreen: `runtime` only) | while open | UI |
| Content script (isolated world) | page DOM | `runtime`, `storage`, `i18n`, (`dom`) only; other APIs via messages to the background | page lifetime | read/modify pages, inject UI |
| Main world script | page DOM + page JS | none | page lifetime | hook page variables/functions |

## MV3 service worker rules (most common source of bugs)

- **Register every listener synchronously at the top of `defineBackground`'s `main()`.** Listeners registered after an `await` or inside a promise are missed when the worker wakes for that event.
- **Global variables reset** whenever the worker restarts. Persist anything important in `storage.session` (in-memory, survives restarts within a browser session) or `storage.local`.
- `setTimeout`/`setInterval` don't survive termination: use `browser.alarms` (permission `alarms`; ≥30 s period in current Chrome).
- No `window`, `document`, `DOMParser`, `localStorage`, `XMLHttpRequest`, `Audio`, or `navigator.clipboard`. Use `fetch`, or an **offscreen document** for DOM/audio/clipboard.
- Things that keep it alive: incoming events/messages, extension API calls, an active WebSocket with traffic (Chrome 116+), an open `runtime.connect` port, debugger sessions. Don't build "keepalive" hacks: store state and resume.
- Dynamic `import()` is not allowed in service workers. WXT bundles the background into one IIFE file by default; `defineBackground({ type: 'module' })` switches to an ESM worker (static imports + code-splitting with pages, MV3 only).

## Messaging (vanilla)

```ts
// content script / popup → background
const reply = await browser.runtime.sendMessage({ type: 'getUser', id: 1 });

// background → a specific tab's content script (optionally a frame)
await browser.tabs.sendMessage(tabId, { type: 'highlight' }, { frameId: 0 });

// receiving side (background or content script)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'getUser') return;              // return undefined: not handled here
  getUser(message.id).then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
  return true;                                          // REQUIRED for async sendResponse
});
```
- `sendMessage` rejects with "Could not establish connection. Receiving end does not exist." when no listener exists: no content script injected yet (tab opened before install/reload, restricted page, or the script isn't matched), or the popup is closed.
- Content scripts can't message each other or other tabs directly; route through the background.
- Streams/progress: `const port = browser.runtime.connect({ name: 'chat' })` ↔ `browser.runtime.onConnect.addListener(port => port.onMessage.addListener(...))`. Handle `port.onDisconnect` (the service worker or the page can go away).
- Web page ↔ extension: either `externally_connectable: { matches: ['https://app.example.com/*'] }` + `chrome.runtime.sendMessage(EXT_ID, msg)` from the page (Chromium) with `runtime.onMessageExternal` in the background, or a content script bridge using `window.postMessage`/CustomEvents (all browsers). Validate `sender.origin`/`sender.url`.
- Native app: `browser.runtime.connectNative('com.example.host')` + permission `nativeMessaging` + a host manifest installed on the OS.

## Permissions cheat sheet

| Need | Permission(s) | Install warning? |
|---|---|---|
| storage (any area) | `storage` (`unlimitedStorage` to lift the quota) | no |
| current tab after a user click (inject, screenshot, read URL) | `activeTab` | no |
| tab URLs/titles of all tabs | `tabs` | yes ("browsing history") |
| inject scripts/CSS programmatically | `scripting` + host access (`activeTab` or host perms) | via host perms |
| always run on sites | `host_permissions` / content script `matches` | yes ("read and change data on…") |
| right-click menu | `contextMenus` (Firefox also `menus`) | no |
| periodic tasks | `alarms` | no |
| notifications | `notifications` | yes (some browsers) |
| side panel (Chromium) | `sidePanel` (WXT adds it) | no |
| offscreen document (Chromium) | `offscreen` | no |
| block/modify requests | `declarativeNetRequest` (+ `declarativeNetRequestWithHostAccess` / `…Feedback`) | yes |
| observe requests | `webRequest` + host perms | yes |
| cookies | `cookies` + host perms | yes |
| downloads | `downloads` | yes |
| OAuth | `identity` | no |
| history / bookmarks | `history` / `bookmarks` | yes |
| clipboard write from a page | `clipboardWrite` (often not needed with a user gesture) | no |
| site favicons (Chromium) | `favicon` | no |
| idle state | `idle` | no |
| native app | `nativeMessaging` | yes |
| debugger/CDP | `debugger` | yes (strong) |

Optional at runtime: list them under `optional_permissions` / `optional_host_permissions`, then `await browser.permissions.request({ permissions: ['tabs'], origins: ['https://*.example.com/*'] })`. It must be called **synchronously within a user gesture** (no `await` before it in the click handler). Listen with `browser.permissions.onAdded`.

## Frequently used API recipes

**Context menu (create once):**
```ts
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({ id: 'lookup', title: 'Look up "%s"', contexts: ['selection'] });
});
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lookup') {/* info.selectionText */}
});
```
**Keyboard shortcut:** `manifest.commands: { 'toggle-ui': { suggested_key: { default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y' }, description: 'Toggle' } }` + `browser.commands.onCommand.addListener((cmd, tab) => …)`. The special `_execute_action` opens the popup. Note that WXT dev mode adds `wxt:reload-extension` (Alt+R) itself, and Chrome allows at most 4 suggested keys.
**Badge:** `browser.action.setBadgeText({ text: '3', tabId })`, `setBadgeBackgroundColor({ color: '#d00' })`.
**Alarms:** `browser.alarms.create('sync', { periodInMinutes: 15 })` + `browser.alarms.onAlarm.addListener(a => a.name === 'sync' && sync())`. Create it in `onInstalled`/startup (alarms persist, but may be cleared on browser restart in some browsers, so re-create it idempotently).
**Screenshot of the visible tab:** `browser.tabs.captureVisibleTab(windowId, { format: 'png' })` (needs `activeTab` or `<all_urls>`).
**Open the options page:** `browser.runtime.openOptionsPage()`.
**Uninstall survey:** `browser.runtime.setUninstallURL('https://example.com/bye')`.
**Detect install/update:** `runtime.onInstalled` → `reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update'`, `previousVersion`.
**DNR static rules:** put `rules.json` in `public/`, then `manifest.declarative_net_request: { rule_resources: [{ id: 'ruleset_1', enabled: true, path: 'rules.json' }] }`. Dynamic: `browser.declarativeNetRequest.updateDynamicRules({ addRules, removeRuleIds })`.
**OAuth (cross-browser):**
```ts
const redirectUri = browser.identity.getRedirectURL();   // https://<id>.chromiumapp.org/ or https://<id>.extensions.allizom.org/
const url = `https://auth.example.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;
const result = await browser.identity.launchWebAuthFlow({ url, interactive: true });
const params = new URL(result!).searchParams;
if (params.get('state') !== state) throw new Error('OAuth state mismatch'); // state = crypto.randomUUID(), sent as &state=
const code = params.get('code');
```
Register `redirectUri` with the provider. On Firefox the ID-based URL needs a fixed `gecko.id`. On Chrome the extension ID must be stable: set the manifest `key` for unpacked dev builds, or use the published ID.

## Security & store-policy rules that shape code

- **No remotely hosted code in MV3**: everything executable ships in the package (no CDN scripts, no `eval`/`new Function`, no fetching JS to run). Fetching *data* (JSON) is fine. WXT 0.21 also removed `url:` imports.
- Treat all data from web pages, content scripts, and `onMessageExternal` as untrusted. Validate sender + message shape in the background before privileged actions, and never expose generic "fetch this URL"/"run this script" handlers. Full rules: `best-practices/security.md`.
- Never render page-provided HTML with `innerHTML` in extension pages. Use text or a sanitizer.
- Ask for the narrowest permissions. Justify every permission in the store listing; unused permissions get rejected.
- Secrets in `.env` (`WXT_*`) end up in the shipped JS. Proxy calls needing secrets through your own server.
- `web_accessible_resources` exposes files to websites (and allows fingerprinting). Expose only what content scripts/pages need, and scope `matches`.

## Restricted pages (scripts never run there)

`chrome://*`, `edge://*`, `about:*`, `chrome-extension://` pages of other extensions, the Chrome Web Store / Edge Add-ons / AMO (addons.mozilla.org) pages, `view-source:`, PDF viewer internals, and `file://` unless the user enables "Allow access to file URLs". Code that calls `tabs.sendMessage`/`executeScript` must handle rejection on these tabs.
