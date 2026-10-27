# Testing & debugging

## Unit tests: Vitest + `WxtVitest`

```sh
pnpm add -D vitest
```
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';   // 0.21: NOT 'wxt/testing' (barrel removed)

export default defineConfig({
  plugins: [WxtVitest()],
  test: { mockReset: true, restoreMocks: true },
});
```
`WxtVitest()` gives tests: the in-memory `browser` (`@webext-core/fake-browser`), your `wxt.config.ts` Vite config/plugins, auto-imports, aliases (`@/`, `~/`), and `import.meta.env.BROWSER`/`MANIFEST_VERSION`/etc.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('settings', () => {
  beforeEach(() => fakeBrowser.reset());           // clears storage, listeners, tabs…

  it('persists', async () => {
    await settings.setValue({ enabled: false, theme: 'dark' });   // real storage logic, in memory
    expect(await settings.getValue()).toEqual({ enabled: false, theme: 'dark' });
  });

  it('handles messages', async () => {
    // fake-browser v2 (WXT 0.21): reply with sendResponse + return true, not a returned promise
    fakeBrowser.runtime.onMessage.addListener((_msg, _sender, sendResponse) => {
      Promise.resolve('pong').then(sendResponse);
      return true;
    });
    expect(await fakeBrowser.runtime.sendMessage('ping')).toBe('pong');
  });
});
```
- Mock a WXT util by its **real path**, not `#imports`: `vi.mock('wxt/utils/inject-script', () => ({ injectScript: vi.fn() }))`. Look up real paths in `.wxt/types/imports-module.d.ts`.
- Testing an entrypoint's logic: extract it into `utils/` functions and test those. Entrypoint files themselves export a definition object, so call `definition.main()` only for simple cases.
- Not everything is implemented in fake-browser (e.g. `scripting`, `sidePanel`). `vi.spyOn`/stub those, or guard them with feature detection.
- DOM tests (content-script logic): set `test.environment: 'happy-dom'` (or `jsdom`) and install it.
- Libraries that depend on `webextension-polyfill` may need `ssr: { noExternal: ['pkg'] }` in the Vitest config.

## E2E tests: Playwright (Chromium only)

