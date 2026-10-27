# Cross-browser

### xb-explicit-manifest-version: HIGH
Firefox and Safari default to **MV2** in WXT. Pin the target in scripts (`wxt build -b firefox --mv3`) or config so the code you wrote for MV3 isn't silently built as MV2.

### xb-feature-detect: HIGH
Guard Chromium-only APIs (`sidePanel`, `offscreen`, `_favicon`, `identity.getAuthToken`, `tabGroups`, `userScripts`) with feature detection or `import.meta.env.*` branches. Use entrypoint `include`/`exclude` for whole features.

### xb-firefox-id-and-consent: CRITICAL (Firefox)
Set `browser_specific_settings.gecko.id` (required for MV3, signing, storage.sync, identity redirects) and `data_collection_permissions` (required for new AMO listings). See `cross-browser.md`.

### xb-firefox-host-permissions: HIGH (Firefox MV3)
Users can withhold or revoke host permissions. Check `permissions.contains({ origins })` and offer a `permissions.request` button, or the content scripts silently won't run.

### xb-test-every-target: HIGH
Build and load every target you ship (`inspect-manifest.mjs --build chrome,firefox`, plus Safari via Xcode). Read the "Differences" output.
