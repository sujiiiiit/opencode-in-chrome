# `wxt.config.ts`, manifest generation, env, hooks, modules (WXT 0.21)

## Quick facts
- CLI: `wxt` (dev) · `wxt build` · `wxt zip` · `wxt prepare` · `wxt clean` · `wxt init` · `wxt submit [init|status]`. Flags: `-b <browser>`, `--mv2`/`--mv3`, `-m/--mode`, `-e <entrypoint>`, `--host`, `-p/--port`, `--debug`; build: `--analyze`, `--analyze-open`; zip: `--sources`; init: `-t <template> --pm <pm>`.
- Output `.output/{browser}-mv{n}` (+`-dev` in dev, `-{mode}` for custom modes). Zip: `{{name}}-{{packageVersion}}-{{browser}}{{modeSuffix}}.zip`.
- Dirs: `entrypoints/`, `public/` (copied as-is, root-level), `assets/` (bundled), `components/ hooks/ utils/ composables/` (auto-imported), `modules/` (auto-loaded), `app.config.ts`, `.env*`, `web-ext.config.ts`. `srcDir: 'src'` moves source dirs (not `public/`/`modules/`).
- Peers (0.21): `vite` required, `web-ext` optional (needed to auto-open the browser), `typescript` ≥5.4 optional. Node ≥22.

Exact types for every key: `docs/api/reference/wxt/interfaces/InlineConfig.md`. Hook signatures: `docs/api/reference/wxt/interfaces/WxtHooks.md`.

## All top-level config keys

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  // Directories (srcDir/modulesDir/outDir/publicDir relative to root; entrypointsDir relative to srcDir)
  root: '.', srcDir: '.', entrypointsDir: 'entrypoints', modulesDir: 'modules', publicDir: 'public', outDir: '.output',
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}{{modeSuffix}}',   // vars: browser, manifestVersion, mode, modeSuffix, command

  // Targets
  browser: 'chrome',            // default target; usually set via -b
  manifestVersion: 3,           // default: 3, but 2 for firefox & safari
  targetBrowsers: ['chrome', 'firefox'], // narrows the type of import.meta.env.BROWSER
  filterEntrypoints: ['popup'], // only build these entrypoints
  mode: 'production',           // usually via --mode

  modules: ['@wxt-dev/module-react'],    // npm WXT modules (local ones in modules/ load automatically)
  manifest: {/* object */} || (({ browser, manifestVersion, mode, command }) => ({/* … */})),
  vite: (configEnv) => ({ plugins: [], define: {}, build: {} }),  // MUST be a function
  imports: {/* unimport options */} || false,                     // auto-imports
  alias: { testing: resolve('utils/testing') },                    // NOT tsconfig paths
  hooks: { 'build:manifestGenerated': (wxt, manifest) => {} },
  webExt: { binaries: {}, startUrls: [], chromiumArgs: [], disabled: false },  // browser startup (needs web-ext installed)
  dev: { server: { host: 'localhost', port: 3000, strictPort: false, origin: 'http://localhost:3000' }, reloadCommand: 'Alt+R' | false },
  zip: {/* see publishing.md */},
  analysis: { enabled: false, open: false, outputFile: 'stats.html', keepArtifacts: false, template: 'treemap' },
  watchOptions: { usePolling: true, interval: 1000 },  // chokidar options (Docker/WSL)
  suppressWarnings: { firefoxDataCollection: true, firefoxId: true },
  experimental: { escapeUnicode: true },  // fixes "Could not load content script… not UTF-8 encoded"
  debug: false, logger: console, configFile: 'wxt.config.ts',
});
```
Removed keys you may see in old code: `runner` (now `webExt`), `transformManifest` (now the `build:manifestGenerated` hook), `extensionApi`, `entrypointLoader`, `dev.server.hostname` (now `host`).

## Manifest generation

There is **no `manifest.json` in source**. WXT merges: the `manifest` config, options declared inside entrypoints, modules, then hooks. Output: `.output/<target>/manifest.json`. Always check the generated file (`scripts/inspect-manifest.mjs`).

- **Write MV3-shaped keys**; WXT converts them for MV2: `action`→`browser_action`, `web_accessible_resources` objects→string array, MV3 `host_permissions`→MV2 `permissions`. Keys specific to one version are dropped for the other.
- `name` defaults to package.json `name`; `version` comes from package.json `version` (cleaned: `1.3.0-alpha2` → `version: "1.3.0"`, `version_name: "1.3.0-alpha2"`), defaulting to `0.0.0`. Bump the version in **package.json**, not in the manifest.
- Icons are auto-discovered from `public/` when named `icon-16.png`, `icon-16x16.png`, `icon@16w.png`, `icon@16h.png`, `icon@16.png`, `icon/16.png`, `icons/16x16.png` (PNG only). Firefox `theme_icons` come from `icon-light-16.png` + `icon-dark-16.png` pairs. Otherwise set `manifest.icons`, or use `@wxt-dev/auto-icons`.
- Permissions are added automatically only for: dev mode (`tabs`, `scripting`, localhost host permissions, a dev CSP, the `wxt:reload-extension` command) and the sidepanel entrypoint (`sidePanel`). **Everything else you add yourself.**
- Per-browser/per-version values need the function form:
  ```ts
  manifest: ({ browser, manifestVersion, mode }) => ({
    name: mode === 'development' ? 'My Ext (dev)' : 'My Ext',
    permissions: ['storage', ...(browser === 'chrome' ? ['sidePanel', 'offscreen'] : [])],
    host_permissions: ['https://api.example.com/*'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: 'my-ext@example.com', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } },
      },
    }),
  }),
  ```
- Action without popup (to use `action.onClicked`/`activeTab`): delete the popup entrypoint and set `manifest: { action: {} }`. Add `page_action: {}` to get an MV2 page action.
- `web_accessible_resources` (MV3 form): `[{ resources: ['page-hook.js', 'icon/*.png'], matches: ['*://*.example.com/*'] }]`.
- CSP: `content_security_policy: { extension_pages: "script-src 'self'; object-src 'self';" }`. MV3 forbids remote code: no CDN `<script>`, no `eval`, no `new Function`. `'wasm-unsafe-eval'` is allowed.

## Environment variables & modes

- Dotenv files (Vite rules): `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`, `.env.[browser]`, `.env.[browser].local`, `.env.[mode].[browser]`, `.env.[mode].[browser].local`.
- Only `WXT_*` / `VITE_*` are exposed: `import.meta.env.WXT_API_URL`. They're inlined into the bundle, so they're readable by anyone who downloads the extension.
- Built-ins: `import.meta.env.BROWSER` (string), `MANIFEST_VERSION` (2|3), `CHROME`, `FIREFOX`, `SAFARI`, `EDGE`, `OPERA` (booleans), `MODE`, `DEV`, `PROD`, `ENTRYPOINT` (current entrypoint name), `COMMAND` ('build'|'serve'). Use them for dead-code-eliminated branching: `if (import.meta.env.FIREFOX) {…}`.
- In `wxt.config.ts`, `.env` values are available inside the **function form** of `manifest` (via `import.meta.env.WXT_X`), and `import.meta.env.DEV` is not defined there: use the `mode` argument.
- Modes: `--mode <name>` (dev defaults to `development`, everything else to `production`). The output dir gets `-<mode>` (`chrome-mv3-staging`), and `-dev` for development.

## Runtime app config

```ts
// <srcDir>/app.config.ts (committed, so no secrets)
import { defineAppConfig } from '#imports';
declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig { apiUrl: string; debug: boolean }
}
export default defineAppConfig({
  apiUrl: import.meta.env.WXT_API_URL ?? 'https://api.example.com',
  debug: import.meta.env.WXT_DEBUG === 'true',
});
// anywhere: getAppConfig().apiUrl   (useAppConfig is deprecated)
```

## Auto-imports and `#imports`