```sh
pnpm add -D @playwright/test && pnpm exec playwright install chromium
```
```ts
// e2e/fixtures.ts (from the official playwright-e2e-testing example)
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
const pathToExtension = path.resolve('.output/chrome-mv3');       // run `wxt build` first

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,      // or `channel: 'chromium'` for headless with extensions
      args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw.url().split('/')[2]);
  },
});
export const expect = test.expect;
```
```ts
// e2e/popup.spec.ts
test('popup renders', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByRole('button')).toBeVisible();
});
test('content UI is injected', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page.locator('example-overlay')).toBeAttached();   // the shadow host tag = `name`
});
```
Playwright pierces open shadow roots in locators (WXT's default `mode: 'open'`). Firefox E2E: use `web-ext run` manually, or Puppeteer/WebDriver BiDi. There's no official WXT recipe.

## Where to see logs and errors

| Context | Chrome / Edge | Firefox |
|---|---|---|
| Background | `chrome://extensions` → Developer mode → your extension → "service worker" (Inspect views) | `about:debugging#/runtime/this-firefox` → Inspect |
| Popup | right-click the toolbar icon → Inspect popup (or open `chrome-extension://<id>/popup.html` in a tab to debug comfortably) | about:debugging → Inspect, or open `moz-extension://<uuid>/popup.html` |
| Side panel / options / pages | right-click inside → Inspect | right-click → Inspect |
| Content script | the web page's DevTools console; pick your extension in the **context dropdown** (top of the Console) | page DevTools console (content scripts are shown) |
| Build-time errors | the terminal running `wxt` | same |

`chrome://extensions` "Errors" button collects uncaught errors from all contexts. In dev, list the dynamically registered content scripts from the SW console with `await chrome.scripting.getRegisteredContentScripts()`.

## Error → cause → fix

| Symptom / message | Cause | Fix |
|---|---|---|
| `ERROR Browser.xyz.addListener not implemented.` / `document is not defined` / `window is not defined` during build or `wxt prepare` | runtime code at module top level, executed when WXT imports the entrypoint in Node | move it inside `main()`; debug with `wxt prepare --debug` |
| `Extension context invalidated.` | old content script still running after the extension reloaded/updated | use `ctx` helpers / check `ctx.isValid`; reload the tab; harmless after dev reloads |
| `Could not establish connection. Receiving end does not exist.` | no listener: content script not injected in that tab (opened before install, restricted URL, not matched), or the popup closed | inject on demand / reload tabs on install, catch the error, check `matches` |
| `The message port closed before a response was received.` | async `onMessage` listener didn't `return true` | `return true` and call `sendResponse` later |
| Message reply is `undefined` | returned a promise from `onMessage` on Chromium | `sendResponse` + `return true`, or a messaging library |
| Content script doesn't run at all | `matches` wrong; SPA navigation; restricted page; Firefox MV3 host permission not granted; file in the wrong place (nested too deep) | check `matches`; see the SPA section; `permissions.request`; run `scripts/wxt-env.mjs` |
| Content script missing from `manifest.json` in dev | expected: WXT registers them at runtime in dev | inspect a production build |
| UI unstyled in content script | `cssInjectionMode` not `'ui'`, CSS not imported in the entry, or a portal rendering outside the shadow root | see `content-scripts.md` |
| `shadow.querySelector('body')` is `null` | 0.21 shadow root has no html/head/body | use the `container`/`shadow` arguments |
| UI size differs between sites | page `<html>` font-size affects `rem` | rem→px PostCSS step |
| `Failed to mount content script UI: could not find anchor element` | anchor not in DOM yet | `ui.autoMount()` or wait for the element |
| `"x" cannot have a shadow root attached to it` | invalid `name` for `createShadowRootUi` | kebab-case with a dash: `my-ext-ui` |
| `autoMount and Element anchor option cannot be combined` | passed an Element to `anchor` with autoMount | pass a selector string |
| `Failed to load styles @ chrome-extension://…/content-scripts/x.css` | `cssInjectionMode: 'ui'` but no CSS imported | import the CSS in the content script entry |
| Images/fonts 404 on the page | asset path resolved against the website | `browser.runtime.getURL()` + `web_accessible_resources` |
| `Refused to execute inline script` / `Refused to load the script` (CSP) | remote/inline scripts in extension pages, or the MV2 `injectScript` on strict-CSP sites | bundle code; use MV3 `injectScript` (src-based) |
| `Could not load content script… not UTF-8 encoded` | a dependency contains unsupported unicode | `experimental: { escapeUnicode: true }` |
| Service worker "inactive" / state lost | MV3 SW terminated after idle | store state in `storage.session/local`; register listeners synchronously |
| Listener never fires after the SW wakes | listener registered asynchronously (after `await`) | register at the top of `main()` |
| `Cannot use import statement outside a module` in background | `import()`/ESM issues | default IIFE is fine; for ESM set `type: 'module'` (MV3 only) |
| Browser doesn't open on `wxt` | `web-ext` not installed (0.21), or `webExt.disabled` | `pnpm add -D web-ext`, or load `.output/chrome-mv3-dev` manually via "Load unpacked" |
| Logged out of sites on each dev run | fresh profile each run | persistent profile (`config.md` → Browser startup) |
| `Cannot find module '#imports'` / auto-import types missing | `.wxt` not generated or tsconfig not extending it | `wxt prepare`; `"extends": "./.wxt/tsconfig.json"` |
| TS errors after upgrading to 0.21 (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`) | new generated tsconfig | fix with `import type` and index checks, or revert via the `prepare:tsconfig` hook (`upgrading.md`) |
| `vite` peer missing / weird resolution errors on 0.21 | `vite` is now a required peer | `pnpm add -D vite` |
| Firefox: `Extension ID is required` / AMO rejects | missing `gecko.id` / `data_collection_permissions` | set `browser_specific_settings.gecko` |
| Update disabled the extension for users | new permissions/host permissions added | make new ones optional; test with extension-update-testing-tool |
| HMR doesn't work in content UI | expected for integrated/shadow root | `createIframeUi` gets HMR; otherwise rely on reloads |
| Changes to `wxt.config.ts` / manifest not applied | needs a dev server restart / extension reload | WXT restarts on config change; if stuck, stop and rerun `wxt` |
| File changes not detected (Docker/WSL/network drive) | no native fs events | `watchOptions: { usePolling: true }` |

## Debugging workflow that works

1. `node scripts/wxt-env.mjs` to get versions, entrypoints, and known pitfalls.
2. Reproduce with a production build when manifest/registration matters: `wxt build` → load `.output/chrome-mv3` unpacked.
3. `node scripts/inspect-manifest.mjs` to check that what the browser sees matches what you expect.
4. Read the console of the *right context* (table above).
5. Search the docs/issues: `node scripts/wxt-docs.mjs search "<error text>"`, then the GitHub issues `https://github.com/wxt-dev/wxt/issues?q=<error>`.
