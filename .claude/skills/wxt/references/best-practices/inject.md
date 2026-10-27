# Content script injection

### inject-use-main-function: CRITICAL
WXT imports every entrypoint in Node at build time. Any `browser.*`, DOM, or side-effectful code at module top level breaks the build (`Browser.xyz not implemented`, `document is not defined`). Put runtime code in `main()`. Pure functions and constants may stay at top level (and may be used in options like `matches`).

### inject-use-ctx: CRITICAL
After an extension reload/update, old content scripts keep running and their `browser.*` calls throw `Extension context invalidated`. Use the `ctx` helpers (`ctx.setInterval`, `ctx.setTimeout`, `ctx.addEventListener`, `ctx.requestAnimationFrame`, `ctx.signal`) so work stops automatically; check `ctx.isValid` / `ctx.isInvalid` (there is no `ctx.isInvalidated`); register cleanup with `ctx.onInvalidated(cb)`. UIs created with `create*Ui(ctx, …)` are removed automatically on invalidation.
```ts
// ❌ setInterval(async () => update(await browser.runtime.sendMessage({ type: 'PING' })), 5000);
// ✅
ctx.setInterval(async () => {
  try { update(await browser.runtime.sendMessage({ type: 'PING' })); }
  catch (e) { if (String(e).includes('Extension context invalidated')) showReloadHint(); else throw e; }
}, 5000);
ctx.onInvalidated(() => showReloadHint());   // e.g. a small "Extension updated, refresh the page" banner
```
On install/update you can also re-inject into open tabs from the background (`scripting.executeScript` per matching tab) so users don't need to refresh.

### inject-choose-world: CRITICAL
The isolated world (default) has extension APIs but can't see page JS variables; the main world sees `window.*` of the page but has no extension APIs. To read page state, hook `fetch`/XHR, or patch prototypes: use `injectScript('/x.js')` + `defineUnlistedScript` (works on MV2/MV3 and all browsers) and relay over CustomEvents or `@webext-core/messaging/page`. `world: 'MAIN'` is Chromium MV3 / Firefox 128+ only. Treat everything coming from the main world as untrusted (the page can forge it).

### inject-run-at-timing: HIGH
| `runAt` | Runs | Use for |
|---|---|---|
| `document_start` | before the page's DOM and scripts | intercepting globals/requests (with main-world injection), hiding content before paint (CSS) |
| `document_end` | DOM parsed, subresources still loading | DOM edits that must happen early |
| `document_idle` (default) | after load or when idle | most enhancements; least impact on page load |
At `document_start`, `document.body` doesn't exist yet; wait for elements (`autoMount`, MutationObserver) instead of querying immediately. MV2 `injectScript` is asynchronous and can miss `document_start`.

### inject-spa-navigation: HIGH
Content scripts run once per full load. On SPAs, match broadly, filter with `MatchPattern`, **handle the initial URL**, then listen to `wxt:locationchange` (which fires at navigation start, via the Navigation API, or polls every 1 s). Make mounting idempotent, and use `ui.autoMount()` for elements that appear later. See `content-scripts.md`.

### inject-dynamic-registration: HIGH
Inject only where/when needed. For user-triggered features use `registration: 'runtime'` + `activeTab` + `scripting.executeScript`. For user-chosen sites use optional host permissions + `scripting.registerContentScripts` on `permissions.onAdded` (unregister on `onRemoved`). **Caveat:** with `registration: 'runtime'`, WXT copies the entrypoint's `matches` into `host_permissions`, so `matches: ['*://*/*']` silently requests all-sites access at install. Keep `matches` empty/narrow and pass origins at registration time instead; verify with `inspect-manifest.mjs`.
```ts
browser.permissions.onAdded.addListener(async ({ origins }) => {
  if (!origins?.length) return;
  await browser.scripting.registerContentScripts([{ id: 'enhancer', matches: origins, js: ['content-scripts/enhancer.js'], persistAcrossSessions: true }]);
});
```
`registerContentScripts` throws if the id already exists. Use `getRegisteredContentScripts` / `updateContentScripts`.

### inject-all-frames: MEDIUM
`allFrames: false` (default) is top-frame only. `allFrames: true` runs a full copy per frame (ads and embeds multiply the cost). Enable it only when you need iframe content, guard UI with `if (window !== window.top) return;` where appropriate, and use `matchAboutBlank`/`matchOriginAsFallback` for `about:blank`/`blob:` frames.

### inject-narrow-matches: HIGH
Use the narrowest `matches` (and `excludeMatches`/globs) possible. Every matched page pays the script's parse/execute cost, and broad matches mean broad permission warnings.

### inject-observe-efficiently: MEDIUM
When watching a busy page: observe the smallest subtree, use `childList` without `subtree: true` if possible, batch work per frame (`ctx.requestAnimationFrame`) or debounce, and disconnect observers on removal/invalidation. Prefer `ui.autoMount()` over hand-written observers for anchor-based UIs.
