# Network requests and CORS

- Content scripts make requests **as the web page** (subject to the page's CORS and CSP). Extension pages and the background make requests as the extension, and with matching `host_permissions` they bypass CORS.
- **Recommend:** do cross-origin `fetch` in the background (or an extension page) and message the result to the content script. Add only the hosts you need to `host_permissions`.
- Local servers: `http://localhost:<port>/*` in `host_permissions`. Firefox treats it the same way, but mixed content rules still apply to content scripts on https pages.
