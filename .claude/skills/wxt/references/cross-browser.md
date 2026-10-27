# Cross-browser: Chromium, Firefox, Safari (and Edge/Opera)

Official page: `docs/guide/essentials/target-different-browsers.md`. API compatibility tables: MDN "Browser support for JavaScript APIs" (fetch it when unsure: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Browser_support_for_JavaScript_APIs).

## Targets and defaults

```sh
wxt                       # dev, chrome, MV3
wxt -b firefox            # dev, Firefox, **MV2 by default**
wxt -b firefox --mv3      # dev, Firefox MV3
wxt build -b edge         # any string works as a target; non-firefox strings open Chrome in dev
wxt build -b safari       # **MV2 by default**; add --mv3 for MV3
wxt zip -b firefox        # also produces the -sources.zip
```
- The default manifest version is **3 for every browser except `firefox` and `safari` (2)**. This is set in `resolve-config`, so pin it in package.json scripts: `"build:firefox": "wxt build -b firefox --mv3"`.
- Output folders: `.output/chrome-mv3`, `.output/firefox-mv2`, `.output/safari-mv3`, … (`-dev` suffix in dev mode).
- Runtime constants for branching (dead-code eliminated per build): `import.meta.env.BROWSER`, `.CHROME`, `.FIREFOX`, `.SAFARI`, `.EDGE`, `.OPERA`, `.MANIFEST_VERSION`. Set `targetBrowsers: ['chrome','firefox','safari']` to narrow the `BROWSER` type.
- Edge/Opera/Brave/Arc/Vivaldi run the Chrome build (`chrome-mv3` zip is accepted by Edge Add-ons). Build `-b edge`/`-b opera` only if you branch on them.

## Three tools for per-browser differences

1. **Manifest function**: `manifest: ({ browser, manifestVersion }) => ({ … })` for permissions, `browser_specific_settings`, actions.
2. **Entrypoint filters and per-browser options**: `include: ['firefox']` / `exclude: ['safari']` (JS) or `<meta name="manifest.exclude" content="['safari']">` (HTML). Most content script options take `{ chrome: …, firefox: … }`.
3. **Runtime feature detection**: always prefer it for APIs: `browser.sidePanel?.open(...)`, `(browser.action ?? browser.browserAction)`. Types assume every API exists; at runtime a missing API is `undefined`.

## WXT's `browser` object

`import { browser } from 'wxt/browser'` (auto-imported) is `globalThis.browser` when present (Firefox, Safari) or `globalThis.chrome` (Chromium). It's promise-based everywhere in MV3 Chromium and Firefox. **There's no webextension-polyfill since 0.20.** If you need polyfill semantics: `pnpm add webextension-polyfill @wxt-dev/webextension-polyfill` and `modules: ['@wxt-dev/webextension-polyfill']`.

