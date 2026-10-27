# Static vs on-demand content scripts

| | `registration: 'manifest'` (default) | `registration: 'runtime'` |
|---|---|---|
| Runs | automatically on every `matches` page | only when you call `scripting.executeScript` / `registerContentScripts` |
| Install warning | "Read and change data on <matches>" | with `activeTab` you can avoid broad host permissions entirely |
| Return value to caller | n/a | `main()`'s return value is available when `globalName: true` is set (default `false` since 0.21) |

**Recommend:** manifest registration when the feature must be always-on for specific sites; **runtime + `activeTab`** when the user triggers it (toolbar click, context menu, shortcut).
**Why:** fewer permissions means a smoother store review, no scary install warning, and no performance cost on unrelated pages.
**Note:** `registration: 'runtime'` adds the script's `matches` to `host_permissions`; leave `matches` minimal (or rely on `activeTab`) if that is not what you want. Check with `inspect-manifest.mjs`.
