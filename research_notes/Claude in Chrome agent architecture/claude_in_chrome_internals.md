# Claude in Chrome: Internals, Architecture and Tool Surface (as of Nov 2026)

Source-tier legend used throughout:
- **[OFFICIAL]** = Anthropic blog / support / docs page.
- **[SCHEMA]** = the live MCP tool schemas exposed by the `claude-in-chrome` MCP server inside a Claude Code session, read directly on 2026-11-05 (primary evidence of the current tool contract; no public URL, so cited as "Live MCP schema, 2026-11-05").
- **[COMMUNITY]** = third-party reverse engineering or reimplementation (unverified by Anthropic, may be version-specific or stale).

---

## 1. What Claude in Chrome is, launch history, and capabilities

### Takeaway
Claude in Chrome is Anthropic's Manifest V3 Chrome extension: a side-panel agent that sees and acts on web pages using the user's logged-in sessions. It went from a 1,000-user research preview (Aug 2025) to Max beta (Nov 2025), to all paid plans plus Claude Code integration (Dec 2025), to GA on every paid plan (26 Aug 2026). As of late 2026 the side panel runs as a "Cowork" session by default, with a "classic" panel still available.

### Cited Findings
- Timeline [OFFICIAL]:
  - **25 Aug 2025**: pilot announced for 1,000 Max-plan users from a waitlist — [Piloting Claude in Chrome](https://claude.com/blog/claude-for-chrome)
  - **24 Nov 2025**: beta for all Max subscribers, adding scheduled tasks, multi-tab workflows and better navigation on frequently used sites — [Piloting Claude in Chrome (update note)](https://claude.com/blog/claude-for-chrome); [Prompt injection defenses](https://www.anthropic.com/research/prompt-injection-defenses)
  - **18 Dec 2025**: extended to Pro, Team and Enterprise, with Claude Code integration and org-wide admin enable/disable plus site allowlists/blocklists — [Piloting Claude in Chrome (update note)](https://claude.com/blog/claude-for-chrome)
  - **26 Aug 2026**: "now generally available on every paid Claude plan", including autonomous actions that use "the same mechanism as auto mode in Claude Code" — [Claude in Chrome GA](https://claude.com/blog/claude-in-chrome-generally-available)
- Plans: Pro, Max, Ultra, Team, Enterprise. It works in the Chrome side panel, Claude Cowork and Claude Code — [Getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)
- Side panel: opened from the toolbar icon. On Max, Ultra and Team (and on Pro/Enterprise once the rollout reaches them or it is enabled) it runs as a **Cowork session**: sessions are saved, sync across surfaces, and support skills, plugins and connectors. The three-dot menu has "Switch back to classic" — [Getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)
- Features listed in the support article [OFFICIAL]:
  - Tab groups: Claude puts the tabs it opens in a separate, differently coloured group. Users can drag tabs into that group so Claude can view and act on all of them.
  - Claude can open, close and switch tabs.
  - **Shortcuts**: saved prompts, invoked with `/` in chat.
  - **Scheduled tasks** (daily, weekly, monthly or annually) set from a clock icon.
  - **Workflow recording**, classic panel only: record steps and save them as a shortcut.
  - Background workflows keep running while Chrome is open.
  - Image and screen-region capture, image uploads to forms.
  - "Enhanced navigation" for Slack, Google Calendar, Gmail, Google Docs and GitHub.
  - 1Password sign-in (beta, macOS): biometric approval, and Claude never sees the password.

  Source: [Getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)
- Browser support conflict:
  - The support article and the GA post say **Chrome only**, not other Chromium browsers or mobile — [Getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome); [GA post](https://claude.com/blog/claude-in-chrome-generally-available)
  - The Claude Code docs say the integration works with Chrome **and Microsoft Edge**, and that Claude Code also detects the extension in Brave, Arc, Vivaldi and Opera. It is not supported in WSL — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- Chrome Web Store ID: `fcoeoabgfenejglbffodgkkbkcdhcgfn`. Claude Code requires extension version 1.0.36 or later — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- Claude Desktop: enabled under Settings > Customize > Connectors > Claude in Chrome. It is off by default in each chat and must be turned on per conversation — [Getting started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)
- HIPAA Enterprise organizations have it off by default, and the BAA does not cover data sent to third-party sites — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)

### Inferences
- The "Chrome only" statement probably applies to the side-panel product as supported by Anthropic. Claude Code's MCP bridge works in practice wherever the extension installs, since it uses Chromium native messaging with per-browser host-manifest paths.
- The move to a Cowork-based side panel suggests the agent loop is shifting from in-extension code (the classic panel) toward Anthropic's shared Cowork harness. In that model the extension mostly becomes a tool executor.

### Gaps
- No official date for when the Cowork side panel became the default.
- No official changelog of extension versions.

---

## 2. Tool surface: names, parameters, behaviour, and ref IDs

### Takeaway
The MCP surface that Claude Code sees today has 22 tools. Element targeting works two ways: by pixel coordinates from screenshots, or by `ref_N` IDs. The refs come from an in-page accessibility-tree walker (`read_page`) or from an LLM-backed semantic search over that tree (`find`). Mutating actions now carry an `action_summary` field, which the action-safety classifier and permission UI presumably consume.

### Cited Findings (current contract) [SCHEMA: Live MCP schema, 2026-11-05]
- **tabs_context_mcp** `{createIfEmpty?: bool}`:
  - Returns the tab IDs in the session's MCP tab group.
  - With `createIfEmpty`, it creates a new window with a new tab group holding an empty tab.
  - The description says each new conversation should create its own tab rather than reuse existing ones.
- **tabs_create_mcp** `{}`: creates an empty tab in the MCP group. Tabs created are "yours to clean up".
- **tabs_close_mcp** `{tabId: int}`: closes a tab, but only one in this session's group. Closing the last tab makes Chrome auto-remove the group.
- **navigate** `{url, tabId?}`:
  - `url` can be `"back"` or `"forward"`, and defaults to `https://` when no protocol is given.
  - When `tabId` is omitted standalone, it auto-calls `tabs_context_mcp{createIfEmpty:true}`.
  - `tabId` is required inside a batch and for back/forward.
- **computer** `{action, tabId, coordinate?, text?, duration?(≤10s), scroll_direction?, scroll_amount?(1–10, default 3), start_coordinate?, region?[x0,y0,x1,y1], repeat?(1–100), ref?, modifiers?, action_summary?, save_to_disk?, scale?(0.1–1)}`:
  - Actions: `left_click`, `right_click`, `double_click`, `triple_click`, `type`, `screenshot`, `wait`, `scroll`, `key`, `left_click_drag`, `zoom`, `scroll_to`, `hover`.
  - `ref` can replace `coordinate` for clicks, and is required for `scroll_to`.
  - Keys are space-separated with platform modifiers (`cmd+a` / `ctrl+a`). Page-zoom shortcuts return an error, so `zoom` (region capture) is the way to magnify.
  - `scale` shrinks the returned image, but "coordinates are ALWAYS in the full-resolution coordinate frame".
- **read_page** `{tabId, filter?: "interactive"|"all", depth?(default 15), ref_id?, max_chars?(default 50000)}`:
  - Returns an accessibility tree that includes non-visible elements by default.
  - Output over the limit is truncated at a line boundary, with a note giving the full size.
- **find** `{query, tabId}`: natural-language element search. It returns up to 20 matches with refs, and asks for a more specific query when there are more than 20.
- **form_input** `{ref, value: string|bool|number, tabId, action_summary?}`: booleans set checkboxes, and select elements take an option's value or text.
- **get_page_text** `{tabId}`: plain text, prioritising article content.
- **javascript_tool** `{action:"javascript_exec", text, tabId}`: runs in page context with REPL semantics. Top-level `await` works and the last expression is returned.
- **read_console_messages** `{tabId, pattern?(regex), onlyErrors?, clear?, limit?(100)}`: current domain only.
- **read_network_requests** `{tabId, urlPattern?(substring), clear?, limit?(100)}`: includes cross-origin requests, and is auto-cleared on navigation to a different domain.
- **gif_creator** `{action: start_recording|stop_recording|export|clear, tabId, download?, filename?, coordinate?, options?}`:
  - Options: `showClickIndicators`, `showDragPaths`, `showActionLabels`, `showProgressBar`, `showWatermark`, `quality` 1–30 (default 10).
  - Overlays include orange click circles, red drag arrows and an orange progress bar.
  - Scoped to the tab's group.
- **upload_image** `{imageId, tabId, ref? | coordinate?, filename?}`:
  - Uploads a recent screenshot, either to a file input via `ref` or by drag-and-drop via `coordinate`.
  - Screenshot IDs expire after a few minutes, and user-attached images are not accepted.
- **file_upload** `{paths[], ref, tabId}`:
  - Sets files on a file input, so Claude does not click file buttons (that opens a native picker it can't see).
  - Only session-shared files are allowed, and the total must be under 10 MB.
- **resize_window** `{width, height, tabId}`.
- **shortcuts_list** `{tabId}` and **shortcuts_execute** `{tabId, shortcutId?, command?}`: execution runs "in a new sidepanel window" and returns immediately.
- **list_connected_browsers** `{}`: returns `deviceId`, display name, OS platform, `isLocal`, `onThisComputer` and `inUse`.
- **select_browser** `{deviceId}`: selects a browser without broadcasting.
- **switch_browser** `{}`: broadcasts a connect request to every browser with the extension and waits up to 2 minutes for the user to click "Connect".
- **browser_batch** `{actions:[{name, input}]}`:
  - Runs actions sequentially and stops on the first error. Each item gets its own permission check, and batches cannot be nested.
  - Coordinates in a batch refer to the screenshot taken before the call. Images come back interleaved.
- `action_summary` is requested on every click, drag, key and type action and on `form_input`. It must "state the effect only… no passwords or other secrets."

### Cited Findings (implementation, older versions) [COMMUNITY]
These come from the sshh12 gist, which analysed extension **v1.0.56** and was written 1 Mar 2026 — [sshh12 gist](https://gist.github.com/sshh12/e352c053627ccbe1636781f73d6d715b)

- **Ref generation**:
  - `window.__generateAccessibilityTree(filter, depth, maxChars, refId)` is injected via `chrome.scripting.executeScript`. It walks the DOM and maps tags to ARIA roles (for example, `<a>` becomes `link`).
  - The accessible name comes from `aria-label`, `placeholder`, `title`, `alt`, an associated `<label>`, or text content.
  - Each element gets a persistent `ref_1`, `ref_2`, … stored in `window.__claudeElementMap` as `WeakRef`s.
  - `ref_id` scopes the walk to one subtree.
  - `<select>` options are listed with their value and selected state.
- **find**: sends the accessibility tree to a Claude model (`claude-sonnet-4-5`, `max_tokens: 800`) for semantic matching.
- **computer**:
  - Uses the built-in `computer_20250124` tool type.
  - Typing goes through CDP `Input.insertText`.
  - Scrolling is a CDP mouseWheel event with delta = `scroll_amount * 100`, followed by an auto screenshot.
- **form_input**: sets the value, then dispatches `input` and `change` events.
- **get_page_text**: prefers `article`/`main`-like selectors and picks the longest match.
- **navigate**: checks the domain against `api.anthropic.com/api/web/domain_info/browser_extension`.
- **Tools in v1.0.56 not exposed over MCP**:
  - `update_plan` (`domains`, `approach` 3–7 items, used for plan approval)
  - `turn_answer_start` (internal)
  - non-MCP `tabs_context` / `tabs_create` (the side-panel group, separate from the MCP group)
- **Page-type tool gating**:
  - `chrome://`, `chrome-extension://` and `about:blank` get only `navigate`.
  - The Chrome Web Store gets `navigate` only, with no script injection.
- **Quick mode** (side panel):
  - Sends `tools: []` with stop sequence `\n<<END>>`.
  - Uses a compact single-letter command language, for example `C` click, `T` type, `K` key, `S` scroll, `N` navigate, `J` JavaScript, `W` wait, `PL` plan.
  - Returns a screenshot after each batch.
  - Supports `effort` (beta `effort-2025-11-24`) and a `[fast]` model suffix (beta `fast-mode-2026-02-01`).
- An open-source clean-room clone, "open-claude-in-chrome", claims tool parity for the core 15 tools. It stubs `gif_creator` and the shortcuts tools, does not support `browser_batch` (offering an `execute_code` sandbox instead), and replaces `list_connected_browsers`/`select_browser` with `switch_browser` — [noemica-io/open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)

### Inferences
- **Refs.** The `WeakRef` element map means refs survive across calls while the node still exists, and can't leak detached nodes. Refs are page-lifetime scoped and become invalid after navigation.
- **Two-path targeting.** The vision path uses screenshot coordinates with the `computer` tool. The DOM path uses refs with `form_input`, `file_upload`, `scroll_to` and ref-clicks. For robustness, a clone should implement both.
- **Batching.** `browser_batch` exists to cut model round-trips, the same goal as the classic panel's "quick mode" command language.

### Gaps
- No official documentation of `read_page` output format (indentation, attributes shown). The gist describes semantics but not exact line format.
- Whether `find` still uses a secondary model call in current versions is unverified.

---

## 3. How it controls the browser technically

### Takeaway
According to community teardown, the extension drives tabs through `chrome.debugger` (CDP 1.3) for input, screenshots, console and network, and injects scripts with `chrome.scripting` for the accessibility tree and refs. Agent tabs are scoped with Chrome tab groups that show a working animation, and the extension's own overlay is hidden during screenshots.

### Cited Findings
- [COMMUNITY] All from the [sshh12 gist](https://gist.github.com/sshh12/e352c053627ccbe1636781f73d6d715b):
  - MV3 extension with a React side panel. The Anthropic JS SDK runs in-browser (`dangerouslyAllowBrowser: true`).
  - Auth is OAuth PKCE with scopes `user:profile user:inference`, plus a feature-gated manual API key.
  - Automation runs through `chrome.debugger.attach(tabId, "1.3")`.
- [COMMUNITY] Screenshots (same gist):
  - Captured with CDP `Page.captureScreenshot` (PNG) and downscaled on Retina displays.
  - Resizing targets a token budget with `pxPerToken: 28` and `maxTargetPx: 1568`.
  - The scaling context is stored so model coordinates map back to the viewport.
  - The Claude overlay is hidden before screenshots and clicks (`HIDE_FOR_TOOL_USE`) and restored afterwards (`SHOW_AFTER_TOOL_USE`).
- [COMMUNITY] Tab groups (same gist):
  - `TabGroupManager` keeps state in `chrome.storage.local`.
  - Each session has a main tab and optional secondary tabs.
  - When tabs change, the new tab context is injected into the conversation as `<system-reminder>`.
  - The group shows an animated loading indicator while working and a checkmark when done.
- [COMMUNITY] Other components and limits (same gist):
  - rrweb for workflow recording.
  - `chrome.alarms` for scheduled prompts.
  - Message compaction at about 25 MB, which replaces old base64 images with placeholders.
  - The main loop streams `claude-sonnet-4-5-20250929` with `max_tokens: 10000` (as of v1.0.56; now likely user-selectable, since the support article says "available on all public models").
- [OFFICIAL] JavaScript dialogs (alert/confirm/prompt) block browser events and stop Claude from receiving commands. The fix is to dismiss them manually — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] The MV3 service worker can go idle in long sessions. That breaks the connection and produces errors like "Receiving end does not exist" — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] In Claude Code local sessions, `/clear` closes the session's tab group. `/resume` or exit closes it only if it holds nothing but empty tabs — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [SCHEMA] Agent actions are restricted to "a tab in the current group". GIF overlays and scoping are per tab group — Live MCP schema, 2026-11-05.

### Inferences
- Attaching `chrome.debugger` shows Chrome's "is debugging this browser" infobar. This is an inherent visual indicator of this design (not explicitly confirmed in the sources found).
- Reading console and network logs most plausibly uses the CDP `Runtime`/`Log` and `Network` domains while the debugger is attached. This would explain why they are "current domain only" or cleared on cross-domain navigation.

### Gaps
- No official architecture description from Anthropic. All internals are community-sourced from one version (v1.0.56).
- The lzwjava architecture page returned 404 and could not be checked.

---

## 4. How Claude Code / Claude Desktop connect to the extension

### Takeaway
There are two transports.

- **Local:** Chrome native messaging. Claude Code installs host `com.anthropic.claude_code_browser_extension`, and Claude Desktop uses `com.anthropic.claude_browser_extension`. On Windows a named pipe links the host and the CLI.
- **Cloud relay:** `bridge.claudeusercontent.com`. This enables multiple connected browsers (deviceIds) per account and remote sessions.

Claude Code exposes the extension as the `claude-in-chrome` MCP server, enabled with `claude --chrome` or `/chrome`.

### Cited Findings
- [OFFICIAL] Enabling the integration:
  - Start with `claude --chrome`, or turn on "Enabled by default" from `/chrome`. That one setting is shared with VS Code, where `@browser` connects on demand.
  - `/chrome` shows status, manages permissions, reconnects, and selects a browser.
  - It requires a `/login` claude.ai sign-in. API-key or `setup-token` auth keeps Chrome off.
  - It is not available via Bedrock, Vertex or Foundry.

  Source: [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] Native messaging host file: `com.anthropic.claude_code_browser_extension.json`. It is installed on first enable, and Chrome must restart to read it.
  - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
  - Linux: `~/.config/google-chrome/NativeMessagingHosts/`
  - Windows: registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\`
  - Edge and Brave have equivalent paths.

  Source: [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] Windows: "Named pipe conflicts (EADDRINUSE)" occur when another Claude Code session holds the pipe — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] Cloud bridge:
  - The errors "Browser extension is not connected" and "No browsers are connected" can come from failing to reach `bridge.claudeusercontent.com` (IP allowlists), or from the extension being signed into a different account or organization.
  - The extension must be signed into the same org as Claude Code.

  Source: [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] Multiple browsers: when more than one is connected, the user picks one, and the choice persists even if another connects later — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [SCHEMA] Device discovery: each browser has a `deviceId`. `select_browser` targets one directly, and `switch_browser` broadcasts a pairing request that the user confirms with "Connect" inside Chrome — Live MCP schema, 2026-11-05.
- [OFFICIAL] File uploads: Claude Code reads the file itself and sends the contents to the browser, so uploads work in remote sessions too. Uploads are refused for:
  - more than 10 MB in total
  - hard-linked files
  - credential-like names such as `.env`, `.pem`/`.key`, or anything under `.ssh` (v2.1.293+)
  - files that Read permission rules deny

  Source: [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] Project-level `.claude/settings.json` cannot set `CLAUDE_CODE_ENABLE_CFC=1`, so a cloned repo can't connect Claude to the browser. Org admins can block the MCP server with the `deniedMcpServers` managed setting — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [COMMUNITY] Native messaging protocol in v1.0.56:
  - The extension connects with `chrome.runtime.connectNative()` to either host name.
  - Messages: `ping`/`pong`, `get_status`, `tool_request` (`method: "execute_tool"`), `tool_response`, `mcp_connected`/`mcp_disconnected`.
  - The extension can also call remote MCP servers (`tools/list`, `tools/call`), gated by a `REMOTE_MCP` permission.

  Source: [sshh12 gist](https://gist.github.com/sshh12/e352c053627ccbe1636781f73d6d715b)
- [COMMUNITY] The clean-room clone's chain is `Claude Code <-stdio MCP-> mcp-server.js <-TCP / named pipe / unix socket-> native-host.js <-native messaging-> extension` — [open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)

### Inferences
- Likely official flow: the Claude Code CLI acts as an MCP server in-process. Chrome spawns the native host (a Claude Code binary in host mode), which relays to the running CLI over a local socket or named pipe. Alternatively, both sides connect through the authenticated cloud bridge, which is why same-org sign-in matters and how remote sessions and multiple devices work. The exact split between the local and bridge paths is not documented.

### Gaps
- Bridge message format and authentication are undocumented.
- It is unknown whether the local native-messaging path is still primary or now only a fallback to the bridge.

---

## 5. Safety model

### Takeaway
The safety design is layered:
- per-site permissions, granted once or always
- three approval modes (Manually approve, Automatically approve, Skip all approvals)
- blocked site categories and admin allow/blocklists
- prompt-injection probes that scan tool results
- an action classifier that checks each action against the user's request
- hard-coded confirmations for high-risk actions

Published prompt-injection attack success rates (ASR) fell from 23.6%/11.2% (Aug 2025) to about 1–2% (Nov 2025). With the GA safeguards (Aug 2026) they are 0% for Sonnet 5, Opus 5 and Mythos 5, and 0.3% for Fable 5.

### Cited Findings
- [OFFICIAL] Modes (from the permissions guide; undated, "updated this week"):
  - **Manually approve** (formerly "Ask before acting"): Allow or Deny for each action.
  - **Automatically approve**: each action is reviewed for exfiltration or injection and unsafe ones are blocked. Repeated blocks revert to per-step prompts. This is the Cowork panel default.
  - **Skip all approvals** (formerly "Act without asking"): no checks.

  Source: [Permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide)
- [OFFICIAL] Site permissions:
  - Prompt options are "Allow this action" (one action only), "Always allow actions on this site" and "Decline". In the Cowork panel they read "Allow all for this website", "Allow this time only" and "Deny".
  - Granted sites are listed under "Your approved sites", with revoke and history.
  - Downloads, sensitive information and authorizations still require approval even under Always allow.
  - Prohibited regardless of mode: purchases and financial transactions, creating accounts, card or ID data, untrusted downloads, permanent deletions, trades, and following instructions from emails or web content.

  Source: [Permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide)
- [OFFICIAL] Launch-era mitigations:
  - Site-level permissions and confirmation before publishing, purchasing or sharing personal data.
  - Blocked categories: financial services, adult content, pirated content.
  - Defenses against hidden DOM form fields and against injections in URL text and tab titles.

  Source: [Piloting Claude in Chrome](https://claude.com/blog/claude-for-chrome)
- [OFFICIAL] ASR, Aug 2025:
  - 123 test cases across 29 scenarios, all run in autonomous mode: 23.6% without mitigations, 11.2% with them.
  - Browser-specific set of 4 attack types: 35.7% fell to 0%.
  - Example: before mitigations, a phishing email led Claude to delete the user's emails without confirmation.

  Source: [Piloting Claude in Chrome](https://claude.com/blog/claude-for-chrome)
- [OFFICIAL] ASR, 24 Nov 2025, adaptive Best-of-N attacker with 100 attempts per environment (model only → old safeguards → improved safeguards):
  - Opus 4.5: 8.0% → 7.6% → **1.4%**
  - Sonnet 4.5: 13.8% → 10.8% → 1.9%
  - Haiku 4.5: 12.0% → 11.1% → 2.4%
  - Sonnet 4: 13.8% → 10.7% → 2.0%

  The safeguards were RL training on injections in simulated web content, plus classifiers that scan all untrusted content (hidden text, manipulated images, deceptive UI). The post says "1% … still represents meaningful risk" — [Prompt injection defenses](https://www.anthropic.com/research/prompt-injection-defenses)
- [OFFICIAL] ASR, 26 Aug 2026 GA:
  - The old evaluation was retired as saturated: 0 successes against Fable 5, Opus 5 or Sonnet 5 even without safeguards.
  - New professional red-team evaluation, before safeguards: Opus 4.5 17.6%, Opus 5 3.8%. Opus 4.5 with probes: 16.7%.
  - With probes plus the action classifier: 0% for Sonnet 5, Opus 5 and Mythos 5, and 0.3% for Fable 5. All successful breaks were low-severity.
  - Mechanisms: trained **probes** scan tool results and warn Claude when content looks like an injection. An **action classifier** checks each action against the original request before it runs.

  Source: [GA post](https://claude.com/blog/claude-in-chrome-generally-available)
- [OFFICIAL] In Claude Code auto mode, when the auto-mode classifier approves a browser call, the extension skips its own per-site check, unless permission rules deny any site to Claude in Chrome. Plan mode prompts before GIF recording, opening tabs or running shortcuts — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [OFFICIAL] Claude pauses at login pages and CAPTCHAs and asks the user to handle them — [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)
- [COMMUNITY] Internals as of v1.0.56:
  - Mode enum: `ask`, `follow_a_plan`, `skip_all_permission_checks`.
  - Permission types: `NAVIGATE`, `READ_PAGE_CONTENT`, `CLICK`, `TYPE`, `UPLOAD_IMAGE`, `PLAN_APPROVAL`, `REMOTE_MCP`, `DOMAIN_TRANSITION`. Durations are `once` (per toolUseId) or `always` (per domain).
  - Domain categories are cached for 5 minutes:
    - `category0`: unrestricted
    - `category1`/`category2`: blocked, and the page is replaced with `blocked.html`
    - `category3`: always prompts, with no "always allow" option
    - `category_org_blocked`: blocked by the organization
  - Before mutating actions, the tab's domain is re-checked against the original to catch mid-action redirects.

  Source: [sshh12 gist](https://gist.github.com/sshh12/e352c053627ccbe1636781f73d6d715b)
- [COMMUNITY] The clone claims the official blocklist covers 58 domains — [open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)
- [COMMUNITY] Critique: Simon Willison called the 11.2% figure still catastrophic for a browser agent — [Simon Willison](https://simonwillison.net/2025/Aug/26/piloting-claude-for-chrome/)

### Inferences
- The `action_summary` field now required on mutating MCP actions is very likely the input the action classifier and the permission UI use: a natural-language effect statement that can be checked against the user's request.
- The "follow_a_plan" mode (with `update_plan` pre-authorizing domains) is the older form of "Ask before acting". The newer naming suggests plan-based approval was folded into the classifier-based "Automatically approve" mode.

### Gaps
- No public list of blocked domains. The "58" figure is unverified.
- No published false-positive rate for the action classifier.

---

## 6. Reverse-engineering writeups and system prompt

### Takeaway
The most detailed public teardown is sshh12's gist on v1.0.56 (Mar 2026). There is also an MIT clean-room reimplementation, open-claude-in-chrome. The extension's system prompt is fetched from server config, and its full text was not found published.

### Cited Findings
- The system prompt is loaded from a server-config key, `chrome_ext_system_prompt`. Platform info, current tab context and domain-specific "skills" are appended — [sshh12 gist](https://gist.github.com/sshh12/e352c053627ccbe1636781f73d6d715b)
- Workflow recording:
  - rrweb DOM snapshots and mouse events, plus screenshots with click overlays and optional voice narration.
  - `claude-haiku-4-5` writes the step descriptions.
  - The output is a saved prompt with `<inputs>` parameters, schedulable via `chrome.alarms`.

  Source: [sshh12 gist](https://gist.github.com/sshh12/e352c053627ccbe1636781f73d6d715b)
- open-claude-in-chrome:
  - Claims parity on turns and latency, has no domain blocklist, and supports any Chromium browser.
  - Lists extra tools (`execute_code`, `set_tab_focus`, `get_config`/`set_config`, `debug`).
  - Its README is internally inconsistent about tool counts (18, 21 or 28).

  Source: [open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)
- Anthropic's separate API "browser use tool" also uses `read_page` with element references, but it is a different product from the extension — [Browser use tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool.md)

### Inferences
- Because the system prompt is served from server config, its text can change without an extension update. Any captured copy is a snapshot.

### Gaps
- No full system-prompt text was found.
- No Hacker News or Reddit teardown beyond the two sources above was checked, because of the tool-call budget.
- No GitHub issue in anthropics/claude-code was found that documents `browser_batch` or bridge internals.
