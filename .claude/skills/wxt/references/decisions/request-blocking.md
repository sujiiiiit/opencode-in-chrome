# Blocking or modifying requests

| | `declarativeNetRequest` (DNR) | `webRequest` blocking |
|---|---|---|
| Chromium MV3 | ✅ (the only option for blocking) | observe-only (blocking needs enterprise policy) |
| Firefox | ✅ | ✅ blocking still supported in MV2 and MV3 |
| Safari | ✅ (DNR) | limited |

**Recommend:** DNR (static rules in `public/` + `declarative_net_request` manifest key, or `updateDynamicRules`) for cross-browser builds. Use `webRequest` only for Firefox-specific power features.
