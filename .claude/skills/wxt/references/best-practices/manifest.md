# Manifest & permissions

### manifest-minimal-permissions: CRITICAL
Request only what you use. Every permission must be justified in the store listing, and unused or broad ones cause rejections, review delays, and install drop-off.
| Instead of | Use | Why |
|---|---|---|
| `<all_urls>` host access | `activeTab` (+ `scripting`) | access to the current tab only after a user gesture, no install warning |
| `tabs` | `activeTab`, or none | `tabs.query`/`create`/`update` work without `tabs`; it's only needed to read `url`/`title` of arbitrary tabs |
| `host_permissions: ['*://*/*']` | specific domains | narrower warning, less risk |
| `webRequest` blocking | `declarativeNetRequest` | required in Chromium MV3 |
| `cookies` + hosts to read your own site's session | background `fetch` with `credentials: 'include'` + host permission | fewer permissions |
Dev builds add `tabs`/`scripting`/localhost by themselves. Audit a **production** build (`inspect-manifest.mjs`).

### manifest-use-optional-permissions: HIGH
Put feature-specific permissions in `optional_permissions` / `optional_host_permissions` and request them when the user enables the feature. `browser.permissions.request` must be called directly from a user-gesture handler (no `await` before it). Check with `permissions.contains` before use, and handle denial and later revocation (`permissions.onRemoved`).
```ts
async function enableBookmarkSync() {               // called from onClick
  const granted = await browser.permissions.request({ permissions: ['bookmarks'] });
  if (!granted) return showDenied();
  await settings.setValue({ ...(await settings.getValue()), bookmarkSync: true });
}
```

### manifest-web-accessible-resources: HIGH
Anything in `web_accessible_resources` can be loaded by websites, which allows extension fingerprinting and probing. List only what content scripts/pages need (injected main-world scripts, fonts, images, iframe pages) and scope `matches` to the sites that need them. Chromium also supports `use_dynamic_url: true` to rotate the URL per session; test that your `getURL`-based loads still work when you enable it. CSS for content scripts doesn't need to be web-accessible: import it in the entry (`cssInjectionMode`) instead.

### manifest-content-security-policy: HIGH
MV3 extension pages can't use `'unsafe-eval'`, `'unsafe-inline'` scripts, or remote script hosts. Allowed: `"script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"`. Code needing `eval` (template engines, some sandboxed libs) goes in a **sandbox page** (`entrypoints/sandbox.html`, Chromium only), with `content_security_policy.sandbox` and `postMessage` to talk to it. Sandbox pages have no extension APIs. Don't hand-copy the dev CSP that WXT injects for the dev server.

### manifest-let-wxt-generate: HIGH
Don't hand-write keys WXT generates from entrypoints (`side_panel`/`sidebar_action`, `action.default_popup`, `options_ui`, `background`, `content_scripts`, `chrome_url_overrides`, `devtools_page`, `sandbox.pages`). Create the entrypoint and let WXT emit the right shape per browser. Write global keys in MV3 form (WXT converts them for MV2) and use the function form `manifest: ({ browser, manifestVersion, mode }) => ({…})` for differences.

### manifest-version-from-package-json: MEDIUM
Bump `version` in package.json (WXT derives `version` + `version_name`). Never set `manifest.version` manually per build.
