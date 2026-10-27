# TypeScript & project hygiene

### ts-use-imports-module: HIGH
Use auto-imports or `import { … } from '#imports'` for WXT APIs; never `wxt/storage`, `wxt/client`, `wxt/sandbox`, or the `wxt/testing` barrel (removed). Keep `"postinstall": "wxt prepare"` so `.wxt/` types exist after every install. In Vitest, mock real paths (`vi.mock('wxt/utils/storage')`), not `#imports`. The mapping is in `.wxt/types/imports-module.d.ts`.

### ts-use-browser-not-chrome: HIGH
Use WXT's `browser` (auto-imported): the native `browser` on Firefox/Safari, `chrome` on Chromium, promise-based in MV3. Raw `chrome.*` calls break or diverge on Firefox/Safari. Feature-detect APIs that may be missing (`browser.sidePanel?.…`).

### ts-strict-null-safety: MEDIUM
WXT's generated tsconfig is already `strict` with `noUncheckedIndexedAccess` (0.21), so don't loosen it. Handle the extension API's real nullables: `tabs.query()` can return `[]`; `tab.id` is undefined for some tabs (devtools, some special pages); `tab.url`/`title` are undefined without `tabs`/host permission; `sender.tab` is undefined for messages from extension pages; `storage.getItem` returns `null` for missing keys (use `fallback`).

### ts-avoid-any-in-handlers: MEDIUM
Type message payloads (discriminated unions, or a messaging library's protocol map) instead of `any`. For extension types use `Browser.*` from `wxt/browser` (`Browser.runtime.MessageSender`, `Browser.tabs.Tab`).

### ts-type-entrypoint-options: LOW
`defineContentScript`/`defineBackground`/`defineUnlistedScript` are already fully typed: options get autocomplete and typo errors inline, so no extra annotations are needed. When sharing option objects between entrypoints, type them with `satisfies Partial<…>` using the option interfaces exported from `'wxt'` (e.g. `IsolatedWorldContentScriptEntrypointOptions`). Don't import types from `wxt/sandbox` (removed).

### ts-augment-browser-types: LOW
For APIs missing from `@types/chrome`-based types (Firefox `sidebarAction`, experimental APIs), install `@wxt-dev/browser` as a direct dependency and augment `declare module '@wxt-dev/browser' { namespace Browser { … } }` (official WXT approach), or use small local interfaces + feature detection. Avoid `@ts-ignore` and broad `as any`.

### ts-import-meta-env: MEDIUM
Use built-ins instead of sniffing: `import.meta.env.BROWSER`/`FIREFOX`/`CHROME`/`SAFARI`/`MANIFEST_VERSION`/`MODE`/`DEV`/`PROD` (dead-code eliminated per build); the extension version comes from `browser.runtime.getManifest().version`, not a hard-coded string. Type custom variables (Vite convention):
```ts
// env.d.ts (included in the TS project)
interface ImportMetaEnv { readonly WXT_API_URL: string; }
interface ImportMeta { readonly env: ImportMetaEnv }
```
Or centralize them in `app.config.ts` (typed `WxtAppConfig`).

### ts-path-aliases: LOW
WXT ships `@`/`~` (srcDir) and `@@`/`~~` (root). Add more via `alias` in `wxt.config.ts` only. WXT writes them into `.wxt/tsconfig.json` and the bundler; **never** add `paths` to your own tsconfig (they override WXT's and drift).

### ts-entrypoint-layout: HIGH
Keep entrypoints one level deep and put helpers inside the entrypoint's folder. Share code through `components/`, `hooks/`, `utils/` (auto-imported). Never import one entrypoint from another.
