# Messaging

### msg-return-true-for-async: HIGH
With raw `runtime.onMessage`, reply asynchronously via `sendResponse` and **return `true` synchronously**. Don't make the listener `async`: an async function returns a Promise, not `true`, and returning promises isn't supported through WXT's un-polyfilled `browser` on Chromium (since 0.20).
```ts
// ❌ browser.runtime.onMessage.addListener(async (msg) => await work(msg));
// ✅
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'work') return;          // not handled: return undefined
  work(msg).then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});
```

### msg-type-safe-messaging: HIGH
Prefer `@webext-core/messaging` with a function-syntax protocol map: typed data and returns, async-safe, tab targeting built in (`sendMessage(type, data, tabId | { tabId, frameId })`). One `onMessage` handler per type per context. With raw APIs, type messages as a discriminated union and `switch` on `type` (exhaustiveness checks catch unhandled messages).

### msg-use-tabs-sendmessage: HIGH
Background/popup → content script uses `browser.tabs.sendMessage(tabId, msg, { frameId? })`. `runtime.sendMessage` from the background goes to extension pages (popup/options/side panel/offscreen), never to content scripts. Content scripts can't message other tabs directly; relay through the background.

### msg-handle-no-receiver: HIGH
`sendMessage`/`tabs.sendMessage` reject with "Could not establish connection. Receiving end does not exist." when nothing listens (no content script on that tab: opened before install, restricted URL, unmatched; popup closed). Catch it; for user-triggered features, inject on demand and retry once:
```ts
async function sendToTab(tabId: number, msg: unknown) {
  try { return await browser.tabs.sendMessage(tabId, msg); }
  catch (e) {
    if (!/Receiving end does not exist|Could not establish connection/.test(String(e))) throw e;
    await browser.scripting.executeScript({ target: { tabId }, files: ['content-scripts/content.js'] });
    return browser.tabs.sendMessage(tabId, msg);
  }
}
```
`@webext-core/messaging` still throws in this case (it surfaces "no listener" as an error), so the same try/catch applies.

### msg-use-ports-for-streams: MEDIUM
For streams (progress, chat tokens, live updates) use `runtime.connect({ name })` ↔ `runtime.onConnect` instead of polling with `sendMessage`. Always handle `port.onDisconnect` (the worker or page can go away); reconnect from the client side only while `ctx.isValid`. Clean up intervals/subscriptions on disconnect.

### msg-avoid-circular-messages: MEDIUM
A handler that broadcasts a message can wake other listeners that broadcast back (popup ↔ side panel ↔ background, or storage watchers that write storage). Use distinct request/result types, never re-broadcast a message type you handle, and don't `setValue` inside a `watch` callback for the same item without a guard. (`runtime.sendMessage` doesn't deliver to the sending context itself, but other extension pages do receive it.)

### msg-prefer-storage-for-state: HIGH
For "keep everyone in sync with this state", use a storage item + `watch()` in each context instead of messaging. It survives worker restarts, reaches every open context, and needs no receiver checks. Use messaging for commands and request/response.

### msg-validate-senders: HIGH
In the background, validate the shape of every incoming message and check `sender.id === browser.runtime.id` / `sender.url` / `sender.tab` before privileged actions. Messages from content scripts can be influenced by hostile pages. For `onMessageExternal`, allow-list `sender.origin`.
