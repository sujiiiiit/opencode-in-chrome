# Content scripts & on-page UI (verified against WXT 0.21.5 source)

Official guide: `docs/guide/essentials/content-scripts.md`. Option types: `docs/api/reference/wxt/utils/content-script-ui/**`, `docs/api/reference/wxt/utils/content-script-context/classes/ContentScriptContext.md`.

## The context object `ctx`

`main(ctx)` receives a `ContentScriptContext`. When the extension is reloaded, updated, or disabled, the old content script keeps running in open tabs, but `browser.*` calls throw **"Extension context invalidated"**. `ctx` lets you stop cleanly:

| Member | Use |
|---|---|
| `ctx.isValid` / `ctx.isInvalid` | check before async work continues (also checks `browser.runtime.id`) |
| `ctx.signal` | an `AbortSignal`: pass it to `fetch`, `addEventListener`, your own code |
| `ctx.onInvalidated(cb)` | cleanup hook; returns an unsubscribe function |
| `ctx.addEventListener(target, type, handler, opts)` | auto-removed on invalidation; also supports `'wxt:locationchange'` |
| `ctx.setTimeout` / `setInterval` / `requestAnimationFrame` / `requestIdleCallback` | auto-cleared on invalidation |
| `ctx.block()` | a promise that never resolves (keep `main` pending) |
| `ctx.abort(reason)` | invalidate manually |

A newer instance of the same content script (e.g. after a dev reload) automatically invalidates the older one on the page. Use the `ctx.*` helpers instead of raw `setInterval`/`addEventListener` so zombie copies don't keep running.

## Three UI helpers (all take `ctx` first)

```ts
createIntegratedUi(ctx, options)        // sync; renders into a plain element in the page
await createShadowRootUi(ctx, options)  // ASYNC (fetches the entry's CSS); renders inside a ShadowRoot
createIframeUi(ctx, { page: '/x.html', ...options })  // sync; hosts an extension HTML page
```
They return `{ mount(), remove(), autoMount(opts?), mounted, ... }`. The shadow-root version also returns `shadow`, `shadowHost`, `uiContainer`. Removal also happens automatically when `ctx` is invalidated.

### Shared options

| Option | Values | Notes |
|---|---|---|
| `position` | `'inline'` \| `'overlay'` \| `'modal'` | inline = normal flow at the anchor; overlay = absolutely positioned (0×0 wrapper at the anchor, your element positioned from it); modal = fixed full-viewport container |
| `alignment` (overlay) | `'top-left'` (default) \| `'top-right'` \| `'bottom-left'` \| `'bottom-right'` | |
| `zIndex` | number | applied to the wrapper for overlay/modal |
| `anchor` | CSS selector \| XPath (string starting with `/`) \| `Element` \| `() => Element\|string` | default `document.body`; throws "could not find anchor element" if missing at `mount()` |
| `append` | `'last'` (default) \| `'first'` \| `'replace'` \| `'before'` \| `'after'` \| `(anchor, ui) => void` | where the UI goes relative to the anchor |
| `onMount(container, …)` | return value is passed to `onRemove` | render your framework app here |
| `onRemove(mounted)` | | unmount your app (`root.unmount()`) |

Shadow-root only: `name` (**required**, must be a valid custom-element name with a dash, e.g. `'my-ext-ui'`), `css` (extra CSS string), `mode` (`'open'` default in WXT), `isolateEvents` (`true` = stop `keydown`/`keyup`/`keypress` from bubbling to the page, or pass an array of event names), `inheritStyles` (default `false`; WXT adds `:host{all:initial !important}`). `onMount(container, shadow, shadowHost)`.

Iframe only: `page` (path of an unlisted HTML entrypoint, which must be in `web_accessible_resources`); `onMount(wrapper, iframe)`.

### `autoMount()` for elements that appear/disappear (SPAs, lazy content)

```ts
ui.autoMount();                                   // mounts when `anchor` exists, unmounts when it's gone, repeats
ui.autoMount({ once: true, onStop: () => {} });   // stop after the first unmount
```
- The anchor must be a selector/XPath string (or a function returning one): passing an `Element` throws "autoMount and Element anchor option cannot be combined".
- `ui.remove()` also stops auto-mounting.

