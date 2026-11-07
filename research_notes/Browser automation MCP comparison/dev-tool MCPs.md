# Dev-tool browser automation MCP servers — competitive profile (state as of 2026-11-07)

All figures below were pulled on 2026-11-07 from primary sources (repo READMEs on `raw.githubusercontent.com`, npm registry API, GitHub REST API, vendor docs). Where a number comes from a vendor blog or a third-party benchmark, it is labelled as such. Anything I could not verify is in a Gaps section, not asserted.

## Playwright MCP (microsoft/playwright-mcp): full tool inventory, capability flags, snapshot model, extension mode, version/cadence/stars, published token & latency numbers, and why Microsoft points coding agents at CLI+Skills

### Takeaway
Playwright MCP is the volume leader (39.3k stars, ~10.6M npm downloads/week) and is an accessibility-tree-first server with 25 default tools, growing to 72 documented tools when every `--caps` group is enabled. As of v0.0.84 (2026-10-31) it is a thin wrapper around code that now lives in the Playwright monorepo, extension mode connects to the user's real Chrome/Edge, and Microsoft's own README now tells coding agents to prefer `@playwright/cli` + skills for token efficiency.

### Cited Findings

**Packaging, version, cadence, popularity**
- Current npm version is **0.0.84**, published **2026-10-31**; the package has **437 published versions** since 2025-03-13, with monthly release counts of 31 (Jul 2026), 28 (Aug 2026), **4 (Sep 2026)** and **1 (Oct 2026)** — a sharp cadence drop after August — [npm registry `@playwright/mcp`](https://registry.npmjs.org/@playwright/mcp).
- Repo stats: **39,285 stars / 3,392 forks / 2 open issues**, last push 2026-11-06, Apache-2.0 — [GitHub API `microsoft/playwright-mcp`](https://api.github.com/repos/microsoft/playwright-mcp); the tiny open-issue count is unusual for a repo this size and suggests triage into `microsoft/playwright` (see Gaps).
- **~10,560,609 downloads in the week 2026-10-30→11-05**, ~5.7× Chrome DevTools MCP — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/@playwright/mcp).
- The repo is now a **wrapper**: `src/` contains only a README saying "Playwright MCP source code is located in the Playwright monorepo" at `packages/playwright-core/src/tools/mcp` — [src/README.md](https://github.com/microsoft/playwright-mcp/blob/main/src/README.md), [monorepo path](https://github.com/microsoft/playwright/tree/main/packages/playwright-core/src/tools/mcp).
- Node ≥18, single `npx @playwright/mcp@latest` install, stdio by default, HTTP/SSE via `--port 8931` (`{"url":"http://localhost:8931/mcp"}`), Docker image `mcr.microsoft.com/playwright/mcp` (headless Chromium only) — [README](https://github.com/microsoft/playwright-mcp#readme).

**Tool inventory (counts from the auto-generated README tool list)**
- Default surface = **25 tools**: 24 core + 1 tab tool. Core: `browser_click`, `browser_close`, `browser_console_messages`, `browser_drag`, `browser_drop`, `browser_emulate_media`, `browser_evaluate`, `browser_file_upload`, `browser_fill_form`, `browser_find`, `browser_handle_dialog`, `browser_hover`, `browser_navigate`, `browser_navigate_back`, `browser_network_request(s)`, `browser_press_key`, `browser_resize`, `browser_run_code_unsafe`, `browser_select_option`, `browser_snapshot`, `browser_take_screenshot`, `browser_type`, `browser_wait_for`; plus `browser_tabs` (list/new/close/select + `isolatedContext`) — [README §Tools](https://github.com/microsoft/playwright-mcp#tools).
- Opt-in groups and their sizes: **config** +1 (`browser_get_config`), **network** +4 (`browser_route`, `browser_route_list`, `browser_unroute`, `browser_network_state_set`), **storage** +17 (`browser_cookie_*` ×5, `browser_localstorage_*` ×5, `browser_sessionstorage_*` ×5, `browser_storage_state`, `browser_set_storage_state`), **devtools** +13 (`browser_annotate`, `browser_highlight`/`browser_hide_highlight`, `browser_resume`, record/trace/video start-stop plus `browser_video_chapter`, `browser_video_show_actions`/`hide_actions`), **vision** +6 (mouse xy primitives), **pdf** +1, **testing** +5 (`browser_generate_locator`, 4 × `browser_verify_*`). **Total 72** (25 + 1 + 4 + 17 + 13 + 6 + 1 + 5) — [README §Tools](https://github.com/microsoft/playwright-mcp#tools).
- The `--caps` enum in source is broader than the README table: `config | core | core-navigation | core-tabs | core-input | core-install | network | pdf | storage | testing | vision | devtools` — [config.d.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/mcp/config.d.ts). Note the **README's `--caps` help text still lists only "vision, pdf, devtools"**, which is stale relative to the tool list (flag: doc inconsistency).
- `webmcp` is **not** a `--caps` value — it is a boolean option (`--no-webmcp`) that is **enabled by default** and exposes tools a page registers via the experimental WebMCP API — [README options table](https://github.com/microsoft/playwright-mcp#readme) and [config.d.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/mcp/config.d.ts).

**Snapshot vs screenshot**
- Default modality is the **accessibility tree**, explicitly "bypassing the need for screenshots or visually-tuned models"; `browser_snapshot` is documented as "better than screenshot", with `depth`, `boxes` and save-to-file options — [README](https://github.com/microsoft/playwright-mcp#readme).
- `browser_take_screenshot` still exists but is positioned as the fallback; coordinate-based interaction is gated behind `--caps=vision`, and `--snapshot-mode none` / `--snapshot-boxes` / `--image-responses omit|only` are the token-control knobs — [README options](https://github.com/microsoft/playwright-mcp#readme).
- `browser_take_screenshot` defaults to CSS-pixel scale (smaller payload) rather than device pixels — [tool list](https://github.com/microsoft/playwright-mcp#tools).

**Extension mode (user's real Chrome)**
- `--extension` "Connect to a running browser instance (Edge/Chrome only). Requires the 'Playwright Extension' to be installed." Extension is published on the Chrome Web Store as **Playwright Extension** (`mmlmfjhmonkocbjadbfplnigmagldckm`) — [README](https://github.com/microsoft/playwright-mcp#readme), [extension README](https://github.com/microsoft/playwright/tree/main/packages/extension).
- Flow: the LLM's first interaction opens a **tab-picker page**; each client gets its **own tab group** (named/coloured), a tab belongs to one client at a time, and a status page can disconnect clients; `--no-tab-group` disables grouping — [extension README](https://github.com/microsoft/playwright/tree/main/packages/extension).
- Auth/UX: per-profile `PLAYWRIGHT_MCP_EXTENSION_TOKEN` bypasses the per-connection approval dialog; `--background` keeps the browser unfocused (needs extension ≥0.5.0, Chrome ≥158.0.8127.2); `--profile-dir-name` selects a Chrome profile — [extension README](https://github.com/microsoft/playwright/tree/main/packages/extension).
- Known structural limitation: Chrome **detaches the debugger** when a page contains a frame with a restricted URL (`chrome://`, other `chrome-extension://`, custom schemes), which can make the tab unusable — [extension README troubleshooting](https://github.com/microsoft/playwright/tree/main/packages/extension).

**Why Microsoft recommends CLI+Skills over MCP**
- README, "Playwright MCP vs Playwright CLI": coding agents "might benefit from using the **CLI+SKILLS** instead… CLI invocations are more token-efficient: they avoid loading large tool schemas and verbose accessibility trees into the model context"; MCP "remains relevant for specialized agentic loops that benefit from persistent state, rich introspection, and iterative reasoning over page structure" — [README](https://github.com/microsoft/playwright-mcp#readme), mirrored in [playwright-cli README](https://github.com/microsoft/playwright-cli).
- `@playwright/cli` is a separate package (**0.1.23**, published 2026-10-31, **15,016 stars**, **1,739,520 downloads/week**), installs skills with `playwright-cli install --skills`, and advertises "Token-efficient. Does not force page data into LLM." — [playwright-cli README](https://github.com/microsoft/playwright-cli), [npm](https://registry.npmjs.org/@playwright/cli), [downloads](https://api.npmjs.org/downloads/point/last-week/@playwright/cli).

**Published token/latency measurements (third-party, vendor-run)**
- Stagehand/Browserbase benchmark (published 2026-09-29, Playwright MCP **0.0.82**, Claude Sonnet 5, 8 tasks × 3 runs): Playwright MCP **default 97k tokens/task, 75% success (18/24), 31 s**, $0.051/task; "tuned" (`--snapshot-mode none --codegen none`) **105k tokens, 88%, 30 s**; Stagehand v4 facade **32k, 100%, 18 s** — [Stagehand blog](https://www.stagehand.dev/blog/playwright-mcp-token-usage).
- Same source: Playwright MCP's **25 tool definitions = 17,857 characters** of context before any task text; median **12.9k–14.1k input tokens per model call** vs 6.9k for Stagehand; on a 12-page form flow both MCP configs hit the 40-step cap in all 3 runs — [Stagehand blog](https://www.stagehand.dev/blog/playwright-mcp-token-usage).
- Same source claims "since 0.0.82 the default config no longer returns a snapshot after each action: it writes the snapshot to a file and returns a link" — this **conflicts with the 0.0.84 README**, which still documents `snapshot.mode` default `full` (flag: unverified/possibly version-specific) — [Stagehand blog](https://www.stagehand.dev/blog/playwright-mcp-token-usage) vs [README options](https://github.com/microsoft/playwright-mcp#readme).
- Independent harness (WebdriverIO benchmark, run 2026-10-09, 100 Online-Mind2Web tasks, DeepSeek V4.1 Flash): `@playwright/mcp@0.0.83` **652k tokens/task, 48% success, 123 s, 28 tool calls**; tuned **574k / 50% / 106 s**; Playwright CLI **641k / 57% / 149 s** — [webdriverio/benchmark](https://github.com/webdriverio/benchmark).

### Inferences
- The 25-tool default (~4.5k tokens of schema at ~4 chars/token) is **not** where Playwright MCP's token cost comes from; the compounding snapshot-per-action history is (Stagehand: 97k/task at 14k input tokens/call).
- The Sep–Oct 2026 release slowdown (31→4→1) plus the "source moved to monorepo" refactor suggests the MCP is in maintenance/stabilisation while Microsoft invests release velocity in `@playwright/cli`.
- Extension mode is functionally close to our design (tab groups per client, token-based auto-approve, background operation), but it is an add-on path; the product's default is still a separate managed browser profile.

### Gaps
- No first-party Microsoft latency or token benchmark exists; every number above is from a vendor with a competing product (Stagehand, WebdriverIO) except the schema character count.
- Could not confirm whether playwright-mcp's 2 open issues reflect relocation of issue tracking to `microsoft/playwright`.
- No public measurement of extension-mode overhead (relay hop) vs bundled-browser mode.

## Puppeteer MCP: is @modelcontextprotocol/server-puppeteer still archived/dead, and do forks add anything?

### Takeaway
Yes — it is dead. The npm package is formally deprecated with an "Archived and unmaintained" message pointing at `modelcontextprotocol/servers-archived`, the last publish was **2025-05-12**, and the de-facto successor inside Google is **chrome-devtools-mcp**, which drives Chrome through Puppeteer.

### Cited Findings
- `@modelcontextprotocol/server-puppeteer` latest **2025.5.12**; npm `deprecated` field: "**Archived and unmaintained; no security guarantees. See https://github.com/modelcontextprotocol/servers-archived**" — [npm registry](https://registry.npmjs.org/@modelcontextprotocol/server-puppeteer).
- `modelcontextprotocol/servers-archived` is described as "Reference MCP servers that are no longer maintained" (306 stars, last push 2025-05-28); the old `servers/src/puppeteer/README.md` now **404s** — [servers-archived](https://github.com/modelcontextprotocol/servers-archived), [404 check](https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/puppeteer/README.md).
- It still gets **~29,868 downloads/week** (2026-10-30→11-05), i.e. legacy installs/tutorials outlive the deprecation — [npm downloads](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/server-puppeteer).
- Best-known community fork: `merajmehrabi/puppeteer-mcp-server` (**489 stars**, last push **2025-03-14**) — "browser automation through Puppeteer… interaction with both new browser instances and existing Chrome windows" — [GitHub](https://github.com/merajmehrabi/puppeteer-mcp-server). It is itself dormant (no commits in ~20 months).
- Google's replacement is explicit: chrome-devtools-mcp "uses **puppeteer** to automate actions in Chrome and automatically wait for action results" — [chrome-devtools-mcp README](https://github.com/ChromeDevTools/chrome-devtools-mcp#readme).

### Inferences
- Puppeteer MCP is not a live competitor; it is a cautionary example of a reference server being abandoned in place while download traffic persists. Any comparison should treat "Puppeteer" as **the engine under chrome-devtools-mcp**, not as a separate MCP offering.
- No fork has emerged with meaningful adoption or maintenance; the ecosystem consolidated around Playwright MCP and chrome-devtools-mcp.

### Gaps
- No maintained fork with >1k stars found; I did not exhaustively enumerate all ~hundreds of forks or unregistered npm packages.

## Other dev-tool browser automation MCP servers worth naming — tool counts and differentiators

### Takeaway
The field splits into four architectures: (a) bundled-browser automation (Playwright MCP, WebdriverIO MCP, Selenium MCP), (b) Chrome DevTools introspection (chrome-devtools-mcp), (c) **extension-attached real Chrome** (Browser MCP, Playwriter — the closest peers to our project), and (d) cloud browser APIs (Browserbase/Stagehand, Steel, Browserless). Tool counts range from **1** (Browser MCP, Playwriter) to **61** (chrome-devtools-mcp).

### Cited Findings

**chrome-devtools-mcp (Google) — 61 tools, 3 in slim mode**
- Auto-generated tool reference lists **61 tools** in 12 groups: input 10, navigation 6, emulation 2, performance 3, network 2, debugging 10, **memory 14**, extensions 5, third-party 2, WebMCP 2, PWA 4, WebAuthn 1 — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md).
- `--slim` exposes exactly **3 tools** (`navigate`, `evaluate`, `screenshot`) — [slim-tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/slim-tool-reference.md).
- Version **1.12.0** (2026-10-22), **66 versions** total, ~2 releases/month — [npm](https://registry.npmjs.org/chrome-devtools-mcp), [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md).
- **54,902 stars / 125 open issues**, last push 2026-11-06, Apache-2.0 — [GitHub API](https://api.github.com/repos/ChromeDevTools/chrome-devtools-mcp); **1,865,622 downloads/week** — [downloads](https://api.npmjs.org/downloads/point/last-week/chrome-devtools-mcp).
- Real-Chrome path: `--autoConnect` requests a remote debugging session against a running Chrome (≥M144, needs `chrome://inspect#remote-debugging` enabled), with a per-connection user consent dialog and the "Chrome is being controlled by automated test software" banner — [Chrome blog, Dec 2025](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session).
- Engineering for perf/reliability visible in 1.12.0: parallel independent tool calls via a **TaskRunner**, page-scoped tools running in parallel across pages, `--maxNavigationSaved`, `--watchConfig` hot-reload, heap-snapshot pagination — [CHANGELOG 1.12.0](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md).
- Token philosophy is documented: "Token-Optimized… Files are the right location for large amounts of data… Reference over Value: for heavy assets return a file path, never the raw data stream" — [design-principles.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/design-principles.md).
- Collects **usage statistics (success rates, latency, environment) by default**; opt out with `--no-usage-statistics` — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp#readme).

**Browser MCP (browsermcp.io) — 1 tool, MV3 extension + local daemon (architecturally closest to us)**
- **7,303 stars**, last push **2026-11-03**, Apache-2.0; `@browsermcp/mcp` **58,211 downloads/week** — [GitHub](https://github.com/browsermcp/mcp), [downloads](https://api.npmjs.org/downloads/point/last-week/@browsermcp/mcp).
- Exposes "one `browser` tool"; architecture: thin stdio process per AI app → local daemon → **Playwright `connectOverCDP`** → CDP bridge that fakes `Browser.*`/`Target.*` → **MV3 service worker with `chrome.debugger`** — [packages/mcp/README](https://github.com/browsermcp/mcp/blob/main/packages/mcp/README.md).
- Security/UX engineering worth copying: loopback-only relay, Host check against DNS rebinding, per-user daemon token file (0600), **6-digit pairing code** shown in both agent and extension, up to **8 browser profiles** (slots), and explicit detection of **hidden/background tabs** (focus emulation, because input to a hidden tab hangs and screenshots are blank) — [packages/mcp/README](https://github.com/browsermcp/mcp/blob/main/packages/mcp/README.md).
- Limitation: Chromium only — "Firefox has no `debugger` API, so Browser MCP doesn't work there" — [README](https://github.com/browsermcp/mcp#readme).

**Playwriter — 2 MCP tools, extension + full Playwright API, CLI-first**
- **4,063 stars**, last push 2026-11-06, MIT; `playwriter@0.10.0` published **2026-11-06**, 9,454 downloads/week — [GitHub](https://github.com/remorses/playwriter), [npm](https://registry.npmjs.org/playwriter).
- MCP exposes **`execute` + `reset`** only; recommended path is the CLI with stateful JS sessions (`playwriter -s 1 -e '...'`) plus a skill; claims "1 `execute` tool" vs "12+ dedicated tools" for Browser MCP, and "**90% fewer tokens than Playwright**" (HN title, vendor claim) — [MCP.md](https://github.com/remorses/playwriter/blob/main/MCP.md), [README](https://github.com/remorses/playwriter#readme), [HN submission](https://news.ycombinator.com/item?id=46590260).
- Differentiators: raw CDP escape hatches (`getCDPSession`, debugger, live code edit), native video via CDP screencast + ffmpeg ("100× more efficient than Playwright video recording"), tab-group-per-session, `PLAYWRITER_DIRECT` to skip the extension and attach over CDP — [README](https://github.com/remorses/playwriter#readme).

**Browserbase / Stagehand MCP — archived**
- `browserbase/mcp-server-browserbase` is **archived** (last push 2026-07-20, 3,398 stars); `@browserbasehq/mcp@3.0.0` is npm-**deprecated**: "This package is no longer maintained" — [GitHub API](https://api.github.com/repos/browserbase/mcp-server-browserbase), [npm](https://registry.npmjs.org/@browserbasehq/mcp).
- The successor is Stagehand's own facade MCP with **3 tools**: `run`, `snapshot`, `screenshot`, one server process owning the browser — [Stagehand blog](https://www.stagehand.dev/blog/playwright-mcp-token-usage).
- `browserbase/stagehand` itself is very alive: **25,975 stars**, last push 2026-11-07 — [GitHub API](https://api.github.com/repos/browserbase/stagehand).

**Steel — hosted HTTP MCP over cloud browsers**
- Hosted server `https://mcp.steel.dev/mcp`, OAuth or Bearer API key; tools are `scrape` (fresh browser → Markdown, no session), then `session_create` → `snapshot` → ref-based actions → `dialog` → `session_release` — [Steel MCP docs](https://docs.steel.dev/overview/mcp).
- Notable protocol design: every mutating call carries `after: <op-id>` for **idempotent retries** ("a repeated call with the same `after` returns the stored result… never runs twice"), page text wrapped in `<untrusted-page-content>`, output truncated at **30,000 characters**, long calls return an execution id — [Steel MCP docs](https://docs.steel.dev/overview/mcp).
- OSS repo **7,932 stars**, last push 2026-11-04, Apache-2.0 — [GitHub API](https://api.github.com/repos/steel-dev/steel-browser).

**Browserless MCP — 8 stateless tools + a stateful Browser Agent, hosted only**
- Hosted `https://mcp.browserless.io/mcp` (Streamable HTTP, OAuth or token); "exposes **eight stateless tools**", seven wrapping REST endpoints (`browserless_smartscraper`, `browserless_function`, `browserless_export`, `browserless_search`, …) plus `browserless_skill`, with a separate **Browser Agent** tool and **Account Tools** — [REST API Tools](https://docs.browserless.io/mcp/rest-api-tools), [setup](https://docs.browserless.io/mcp/browserless-mcp-server).
- Licensing matters: repo is "SPDX-License-Identifier: **SSPL-1.0 OR Browserless Commercial License**" — not OSI open source for commercial closed-source use; 13,911 stars — [README](https://github.com/browserless/browserless#readme).

**Selenium MCP (angiejones) — 18 tools, stale**
- **18 tools**: `start_browser`, `navigate`, `interact`, `send_keys`, `get_element_text`, `get_element_attribute`, `press_key`, `upload_file`, `take_screenshot`, `close_session`, `execute_script`, `window`, `frame`, `alert`, `add_cookie`, `get_cookies`, `delete_cookie`, `diagnostics`; plus 2 resources (`browser-status://current`, `accessibility://current`) — [README](https://github.com/angiejones/mcp-selenium#readme).
- Only **430 stars**, last push **2026-02-23** (≈8.5 months stale as of 2026-11), 995 downloads/week; supports Chrome/Firefox/Edge/Safari, uses WebDriver BiDi for console/error/network **diagnostics** — [GitHub API](https://api.github.com/repos/angiejones/mcp-selenium), [downloads](https://api.npmjs.org/downloads/point/last-week/@angiejones/mcp-selenium).

**WebdriverIO MCP (@wdio/mcp) — dynamic tool surface, web + mobile + Electron**
- `@wdio/mcp@4.1.0` (2026-10-30), repo last push 2026-11-05; only 44 stars but it is the setup that **beat Playwright MCP on tokens and success** in the independent WebdriverIO benchmark — [npm](https://registry.npmjs.org/@wdio%2Fmcp), [GitHub](https://github.com/webdriverio/mcp), [benchmark](https://github.com/webdriverio/benchmark).
- Distinct engineering: **the server lists only tools that fit the current session** (browser vs mobile vs Electron), and rarely used groups (`mocks`, `cookies`, `device`, `extensions`, `attach`, `elements`, `cloud-apps`) are hidden until the agent calls `enable_tools` — progressive disclosure instead of a fixed schema — [README §Available Tools](https://github.com/webdriverio/mcp#readme).
- Surface spans session mgmt (`start_session`, `attach_session`, `launch_chrome`), navigation, element interaction, mobile gestures, device control, and BrowserStack/Sauce/LambdaTest/TestingBot cloud providers — [README](https://github.com/webdriverio/mcp#readme).

### Inferences
- Tool-count is bimodal by design philosophy: **one-tool "run code" servers** (Browser MCP, Playwriter) minimise schema cost; **many-small-tools servers** (chrome-devtools 61, Playwright 25+44 opt-in) minimise per-call reasoning but pay schema cost every turn; **dynamic-surface servers** (WDIO) try to have both.
- Our 20-tool set sits in the middle: narrower than both first-party servers (fewer tools than Playwright's 25 default, far fewer than 61), but broader per-tool (e.g. one `computer` covers click/type/scroll/screenshot/dialog; `batch` batches).
- Browser MCP is the only direct comparable to a client-MCP-over-WebSocket MV3 design, and its README is effectively a list of the failure modes to design around (hidden tabs, target/bridge bookkeeping, service-worker restarts, DNS rebinding).

### Gaps
- Exact Steel tool count is unverified (docs describe the tool *flow*, not an enumerated list).
- Browserless "Browser Agent" and "Account Tools" counts were not enumerated (only the 8 REST tools are explicitly counted).
- Could not verify pricing $ figures for Browserbase/Steel/Browserless in 2026 (their pricing pages are JS-rendered); all are metered cloud products with free OSS self-host for Steel/Browserless(SSPL)/Browserbase's SDK.

## Head-to-head benchmarks: Playwright MCP vs Chrome DevTools MCP vs Puppeteer (speed, tokens, success rate)

### Takeaway
There is **no rigorous three-way benchmark including Puppeteer** (it has no live MCP), and only one credible head-to-head covering Playwright MCP and chrome-devtools-mcp — it is small, single-author, and scoped to job-application fixtures. The strongest, most reproducible numbers are from the WebdriverIO Online-Mind2Web harness (Playwright MCP vs Playwright CLI vs Stagehand vs WDIO MCP), which shows Playwright MCP at **48% success / 652k tokens/task** on 100 live-site tasks.

### Cited Findings
- **WebdriverIO benchmark** (100 Online-Mind2Web tasks, same model/harness/prompt, medians): DeepSeek V4.1 Flash — playwright-mcp **652k tokens, $0.028, 48%, 123 s, 28 calls**; playwright-mcp-tuned **574k, $0.029, 50%, 106 s**; stagehand **354k, $0.022, 56%, 91 s**; wdio-mcp **340k, $0.016, 54%, 114 s**; wdio-session **168k, $0.010, 58%, 150 s**; agent-browser **735k, $0.036, 50%, 157 s**; playwright-cli **641k, $0.029, 57%, 149 s**. Claude Sonnet 5 (50 tasks): playwright-mcp **363k, $0.177, 32%, 74 s**; stagehand **549k, $0.216, 60%**; wdio-mcp **241k, $0.107, 52%** — [webdriverio/benchmark](https://github.com/webdriverio/benchmark).
- **Stagehand benchmark** (8 tasks × 3 runs, Sonnet 5): Playwright MCP **97k tokens, 75%, 31 s** vs Stagehand **32k, 100%, 18 s**; per-call input tokens 12.9–14.1k vs 6.9k — [Stagehand blog](https://www.stagehand.dev/blog/playwright-mcp-token-usage).
- **Cold-start / composite benchmark** (7 MCPs, frozen loopback Greenhouse+Ashby fixtures, median of 3 passes, published 2026-05-27): playwright **composite 7.93, cold start 197 ms**; chrome-devtools-mcp **5.60, 358 ms** (and 5.6/5.6/8.33 across passes — high variance); browser-use direct **5.87, 668 ms**; lightpanda **6.31, 13 ms**; browser-use agent mode **0.00** (30 s `BrowserStartEvent` timeout) — [pleasedodisturb/web-agent-comparison](https://github.com/pleasedodisturb/web-agent-comparison).
- Same benchmark's out-of-scope probe of **BrowserMCP**: works end-to-end on real Chrome via extension attach, captures the operator's real Chrome TLS fingerprint (`ja4_hash: 3fc5444b6956`), and surfaced a recursive `server.close` stack overflow on shutdown — [README §v1.0.2 BrowserMCP probe](https://github.com/pleasedodisturb/web-agent-comparison).
- A third-party Medium post claims a "Browser DevTools MCP" uses "**78% fewer tokens than Playwright MCP**"; note this is a **different server** (`serkan-ozal/browser-devtools-mcp`), not Google's chrome-devtools-mcp — [Medium](https://medium.com/@serkan_ozal/browser-devtools-mcp-78-fewer-tokens-vs-playwright-mcp-faster-and-more-consistent-32f314004d30).
- Playwriter claims "**90% fewer tokens than Playwright**" and Mantis claims agents "browse **36% faster** than with Playwright MCP" — both vendor/Show-HN claims, no shared harness — [HN Playwriter](https://news.ycombinator.com/item?id=46590260), [Mantis](https://github.com/perzianhq/mantis).
- Qualitative head-to-head (Apr 2026, updated Sep 2026): Playwright = "driving", chrome-devtools = "debugging"; Playwright is cross-browser (chrome/firefox/webkit/msedge), chrome-devtools is Chrome/Chrome-for-Testing only; chrome-devtools has first-class perf traces (LCP/INP/CLS insights), Lighthouse (a11y/SEO/best-practices, explicitly **not** performance) and V8 heap snapshots that Playwright cannot match — [Steve Kinney](https://stevekinney.com/writing/driving-vs-debugging-the-browser). **Caveat: that article describes chrome-devtools-mcp at v0.21.0 with ~29 tools; as of 2026-11 it is v1.12.0 with 61 tools, so its tool inventory is stale.**

### Inferences
- The success-rate spread on live sites (32–60%) dwarfs token differences; the dominant variable in these benchmarks is the model+harness, not the MCP. On the same model, Playwright MCP's tuned config helps only marginally (48→50%, 363k→284k).
- chrome-devtools-mcp's measured weakness is **variance and cold start**, consistent with its much larger tool surface and DevTools attach path; its strength (perf/memory/Lighthouse) is not exercised by task-completion benchmarks at all, so composite scores understate it for debugging use cases.
- No benchmark isolates the extension-attach architecture (Browser MCP / Playwriter / ours) against bundled-browser MCPs on identical tasks; the only datapoint is the BrowserMCP exploratory probe.

### Gaps
- **No head-to-head that includes Puppeteer MCP** exists in 2026 (it is deprecated); any "Puppeteer vs Playwright MCP" numbers found online predate the archive and were not verifiable.
- No independent measurement of chrome-devtools-mcp token/schema cost (61 tools) — Google publishes no figure, and I did not build the package to measure the serialized schema.
- The strong benchmarks are vendor-adjacent (Stagehand sells a competing SDK; WebdriverIO's own MCP wins its own benchmark); treat deltas as directional, not absolute.

## Capability mapping: our 20 tools vs the field (analysis, for positioning)

### Takeaway
Against Playwright MCP (25 default) and chrome-devtools-mcp (61), our 20 tools are **narrower in count but broader per tool**, and we are the only design in this set (besides Browser MCP) that is a client-MCP over WebSocket inside an MV3 extension with `chrome.debugger`. Our real differentiators are: `tabs_share`, `ask_user`, `done`, `batch`, `upload_image`, `gif`, and true user-Chrome attachment with no local daemon.

### Cited Findings (mapping, competitor tool named per capability)
- **Tabs**: ours 4 tools (`tabs_context`, `tabs_share`, `tabs_create`, `tabs_close`) vs Playwright `browser_tabs` (1 tool, actions list/new/close/select + `isolatedContext`) and chrome-devtools `list_pages`/`new_page`/`close_page`/`select_page` (4) — [Playwright tools](https://github.com/microsoft/playwright-mcp#tools), [CDT tools](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md). Neither competitor has a `share` primitive; Playwright's nearest is extension-mode tab groups.
- **navigate / resize_window**: Playwright `browser_navigate`(+`_back`), `browser_resize`; CDT `navigate_page`, `resize_page` + `emulate` — we have no back/forward or emulate equivalent (emulation is a gap).
- **read_page / get_page_text**: Playwright `browser_snapshot` (a11y tree, depth/boxes/file) and `browser_evaluate`; CDT `take_snapshot` + `evaluate_script`. **We have no `evaluate`-returning-snapshot distinction**; `get_page_text` is a plain-text extraction that neither first-party server exposes as a named tool (Playwright gets there via evaluate/`browser_find`).
- **find**: Playwright `browser_find` (text or regex, returns matching nodes with context paths, `maxResults`, save-to-file) — this is a **direct, recently added competitor** (v0.0.83 added `filename`) and is cheaper than a full snapshot; CDT has no search tool.
- **computer**: ours is 1 tool for click/type/scroll/screenshot/dialog; Playwright splits into `browser_click`, `browser_type`, `browser_press_key`, `browser_hover`, `browser_drag`, `browser_drop`, `browser_select_option`, `browser_handle_dialog`, `browser_take_screenshot`, `browser_mouse_*` (vision cap); CDT splits into `click`, `type_text`, `press_key`, `hover`, `drag`, `fill`, `handle_dialog`, `take_screenshot`, `click_at`. **Competitors are broader here** (drag/drop, select_option, doubleClick, modifiers, mouse down/up/wheel).
- **form_input**: Playwright `browser_fill_form` (multi-field array); CDT `fill` + `fill_form`; Selenium `send_keys`.
- **file_upload / upload_image**: Playwright `browser_file_upload` (paths, cancel-by-omit), `browser_drop` (files or MIME data); CDT `upload_file`; Selenium `upload_file`. **`upload_image` has no direct analogue anywhere** — competitors treat it as a file upload.
- **console / network**: Playwright `browser_console_messages` (level, all, filename) and `browser_network_requests` + `browser_network_request` (index, part, filter, static, all); CDT `list_console_messages`/`get_console_message` and `list_network_requests`/`get_network_request` (preserved across last 3 navigations, pagination, body spilling to file). Playwright additionally mocks/routes under `--caps=network` (4 tools) — **CDT has no mocking at all**.
- **javascript**: Playwright `browser_evaluate` (+ `browser_run_code_unsafe`, which is RCE-equivalent) ; CDT `evaluate_script`; Selenium `execute_script`. Ours is equivalent to the safer `evaluate`.
- **gif**: Playwright's nearest is `--caps=devtools` video tools (13 tools: `browser_start_video` with `fps`, `cursor`, chapters, action overlays; `browser_start/stop_tracing`); CDT has `screencast_start/stop`. **No competitor ships a GIF-specific recorder**; Playwright records webm video, Playwriter streams via CDP+ffmpeg.
- **ask_user / done**: **no competitor has either**. Playwright and CDT have no elicitation/human-in-the-loop tool; Playwright's nearest is `browser_annotate` (devtools cap) which waits for a human to draw annotations, and extension-mode approval dialogs.
- **batch**: **no competitor has a batch tool**. Playwright's answer is `browser_run_code_unsafe` (one JS function, many Playwright calls); Playwriter's is a single `execute`; agent-browser's is a CLI `batch` of command strings.
- **Token shape**: Playwright default = 25 schemas / 17,857 chars; chrome-devtools = 61 schemas (3 in `--slim`); Browser MCP = 1; Playwriter = 2; WDIO = session-dependent subset. Our 20 tools should land well under Playwright's schema cost while keeping per-call payloads small (a `batch` tool is the main lever competitors lack).

### Inferences
- Where competitors are **broader**: cross-browser engines (Playwright: Chromium/Firefox/WebKit/Edge), storage/cookie APIs (17 tools), network mocking, DevTools-grade perf/memory/Lighthouse (CDT), mobile/Electron/cloud grids (WDIO), HTTP/SSE remote deployment + Docker (Playwright, all cloud vendors).
- Where competitors are **faster**: cold start (Playwright 197 ms vs CDT 358 ms measured; toolbar-only extension attach should beat both since there is no browser launch), and per-step latency when they avoid a round trip (Stagehand's in-browser core claims up to 50% faster; our WebSocket + `chrome.debugger` keeps the same "no separate browser process" advantage).
- Where we are **unique**: share-a-tab consent (`tabs_share`), explicit completion signalling (`done`), human questions mid-run (`ask_user`), image-specific upload, GIF capture, and multi-action `batch` — all absent from both first-party servers.
- Biggest competitive risks: (1) the 61-tool CDT surface keeps absorbing debugging jobs; (2) Microsoft is steering coding agents to CLI+skills, which shrinks the MCP-only market; (3) extension-attached designs inherit Chrome's debugger detach on restricted-URL frames and hidden-tab throttling (documented by both Playwright and Browser MCP).

### Gaps
- I did not verify whether our `read_page` returns an a11y tree or DOM-derived outline, so the direct comparison to `browser_snapshot` vs `take_snapshot` is approximate.
- No public data on our GIF encoding cost/latency vs Playwright's video pipeline (Playwriter's "100× more efficient" claim is vendor marketing, not a measurement).
