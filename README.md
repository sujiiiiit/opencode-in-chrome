# Opencode

## Browser agent setup

The browser agent needs opencode 2.2.5 or newer and a local server that allows the extension's origin. Find the extension ID on `chrome://extensions`, then start the server with:

```powershell
opencode serve --cors chrome-extension://YOUR_EXTENSION_ID
```

Run `opencode pair --url <server URL printed by serve>`, open its link in the extension's browser, and turn on browser access in Settings. The `--cors` origin is required for the client-MCP ticket request; the default `opencode service start` command does not expose a CORS option. Keep the server running while using browser tools.

## Shared development browser

Start the extension once and leave the WXT-managed Chrome window open:

```powershell
pnpm dev
```

That browser uses a persistent profile at `.wxt/chrome-profile` and exposes
the Chrome DevTools Protocol on `http://127.0.0.1:9222`. You and an automation
agent can use the same running browser: use the window normally, while the
agent connects to port 9222 to inspect and drive extension pages. WXT applies
extension changes through its normal development reload, so restarting Chrome
for each edit is unnecessary.

WXT's development server already uses port 3000 for builds and hot reload. It
is not the extension UI or a browser-control endpoint, so the dedicated CDP
port must be different.

The profile is intentionally separate from your everyday Chrome profile and is
ignored by Git. Closing `pnpm dev` closes the browser, but its tabs, login state,
pairing information, and extension storage remain available on the next run.

To use another debugging port for a particular run:

```powershell
$env:WXT_CDP_PORT = '9222'
pnpm dev
```

Only one process can listen on the configured debugging port at a time.

For reusable CDP commands, recovery, and first pairing, see [the development browser guide](docs/dev-browser-cdp.md).
