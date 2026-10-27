# UI: popup, side panel, on-page UI

### ui-use-shadow-dom: HIGH
Inject on-page UI with `await createShadowRootUi(ctx, { name: 'kebab-name', … })` + `cssInjectionMode: 'ui'` + CSS imported in the entry: isolated styles both ways, with `:host{all:initial}` applied by default (`inheritStyles: true` opts out). It's **async**: always `await` it before `mount()`. `isolateEvents: true` (or an array of event names) stops keyboard events from reaching the page's shortcuts. Mount React on a wrapper `div` inside `container`, not on `container` itself. Point portals and CSS-in-JS at `container`/`shadow` (0.21 has no `<body>` in the shadow root).
```ts
// ❌ const ui = createShadowRootUi(ctx, {…}); ui.mount();   // ui is a Promise → TypeError
// ✅ const ui = await createShadowRootUi(ctx, {…}); ui.mount();
```

### ui-cleanup-on-unmount: HIGH
Everything your UI starts must stop when it's removed: return resources from `onMount` and release them in `onRemove` (unmount the React root, disconnect observers, unwatch storage, close ports); use `ctx.addEventListener`/`ctx.setInterval` so listeners/timers end on invalidation. WXT already calls `remove()` on context invalidation for UIs created with `ctx`, so you don't need your own `ctx.onInvalidated(ui.remove)`.
```ts
onMount: (container) => {
  const wrapper = document.createElement('div'); container.append(wrapper);
  const root = ReactDOM.createRoot(wrapper); root.render(<Panel />);
  const observer = new MutationObserver(onMutation); observer.observe(target, { childList: true });
  const unwatch = settings.watch(apply);
  return { root, wrapper, observer, unwatch };
},
onRemove: (m) => { m?.unwatch(); m?.observer.disconnect(); m?.root.unmount(); m?.wrapper.remove(); },
```

### ui-iframe-for-heavy-ui: MEDIUM
For large, app-like injected UIs (dashboards, editors, full component libraries that can't target a shadow root), use `createIframeUi(ctx, { page: '/panel.html', … })`: full isolation, HMR in dev, code-splitting, and extension APIs inside the page, while the content script stays tiny. Add the page to `web_accessible_resources` (scoped). Size/position the iframe in `onMount(wrapper, iframe)`, and communicate via `runtime` messaging or `postMessage` with origin checks.

### ui-defer-popup-work: MEDIUM
The popup is created fresh on every open, and the user is waiting. Render a shell immediately and then load data in effects (show cached values from storage first, refresh after); lazy-load heavy views; avoid top-level `await` chains in `main.tsx` before the first render; keep analytics init off the critical path.

### ui-popup-is-ephemeral: HIGH
The popup is destroyed when it loses focus: unsaved state, pending `fetch`es, and timers die with it. Persist form drafts to `storage` as the user types (debounced), and start long operations in the background (message it) rather than in the popup. If the UI must stay open, use the side panel.

### ui-sidepanel-persistence: MEDIUM
The side panel persists across tab switches but is still destroyed when closed. Persist meaningful UI state (current view, query, draft) in `session:` (per browser session) or `local:` (durable) with debounced writes, restore on mount, and react to tab changes (`tabs.onActivated`/`onUpdated`) if content is per-tab.

### ui-avoid-layout-thrashing: MEDIUM
On host pages, batch DOM reads before writes. Interleaving `offsetHeight`/`getBoundingClientRect()`/`getComputedStyle()` reads with style writes forces a synchronous reflow per element. Read everything, then write in one pass (or write in `ctx.requestAnimationFrame`). Prefer CSS (classes, one injected stylesheet) over per-element inline styles for bulk changes.
```ts
// ❌ els.forEach((el) => { el.style.minHeight = `${el.offsetHeight + 20}px`; });
// ✅
const heights = els.map((el) => el.offsetHeight);
ctx.requestAnimationFrame(() => els.forEach((el, i) => (el.style.minHeight = `${heights[i] + 20}px`)));
```

### ui-respect-the-host-page: MEDIUM
Use a high but deliberate `zIndex`, avoid global page styles from `cssInjectionMode: 'manifest'` unless restyling is the feature, don't steal focus/keyboard shortcuts unexpectedly (`isolateEvents`), and keep `rem`-based sizes stable (convert rem→px for shadow UIs).

### ui-hash-routing: LOW
Use hash-based routers in extension pages (`createHashRouter`, `popup.html#/settings`).
