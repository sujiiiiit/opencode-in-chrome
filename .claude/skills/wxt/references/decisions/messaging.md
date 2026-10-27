# Messaging between contexts

| Option | Shape | Type safety | Notes |
|---|---|---|---|
| Vanilla `browser.runtime.sendMessage` / `tabs.sendMessage` | event + switch | manual | async replies need `sendResponse` + `return true`. Don't rely on returning a promise from the listener: WXT's `browser` is the raw `chrome` object on Chromium (no polyfill since 0.20), and the WXT upgrade guide documents promise replies as unsupported |
| `@webext-core/messaging` (v4) | `defineExtensionMessaging<ProtocolMap>()` → `sendMessage`/`onMessage` | protocol map, function syntax | tiny; ONE listener per message type per JS context; `sendMessage(type, data, tabId | {tabId, frameId})`; throws if nobody listens. `@webext-core/messaging/page` has `defineWindowMessaging`/`defineCustomEventMessaging` for content script ↔ page/injected script |
| `@webext-core/proxy-service` (v3) | `registerService(key, impl)` in background, `createProxyService(key)` elsewhere | inferred from the class | call background methods like local async functions |
| `webext-bridge` | `sendMessage(id, data, 'content-script@tabId')` | `ProtocolMap` augmentation | MUST be imported in the background (it relays everything); any-to-any routing |
| `comctx` | RPC proxy over an adapter you write | inferred | flexible (workers, iframes, extension); you implement the adapter |
| `trpc-chrome` | tRPC router over a port | full tRPC | peer-depends on tRPC **v10** (old); port-based |

**Recommend:** `@webext-core/messaging` for request/response messages; add `@webext-core/proxy-service` when you are mostly "calling background functions".
**Why:** it's tiny, typed, made by WXT's author, works on all browsers, and avoids the `return true` footgun.
**Deviate when:** you need arbitrary context-to-context routing (devtools ↔ content script) → `webext-bridge`; you already use tRPC v10 → `trpc-chrome`; one or two messages only → vanilla is fine.
Also: for "data changed, update the UI" you usually don't need messaging at all. Use storage watchers (`decisions/shared-state.md`).
