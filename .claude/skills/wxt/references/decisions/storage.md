# Storage: API and area

**API:** `storage` from `#imports` (= `@wxt-dev/storage`) is the recommended default: typed `defineItem`, `fallback`/`init`, versioned `migrations`, `watch`, metadata, bulk ops, and `fakeBrowser` support in tests. Vanilla `browser.storage` is fine for one-off reads. For large/relational data (thousands of records, blobs) use IndexedDB in an extension page or offscreen doc (`idb`/`dexie`): note that a content script's IndexedDB belongs to the *website's* origin.

**Area:**
| Prefix | Size | Persists | Synced | Use for |
|---|---|---|---|---|
| `local:` | ~10 MB (`unlimitedStorage` lifts it) | yes | no | default for app data, caches |
| `sync:` | ~100 KB total, 8 KB/item, write rate limits | yes | across signed-in browsers | small user preferences |
| `session:` | ~10 MB, in memory | until browser restart | no | MV3 service-worker state that must survive SW restarts but not sessions, tokens |
| `managed:` | n/a | admin policy | n/a | read-only enterprise config |

`storage.session` is not exposed to content scripts by default (Chromium): call `browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })` from the background if they need it (not if it holds tokens: that exposes them to content scripts). Never put tokens in `sync:`. Always add the `storage` permission.
