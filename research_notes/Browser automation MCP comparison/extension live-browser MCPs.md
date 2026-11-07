# Extension-based live-browser MCPs and agents (state of the market, November 2026)

Scope: products that drive a user's *real, logged-in* Chrome/Chromium session from an AI client, with emphasis on extension-based control surfaces and MCP exposure. Facts are stated as of **2026-11-07**. Vendor documentation is treated as a claim about its own product; benchmark numbers are labelled self-reported vs. independently evaluated. The comparison baseline is a 20-tool Chrome MV3 client-MCP (`tabs_context`, `tabs_share`, `tabs_create`, `tabs_close`, `navigate`, `resize_window`, `read_page`, `find`, `get_page_text`, `computer`, `form_input`, `file_upload`, `upload_image`, `console`, `network`, `javascript`, `gif`, `ask_user`, `done`, `batch`) behind an approval/policy layer, with no native host and no local process.

**Market map** (product, architecture, MCP surface, security headline, price, adoption — sources below the table).

| Product | Drives user's real browser? | Extra local process / host? | MCP server? | Tool surface | Security model (headline) | Price | Adoption signal |
| - | - | - | - | - | - | - | - |
| **Claude in Chrome** (Anthropic) | Yes, Chrome only | Yes for Claude Code (native messaging host); no host for the side panel | Indirect: exposes a `claude-in-chrome` MCP server *to Claude Code only* | Undocumented count; `tabs_context_mcp`, `browser_batch` named publicly; full list behind `/mcp > View tools` | Per-action safety classifier, permission modes, prohibited actions, tab groups | Included in paid Claude plans | Bundled with Claude; install counts unpublished |
| **BrowserMCP** | Yes, any Chromium | Yes: Node MCP server + per-user daemon on 127.0.0.1:9010 | Yes, stdio `@browsermcp/mcp` | 1 `browser` tool, ~40 line-commands | Loopback + Origin check + token + 6-digit pairing; extension-enforced tab rules | Free, Apache-2.0 | 7.3k GitHub stars |
| **Playwriter** | Yes, any Chromium | Yes: local WebSocket relay on :19988 | Yes, 1 `execute` tool | Full Playwright API in a stateful sandbox + raw CDP | Localhost-only by default, Origin validation, click-to-control; remote mode explicitly "not a sandbox" | Free, MIT | 4.1k stars |
| **Playwright MCP** (Microsoft) | Yes, with `--extension` and Playwright Extension | Yes (stdio/HTTP server) | Yes | ~25 core tools + `--caps` (vision, pdf, devtools, network, storage, config) | "Not a security boundary"; workspace roots as convenience only | Free, Apache-2.0 | 39.3k stars |
| **Browser Use** | Yes, via CDP to a launched Chrome (or a cloud browser) | Yes (local `uvx` process) | Yes, local stdio + hosted cloud MCP | 16 tools | "Only connect trusted MCP clients"; `BROWSER_USE_DISABLE_SECURITY` env flag exists | OSS free; cloud $0.02/browser-hour | — |
| **Nanobrowser** | Yes, Chrome/Edge | No separate process (side panel extension) | **No MCP** | Own agent loop + browser-control layer | Ask/Auto modes, per-site Allow/Ask/Block, hands sensitive steps to user | Free, Apache-2.0, bring your own model | 14.3k stars |
| **Stagehand** (Browserbase) | Yes, local SDK runs an extension beside the browser | Yes (SDK/CLI) | Hosted Browserbase MCP (cloud browsers) | `navigate`, `act`, `observe`, `extract` on hosted MCP | Browserbase platform controls; local mode uses Playwright | MIT SDK; Browserbase paid cloud | 26k stars |
| **Notte** | No: cloud browsers | No local process | Yes, hosted `https://api.notte.cc/mcp` | 8 tools | Profiles and auth management, OAuth or API key, cloud isolation | Credits consumed while session active | — |
| **Airtop** | No: cloud browsers | No local process | No documented browser-control MCP (docs expose only a docs-retrieval MCP) | REST/SDK: sessions, windows, AI query/extraction, CDP endpoint | Residential proxies, encrypted profiles, no credential storage | Enterprise/usage-based (not published on docs home) | — |
| **Gemini in Chrome** | Yes, Chrome desktop/Android | No | **No MCP** | Built-in "auto browse" | Confirmation before sensitive tasks | Google AI subscription (tiers not verified) | Bundled with Chrome |
| **Edge / Copilot** | Yes, Edge | No | **No MCP** | "Browse with Copilot" (M365 Premium, US) | Visible steps, human takeover | M365 Premium | Bundled with Edge |
| **ChatGPT Atlas** | Retired | — | — | — | — | — | Shut down 2026 |
| **Perplexity Comet** | Yes, Chromium browser | No | No first-party MCP found | Built-in assistant | Built-in | Not stated on landing page | — |