- Auto-imported everywhere: WXT APIs (`defineBackground`, `defineContentScript`, `defineUnlistedScript`, `createShadowRootUi`, `createIntegratedUi`, `createIframeUi`, `injectScript`, `storage`, `browser`, `MatchPattern`, `ContentScriptContext`, `getAppConfig`, …), plus all exports from `<srcDir>/{components,composables,hooks,utils}/*`. With `@wxt-dev/module-react`, exactly these React hooks are auto-imported: `useState`, `useCallback`, `useMemo`, `useEffect`, `useRef`, `useContext`, `useReducer` (anything else, like `useId`, `createPortal`, or `ReactDOM`, still needs an import). `fakeBrowser` is also in `#imports`. Check `.wxt/types/imports-module.d.ts` for the project's real list.
- Explicit form (preferred in generated code for clarity, and required when `imports: false`): `import { storage, defineContentScript } from '#imports'`. `#imports` is rewritten to real paths like `wxt/utils/storage`, which is important when mocking in Vitest.
- Types for auto-imports need `wxt prepare` (`postinstall`). The full list is in `.wxt/types/imports-module.d.ts`.
- `imports: { dirs: ['lib'] }` adds directories; `imports: { scan: false }` disables directory scanning; `imports: false` disables everything.
- ESLint: `imports: { eslintrc: { enabled: 9 } }` → `import autoImports from './.wxt/eslint-auto-imports.mjs'` in `eslint.config.mjs` (`8` → `.wxt/eslintrc-auto-import.json`; `true` = auto-detect).

## TypeScript

