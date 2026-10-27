# Security & store policy

Threat model: web pages are hostile, content scripts run inside them (treat them as possibly compromised), and the background/extension pages hold the privileges. Every privileged action must be decided in the background, never on the word of a page or content script.

### sec-no-remote-code: CRITICAL
Ship all executable code in the package: no CDN scripts, `eval`/`new Function`, fetched JS, `setTimeout('string')`, or `url:` imports (removed in 0.21). Remote *data* is fine, but not data that acts as code (fetched rule DSLs that run arbitrary logic, remote JS snippets stored then injected). Check dependencies too: libs that compile code at runtime (ajv without standalone mode, lodash `template`, some template engines) break the MV3 CSP. For user-written scripts (a userscript manager), use the `userScripts` API (Chrome: the user must enable "Allow User Scripts" for the extension; Firefox MV3: optional permission), not eval.

### sec-no-secrets-in-bundle: CRITICAL
`WXT_*`/`VITE_*` env values and anything in `app.config.ts` end up in the shipped JS. Ship only public identifiers (OAuth client id, analytics measurement id). Keep API keys, client secrets, and `api_secret`s on your server and proxy through it. Keep `.env.submit`/store credentials in CI secrets, never in git or the sources zip.

### sec-no-privileged-proxy: CRITICAL
Never build background handlers that do whatever a message says: `fetch(msg.url)`, `tabs.create({ url: msg.url })`, `scripting.executeScript` with message-chosen code/files, `cookies.get` for any domain, `downloads.download(msg.url)`. A compromised content script (or a page that reaches it) turns that into a universal proxy with your permissions. Expose narrow, named actions (`getProfile`, `saveNote`) with fixed endpoints; if a URL must come from a message, parse it with `new URL()` and allowlist protocol (`https:`) and host.

### sec-validate-senders: HIGH
In `runtime.onMessage`, check `sender.id === browser.runtime.id`, and for content-script messages use `sender.tab`/`sender.frameId`/`sender.origin` (or `sender.url`) to know where it came from, especially with `allFrames: true` (ads and third-party iframes run your script too). In `onMessageExternal`/`onConnectExternal`, allowlist `sender.origin` or `sender.id`. Validate the payload shape (TypeScript types are not runtime checks; use a type guard or zod/valibot) before acting.

### sec-untrusted-page-data: HIGH
Treat DOM content, URLs, page titles, `postMessage`, `CustomEvent`s, main-world messages, and `onMessageExternal` as hostile. On `window` `message` listeners check `event.source === window` and `event.origin`; when posting, pass a specific `targetOrigin`, never `'*'` for anything sensitive. Anything you put in the main world (or `postMessage`) is readable and forgeable by the page: never pass tokens, user data, or privileged capabilities there.

### sec-safe-dom-writes: HIGH
Insert text with `textContent`/React rendering, not `innerHTML`/`insertAdjacentHTML`/`outerHTML`/`document.write`/`dangerouslySetInnerHTML` with untrusted strings. Sanitize (DOMPurify) when HTML is unavoidable. Don't set `href`/`src` from untrusted data without checking the protocol (`javascript:`). AMO review flags every `innerHTML` assignment, so `web-ext lint` must be clean.

### sec-shadow-dom-is-not-a-boundary: HIGH
`createShadowRootUi` isolates styles, not data: the page can read and script it (closed mode only slows it down), observe keystrokes in it, and fake clicks. For sensitive UI (passwords, tokens, payment, account actions) use `createIframeUi` with an extension page, the popup, or the side panel. Never auto-act on page-generated clicks for sensitive actions; require a real user gesture in extension UI.

### sec-token-storage: HIGH
Store tokens in `session:` (memory) when re-auth is cheap, or `local:` when they must survive restarts; never `sync:` (copied to every device/account) and never in page `localStorage`/cookies. Don't call `storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })` when session holds secrets: it exposes the whole area to content scripts. Content scripts should ask the background to do the authenticated call, not hold the token. OAuth: authorization code + PKCE + a random `state` that you verify on return; never embed a client secret.

### sec-least-exposure: MEDIUM
Minimize `web_accessible_resources` (each file lets any matched site fingerprint the extension, and WAR pages can be framed for clickjacking). Scope `matches`; on Chromium MV3 add `use_dynamic_url: true`. `externally_connectable.matches` lists exact origins only (never `<all_urls>`/wildcard TLDs). Request `activeTab`/optional host permissions instead of `<all_urls>`; never list `http://` hosts when `https://` works.

### sec-csp-strict: MEDIUM
Keep the MV3 default CSP. Never add `'unsafe-eval'`, remote script hosts, or `'unsafe-inline'` to `extension_pages` (Chrome rejects them). WASM needs `'wasm-unsafe-eval'` (Firefox requires it explicitly). Code that needs eval goes in a `sandbox` page (Chromium only; no extension APIs, talk via `postMessage`). WXT's dev CSP (localhost) appears only in dev builds; check the production manifest.

### sec-supply-chain: MEDIUM
Every dependency runs with your extension's permissions and ships to all users on auto-update. Commit the lockfile, install with `--frozen-lockfile` in CI, prefer few well-known deps, run `pnpm audit`, and allow postinstall scripts only for packages that need them (pnpm `onlyBuiltDependencies`). Protect store accounts with 2FA and use a dedicated publishing service account with the smallest role.

### sec-privacy-and-data-policy: MEDIUM
Collect only what the single purpose needs; disclose it in the store's privacy fields and a privacy policy; for Firefox declare it in `gecko.data_collection_permissions`. Analytics must be opt-in or disclosed (WXT `@wxt-dev/analytics` `enabled` item). Don't log page content, tokens, or URLs to remote services; strip them from error reports. Send data only over HTTPS. Per-store rules and dates: `../store-policies.md`.