Sources for the table: Claude in Chrome [GA post](https://claude.com/blog/claude-in-chrome-generally-available), [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome), [Claude Code + Chrome docs](https://code.claude.com/docs/en/chrome); BrowserMCP [how-it-works](https://docs.browsermcp.io/how-it-works), [browser tool](https://docs.browsermcp.io/browser-tool), [GitHub](https://github.com/BrowserMCP/mcp); Playwriter [README](https://github.com/remorses/playwriter); Playwright MCP [README](https://github.com/microsoft/playwright-mcp); Browser Use [MCP docs](https://docs.browser-use.com/customize/mcp-server), [pricing](https://browser-use.com/pricing); Nanobrowser [README](https://github.com/nanobrowser/nanobrowser); Stagehand [README](https://github.com/browserbase/stagehand); Notte [MCP docs](https://docs.notte.cc/mcp-server); Airtop [docs](https://docs.airtop.ai/); Gemini [Google blog](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/); Edge [Microsoft blog](https://blogs.windows.com/msedgedev/2026/05/13/new-updates-to-edge-across-desktop-and-mobile/); Atlas [OpenAI help centre](https://help.openai.com/en/articles/20001371-chatgpt-atlas-retirement); Comet [product page](https://www.perplexity.ai/comet).

## Q1. Which extension-based live-browser products exist, and what architectures and tool surfaces do they expose?

### Takeaway

Three purpose-built extension-native browser-control products exist — Claude in Chrome, BrowserMCP 2.x, and Playwriter — plus two extension-attach paths (Playwright MCP's `--extension`, Stagehand's local extension). All of them except Claude's side panel require a local helper process or native-messaging host, and tool surfaces cluster into two camps: one fat tool with a command language (BrowserMCP, Playwriter) versus dozens of granular tools (Playwright MCP, Browser Use).

### Cited Findings

**Claude in Chrome**

- Generally available on every paid Claude plan since **2026-08-26**; Claude may act autonomously, with a classifier validating each action against the user's request before it runs — [GA announcement](https://claude.com/blog/claude-in-chrome-generally-available).
- GA post states the extension does not run on other Chromium browsers or on mobile "yet" — [GA announcement](https://claude.com/blog/claude-in-chrome-generally-available). The Claude Code integration is broader: it documents Chrome, Edge, and detection of Brave, Arc, Vivaldi and Opera, but not WSL — [Claude Code + Chrome](https://code.claude.com/docs/en/chrome).
- Installation requests 15 permissions, including `debugger`, `nativeMessaging`, `tabGroups`, `declarativeNetRequestWithHostAccess`, `downloads`, `alarms`, `offscreen`, `system.display`, `webNavigation` and `unlimitedStorage` — [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome).
- Capability list: per-session tab group with drag-to-share tabs, multi-tab workflows, scheduled tasks, workflow recording (classic side panel only), shortcuts, console-log reading, network requests, DOM state, image/file upload and GIF recording — [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome); [Claude Code + Chrome](https://code.claude.com/docs/en/chrome).
- Claude Code connects through a native messaging host file named `com.anthropic.claude_code_browser_extension.json` and the bridge host `bridge.claudeusercontent.com`; the integration stays off when Claude Code is authenticated with an API key or `claude setup-token`, and is unavailable via Bedrock, Google Cloud Agent Platform or Microsoft Foundry — [Claude Code + Chrome](https://code.claude.com/docs/en/chrome).
- Only two browser tool names are stated in official prose — `tabs_context_mcp` (including a `createIfEmpty` argument) and `browser_batch`; the complete list is only reachable at runtime via `/mcp`, selecting `claude-in-chrome`, then "View tools" — [Claude Code + Chrome](https://code.claude.com/docs/en/chrome).
- Upload handling: a single upload may total up to **10 MB**; files with multiple hard links are refused, as are credential-like names/paths (`.env`, `.pem`, `.key`, anything under `.ssh`) from v2.1.293 — [Claude Code + Chrome](https://code.claude.com/docs/en/chrome).
- 1Password sign-in is in beta on macOS: the user approves with biometrics and 1Password fills the credential so Claude never sees the password or one-time code — [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome).
- Sessions follow the Claude account across side panel, web, desktop and mobile; the Cowork side panel runs as a Cowork session — [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome).

**BrowserMCP**

- Architecture is a three-hop chain: MCP server per AI app → one per-user background daemon → MV3 extension → tabs; the daemon drives tabs with Playwright through the extension's `chrome.debugger` relay — [how-it-works](https://docs.browsermcp.io/how-it-works), [README](https://github.com/BrowserMCP/mcp).
- Daemon listens on **127.0.0.1:9010**, falling back to 9011/9012; it exits 10 minutes after the last AI app closes — [how-it-works](https://docs.browsermcp.io/how-it-works).
- 2.0 (2026-10-26) replaced per-tab Connect and the `browser_*` tools with **one `browser` tool** that takes command lines and returns one line per action; commands cover `goto/back/forward/reload`, `click/hover/drag/scroll/fill/type/press/select/check/uncheck/upload/dialog`, `wait`, `tab list|new|select|close`, `browser list|use`, `snapshot/find/get text|value|count|attr|url|title/screenshot`, `eval/console/requests/request`, and `cdp` under `--caps cdp` — [changelog](https://docs.browsermcp.io/changelog), [browser tool](https://docs.browsermcp.io/browser-tool).
- Reads default to **10,000 characters**, rise to 75,000 with `--max`, and a single call is capped at **80,000** characters — [browser tool](https://docs.browsermcp.io/browser-tool).
- Since MCP server 2.4.0 (2026-11-02) up to **8 browsers/profiles** can connect at once, and extension 2.2.1 lets users name each browser — [changelog](https://docs.browsermcp.io/changelog).
- The extension removes other extensions' frames (e.g. password-manager inline menus) when attaching, and requests all-sites access to do so — [changelog v2.1.0](https://docs.browsermcp.io/changelog).
- Self-built extension builds share a fixed ID derived from `apps/extension/extension-key.ts`, and the server accepts its ID via `BROWSER_MCP_EXTENSION_IDS` — [README](https://github.com/BrowserMCP/mcp).

**Playwriter**

- Architecture: Chrome extension ↔ local WebSocket relay on **localhost:19988** (`/extension`, `/cdp/:id`) ↔ MCP client; the MCP surface is a **single `execute` tool** running Playwright JavaScript in a stateful sandbox — [README](https://github.com/remorses/playwriter).
- Exposes the full Playwright API plus raw CDP, network interception, debugger/breakpoints, live code editing, and `screenshotWithAccessibilityLabels` (aria-ref labels, Vimium-style) — [README](https://github.com/remorses/playwriter).
- Session tab groups are named and coloured per session (`--tab-group`, `--tab-group-color`), and tabs are only controlled after the user clicks the extension icon — [README](https://github.com/remorses/playwriter).
- Vendor comparison claims "1 execute tool" vs BrowserMCP's "12+ dedicated tools" and "low" vs "high (tool schemas)" context usage — [README](https://github.com/remorses/playwriter) (vendor claim, not measured).

**Playwright MCP**

- Core surface is accessibility-snapshot + ref based: `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_find`, `browser_evaluate`, `browser_file_upload`, `browser_network_requests`, `browser_console_messages`, `browser_tabs`, `browser_resize`, `browser_run_code_unsafe` and others (~25 core) — [README](https://github.com/microsoft/playwright-mcp).
- `--extension` connects to a running Edge/Chrome via the Playwright Extension; `--background` avoids focusing tabs, `--no-tab-group` disables grouping, `--profile-dir-name` selects a profile — [README](https://github.com/microsoft/playwright-mcp).
- Extra capabilities are opt-in via `--caps`: `vision`, `pdf`, `devtools`, `network` (route/mock/offline), `storage` (cookies, localStorage, sessionStorage) and `config` — [README](https://github.com/microsoft/playwright-mcp).
- Collects and exposes page-registered **WebMCP** tools unless `--no-webmcp` is set — [README](https://github.com/microsoft/playwright-mcp).
- Microsoft's own README now recommends **CLI + skills over MCP** for coding agents because CLI invocations avoid loading large tool schemas and verbose accessibility trees into context — [README](https://github.com/microsoft/playwright-mcp).

**Browser Use**

- Local MCP is stdio via `uvx --from 'browser-use[cli]' browser-use --mcp` and exposes **16 tools**: one autonomous `retry_with_browser_use_agent`; six direct-control tools (`browser_navigate`, `browser_click`, `browser_type`, `browser_get_state`, `browser_scroll`, `browser_go_back`); three tab tools (`browser_list_tabs`, `browser_switch_tab`, `browser_close_tab`); three content tools (`browser_extract_content`, `browser_get_html`, `browser_screenshot`); and three session tools (`browser_list_sessions`, `browser_close_session`, `browser_close_all`) — [MCP docs](https://docs.browser-use.com/customize/mcp-server).
- The docs say the local server "has access to your browser and file system" and advise only connecting trusted MCP clients; a `BROWSER_USE_DISABLE_SECURITY` environment variable is documented — [MCP docs](https://docs.browser-use.com/customize/mcp-server).
- A separate hosted Cloud MCP server exists for users who do not want local setup — [MCP docs](https://docs.browser-use.com/customize/mcp-server).

**Nanobrowser**

- Apache-2.0 side-panel agent (not an MCP server) with its own browser-control layer over `chrome.debugger`, using Puppeteer for frame tracking; it claims deterministic element IDs and real input events — [README](https://github.com/nanobrowser/nanobrowser).
- Features: concurrent tasks each in their own tab group, Ask/Auto modes, per-site Allow/Ask/Block, file and image upload, saving CSV/Markdown to Downloads, shortcuts, voice input, memory, and automatic summarisation of long tasks — [README](https://github.com/nanobrowser/nanobrowser).
- Supports Chrome and Edge only; other Chromium browsers are untested — [README](https://github.com/nanobrowser/nanobrowser).

**Stagehand**

- MIT SDK for TypeScript, Python and Go; local runs launch Chrome and Stagehand "runs as an extension next to the browser, cutting round-trip latency on every action" — [README](https://github.com/browserbase/stagehand).
- Browserbase also ships a **hosted MCP** at `https://mcp.browserbase.com/mcp` exposing `navigate`, `act`, `observe`, `extract` against cloud browsers with an API key — [README](https://github.com/browserbase/stagehand).

**Cloud-only and built-in agents**

- Notte: hosted MCP at `https://api.notte.cc/mcp` with 8 tools (`manage_browsers`, `browser_observe`, `browser_scrape`, `browser_screenshot`, `browser_action`, `manage_files`, `manage_profiles`, `manage_auth`); browser time consumes credits while active — [Notte MCP docs](https://docs.notte.cc/mcp-server).
- Airtop: cloud browser sessions via API/SDK, natural-language query/extraction APIs, Playwright/Puppeteer/Selenium over a CDP WebSocket, residential proxies, and encrypted profiles that "never store any actual credentials" — [Airtop docs](https://docs.airtop.ai/).
- Gemini in Chrome: Gemini 3-based side panel with **auto browse** on macOS, Windows and Chromebook Plus — [Google blog](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/); Android auto browse is designed to confirm before sensitive tasks — [Google Android blog](https://blog.google/products-and-platforms/products/chrome/gemini-in-chrome-android-auto-browse/).
- Edge: Copilot Mode was retired on **2026-05-13** and its features folded into Edge; Copilot Actions became "Browse with Copilot", limited to Microsoft 365 Premium subscribers in the US with usage limits — [Microsoft Edge blog](https://blogs.windows.com/msedgedev/2026/05/13/new-updates-to-edge-across-desktop-and-mobile/).
- Atlas: OpenAI's help centre now hosts a "ChatGPT Atlas retirement" article covering data and migration — [OpenAI Help Center](https://help.openai.com/en/articles/20001371-chatgpt-atlas-retirement); secondary coverage puts the shutdown at 2026-08-09 — [WindowsForum](https://windowsforum.com/news/chatgpt-atlas-shuts-down-august-9-2026-migration-guide.437530/).
- Comet: Perplexity's Chromium browser for Mac, Windows, iOS and Android with an agentic assistant that shops, emails and builds — [Perplexity Comet](https://www.perplexity.ai/comet).

### Inferences

- The market has converged on `chrome.debugger` as the only viable way to drive a real signed-in profile without relaunching Chrome; Chrome 136's block on `--remote-debugging-port` for the default profile is the structural reason ([Playwriter's account](https://github.com/remorses/playwriter)).
- Two architectural camps are visible: (a) *relay + local daemon* (BrowserMCP, Playwriter, Playwright MCP, Browser Use, Claude Code) and (b) *in-extension agent* (Claude side panel, Nanobrowser). Only the in-extension camp avoids a local process, and both members are single-vendor surfaces (Anthropic's client; Nanobrowser's own agent).
- The "one fat tool + command language" pattern (BrowserMCP, Playwriter) is a direct response to context cost of granular tools; Microsoft independently reached the same conclusion and now recommends CLI+skills over its own MCP ([README](https://github.com/microsoft/playwright-mcp)).
- Cloud products (Notte, Airtop, Browserbase MCP) are a different category: they solve CAPTCHAs, proxies and isolation, but they cannot inherit the user's local logins, extensions or cookies.

### Gaps

- No public, complete tool-schema list exists for Claude in Chrome; only `tabs_context_mcp` and `browser_batch` appear in official docs, and the rest require an authenticated `/mcp` session. Tool count is therefore unknown.
- Airtop's docs index exposes only a documentation-retrieval MCP (`docs.airtop.ai/_mcp/server`); no browser-control MCP endpoint is documented, so it is unclear whether Airtop ships one.
- Comet's public page describes an agentic assistant but no MCP endpoint; no first-party MCP documentation was found.
- Browser Use's docs describe a launched browser (and `BROWSER_USE_HEADLESS=false` to show it) but no first-party Chrome extension; "extension mode" could not be confirmed for Browser Use.
- No install/user counts are published for Claude in Chrome, Notte, Airtop or Comet; GitHub stars are the only comparable adoption proxy, and they favour developer tools, not consumer agents.

## Q2. How do latency, reliability and measured task performance compare?

### Takeaway

There are **no published latency measurements for any extension relay**, and no benchmark that isolates extension-based control from cloud or headless control. The only comparable quality signal is Online-Mind2Web, where the top scores come from cloud/agent harnesses with self-reported or custom judges; products that can run in a real local profile appear only indirectly (Atlas 71.0%, Stagehand 65.0%). Reliability evidence is qualitative and comes from vendor bug-fix logs, which are unusually specific about extension failure modes.

### Cited Findings

**Online-Mind2Web (300 tasks / 136 live sites, leaderboard last updated 2026-10-11)**

| System | Score | Reporting caveat |
| - | - | - |
| Browser Use Cloud (bu-max) | 97.0% | Self-reported with a custom agentic judge built on the Claude Agent SDK; not directly comparable to OpenAI's screenshot-based judge — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| GPT-5.4 Native Computer Use | 93.0% | OpenAI-reported; raw data not public — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| ABP + Claude Opus 4.6 | 90.53% | All 300 task results published; previous SOTA 78.7% — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| TinyFish | 90.0% | All 300 runs published — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| CUAWright + GPT-5.5 | 89.4% | Harness result using terminal/filesystem + generated browser code — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| UI-TARS-2 | 88.2% | Technical-report self-report — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| OpenAGI Lux | 83.6% | Self-reported at launch — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| Yutori Navigator | 78.7% | Human evaluation; 64.7% under WebJudge — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| ChatGPT Atlas Agent Mode | 71.0% | OpenAI-reported; run data not public — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| Gemini 2.5 Computer Use | 69.0% | Independent rerun by Yutori; 57.3% under WebJudge — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| Stagehand (Gemini 2.5 CU) | 65.0% | Browserbase public evals leaderboard — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| OpenAI Operator | 61.3% | From the original paper; judge/harness not published — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| Claude 4.0 | 61.0% | Human evaluation; 47.7% under WebJudge — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |
| Claude Computer Use 3.7 (no thinking) | 56.3% | osunlp HF leaderboard — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/) |

- The leaderboard itself warns that scores compare *evaluated systems including their tools, compute budgets and context strategies*, and that judge differences make cross-row comparison unsafe — [Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/).

**Documented reliability failure modes**

- Claude in Chrome: the extension service worker going idle breaks the connection ("Receiving end does not exist"); a tab can be unready ("No tab available"); an org mismatch produces "Browser extension is not connected" even with the same account; fix is `/chrome` → "Reconnect extension" — [Claude Code + Chrome](https://code.claude.com/docs/en/chrome).
- BrowserMCP 2.0 lists "fixed the connection dropping when Chrome suspended the extension" among its changes, and 2.1.0 fixed attach failures caused by password-manager frames; 2.4.0 fixed a 15-second "tab didn't become ready" hang — [changelog](https://docs.browsermcp.io/changelog).
- Playwright MCP: a persistent profile "can only be used by one browser instance at a time", so concurrent clients sharing a workspace conflict unless each uses `--isolated` or a distinct `--user-data-dir` — [README](https://github.com/microsoft/playwright-mcp).
- Playwriter known issues: all pages returning `about:blank` until Chrome restarts (a `chrome.debugger` bug), and the browser switching to light mode on connect — [README](https://github.com/remorses/playwriter).

**Context/token efficiency signals**

- BrowserMCP's 2.0 design returns "one line per action instead of a full page snapshot" specifically to cut calls and tokens — [changelog](https://docs.browsermcp.io/changelog).
- Claude Code documents that enabling Chrome by default "increases context usage since the browser tools and their instructions are always loaded" — [Claude Code + Chrome](https://code.claude.com/docs/en/chrome).
- Playwright MCP's README says CLI invocations avoid loading "large tool schemas and verbose accessibility trees", which is more token-efficient for coding agents — [README](https://github.com/microsoft/playwright-mcp).
- Playwriter claims its accessibility snapshots cost 5–20 KB versus 100 KB+ screenshots for the Claude extension, and that its single tool uses less context than BrowserMCP's schemas — [README](https://github.com/remorses/playwriter) (vendor claim, no measurement published).

### Inferences

- Benchmark ranking is dominated by the *model + harness*, not the transport. A 20-tool extension API that keeps snapshots small and returns deltas should land in the same band as the better harnesses; the transport (WebSocket vs stdio vs native messaging) is unlikely to move task success by more than a few points.
- The most credible auditable result is ABP + Claude Opus 4.6 at 90.53% with all 300 trajectories public ([Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/)); the 97.0% Browser Use figure should be treated as a marketing number until its custom judge is reproduced.
- Reliability, not raw capability, is where extension relays differentiate: every product's changelog is a list of MV3 lifecycle bugs (service-worker suspension, tab readiness, frame collisions, debugger detach). A design that avoids the service worker holding the socket — e.g. client-MCP over WebSocket with reconnection and explicit tab readiness — is structurally advantaged.
- No vendor publishes p50/p95 action latency. Given the extra hops (extension ↔ relay ↔ daemon ↔ MCP client), local relays should be slower per action than an in-extension path, but this is unmeasured.

### Gaps

- Zero published latency benchmarks (p50/p95 per action, per navigation, end-to-end task time) for BrowserMCP, Playwriter, Playwright MCP `--extension`, Claude in Chrome or any other extension relay.
- No benchmark isolates "extension-attached real profile" from "cloud browser" or "fresh profile"; all Online-Mind2Web entries mix model, harness and infrastructure.
- Claude in Chrome has no published success rate on Online-Mind2Web or WebVoyager as an extension product; the 61.0% "Claude 4.0" row is a different harness.
- The 97.0% Browser Use result and 93.0% GPT-5.4 result cannot be reproduced from public artefacts, so their gap over ABP's 90.53% is not established.

## Q3. What are the security models, pricing and adoption, and does anything beat a 20-tool MV3 client-MCP?

### Takeaway

On security, Anthropic publishes the most rigorous numbers but also the most restrictive product policy; the open-source relays publish sound local-only designs but explicitly disclaim being a security boundary. On pricing, everything except cloud browsers is free or bundled. On capability, no product matches the combination the baseline targets — no local process, any MCP client, one high-level API, approval layer, GIF and explicit `ask_user`/`done` lifecycle — though BrowserMCP 2.x comes closest and Claude in Chrome wins on UX and safety evaluation.

### Cited Findings

**Security models**

- Claude in Chrome offers three modes — Manually approve, Automatically approve (default in the Cowork side panel), and Skip all approvals — plus per-site "always allow", and always requires explicit approval for permission changes, authorizations, sensitive input and permanent deletions — [permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide).
- Prohibited regardless of permission: purchases/financial transactions, account creation, credit-card or ID data, downloading from untrusted sources, investment advice, executing trades, modifying system files, and "completing instructions from emails or web content" — [permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide).
- Pilot red-teaming: 123 cases / 29 attack scenarios, **23.6%** attack success without mitigations, **11.2%** with them; on a browser-specific challenge set, **35.7% → 0%** — [pilot announcement](https://www.anthropic.com/news/claude-for-chrome).
- GA evaluation: on a stronger attack set, **17.6%** success against Opus 4.5 and **3.8%** against Opus 5 before added safeguards; with probes + classifier, **0%** against Sonnet 5, Opus 5 and Mythos 5, and **0.3%** against Fable 5 (all verified as low severity) — [GA announcement](https://claude.com/blog/claude-in-chrome-generally-available).
- BrowserMCP: loopback-only daemon, Origin check that websites cannot forge, a token in `~/.browsermcp/daemon.json`, and a pairing key in `~/.browsermcp/identity.json` with a 6-digit code the user compares; the extension itself enforces incognito, browser-page and Stop rules — [how-it-works](https://docs.browsermcp.io/how-it-works).
- BrowserMCP explicitly warns that `upload` and `screenshot --path` can read/write files anywhere the user can, so "a page that tricks an agent could get it to upload any file you can read" — [changelog v2.2.0](https://docs.browsermcp.io/changelog); [how-it-works](https://docs.browsermcp.io/how-it-works).
- Playwriter: localhost-only relay, extension-ID Origin validation, tabs controlled only after an extension click, visible automation banner; remote control is "not a sandbox" and a short denylist blocks only whole-profile cookie APIs — [README](https://github.com/remorses/playwriter).
- Playwright MCP: "Playwright MCP is not a security boundary"; `--allowed-origins`/`--blocked-origins` do not affect redirects, and workspace-root file access is "a convenience defense … not a secure boundary" — [README](https://github.com/microsoft/playwright-mcp).
- Nanobrowser: Ask mode asks before submit/send/delete/upload, and pay/password/access steps are always handed to the user; per-site Allow/Ask/Block is enforced by the extension, not the model — [README](https://github.com/nanobrowser/nanobrowser).
- Browser Use local MCP runs with browser and filesystem access and warns to connect only trusted clients; a `BROWSER_USE_DISABLE_SECURITY` switch is documented — [MCP docs](https://docs.browser-use.com/customize/mcp-server).

**Pricing**

- Claude in Chrome is available on all paid Claude plans (Pro, Max, Ultra, Team, Enterprise) — [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome).
- BrowserMCP, Playwriter, Playwright MCP and Nanobrowser are free open source (Apache-2.0 / MIT / Apache-2.0 / Apache-2.0) — [BrowserMCP](https://github.com/BrowserMCP/mcp), [Playwriter](https://github.com/remorses/playwriter), [Playwright MCP](https://github.com/microsoft/playwright-mcp), [Nanobrowser](https://github.com/nanobrowser/nanobrowser).
- Browser Use cloud: **$0.02/browser-hour**, **$5/GB** home-IP proxy, **$0.20/GB** direct or own proxy, CAPTCHA solving included, no subscription, credits never expire; concurrency 10 free, 50 at $100 paid, 250 at $1,000, 500 at $5,000, 1,000 at $25,000 — [pricing](https://browser-use.com/pricing).
- Browser Use model prices (per 1M tokens, input/output): BU Ultrafast $0.24/$1.20, GPT-6 Luna $0.12/$0.60, Claude Opus 5 $6.00/$30.00, GPT-6 Astra $12.00/$60.00 — [pricing](https://browser-use.com/pricing).
- Stagehand SDK is MIT; hosted Browserbase MCP requires a Browserbase API key — [README](https://github.com/browserbase/stagehand).
- Notte charges credits while a browser session is active — [Notte MCP docs](https://docs.notte.cc/mcp-server).

**Adoption signals**

- GitHub: BrowserMCP 7.3k stars / 602 forks — [GitHub](https://github.com/BrowserMCP/mcp); Nanobrowser 14.3k / 1.5k — [GitHub](https://github.com/nanobrowser/nanobrowser); Playwriter 4.1k / 195 — [GitHub](https://github.com/remorses/playwriter); Playwright MCP 39.3k / 3.4k — [GitHub](https://github.com/microsoft/playwright-mcp); Stagehand 26k / 1.8k — [GitHub](https://github.com/browserbase/stagehand).
- Claude in Chrome is distributed through Anthropic's paid plans and has been GA since 2026-08-26, giving it the largest potential install base, but no install count is published — [GA announcement](https://claude.com/blog/claude-in-chrome-generally-available).

**Recurring features across competitors**

- Visual grounding: Playwriter's `screenshotWithAccessibilityLabels` with colour-coded aria-ref labels — [README](https://github.com/remorses/playwriter); Playwright MCP's `vision` capability for coordinate-based interaction — [README](https://github.com/microsoft/playwright-mcp).
- Accessibility-tree snapshots and refs: Playwright MCP's core model, BrowserMCP's `snapshot`/`find`, Browser Use's `browser_get_state` — [Playwright MCP](https://github.com/microsoft/playwright-mcp), [BrowserMCP](https://docs.browsermcp.io/browser-tool), [Browser Use](https://docs.browser-use.com/customize/mcp-server).
- Raw CDP and network mocking: BrowserMCP `--caps cdp`, Playwriter raw CDP, Playwright MCP `--caps network` — [BrowserMCP](https://docs.browsermcp.io/browser-tool), [Playwriter](https://github.com/remorses/playwriter), [Playwright MCP](https://github.com/microsoft/playwright-mcp).
- Session recording / live view: Claude GIF recording — [Claude Code + Chrome](https://code.claude.com/docs/en/chrome); Playwriter video via CDP screencast + ffmpeg — [README](https://github.com/remorses/playwriter); Notte sessions and profiles — [Notte](https://docs.notte.cc/mcp-server).
- Multi-tab orchestration with tab groups: Claude, BrowserMCP, Playwriter and Playwright MCP all implement it — [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome), [how-it-works](https://docs.browsermcp.io/how-it-works), [Playwriter](https://github.com/remorses/playwriter), [Playwright MCP](https://github.com/microsoft/playwright-mcp).
- Scheduled tasks: Claude in Chrome lets users schedule shortcuts daily/weekly/monthly/annually — [get-started](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome).

### Inferences

**Tool-for-tool mapping against the 20-tool baseline**

| Baseline tool | Closest competitor equivalent | Assessment |
| - | - | - |
| `tabs_context` | Claude `tabs_context_mcp`; BrowserMCP `tab list`; Playwright `browser_tabs` | Parity, but only Claude treats "context" as a first-class tab set |
| `tabs_share` | Claude drag-into-tab-group; BrowserMCP "drag a tab into an app's group"; Playwright `--extension` grouping | Parity in mechanism; Claude/BrowserMCP make sharing explicit |
| `tabs_create` / `tabs_close` | `tab new` / `tab close`; `browser_tabs` | Parity; BrowserMCP forbids closing user tabs |
| `navigate` | `goto`; `browser_navigate` | Parity |
| `resize_window` | Playwright `browser_resize`; BrowserMCP only via the `cdp` escape hatch | Playwright is simpler; others require CDP |
| `read_page` | `snapshot`; `browser_snapshot` | Parity, but Playwright/BrowserMCP return raw a11y trees; a high-level reader can be cheaper |
| `find` | `find`; `browser_find` | Parity (Playwright and BrowserMCP both shipped text search over snapshots) |
| `get_page_text` | `get text`; Stagehand `extract`; Browser Use `browser_extract_content` | Parity |
| `computer` | Playwright `vision` caps; Playwriter screenshots + labels; Browser Use `browser_get_state(include_screenshot)` | Competitors split into screenshot-mode vs a11y-mode; few offer one tool that does both |
| `form_input` | `fill`/`select`/`check`; `browser_fill_form` | Parity |
| `file_upload` | `upload`; `browser_file_upload` | Parity, but BrowserMCP's any-path upload is a documented exfiltration risk |
| `upload_image` | Not a distinct tool anywhere; image attachments exist in Nanobrowser and Claude | Baseline is broader here |
| `console` | `console`; `browser_console_messages` | Parity |
| `network` | `requests`/`request`; `browser_network_requests`; `--caps network` | Parity, but competitors add mocking/routing |
| `javascript` | `eval`; `browser_evaluate`; Playwriter `execute` | Parity; Playwriter is stronger (full Playwright + CDP) |
| `gif` | Claude GIF recording; Playwriter video via CDP screencast + ffmpeg | Parity in outcome, different formats |
| `ask_user` | Claude permission prompts; Nanobrowser Ask mode | Competitors implement it as a UI mode, not a callable tool; a callable `ask_user` is a genuine differentiator |
| `done` | Browser Use `is_done` (library-level); Claude task completion notification | Mostly implicit; an explicit `done` contract is uncommon — [Browser Use](https://docs.browser-use.com/customize/mcp-server) |
| `batch` | Claude `browser_batch`; BrowserMCP multi-command calls; Playwriter one `execute` | Parity, and validates the batch design |
| *(no baseline equivalent)* | Raw CDP, network mocking, cloud proxies/CAPTCHA, session replay, credential vaults | Competitors lead on infrastructure features, not on agent ergonomics |

- **What the baseline does better:** no local process or native host (BrowserMCP needs a daemon, Playwriter a relay, Playwright MCP a server, Claude Code a native messaging host, Browser Use a `uvx` process); client-agnostic MCP (Claude in Chrome is exposed only to Claude clients); a single high-level API rather than two dozen granular tools; and an approval/policy layer that is part of the server rather than delegated to the client (`Playwright MCP` explicitly disclaims being a boundary).
- **What the baseline lacks relative to the best competitor:** raw CDP and network mocking (BrowserMCP `--caps cdp`, Playwriter), visual grounding with labelled screenshots (Playwriter), cloud fallback with stealth/proxies/CAPTCHA (Browser Use, Notte, Airtop, Browserbase), and published prompt-injection evaluations (Anthropic).
- **Where the market is heading:** toward fewer, fatter tools and CLI/skill interfaces — Microsoft recommends CLI+skills over its own MCP, BrowserMCP collapsed its per-action tools into one, Playwriter ships one `execute`, and Stagehand ships a `browse` CLI. A 20-tool API with a batch tool is on the right side of that trend, but a single "run a script" escape hatch is becoming table stakes.
- **Competitive verdict:** nothing in this set materially beats the baseline on the axes the baseline optimises (no local process, any MCP client, compact high-level tools, approval layer). BrowserMCP 2.x is the closest architectural peer and beats it on raw CDP and multi-browser fan-out; Claude in Chrome beats it on safety evidence and UX but is Claude-only and Chrome-only for the extension surface; cloud products beat it on anti-bot infrastructure but lose the local-session advantage entirely.

### Gaps

- No vendor publishes per-action or end-to-end latency, so the performance claim in the verdict rests on architecture, not measurement.
- Claude in Chrome's full tool list and schemas are not public; the mapping of `computer`, `form_input`, `file_upload` etc. to Claude's actual tools is inferred from documented capabilities, not names.
- No source establishes whether Claude in Chrome's `claude-in-chrome` MCP server can be attached by non-Claude MCP clients; documentation frames it as a Claude Code integration only.
- Airtop's browser-control MCP status, Notte's and Airtop's public price points, and install counts for Claude in Chrome, Comet and Notte could not be established.
- Could not verify with a citable primary source: community reports (Oct–Nov 2026) that Claude in Chrome hard-blocks `reddit.com`/`redd.it` via a server-side URL hash check. Treat as unconfirmed; the permissions guide only documents category-level restrictions (financial services, adult content, pirated content) — [permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide).
- No independent security audit or CVE record was found for BrowserMCP, Playwriter, Nanobrowser or Playwright MCP; security claims are vendor self-descriptions.
