# Permissions strategy

- Required (`permissions`, `host_permissions`): shown at install. **Adding new ones in an update can disable the extension until the user re-approves.** Test with Google's extension-update-testing-tool.
- Optional (`optional_permissions`, `optional_host_permissions`) + `browser.permissions.request()` from a user gesture: no install warning, request at the moment of use.
- `activeTab`: temporary access to the current tab after a user gesture, with no warning.

**Recommend:** start minimal: `storage` + `activeTab` + specific hosts. Make broad access (`<all_urls>`) optional. Note that WXT's dev build adds `tabs`/`scripting`/localhost on its own; only a production build shows the real list.
