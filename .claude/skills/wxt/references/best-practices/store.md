# Storage

### store-use-define-item: HIGH
Define each storage key once (`utils/storage.ts`) with `storage.defineItem<T>('area:key', { fallback })`: typed, never `null` with `fallback`, migration-ready, test-friendly. `fallback` returns a default without writing; `init` writes once (ids, install dates). Omit both only when `null` is meaningful. Ad-hoc `storage.getItem` is for dynamic keys.

### store-choose-storage-area: HIGH
| Area | Persists | Synced | Quota (Chromium) | Use for |
|---|---|---|---|---|
| `session:` | until browser restart (memory) | no | ~10 MB | worker state, tokens, in-progress work |
| `local:` | yes | no | ~10 MB (`unlimitedStorage` removes it) | caches, large data, device settings |
| `sync:` | yes | yes | ~100 KB total, ~8 KB/item, write-rate limits | small preferences |
| `managed:` | admin-set | n/a | n/a | enterprise config (read-only) |
`storage.session` isn't readable from content scripts unless the background calls `browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })`. That exposes the whole area, so don't do it if session holds tokens (`security.md` → sec-token-storage). Never put tokens in `sync:`.

### store-group-related-data: MEDIUM
Data that's read/written together belongs in one item (one read/write and one change event). Split data with different areas, lifecycles, sizes, or update frequency (a large cache shouldn't rewrite user preferences on every change, and `sync` per-item limits favor smaller items). For multiple independent keys, use the bulk APIs (`storage.getItems` / `setItems` / `removeItems`) instead of sequential awaits.

### store-watch-for-changes: HIGH
React to changes with `item.watch(cb)` (backed by `storage.onChanged`, which fires in every context), never by polling. In content scripts, unwatch on invalidation: `ctx.onInvalidated(item.watch(cb))`. In React, unwatch in the effect cleanup. Read the initial value separately (`getValue`), because `watch` only fires on changes.

### store-handle-quota-errors: MEDIUM
Writes can reject (`QUOTA_BYTES`, `QUOTA_BYTES_PER_ITEM`, sync write-rate limits such as `MAX_WRITE_OPERATIONS_PER_MINUTE`). Bound caches (max entries/size, evict oldest), truncate oversized values, catch write errors and degrade gracefully (don't wipe user settings to make room for a cache). Use `local` + `unlimitedStorage` or IndexedDB for large data; debounce frequent `sync` writes.

### store-versioned-migrations: HIGH
When an item's shape changes, bump `version` and add `migrations[n]`; unversioned data counts as v1. Migrations run automatically when `defineItem` executes, and reads/writes wait for them. Never "detect the old shape" ad hoc throughout the code. Keep old types in the file for the migration signatures.

### store-serializable-values: MEDIUM
Store JSON-serializable data only: no `Map`/`Set`/`Date` objects/class instances/functions. Convert to arrays, ISO strings, or epoch numbers.