- Root `tsconfig.json`: `{ "extends": "./.wxt/tsconfig.json" }`. In 0.21 the generated config uses `module: "Preserve"`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `allowImportingTsExtensions`, `lib: [ESNext, DOM, DOM.Iterable]`. Type-only imports must use `import type`.
- Aliases: `~`/`@` → srcDir, `~~`/`@@` → root. Add more via `alias` in config (never in tsconfig `paths`).
- Adjust the generated tsconfig with the `prepare:tsconfig` hook: `(wxt, { tsconfig }) => { tsconfig.compilerOptions.lib.push('WebWorker') }`.
- Types for the extension API: `import type { Browser } from 'wxt/browser'` → `Browser.runtime.MessageSender`, `Browser.tabs.Tab`. They're based on `@types/chrome`, so some Firefox-only APIs (`sidebarAction`, `menus` extras) are untyped. Augment them with `declare module '@wxt-dev/browser' { namespace Browser { … } }` after installing `@wxt-dev/browser` as a direct dependency.

## Vite

```ts
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  vite: ({ mode, command }) => ({
    plugins: [tailwindcss()],
    build: { sourcemap: mode === 'development' ? 'inline' : false },
  }),
});
```
- WXT runs several separate Vite builds (HTML pages and an ESM background as one multi-page build; each content script/unlisted script as its own IIFE library build) plus a dev server. Plugins that assume "one `vite build`" may need gating on `mode`.
- Vite 6.3.4+, 7, or 8 is a **required peer** in 0.21: `vite` must be in your devDependencies.

## Hooks (all in `docs/api/reference/wxt/interfaces/WxtHooks.md`)

`config:resolved`, `ready`, `prepare:types`, `prepare:tsconfig`, `prepare:publicPaths`, `entrypoints:found`, `entrypoints:resolved`, `entrypoints:grouped`, `vite:build:extendConfig`, `vite:devServer:extendConfig`, `build:before`, `build:publicAssets`, `build:manifestGenerated`, `build:done`, `server:created`, `server:started`, `server:closed`, `zip:start`, `zip:extension:start`, `zip:extension:done`, `zip:sources:start`, `zip:sources:done`, `zip:done`.

```ts
hooks: {
  'build:manifestGenerated': (wxt, manifest) => {
    if (wxt.config.mode === 'development') manifest.name += ' (DEV)';
  },
  'build:publicAssets': (wxt, assets) => {
    assets.push({ relativeDest: 'rules.json', contents: JSON.stringify(rules) });
    // or { absoluteSrc: resolve('node_modules/pkg/file.wasm'), relativeDest: 'file.wasm' }
  },
},
```
Order: npm modules (in `modules` order) → local `modules/*` (alphabetical; prefix `0.`, `1.` to reorder) → config `hooks`. Inspect with `wxt prepare --debug` ("Hook execution order").

## Writing a local module

```ts
// modules/my-module.ts: auto-loaded, no config needed
import { defineWxtModule, addAlias, addEntrypoint, addImportPreset, addPublicAssets, addViteConfig, addWxtPlugin } from 'wxt/modules';

export default defineWxtModule({
  name: 'my-module',
  configKey: 'myModule',            // options come from `myModule:` in wxt.config.ts (augment InlineConfig for types)
  imports: [{ from: '#my', name: 'thing' }],  // extra auto-imports
  setup(wxt, options) {
    wxt.logger.info('loaded');
    addViteConfig(wxt, () => ({ define: { __FLAG__: 'true' } }));
    wxt.hook('build:manifestGenerated', (_, manifest) => { /* … */ });
  },
});
```
Runtime plugins (`defineWxtPlugin` + `addWxtPlugin`) run code at the start of every entrypoint. Build-time options go in `wxt.config.ts`; runtime options go in `app.config.ts`.

## Browser startup in dev (`web-ext`)

- Optional peer since 0.21: install `web-ext` or no browser opens (load `.output/chrome-mv3-dev` manually instead).
- Config locations: `web-ext.config.ts` (gitignored, personal), `webExt` in `wxt.config.ts` (shared), `~/web-ext.config.ts` (global). Use `defineWebExtConfig` from `'wxt'`.
- Persistent profile (stay logged in): Windows `chromiumProfile: resolve('.wxt/chrome-data'), keepProfileChanges: true`; macOS/Linux `chromiumArgs: ['--user-data-dir=./.wxt/chrome-data']`.
- Other: `binaries: { chrome: '/path/to/chrome-beta', firefox: 'firefoxdeveloperedition', edge: '/path/to/msedge' }`, `startUrls: ['https://example.com']`, `disabled: true`.
- Chrome's built-in AI / Prompt API in the dev browser needs `chromiumArgs: ['--disable-features=DisableLoadExtensionCommandLineSwitch']`.
- Docker/devcontainer: `wxt --host 0.0.0.0`, `webExt.disabled`, `watchOptions.usePolling`.
