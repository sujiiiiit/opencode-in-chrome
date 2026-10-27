# Wrong advice commonly found in third-party WXT guides

Popular community rule sets and blog posts (often written for 0.19/0.20) contain patterns that are wrong for 0.21. If you see any of these in a snippet, translate it:

| Seen | Problem | Correct |
|---|---|---|
| `const ui = createShadowRootUi(...); ui.mount()` | it's async: `ui` is a Promise | `const ui = await createShadowRootUi(...)` |
| `ctx.isInvalidated` | doesn't exist | `ctx.isInvalid` / `ctx.isValid` / `ctx.onInvalidated()` |
| `vi.mock('wxt/storage')` | path removed in 0.20 | `vi.mock('wxt/utils/storage')` |
| `import type { ContentScriptDefinition } from 'wxt/sandbox'` | module removed in 0.20 | types from `'wxt'`; usually unnecessary |
| `defineContentScript({ css: ['x.css'] })` | not a WXT option | `import './x.css'` + `cssInjectionMode` |
| `addListener(async (msg, s, sendResponse) => { …; return true })` | async function returns a Promise, not `true` | non-async listener: `work().then(sendResponse); return true;` |
| manual `side_panel` / `sidebar_action` / `content_scripts` in `manifest` | duplicates what WXT generates from entrypoints | create the entrypoint |
| tsconfig `paths` for aliases | WXT says not to; it overrides the generated config | `alias` in `wxt.config.ts` |
| `registration: 'runtime'` with `matches: ['*://*/*']` to "avoid broad permissions" | WXT adds `matches` to `host_permissions` | narrow/empty `matches`; register origins at runtime |
| "an open port keeps the service worker alive" / 24 s keep-alive alarms | idle ports don't; alarms are clamped to 30 s; hacks are fragile | checkpoint + alarms/offscreen; ports only while actively messaging |
| `await import('heavy')` in a content script "to lazy-load" | content scripts are IIFE; dynamic imports are inlined | inject a second script on demand / iframe UI / do it in background |
| "extension entrypoints can't share chunks" | HTML pages + ESM background do share chunks | only content/unlisted scripts are standalone |
| `shadow.querySelector('body')` / `('head')` as a container | no html/head/body in the shadow root in 0.21 | `container` / `shadow` |
| `return value` from `onMessage` listener for replies | no polyfill since 0.20 | `sendResponse` + `return true` |
| `"prepare": "wxt prepare"` | works, but the official convention is `postinstall` | `"postinstall": "wxt prepare"` |
