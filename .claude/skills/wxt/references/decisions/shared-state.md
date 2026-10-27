# Shared state across popup / content / background

| Approach | How | Fits |
|---|---|---|
| **Storage as the single source of truth** | everyone reads `item.getValue()` and subscribes with `item.watch()` | settings, toggles, lists, most app state |
| Background owns state, others message it | `@webext-core/proxy-service` / messaging | state that needs privileged APIs or must be computed centrally |
| Long-lived port (`runtime.connect`) | streaming updates | progress streams, chat token streams |

**Recommend:** storage + watchers.
**Why:** MV3 service workers are killed after ~30 s idle, so in-memory background state silently disappears; storage survives and fans out change events for free. A React hook wrapping `item.getValue()` + `item.watch()` is the usual pattern.
