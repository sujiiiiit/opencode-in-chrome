# Background long-running work in MV3

The MV3 service worker can be terminated after ~30 s idle (extension API calls and events reset the timer; Chrome 116+ allows active WebSocket traffic to extend it). Options:
- `browser.alarms` for periodic work (minimum period 30 s in Chrome 120+).
- Persist progress in `storage.session`/`local` and resume on wake.
- **Offscreen document** (Chromium, permission `offscreen`) for DOM parsing, audio, clipboard, long-lived WebSockets/streams; create it from the background with a `reasons` + `justification`.
- Firefox MV3 uses a non-persistent *event page* (DOM available, still suspended when idle). Firefox MV2 can use `persistent: true` (in `defineBackground`).

**Recommend:** design for termination (state in storage, listeners registered synchronously at the top of `main()`); reach for offscreen only for DOM/streaming needs.
