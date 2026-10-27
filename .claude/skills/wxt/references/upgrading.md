# Version drift: upgrading WXT and translating old snippets

WXT is pre-1.0, so **every `0.x` minor bump can be breaking**. Blog posts, StackOverflow answers, the official `wxt-dev/examples` repo (which pins `wxt ^0.20`), and your own training data often show older APIs. Translate them before use. Full official notes: `docs/guide/resources/upgrading.md`.

## Old → current translation table

| You see (old) | Use now (0.21) | Since |
|---|---|---|
| `import { storage } from 'wxt/storage'` | `import { storage } from '#imports'` (or auto-import) | 0.20 |
| `import { defineContentScript } from 'wxt/sandbox'` / `'wxt/client'` | `#imports` | 0.20 |
| `import { fakeBrowser, WxtVitest } from 'wxt/testing'` | `'wxt/testing/fake-browser'` + `'wxt/testing/vitest-plugin'` | 0.21 |
| `useAppConfig()` | `getAppConfig()` | 0.20 (deprecated) |
| `runner: {…}`, `defineRunnerConfig`, `ExtensionRunnerConfig` | `webExt: {…}`, `defineWebExtConfig`, `WebExtConfig` | 0.21 removed |
| `dev.server.hostname` | `dev.server.host` | 0.21 |
| `transformManifest(manifest) {}` | `hooks: { 'build:manifestGenerated': (wxt, manifest) => {} }` | 0.20 |
| `extensionApi: 'chrome'` | delete it | 0.20 |
| `entrypointLoader: 'jiti'` | delete it | 0.20 |
| `import type { Runtime, Tabs } from 'wxt/browser'` (polyfill types) | `import type { Browser } from 'wxt/browser'` → `Browser.runtime.MessageSender`, `Browser.tabs.Tab` | 0.20 |
| `onMessage.addListener(async () => value)` | `(msg, sender, sendResponse) => { work().then(sendResponse); return true; }` | 0.20 (no polyfill) |
| `import 'url:https://cdn…/lib.js'` | npm package or vendored file | 0.21 removed |
| `shadow.querySelector('body')` / `('head')` in `createShadowRootUi` | `container` / `shadow` args of `onMount` | 0.21 (isolated-element v3) |
| `createContentScriptUi` / `createContentScriptIframe` | `createShadowRootUi` / `createIframeUi` | 0.14 |
| `type: 'overlay'` (UI option) / `mount:` option | `position: 'overlay'` / `onMount:` | 0.14 |
| `defaultValue:` in `storage.defineItem` | `fallback:` | deprecated |
| `__BROWSER__`, `__IS_FIREFOX__`, `__MANIFEST_VERSION__` | `import.meta.env.BROWSER`, `.FIREFOX`, `.MANIFEST_VERSION` | 0.15 |
| `zip.ignoredSources` | `zip.excludeSources` | 0.15 |
| `vite: { … }` (object) | `vite: () => ({ … })` | 0.6 |
| `public/`, `modules/` inside `srcDir` | at the project **root** (or set `publicDir`/`modulesDir`) | 0.20 |
| output `.output/chrome-mv3` in dev | dev → `.output/chrome-mv3-dev` | 0.20 |
| zip `{{version}}` meaning version_name | `{{versionName}}`; defaults now use `{{packageVersion}}` | 0.21 |
| executeScript reading `result` of a WXT script | add `globalName: true` to that entrypoint | 0.21 |
| `@webext-core/proxy-service` `defineProxyService(name, init)` | `registerService(key, impl)` + `createProxyService(key)` (v3) | proxy-service v2/v3 |
| `ProtocolWithReturn<D, R>` in `@webext-core/messaging` | function syntax `name(data: D): R` | deprecated |
| CWS submit with `CHROME_REFRESH_TOKEN`/client id+secret | CWS API v2 service account (`wxt submit init`) | publish-browser-extension 5+ |

More wrong-but-common patterns from community guides (non-awaited `createShadowRootUi`, `ctx.isInvalidated`, `css:` option, async listeners with `return true`, keep-alive hacks, tsconfig `paths`, and more) are in `best-practices/wrong-advice.md`.

## 0.20 → 0.21 checklist (the current major)

1. `pnpm i wxt@latest --ignore-scripts`
2. Node ≥ 22; add **`vite`** (required peer) and `typescript` ≥ 5.4 to devDependencies; add **`web-ext`** if you want the browser to auto-open in dev.
3. Fix the testing imports (`wxt/testing/*`), `runner`→`webExt`, `hostname`→`host`, `url:` imports.
4. Regenerate types: `pnpm wxt prepare`. The new tsconfig enables `verbatimModuleSyntax` (use `import type`) and `noUncheckedIndexedAccess` (array/record access may be `undefined`). To revert temporarily:
   ```ts
   hooks: { 'prepare:tsconfig': (_, { tsconfig }) => {
     delete tsconfig.lib; tsconfig.module = 'ESNext'; delete tsconfig.moduleDetection;
     delete tsconfig.allowImportingTsExtensions; delete tsconfig.verbatimModuleSyntax;
     tsconfig.esModuleInterop = true; tsconfig.forceConsistentCasingInFileNames = true; tsconfig.resolveJsonModule = true;
     delete tsconfig.noFallthroughCasesInSwitch; delete tsconfig.noUncheckedIndexedAccess; delete tsconfig.noImplicitOverride;
   } }
   ```
5. Shadow-root UIs: check styling (the new `<style>` + `<div>` structure). Replace `querySelector('body'|'head')`, and pin `@webext-core/isolated-element@^1` only as a stopgap.
6. Scripts whose return value you read via `executeScript`: `globalName: true`.
7. Firefox sources zip: rebuild `zip.includeSources`/`excludeSources` as an allowlist (+ `dotSources`), then check the printed file list.
8. Custom zip templates: `{{version}}` → `{{versionName}}` if you relied on version_name.
9. Unit tests with fake-browser v2: `onMessage` mocks must use `sendResponse`.
10. CI: switch `wxt submit` to CWS API v2.
11. Run `wxt`, `wxt build`, `wxt build -b firefox`, and compare manifests with the previous release (`scripts/inspect-manifest.mjs`).

## 0.19 → 0.20 highlights

`webextension-polyfill` removed (opt back in with `@wxt-dev/webextension-polyfill`), the `Browser` types namespace, `#imports`, `public/`+`modules/` moved to the root, `createShadowRootUi` resets inherited styles (`inheritStyles: true` to opt out), the `-dev` output dir, `transformManifest`/`entrypointLoader` removed, `runner`→`webExt` deprecations.

## How to check what's true for the installed version

1. `node scripts/wxt-env.mjs`: installed version + stale-API scan.
2. Read the installed types: `node_modules/wxt/dist/**/*.d.mts` (e.g. `node_modules/wxt/dist/types.d.mts` for config/entrypoint options, `node_modules/wxt/dist/utils/content-script-ui/*.d.mts`).
3. Changelog: `https://github.com/wxt-dev/wxt/blob/main/packages/wxt/CHANGELOG.md` (or `node_modules/wxt/CHANGELOG.md` if shipped).
4. If the installed version is **newer** than the vendored docs snapshot (see `docs/INDEX.md` header), fetch live docs: `node scripts/wxt-docs.mjs page guide/resources/upgrading`.
