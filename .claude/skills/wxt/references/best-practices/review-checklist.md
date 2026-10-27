# Code review checklist

Run `node scripts/wxt-env.mjs` first (it flags stale APIs and layout problems automatically), then check:

**Background**
- [ ] `main()` is sync; all listeners registered at its top
- [ ] No state held only in module variables; `session:`/`local:` used
- [ ] No `setInterval` for periodic work (use `alarms`); no keep-alive hacks
- [ ] DOM work in offscreen (Chromium) / feature-detected for Firefox
- [ ] Async `onMessage` replies use `sendResponse` + `return true`; senders and payloads validated

**Content scripts**
- [ ] No top-level runtime code; narrow `matches`; correct `runAt`
- [ ] `ctx` helpers for timers/listeners; invalidation handled
- [ ] SPA navigation handled, including the initial URL; mounting idempotent
- [ ] `await createShadowRootUi`, valid `name`, `cssInjectionMode: 'ui'`, CSS imported; portals target `container`
- [ ] `onRemove` releases everything `onMount` started
- [ ] DOM reads/writes batched; observers scoped and disconnected
- [ ] Size checked with `wxt build --analyze`; heavy code moved out

**Messaging & storage**
- [ ] Shared state via storage + `watch`, not polling or broadcast loops
- [ ] Background→content uses `tabs.sendMessage`; "no receiver" handled
- [ ] Items defined once with `fallback`/`init`; migrations for shape changes; JSON-serializable values; quota/rate limits considered

**Manifest & security**
- [ ] Production manifest reviewed (`inspect-manifest.mjs`); permissions minimal; broad ones optional
- [ ] `web_accessible_resources` minimal and scoped; CSP MV3-compliant
- [ ] No remote code, no secrets, no `innerHTML` with untrusted data
- [ ] No generic proxy handlers (`fetch(msg.url)`, `executeScript` from message data); `sender` checked; payloads validated at runtime
- [ ] `postMessage`/`message` listeners check `source`/`origin`; nothing sensitive in the main world or shadow-root UI
- [ ] Tokens held by the background, not in `sync:`; `storage.session` not opened to content scripts if it holds secrets; OAuth uses PKCE + `state`
- [ ] `externally_connectable` exact origins; WAR scoped (`use_dynamic_url` on Chromium); no `unsafe-eval` CSP
- [ ] `web-ext lint` clean for Firefox; lockfile committed; privacy disclosures match data collected
- [ ] Firefox: `gecko.id`, `data_collection_permissions`, explicit `--mv3` if intended

**Types & layout**
- [ ] `#imports`/auto-imports only; `browser` not `chrome`
- [ ] No `any` in handlers; nullable API results handled
- [ ] Aliases via `alias`, not tsconfig `paths`; helpers inside entrypoint folders