Consequence: in `runtime.onMessage` use `sendResponse` + `return true` for async replies (a returned promise works natively on Firefox, but not reliably through Chromium's `chrome`).

## Chromium (Chrome, Edge, Opera, Brave, Arc)

- Chrome Web Store: MV3 only. Background = **service worker** (no DOM, `window`, `document`, `localStorage`, or `XMLHttpRequest`; use `fetch`, `storage`, an offscreen document).
- Chromium-only APIs: `sidePanel`, `offscreen`, `_favicon`, `tabGroups`, `readingList`, `userScripts` (the user must enable it for the extension), `identity.getAuthToken`, `world: 'MAIN'` (Chrome 111+), sandbox pages.
- Side panel: Chrome 114+. WXT writes `side_panel.default_path` + the `sidePanel` permission. Open it programmatically with `browser.sidePanel.open({ windowId })` (requires a user gesture).
- `declarativeNetRequest` replaces blocking `webRequest`.
- Edge: same as Chrome; publish the Chrome zip to Partner Center (`wxt submit --edge-zip`). Opera: `--opera-*` flags in `wxt submit`.

## Firefox

- **Extension ID is required for MV3** (and for signing / AMO / `storage.sync`, `identity` redirect URLs). WXT warns when it's missing:
  ```ts
  manifest: ({ browser }) => browser === 'firefox' ? {
    browser_specific_settings: {
      gecko: {
        id: 'my-extension@example.com',        // or a {uuid}
        strict_min_version: '128.0',
        data_collection_permissions: { required: ['none'] },  // or e.g. required: ['websiteContent'], optional: ['technicalAndInteraction']
      },
    },
  } : {}
  ```
- **`data_collection_permissions` is required for new AMO submissions since Nov 3, 2025** (Firefox built-in data consent). Values: `required: ['none' | 'locationInfo' | 'browsingActivity' | 'websiteContent' | 'websiteActivity' | 'searchTerms' | 'bookmarksInfo' | 'healthInfo' | 'contactInfo' | 'socialInfo' | …]`, `optional: [… | 'technicalAndInteraction']`. Silence the warning with `suppressWarnings.firefoxDataCollection`.
- MV3 background is an **event page** (`background.scripts`; the DOM is available, but it's non-persistent). WXT emits the right shape per browser.
- MV2 is still fully supported (persistent background via `defineBackground({ persistent: true })`, blocking `webRequest`).
- In MV3, users control host permissions and can revoke them at any time from the add-ons manager (older Firefox versions didn't grant them at install). Check with `browser.permissions.contains({ origins })` and request with `browser.permissions.request` from a user gesture, otherwise content scripts silently don't run on those sites.
- Bookmarks and history overrides are not supported on Firefox: WXT skips them with a warning.
- Sidebar: WXT writes `sidebar_action` for the sidepanel entrypoint. The API is `browser.sidebarAction` (untyped in WXT's chrome-based types; cast it or augment the types).
- `world: 'MAIN'` content scripts: Firefox 128+. `injectScript` works everywhere.
- No `offscreen` API (the event page has DOM), no `_favicon`, no `sidePanel`. `menus` ≈ `contextMenus` (both exist).
- Store: AMO requires a **sources zip** when the code is bundled/minified (`wxt zip -b firefox` makes one; see `publishing.md`). Self-distribution is possible with signing.
- Firefox for Android: run `web-ext run -t firefox-android` against `.output/firefox-mv*` (adb). Many APIs are missing (no sidebar, limited tabs/windows), so feature-detect.

## Safari (macOS / iOS)

- WXT builds the web extension; **Apple requires a native app wrapper** made with Xcode:
  ```sh
  wxt build -b safari            # or: wxt build -b safari --mv3
  xcrun safari-web-extension-packager .output/safari-mv2   # pass the BUILD OUTPUT, not your source
  ```
  Then build/sign/distribute through Xcode / App Store Connect. `wxt submit` doesn't support Safari.
- Needs macOS + Xcode. For local testing, enable Safari → Develop → "Allow Unsigned Extensions" (resets on restart).
- Safari exposes `browser` (promise-based). Gaps to feature-detect: no `sidePanel`/sidebar, no `offscreen`, limited `webRequest` (use DNR), `identity` is limited, some `storage.sync` and `commands` behavior differs, and permissions are granted per-site by the user.
- MV3 needs Safari 15.4+. WXT emits `background.service_worker` for Safari MV3 (only Firefox MV3 gets `background.scripts`). If you need a different shape, rewrite `manifest.background` in a `build:manifestGenerated` hook gated on `wxt.config.browser === 'safari'`. Test on real devices (macOS and iOS behave differently).

## Cross-browser checklist before shipping

1. `node scripts/inspect-manifest.mjs --build chrome,firefox[,safari]` and read the "Differences" section.
2. No Chromium-only API is called unguarded (`sidePanel`, `offscreen`, `_favicon`, `getAuthToken`, `tabGroups`).
3. Firefox: `gecko.id` + `data_collection_permissions` set; host permissions requested at runtime if needed.
4. The same permissions are listed for every store (permission changes on update can disable the extension).
5. `runtime.onMessage` handlers use `sendResponse` + `return true` for async replies.
6. Each target loads and works manually at least once (`wxt -b firefox`, Safari via Xcode).
