# Entrypoints reference (WXT 0.21)

Full official page: `docs/guide/essentials/entrypoints.md`. Exact option types: `docs/api/reference/wxt/interfaces/*EntrypointOptions.md`.

## Discovery rules (verified against WXT's flat entrypoint finder)

An entrypoint is **a file directly in `entrypoints/`**, or **a folder with an `index.*` file** in it. That's ONE level deep only: `entrypoints/youtube/content/index.ts` is NOT discovered; use `entrypoints/youtube.content/index.ts`.

The first matching pattern wins:

| Pattern (file or `<name>/index.*`) | Type | Manifest effect |
|---|---|---|
| `sandbox.html`, `*.sandbox.html` | sandbox | `sandbox.pages` (Chromium only) |
| `bookmarks.html` | bookmarks | `chrome_url_overrides.bookmarks` |
| `history.html` | history | `chrome_url_overrides.history` |
| `newtab.html` | newtab | `chrome_url_overrides.newtab` |
| `sidepanel.html`, `*.sidepanel.html` | sidepanel | Firefox (any MV): `sidebar_action`. Other browsers MV3: `side_panel.default_path` + `sidePanel` permission. Chromium MV2: skipped with a warning. Only ONE becomes the manifest default (the one named `sidepanel`, else the first); others are reachable via `sidePanel.setOptions({ path })` |
| `devtools.html` | devtools | `devtools_page` |
| `background.[jt]s` | background | `background.service_worker` (MV3 Chromium) / `background.scripts` (MV2, Firefox/Safari MV3) |
| `content.[jt]s(x)`, `*.content.[jt]s(x)` | content-script | `content_scripts[]` |
| `content.css`, `*.content.css` (also scss/sass/less/styl) | content-script-style | CSS-only; add it to the manifest yourself with a hook |
| `popup.html` | popup | `action.default_popup` (MV2: `browser_action`) |
| `options.html` | options | `options_ui` |
| any other `*.html` | unlisted-page | none; reach it with `browser.runtime.getURL('/<name>.html')` |
| any other `*.[jt]s(x)` | unlisted-script | none; output `/<name>.js` |
| any other `*.css` | unlisted-style | none |

Consequences:
- **Never put helper files (App.tsx, utils.ts, style.css) directly in `entrypoints/`**: each becomes an unlisted entrypoint and usually breaks the build. Use a folder: `entrypoints/popup/{index.html, main.tsx, App.tsx, style.css}`.
- Only one popup, options, newtab, devtools, and background are allowed. Multiple content scripts, sidepanels, and sandboxes are fine (`foo.content.ts`, `bar.content.ts`).
- There's no special "offscreen" type: an offscreen document is just an unlisted page (`entrypoints/offscreen.html`).
- The name comes from the file/folder minus the type suffix: `youtube.content.ts` → name `youtube` → output `content-scripts/youtube.js` (+ `.css`).

## JS/TS entrypoints and the "import at build time" rule

WXT imports every JS/TS entrypoint **in Node at build time** to read its options (it strips `main()` and tree-shakes first, polyfilling `window`/`document` with linkedom and `browser` with fake-browser). Therefore:
- Put ALL runtime code (DOM access, `browser.*` calls, listeners, top-level side effects of imported modules) inside `main()`.
- Error `Browser.xyz.addListener not implemented` or `document is not defined` at build time means some code runs at module top level. Move it into `main()`. Debug with `wxt prepare --debug` (it prints the pre-processed code).
- You MAY import constants and use them in options (`matches: [GOOGLE_MATCHES]`) and use `import.meta.glob` in options.

## Background

