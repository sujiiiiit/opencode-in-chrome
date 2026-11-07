# Drive the running development extension

Use this workflow when working in the WXT development Chrome. `http://localhost:3000` is WXT's build and hot reload server. Chrome's CDP endpoint is `http://127.0.0.1:9222` by default. They are different ports.

## Start with the existing browser

From the repository root:

```powershell
node scripts/dev-cdp.mjs status
node scripts/dev-cdp.mjs inspect
node scripts/dev-cdp.mjs screenshot .wxt/sidepanel.png
```

`status` lists page targets without changing them. `inspect` reads the existing extension side panel, including its current chat. `screenshot` saves a visual check. For more complex interaction, connect Playwright to the same endpoint:

```js
import { chromium } from '@playwright/test';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const pages = browser.contexts().flatMap((context) => context.pages());
const panel = pages.find((page) => /^chrome-extension:\/\/[^/]+\/sidepanel\.html(?:\?|$)/.test(page.url()));
if (!panel) throw new Error('Open the extension side panel first');
console.log(await panel.title());
// Use panel.getByRole(...), panel.locator(...), and panel.screenshot(...).
await browser.close(); // Disconnects Playwright; it does not close the running Chrome.
```

Reuse this browser and its `.wxt/chrome-profile`. Do not call `chromium.launch()` or start another `pnpm dev` while port 9222 is live. Do not clear the profile to troubleshoot a UI issue; it holds tabs, login, and pairing state.

## If the extension or browser disappears

First check `node scripts/dev-cdp.mjs status`. WXT may be reloading the extension after a core change while Chrome is still alive. Wait for the side panel target to return, then reopen the side panel if needed. If CDP is unavailable, run:

```powershell
node scripts/dev-cdp.mjs ensure
```

`ensure` reuses Chrome when reachable. Otherwise it starts `pnpm dev` in the background, waits for CDP, and writes output to `.wxt/dev-cdp.log`. It never kills an existing process. If a manually started `pnpm dev` must be stopped for a core extension change, stop that dev-server process in its own terminal, then run `ensure`. After Chrome returns, inspect the side panel again and resume; the persistent profile normally retains pairing. If port 9222 is occupied by another process or WXT reports a different port, resolve that conflict or set `WXT_CDP_PORT` for the helper to match the WXT run.

## First pairing or lost pairing

The browser agent requires opencode 2.2.5 or newer. Find the extension ID in `chrome://extensions`, then start a server that accepts the extension origin:

```powershell
opencode serve --cors chrome-extension://YOUR_EXTENSION_ID
```

Leave the server running. In another terminal run `opencode pair --url <server URL printed by serve>`. Copy the pairing link it prints. With the extension side panel showing **Connect to opencode**, pipe the link to the helper, or paste it into **Pairing link or code** and press **Connect with link**:

```powershell
$pairLink = Read-Host 'Pairing link'
$pairLink | node scripts/dev-cdp.mjs pair
Remove-Variable pairLink
```

The helper enters the link through the visible UI and prints the resulting panel text. Do not commit or log the pairing link. If the side panel already shows a chat, pairing is already present. Turn on **Let chats use the browser** in Settings when the browser tools are needed. Pairing and browser access are separate settings.

## Agent operating rules

1. Check `status`, then `inspect`, before interacting. Preserve the user's current chat and tabs.
2. Use Playwright locators against the observed page. Reinspect after a reload or a failed action. Verify the visible result of each action.
3. Use CDP for development inspection and UI testing. For an agent acting *inside* the extension chat, use its registered `browser_*` tools and their tab scope and approval rules.
4. Keep sign-in, passwords, one-time codes, CAPTCHA, and payment details with the user. Never expose pairing credentials in screenshots, logs, or reports.
