# Testing approach

- Unit: **Vitest + `WxtVitest()`** (auto-imports, aliases, `import.meta.env.*`, in-memory `fakeBrowser` storage/messaging). Reset with `fakeBrowser.reset()` in `beforeEach`.
- E2E: **Playwright** loading `.output/chrome-mv3` with `launchPersistentContext` + `--load-extension`. Chromium only, so Firefox needs manual checks or web-ext.
- **Recommend:** unit-test logic (storage, parsers, message handlers) heavily; one or two Playwright smoke tests for injection and popup.
