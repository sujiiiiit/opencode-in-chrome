# Talking to the page's own JavaScript (main world)

| Option | MV2 | MV3 | Firefox | Extension APIs inside |
|---|---|---|---|---|
| `injectScript('/x.js')` + `defineUnlistedScript` + web_accessible_resources | ✅ | ✅ | ✅ | no, but the parent content script relays |
| `defineContentScript({ world: 'MAIN' })` | ❌ | ✅ | Firefox 128+ | **none** |
| `browser.scripting.executeScript({ world: 'MAIN', func })` | ❌ | ✅ | ✅ (MV3) | none; on demand from the background |

**Recommend:** `injectScript` with a paired content script, using `@webext-core/messaging/page` (or `CustomEvent`s on the returned `script` element) to talk.
**Why:** it's what WXT recommends: it works on every browser and manifest version, and the content script can bridge to extension APIs.
**Deviate when:** Chromium-only MV3 and you need to run before the page's own scripts at `document_start` with zero latency → `world: 'MAIN'` (keep it tiny; it can't use `browser.*`).
