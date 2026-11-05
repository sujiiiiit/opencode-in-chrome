# Live probe of Claude in Chrome tools (2026-11-05)

Exercised from Claude Code via the `claude-in-chrome` MCP server against httpbin.org/forms/post,
an injected test DOM, httpbin.org/html and news.ycombinator.com. Extension id seen in network log:
`mgijmfgdpljgnhcmokgeokdibogckgoj`. Windows, DPR 1, window 1920 wide.

## Output formats

- `tabs_context_mcp` → JSON `{availableTabs:[{tabId,title,url}], selectedTabId, tabGroupId}` plus a
  "Tab Context" text footer. Every other tool also appends this footer ("Executed on tabId …").
- `read_page filter=interactive` → flat lines: `role "name" [ref_N] attr="…"`, e.g.
  `textbox [ref_2] type="tel"`, `link "login" [ref_10] href="login?goto=news"`,
  `combobox "Banana" [ref_30]` with child `option "Banana" (selected) value="b"`. Ends with `Viewport: 1920x911`.
- `read_page filter=all` → same lines, indented one space per depth, includes labels, groups,
  `generic` text containers (`generic "766 points" [ref_182]`), hidden elements (`display:none` button shown).
- Truncation: `[output truncated at 1500 of 10553 characters. Pass a larger max_chars … or use ref_id or a smaller depth to focus.]`
- Sizes: HN front page interactive = 10.5k chars (~175 refs); `all` at depth 4 = 20.3k chars.
- `find` → `- ref_4: radio "small" (radio) - <LLM-written explanation>`; failure is an LLM sentence. It is
  an LLM call over the same tree (it could not see elements the tree lacks). Adds latency + cost.
- `get_page_text` → `Title:\nURL:\nSource element: <body>\n---\n<text>` (readability-style main element).
- `form_input` → `Set text value to "Test User" (previous: "")`; for radio just `ok`.
- `computer left_click ref` → `Clicked on element ref_8`; `type` → `Typed "…"`; `key` → `Pressed 1 key: ctrl+a`.
- `screenshot` → `Successfully captured screenshot (784x372, jpeg) - ID: ss_2834cf3h8 — 0.5-scale view; coordinate frame: 1568x744.`
  Viewport 1920x911 → coordinate frame capped at 1568 px wide (scale 0.8167). Image is JPEG.
- `zoom` → `captured zoomed screenshot of region (0,0) to (400,200) - 245x123 pixels`.
- `javascript_tool` → JSON of last expression, REPL semantics. Runs in the page MAIN world
  (sees other extensions' main-world globals; `window.__claudeElementMap` / `__generateAccessibilityTree`
  are NOT visible there → the tree builder runs in the isolated world).
- `read_console_messages` → `[1] [20:31:24] [LOG]\nprobe-log 1`.
- `read_network_requests` → `1. url: … method: GET statusCode: 200`. Tracking starts on first call
  (note says so). No type, size, timing or headers. Includes `data:` URLs and the extension's own
  `injectIneligible.js` (noise).
- `browser_batch` → concatenated `[tool] result` strings; on error: `actions[3] (computer:left_click) failed: … (3 completed, 0 remaining)`.
  Images from a batch that later errors are dropped ("[Image omitted due to error]").
- `list_connected_browsers` → `[{deviceId,name:"Browser 1",osPlatform,connectedAt,isLocal,inUse}]`.

## Behaviours

- Refs are stable across calls in the same document (ref_1 same in interactive and all reads; new
  elements get the next number, ref_30+ after DOM rewrite). Removed element → `No element found with
  reference: "ref_1". The element may have been removed from the page.` (fail closed).
- Viewport height dropped 911 → 855 after the first click: the "started debugging this browser"
  infobar appeared, i.e. `chrome.debugger` attaches lazily on first input action.
- **Not covered by read_page/find: open shadow roots, closed shadow roots, same-origin srcdoc iframes,
  cross-origin iframes.** Only reachable via screenshot + coordinates.
- `interactive` omitted an element 3000 px below the fold that `all` listed (likely viewport/near-viewport filter).
- read_page does not report checkbox checked state, textarea value, or focused state (after typing
  "ring bell" the textbox line was unchanged; `cheese` was checked but line showed no state). Only
  `<select>` shows `(selected)` and textbox shows its value as name.
- Contenteditable shows as `generic "Editor"`; `role=button` div shows as button.
- Restricted pages (`chrome://newtab`) → `Can't interact with browser-internal or unparseable URLs. Navigate to a web page first.`
- After `tabs_close_mcp` inside a batch, the batch's notion of "current tab" went stale and the next
  navigate failed with `Tab … is not in the same group as the current tab` although the tab was in the group.
- `navigate` waits for load and returns only `Navigated to <url>` (no title, no snapshot).
- `navigator.webdriver` stays false.

## Improvement opportunities for our implementation

1. Pierce open shadow roots and same-origin frames; attach to OOPIFs via CDP for cross-origin.
2. Emit state: checked, value, focused, disabled, expanded, required.
3. Local deterministic `find` (text/role match, no LLM call) with optional semantic fallback.
4. Return a compact post-action delta (url/title change, new refs, dialogs) instead of bare "Clicked".
5. `navigate` returns title + optional interactive snapshot in one round trip.
6. Network log with type/status/size/duration, filtered to exclude extension/data URLs; start capture
   at tab adoption so pre-call requests are available.
7. Keep batch images even when a later item fails.
