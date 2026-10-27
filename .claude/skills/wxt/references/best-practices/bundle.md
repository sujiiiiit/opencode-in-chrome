# Bundle size & performance

### bundle-analyze-size: MEDIUM-HIGH
Measure before optimizing: `wxt build --analyze` (or `--analyze-open`; config `analysis: { enabled, open, template, keepArtifacts }`) writes a visualizer report (`stats.html`) per build step. Check content scripts first (they run on every matched page). Rough budgets that keep pages snappy: content script < 50 KB (detection-only < 10 KB), background < 100–200 KB, popup < 200 KB initial. Treat these as guidelines, not rules.

### bundle-light-content-scripts: HIGH
Content scripts are built as **single self-contained IIFE files**: no shared chunks, and dynamic `import()` gets inlined (so it doesn't reduce their size). To keep them small:
- Keep heavy UI out of always-on scripts: inject a second content script on demand (`registration: 'runtime'` + `executeScript`), or host heavy UI in `createIframeUi` (an extension page, which can code-split and lazy-load) or the side panel.
- Keep frameworks/data libraries in extension pages; message the results to the content script.
- Do heavy work (parsing, crypto, ML, WASM) in the background/offscreen document, not in the page.

### bundle-split-by-entrypoint: MEDIUM
Each entrypoint should import only what it uses. Avoid barrel files (`utils/index.ts` re-exporting everything) that pull heavy modules, especially ones with top-level side effects that defeat tree-shaking, into every bundle. Import from the specific module (`@/utils/dates`). HTML pages and an ESM background (`type: 'module'`) share chunks automatically; content scripts and unlisted scripts don't.

### bundle-lazy-load-in-pages: MEDIUM
In popup/options/side panel, lazy-load rarely used heavy views with `React.lazy(() => import('./Charts'))` / dynamic `import()`. Code-splitting works in extension pages.

### bundle-choose-lean-deps: MEDIUM
Prefer native APIs (`fetch`, `Intl`, `URL`, `structuredClone`, `crypto.randomUUID`) and small, ESM, tree-shakeable packages (`lodash-es` per-function imports or `es-toolkit`, `date-fns`). Verify any "this library is huge" claim with `--analyze`: modern icon libraries (e.g. `lucide-react`) tree-shake named imports in production builds, so deep imports or `unplugin-icons` only matter if the report shows the whole set being bundled.

### bundle-wasm-and-heavy-assets: MEDIUM
Ship `.wasm`/models/large data as separate files (a WXT module or `public/`), load them on demand with `browser.runtime.getURL()` (+ `web_accessible_resources` if a content script fetches them), and prefer loading them in the background/offscreen document. MV3 CSP needs `'wasm-unsafe-eval'` in `extension_pages` to compile WASM. See `docs/guide/essentials/assets.md` (WASM section).

### bundle-strip-dev-code: LOW
Gate debug logging with `import.meta.env.DEV` (dead-code eliminated in production); use `zip.exclude` for source maps you don't want to ship. Vite plugins like `vite-plugin-remove-console` must be gated on `configEnv.mode === 'production'` under WXT.