```ts
// entrypoints/background.ts
export default defineBackground({
  type: 'module',          // optional: ESM service worker (MV3 only) → code-splitting with pages
  persistent: undefined,   // MV2 only (true = persistent background page)
  include: undefined,      // or exclude: ['firefox'], target-browser filter
  main() {
    // MUST be synchronous: no `async main()`. Register listeners synchronously here so the
    // MV3 service worker sees them when it wakes up.
    browser.runtime.onInstalled.addListener(({ reason }) => { /* 'install' | 'update' */ });
    browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      handle(msg).then(sendResponse);
      return true; // keep the channel open for the async reply
    });
  },
});
```
Shorthand: `export default defineBackground(() => { … })`. In dev, WXT injects reload/websocket code into the background (and adds a no-op background if you don't have one).

## Content scripts

```ts
// entrypoints/example.content.ts  (or example.content/index.tsx)
export default defineContentScript({
  matches: ['*://*.example.com/*'],      // required for registration: 'manifest'
  excludeMatches: [], includeGlobs: [], excludeGlobs: [],
  allFrames: false,
  runAt: 'document_idle',                // 'document_start' | 'document_end' | 'document_idle'
  matchAboutBlank: false, matchOriginAsFallback: false,
  world: 'ISOLATED',                     // 'MAIN' = Chromium MV3 / Firefox 128+, no extension APIs
  cssInjectionMode: 'manifest',          // 'manifest' | 'manual' | 'ui' (use 'ui' with createShadowRootUi)
  registration: 'manifest',              // 'runtime' = not in manifest; inject via scripting API
  globalName: false,                     // 0.21 default; set true to get main()'s return value from executeScript
  noScriptStartedPostMessage: undefined, // true = skip the legacy window.postMessage on start
  include: undefined, exclude: undefined,
  async main(ctx) {                      // main CAN be async here
    // ctx: ContentScriptContext (see content-scripts.md)
  },
});
```
Every option except `include`/`exclude`/`globalName`/`noScriptStartedPostMessage` accepts a **per-browser object**: `runAt: { chrome: 'document_start', firefox: 'document_end' }`.

Importing CSS in a content script (`import './style.css'`) bundles it as `content-scripts/<name>.css`. With `cssInjectionMode: 'manifest'` it's listed in the manifest, so it **applies to the whole page**.

## Unlisted scripts (main-world scripts, injected scripts)

```ts
// entrypoints/page-hook.ts → output /page-hook.js
export default defineUnlistedScript(() => {
  // runs wherever you load it (injectScript, scripting.executeScript, <script src>)
});
// options form: defineUnlistedScript({ include, exclude, globalName, main() {} })
```
To load it into a web page, add `'page-hook.js'` to `web_accessible_resources`.

## HTML entrypoints: options via `<meta>` tags

```html
<!-- entrypoints/popup/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Popup title</title>                                  <!-- popup: action.default_title -->
    <meta name="manifest.default_icon" content="{ '16': '/icon/16.png' }" />
    <meta name="manifest.type" content="page_action|browser_action" /> <!-- MV2 only -->
    <meta name="manifest.browser_style" content="true|false" />
    <meta name="manifest.default_area" content="navbar" />      <!-- Firefox -->
    <meta name="manifest.include" content="['chrome', 'firefox']" />
    <meta name="manifest.exclude" content="['safari']" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>          <!-- type="module" is required -->
  </body>
</html>
```
- Options page metas: `manifest.open_in_tab`, `manifest.chrome_style`, `manifest.browser_style`.
- Side panel metas: `manifest.default_icon`, `manifest.open_at_install` (Firefox sidebar), `manifest.browser_style`.
- Custom module options from HTML: `<meta name="wxt.myOption" content="…">`.

## Filtering by browser

- Per entrypoint: `include: ['firefox']` or `exclude: ['chrome']` (JS), or the `manifest.include`/`manifest.exclude` metas (HTML).
- Globally: `filterEntrypoints: ['popup', 'background']` in config, or `wxt -e popup` on the CLI.

## Recipes

**Open a page on install:**
```ts
// background main()
browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
});
```

**Side panel opens on toolbar click (Chromium), sidebar toggle (Firefox):**
```ts
// background main()
if (browser.sidePanel) {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
} else {
  // Firefox: needs manifest browser_action (MV2) / action (MV3) and the sidebarAction API (untyped by default)
  (browser as any).browserAction?.onClicked.addListener(() => (browser as any).sidebarAction.toggle());
}
```
A popup and click-driven behaviors conflict: with a `default_popup`, `action.onClicked` never fires and the toolbar click opens the popup. Decide which one the icon click does (or `exclude` the popup for some browsers), and verify in the target browser. See the `side-panel` example: `node scripts/wxt-docs.mjs example side-panel`.

**Offscreen document (Chromium MV3):**
```ts
// entrypoints/offscreen/index.html + main.ts (unlisted page); permission 'offscreen'
// background:
if (!(await browser.offscreen.hasDocument?.())) {
  await browser.offscreen.createDocument({
    url: '/offscreen.html',
    reasons: ['DOM_PARSER'], // CLIPBOARD, AUDIO_PLAYBACK, BLOBS, USER_MEDIA, WORKERS, ...
    justification: 'Parse HTML returned by the API',
  });
}
```
Only one offscreen document can exist at a time. It only has `runtime` messaging access, so talk to it via messages.

**DevTools panel:** `entrypoints/devtools/` creates the panel with `browser.devtools.panels.create('Name', 'icon.png', 'devtools-panel.html')`, plus `entrypoints/devtools-panel/index.html` (unlisted page). Example: `devtools-extension`.
