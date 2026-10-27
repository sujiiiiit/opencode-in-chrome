# Authentication

| Option | Browsers | Notes |
|---|---|---|
| `browser.identity.launchWebAuthFlow` | Chromium, Firefox | generic OAuth2/OIDC with any provider; redirect to `browser.identity.getRedirectURL()` (permission `identity`) |
| `chrome.identity.getAuthToken` | Chrome only | Google accounts only; needs `oauth2.client_id` in the manifest (use the function form + env var) |
| Reuse the website's login (cookies) | all | background `fetch` with `credentials: 'include'` + host permission; or the `cookies` API |

**Recommend:** `launchWebAuthFlow` with authorization code + PKCE + a verified `state` for cross-browser builds; keep tokens in the background (`session:` or `local:`, never `sync:`) and let content scripts ask the background to make authenticated calls; never embed client secrets (token exchange needing a secret goes through your server).