### React in a shadow root (canonical, matches the official example)

```tsx
// entrypoints/overlay.content/index.tsx
import './style.css';                 // CSS for THIS UI (Tailwind import or plain CSS)
import ReactDOM from 'react-dom/client';
import App from './App';

export default defineContentScript({
  matches: ['*://*.example.com/*'],
  cssInjectionMode: 'ui',             // the CSS goes into the shadow root, not the page
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'example-overlay',
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container) => {
        const wrapper = document.createElement('div'); // don't create a React root directly on `container`
        container.append(wrapper);
        const root = ReactDOM.createRoot(wrapper);
        root.render(<App />);
        return { root, wrapper };
      },
      onRemove: (mounted) => {
        mounted?.root.unmount();
        mounted?.wrapper.remove();
      },
    });
    ui.mount();
  },
});
```

### How shadow-root CSS works in 0.21 (important for Tailwind and component libraries)

1. CSS imported by the entrypoint is built to `content-scripts/<name>.css`. With `cssInjectionMode: 'ui'`, `createShadowRootUi` **fetches** that file at runtime (that's why it's async) and puts it in a `<style>` inside the shadow root.
2. Every `:root` in that CSS is rewritten to `:host`.
3. `@property` and `@font-face` blocks are **moved to a `<style>` in the page `<head>`** (they don't work inside shadow roots). Tailwind v4 relies on `@property`, and this is what makes it work.
4. The shadow root's structure is now simply `<style>…</style><div>(your container)</div>`. **There is no `<html>`, `<head>`, or `<body>` inside it anymore** (`@webext-core/isolated-element` v3).
   - Older snippets (including WXT's own FAQ) use `shadow.querySelector('body')!` or `shadow.querySelector('head')!` as a portal/style container. **On 0.21 these return `null`.** Use `container` (or `shadow` itself) instead.
   - To restore the old html/head/body structure: `pnpm add @webext-core/isolated-element@^1` (WXT respects the installed version; support ends in the next major).
5. `rem` units still follow the *page's* `<html>` font-size. If a site sets it (e.g. 62.5%), Tailwind-sized UIs shrink/grow. Fix it by converting rem→px at build time (see `styling-react.md`).

### Portals, popovers, dialogs, and CSS-in-JS libraries inside a shadow root

Libraries that render into `document.body` (Radix/shadcn `Portal`, MUI/Headless UI popovers, react-hot-toast, tooltips) or inject `<style>` into `document.head` (Ant Design cssinjs, Emotion, styled-components, Mantine CSS vars) end up **outside** the shadow root and render unstyled. The fix is always to point them inside:

```tsx
onMount: (container, shadow) => {
  const wrapper = document.createElement('div');
  container.append(wrapper);
  const root = ReactDOM.createRoot(wrapper);
  root.render(
    <PortalContainerContext.Provider value={container}>    {/* for createPortal / Radix `container` prop */}
      <StyleProvider container={shadow}>                    {/* antd: @ant-design/cssinjs */}
        <App />
      </StyleProvider>
    </PortalContainerContext.Provider>,
  );
  return root;
}
```
- Radix / shadcn: pass `container={portalContainer}` to every `*.Portal` (or wrap the shadcn components once).
- Emotion: `createCache({ key: 'x', container: shadow })` + `<CacheProvider>`. styled-components: `<StyleSheetManager target={shadow}>`.
- Mantine: `getRootElement={() => container}` and `cssVariablesSelector=":host"` on `MantineProvider`.
- If a library can't be redirected, use `createIframeUi` instead.

## Main world (page JavaScript access)

```ts
// entrypoints/hook.content.ts: isolated world, has extension APIs
export default defineContentScript({
  matches: ['*://*.example.com/*'],
  runAt: 'document_start',
  async main() {
    const { script } = await injectScript('/page-hook.js', {
      keepInDom: false,                        // default false: the <script> tag is removed after load
      modifyScript(script) {                   // runs before insertion (may be async)
        script.dataset.config = JSON.stringify({ debug: true });
        script.addEventListener('from-page', (e) => console.log((e as CustomEvent).detail));
      },
    });
    script.dispatchEvent(new CustomEvent('from-content', { detail: 'hi' }));
  },
});

// entrypoints/page-hook.ts: main world, NO extension APIs, sees window.* of the page
export default defineUnlistedScript(() => {
  const script = document.currentScript;
  const config = JSON.parse(script?.dataset.config ?? '{}');
  script?.addEventListener('from-content', (e) => {/* … */});
  script?.dispatchEvent(new CustomEvent('from-page', { detail: { title: document.title } }));
});
```
```ts
// wxt.config.ts
manifest: { web_accessible_resources: [{ resources: ['page-hook.js'], matches: ['*://*.example.com/*'] }] }
```
- MV3: `script.src` = extension URL (evaluated in time for `run_at`). MV2: WXT fetches the text and inlines it (asynchronous, so it can miss `document_start`; and pages with strict CSP may block inline scripts).
- For typed messaging, use `defineCustomEventMessaging` / `defineWindowMessaging` from `@webext-core/messaging/page` on both sides.
- Only send serializable data across; never trust data coming *from* the page (it can be forged by the site).

## SPAs and client-side navigation

Content scripts run once per full page load. Sites like YouTube, GitHub, X, and Gmail change URLs without reloading.

```ts
const watchPattern = new MatchPattern('*://*.youtube.com/watch*');

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],          // match the whole site, filter at runtime
  main(ctx) {
    const onUrl = (url: URL | string) => { if (watchPattern.includes(url)) mountWatchUi(ctx); };
    onUrl(location.href);                      // handle the page you landed on: the event does NOT fire initially
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => onUrl(newUrl));
  },
});
```
- `wxt:locationchange` uses the Navigation API `navigate` event when available (it fires at navigation *start*, before the new DOM exists), otherwise it polls `location.href` every 1 s. Combine with `ui.autoMount()` or wait for the anchor element instead of assuming the DOM is ready.
- Make mounting idempotent (keep a reference; `remove()` before re-mounting) to avoid duplicate UIs.

## `MatchPattern`

`new MatchPattern('*://*.google.com/*').includes(urlOrLocation)` → boolean. It throws `InvalidMatchPattern` for bad patterns. It supports `<all_urls>`, http/https/file/ftp/urn. Auto-imported, or `import { MatchPattern } from '#imports'`.

## CSS injection modes

| `cssInjectionMode` | Effect | Use with |
|---|---|---|
| `'manifest'` (default) | CSS listed in the manifest's `content_scripts[].css`, applied to the **whole page** | page restyling, integrated UI |
| `'ui'` | not in the manifest; loaded into the shadow root by `createShadowRootUi` | shadow-root UIs (almost always) |
| `'manual'` | not in the manifest; load `browser.runtime.getURL('/content-scripts/<name>.css')` yourself | custom loading |

CSS-only content script: create `entrypoints/example.content.css` and add it via the `build:manifestGenerated` hook (build once to see the output path).

## Assets inside content scripts

`import icon from '/icon/128.png'` (public) or `~/assets/x.png` resolves to a *path*, which the website's origin would load. Convert it: `browser.runtime.getURL(icon)`. Public files used by content scripts must also be in `web_accessible_resources`.

## Programmatic injection (on demand)

```ts
// entrypoints/picker.content.ts
export default defineContentScript({
  registration: 'runtime',
  globalName: true,              // needed (0.21+) if you read main()'s return value
  main() { return document.title; },
});
// background main(): manifest permissions ['scripting', 'activeTab']
browser.action.onClicked.addListener(async (tab) => {
  const [res] = await browser.scripting.executeScript({
    target: { tabId: tab.id! },
    files: ['content-scripts/picker.js'],
  });
  console.log(res.result);
});
```
`executeScript` can't run on `chrome://`, `about:`, `edge://`, the Chrome Web Store, or other extensions' pages. Handle the rejection.

## Frames

`allFrames: true` runs the script in iframes too (cross-origin frames need matching `matches`; `matchAboutBlank`/`matchOriginAsFallback` cover `about:blank`/`data:`/`blob:` frames). Each frame gets its own `ctx` and its own UI, so guard with `if (window !== window.top) return;` when you want top-frame-only behavior.
