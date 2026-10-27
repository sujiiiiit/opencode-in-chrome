# Release & updates

### rel-permission-changes: CRITICAL
New required permissions in an update can disable the extension until users re-approve. Add new ones as optional where possible; test with Google's extension-update-testing-tool; compare production manifests between releases.

### rel-test-update-path: HIGH
Exercise `onInstalled` with `reason: 'update'` and storage migrations against data from the previous version before shipping.

### rel-cws-api-v2: HIGH
`wxt submit` against the Chrome Web Store uses API v2 with a service account (v1 refresh-token auth was scheduled to end Oct 15, 2026). See `publishing.md`.

### rel-firefox-sources-zip: HIGH
Verify the sources zip rebuilds identically from a clean folder, and document the build commands for reviewers.
