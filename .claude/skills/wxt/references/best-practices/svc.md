# Service worker / background lifecycle

### svc-register-listeners-synchronously: CRITICAL
Register every event listener synchronously at the top of `defineBackground`'s `main()` (which must not be `async`). A listener added after an `await` is missing when the MV3 worker restarts for that event, so the event is silently dropped.
```ts
// ❌
export default defineBackground(async () => {
  const config = await loadConfig();
  browser.runtime.onMessage.addListener(handler);
});
// ✅ register first, do async work inside the handler
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    loadConfig().then((config) => handle(msg, config)).then(sendResponse);
    return true;
  });
});
```
Exception: listeners intentionally enabled only after a user action/setting (then re-register them on every startup based on stored state).

### svc-avoid-global-state: CRITICAL
The MV3 service worker is terminated after ~30 s idle (Firefox MV3 event pages are suspended too). Module-level variables reset on restart. Persist state: `session:` for ephemeral state (cleared on browser restart, in memory), `local:` for durable state.
```ts
// ❌ let tabCounts: Record<number, number> = {};
// ✅
const tabCounts = storage.defineItem<Record<number, number>>('session:tabCounts', { fallback: {} });
browser.tabs.onUpdated.addListener(async (tabId) => {
  const counts = await tabCounts.getValue();
  await tabCounts.setValue({ ...counts, [tabId]: (counts[tabId] ?? 0) + 1 });
});
```
Note the read-modify-write race when events fire rapidly. Serialize updates through a small promise queue if counts must be exact. In-memory caches are fine *as caches* (re-derive them from storage when empty).

### svc-handle-install-update: HIGH
Use `runtime.onInstalled` (`reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update'`, `previousVersion`) for one-time setup: onboarding tab, context menus, alarms, DNR dynamic rules, data cleanup. Prefer `storage.defineItem({ fallback })` over "initialize defaults on install" so reads never return `null`, even if install logic failed or storage was cleared. Use defineItem `version` + `migrations` for schema changes instead of hand-written update branches.
```ts
browser.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  if (reason === 'install') browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
  if (reason === 'install' || reason === 'update') browser.contextMenus.create({ id: 'x', title: 'X', contexts: ['selection'] });
});
```
Context menus persist across restarts but are created again on update. Use stable ids, and call `contextMenus.removeAll()` first if titles change.

### svc-no-keepalive-hacks: HIGH
Design work to survive termination instead of fighting it. Facts (Chromium): each extension event and extension-API call resets the 30 s idle timer; messages over a long-lived port reset it (Chrome 114+), while an idle open port alone does not; active WebSocket traffic extends it (Chrome 116+); one request/response taking longer than 5 min can still be killed. Options in order of preference:
1. Split long work into chunks and checkpoint progress in `storage.session`/`local`; resume on the next event.
2. `browser.alarms` for periodic or resumable work (Chrome's minimum period is 30 s; shorter values are clamped).
3. An **offscreen document** (Chromium) or an extension page/tab for long DOM, streaming, or audio work; it isn't subject to the worker idle timer.
4. A port that **actively exchanges messages** while a UI is open (e.g. streaming progress to the side panel) is legitimate. Pinging a port or alarm every ~20 s purely to stay alive is a hack: fragile, battery-unfriendly, and can trip store review.

### svc-offscreen-documents: HIGH (Chromium)
The service worker has no `document`/`DOMParser`/`navigator.clipboard`/`Audio`. Use an offscreen document (an unlisted page `entrypoints/offscreen.html` + the `offscreen` permission). Only one can exist at a time, so check before creating, and talk to it via `runtime` messages (it only has `runtime` access).
```ts
async function ensureOffscreen() {
  const existing = await browser.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing?.length) return;
  await browser.offscreen.createDocument({ url: '/offscreen.html', reasons: ['DOM_PARSER'], justification: 'Parse fetched HTML' });
}
```
Firefox has no `offscreen` API; its MV3 background is an event page *with* DOM, so feature-detect `browser.offscreen` and parse directly there. If the offscreen document's listener and the background both listen to `runtime.onMessage`, filter by a `target: 'offscreen'` field so each ignores the other's messages.

### svc-declarative-net-request: HIGH
To block/redirect/modify requests, use `declarativeNetRequest`: rules run in the browser's network stack, work while the worker sleeps, and are the only blocking option in Chromium MV3. Put static rules in `public/rules/*.json` + `manifest.declarative_net_request.rule_resources`; dynamic ones via `updateDynamicRules` (from `onInstalled`/settings changes). Blocking `webRequest` remains available on Firefox only.

### svc-alarms-not-timers: HIGH
`setTimeout`/`setInterval` in the worker die with it. Use `browser.alarms.create(name, { periodInMinutes })` + `alarms.onAlarm`. Create alarms idempotently at startup/install (check `alarms.get(name)`).

### svc-no-dynamic-import-in-sw: MEDIUM
Service workers can't use dynamic `import()`. WXT bundles the background as a single IIFE by default; `defineBackground({ type: 'module' })` gives an ESM worker with static imports and code shared with pages (MV3 only).
