# React + Tailwind / UnoCSS in WXT

## React setup

```ts
// wxt.config.ts
export default defineConfig({ modules: ['@wxt-dev/module-react'] });   // pnpm add react react-dom; pnpm add -D @wxt-dev/module-react @types/react @types/react-dom
```
Each HTML entrypoint is its own app:
```
entrypoints/popup/
  index.html      <div id="root"></div> <script type="module" src="./main.tsx"></script>
  main.tsx        ReactDOM.createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
  App.tsx
  style.css
```
- Share code via `components/`, `hooks/`, `utils/` (auto-imported) or `@/…` imports. Don't import one entrypoint from another.
- The React module passes options through `react: { vite: {/* @vitejs/plugin-react options, e.g. babel plugins */}, vitePluginsBefore: [] }`.
- Routing: extension pages are static files, so use **hash routing** (`createHashRouter` / `<HashRouter>` in react-router, `createHashHistory` in TanStack Router). `popup.html#/settings`.
- State: per-page state with React; cross-context state lives in `storage` (see the `useStorageItem` hook in `packages.md`). Zustand/Jotai stores are per-context; sync them through storage if several contexts need them.
- Popup size: the browser sizes the popup to content, up to **800×600** (Chrome and Firefox). Set an explicit width on `body`/the root (e.g. `w-[360px]`); a zero-width root renders as a tiny box.
- HMR: popup/options/side panel/unlisted pages get React Fast Refresh in dev. Content-script shadow/integrated UIs reload instead (no HMR); iframe UIs get HMR.

## Tailwind CSS v4

```sh
pnpm add -D tailwindcss @tailwindcss/vite
```
```ts
// wxt.config.ts
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
});
```
```css
/* assets/tailwind.css */
@import "tailwindcss";
```
- Pages: `import '~/assets/tailwind.css'` in `main.tsx`.
- Content-script shadow UI: the same import at the top of the content script entry + `cssInjectionMode: 'ui'`. WXT injects it into the shadow root, rewrites `:root`→`:host`, and hoists Tailwind's `@property` rules to the page so shadows/gradients/transforms work.
- Class detection: Tailwind v4 scans the project automatically (respecting `.gitignore`, so `.output/` and `.wxt/` are skipped). Add `@source "../some/dir";` in the CSS for files outside the project or in ignored paths.
- Tailwind v3 projects (`tailwind.config.js` + `postcss.config.js` with `tailwindcss` + `autoprefixer`) still work through Vite's PostCSS support. Don't mix v3 config files with the v4 Vite plugin.

### Making content-script UIs look the same on every site (rem → px)

Tailwind sizes in `rem`, and `rem` is relative to the **page's** `<html>` font-size, which the shadow root can't isolate. Sites that set `html { font-size: 62.5% }` (or similar) shrink your UI. Convert at build time:
```sh
pnpm add -D postcss-rem-to-responsive-pixel
```
```js
// postcss.config.mjs
import remToPx from 'postcss-rem-to-responsive-pixel';
export default { plugins: [remToPx({ rootValue: 16, propList: ['*'], transformUnit: 'px' })] };
```
Verify it worked: `wxt build`, then search `.output/chrome-mv3/content-scripts/*.css` for `rem`. Only intentional rem values should remain. If Tailwind's output isn't converted with the Vite plugin, switch Tailwind to the PostCSS plugin in the same file so the order is explicit: `plugins: [tailwindPostcss(), remToPx({...})]` with `import tailwindPostcss from '@tailwindcss/postcss'` (and remove `@tailwindcss/vite`).

### CSS that targets `html`/`body` doesn't apply inside the shadow root

In 0.21 the shadow root contains only `<style>` + your container `<div>`. Rules like `body { background: black }` in a content-script stylesheet don't match anything there. Style the container/root element (or `:host`) instead. With `cssInjectionMode: 'manifest'`, by contrast, such rules hit the *website's* body, which is usually a bug.

### shadcn/ui, Radix, and other component kits in content scripts

- CSS variables declared on `:root` are rewritten to `:host` by WXT automatically.
- Every Radix `Portal` (Dialog, Popover, Select, DropdownMenu, Tooltip, Sheet, Toast) must get `container={shadowContainer}`, or it renders unstyled in `document.body`. Create a context with the `container` from `onMount` and pass it to the shadcn wrappers. See `content-scripts.md` → "Portals".
- Ant Design: `<StyleProvider container={shadow}>` from `@ant-design/cssinjs`; with Tailwind v4, order the layers `@layer theme, base, antd, components, utilities;` (the official `react-antd-tailwindcss` example).
- Mantine: `MantineProvider getRootElement={() => container} cssVariablesSelector=":host"`.
- If a kit can't target a shadow root, mount the UI with `createIframeUi` instead.

### Custom fonts in content-script UIs

Font URLs in your CSS resolve against the *website's* origin, and `@font-face` doesn't work inside shadow roots (WXT hoists it to the page). The reliable pattern (official `react-content-ui-custom-font` example):
```ts
// wxt.config.ts: manifest.web_accessible_resources: [{ resources: ['fonts/*'], matches: ['*://*.example.com/*'] }]
// content script onMount:
const style = document.createElement('style');
style.textContent = `@font-face { font-family: 'My Font'; src: url('${browser.runtime.getURL('/fonts/my-font.woff2')}') format('woff2'); }`;
document.head.append(style);
```
Then use `font-family: 'My Font'` inside the shadow UI. Remove the style in `onRemove` if needed.

## UnoCSS

`pnpm add -D @wxt-dev/unocss unocss` → `modules: ['@wxt-dev/unocss']` → `import 'virtual:uno.css'` in each entry (with `cssInjectionMode: 'ui'` for shadow-root UIs). Config lives in `uno.config.ts`. `unocss: { excludeEntrypoints: ['background'] }`.

## Dark mode

`prefers-color-scheme` works in pages and shadow roots. Tailwind's `dark:` variant follows it by default. For a manual toggle, use `@custom-variant dark (&:where(.dark, .dark *));` and toggle a `dark` class on your root container (not `document.documentElement` in content scripts: that's the website's).

## Images and icons inside React

- Bundled: `import logo from '~/assets/logo.svg'` → `<img src={logo} />` works in pages. In content scripts, check what the import resolves to: content scripts are built in Vite library mode, which may inline assets as `data:` URLs (usable directly). If it's a path starting with `/`, wrap it in `browser.runtime.getURL(logo)` and add the file to `web_accessible_resources`.
- `public/` files: reference them by absolute path (`/icon/128.png`) in pages; content scripts again need `getURL` + `web_accessible_resources`.
