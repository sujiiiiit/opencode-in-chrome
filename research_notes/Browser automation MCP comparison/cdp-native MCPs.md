# CDP-native browser MCP servers: Chrome DevTools MCP and peers

*State as of 7 November 2026. Primary sources: repo docs at `main`, npm registry metadata, Chrome for Developers docs. Web search was unavailable (HTTP 402/429), so this is built from direct fetches of primary sources; no independent benchmark literature was reachable (see Gaps). Vendor marketing claims are labelled as such.*

## Q1. Chrome DevTools MCP: full tool inventory, count, stable/experimental split, version, requirements, attach model, snapshot model

### Takeaway
`chrome-devtools-mcp` v1.12.0 (2026-10-22) exposes **61 MCP tools across 12 categories**, of which roughly **33 are enabled by default** and **28 are gated behind opt-in flags**; it is a Puppeteer-driven, process-launching Node server (not an extension), and its element model is an **accessibility-tree text snapshot with per-snapshot `uid`s**, not persistent refs.

### Cited Findings

**Version / packaging / requirements**
- Latest npm version is **1.12.0**; CHANGELOG dates the 1.12.0 release **2026-10-22** — [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md), [npm registry](https://registry.npmjs.org/chrome-devtools-mcp/latest)
- npm `engines`: `node: "^20.19.0 || ^22.12.0 || >=23"`; package is ESM, Apache-2.0, ~14.3 MB unpacked — [npm registry](https://registry.npmjs.org/chrome-devtools-mcp/latest)
- Requirements: Node.js **LTS**, "Chrome current stable version or newer", npm; officially supports **Google Chrome and Chrome for Testing only** (other Chromium "may work… not guaranteed"); committed to supporting the latest **Extended Stable** Chrome — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md)
- Ships as MCP server **and** a `chrome-devtools` CLI (CLI was promoted out of experimental status in the 1.12.0 docs changes: "remove experimental status from CLI") — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md), [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- Bundles **7 agent skills** (`chrome-devtools`, `chrome-devtools-cli`, `a11y-debugging`, `cookie-debugging`, `debug-optimize-lcp`, `memory-leak-debugging`, `troubleshooting`), installable as Claude Code / Copilot / Gemini CLI plugins — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md)

**Exact tool inventory (61 total, generated from `docs/tool-reference.md`)**

| Category | N | Tools |
|---|---|---|
| Input automation | 10 | `click`, `drag`, `fill`, `fill_form`, `handle_dialog`, `hover`, `press_key`, `type_text`, `upload_file`, `click_at`* |
| Navigation automation | 6 | `close_page`, `list_pages`, `navigate_page`, `new_page`, `select_page`, `wait_for` |
| Emulation | 2 | `emulate`, `resize_page` |
| Performance | 3 | `performance_analyze_insight`, `performance_start_trace`, `performance_stop_trace` |
| Network | 2 | `get_network_request`, `list_network_requests` |
| Debugging | 10 | `evaluate_script`, `get_console_message`, `get_css_styles`, `lighthouse_audit`, `list_console_messages`, `screencast_start`, `screencast_stop`, `set_logpoints`, `take_screenshot`, `take_snapshot` |
| Memory | 14 | `take_heapsnapshot` + 13 analysis tools (`analyze_heapsnapshot_contexts`, `close_heapsnapshot`, `compare_heapsnapshots`, `get_heapsnapshot_class_nodes`, `get_heapsnapshot_details`, `get_heapsnapshot_dominators`, `get_heapsnapshot_duplicate_strings`, `get_heapsnapshot_edges`, `get_heapsnapshot_object_details`, `get_heapsnapshot_retainers`, `get_heapsnapshot_retaining_paths`, `get_heapsnapshot_summary`, `query_heapsnapshot_objects`) |
| Extensions | 5 | `install_extension`, `list_extensions`, `reload_extension`, `trigger_extension_action`, `uninstall_extension` |
| Third-party | 2 | `execute_3p_developer_tool`, `list_3p_developer_tools` |
| WebMCP | 2 | `execute_webmcp_tool`, `list_webmcp_tools` |
| Progressive Web Apps | 4 | `get_os_app_state`, `install_pwa`, `launch_pwa`, `uninstall_pwa` |
| WebAuthn | 1 | `configure_webauthn` |

(\* `click_at` "requires flag: --experimentalVision=true") — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)

**Stable vs "experimental" (there is no separate experimental build — flags gate surfaces)**
- Default-on categories: input, navigation, emulation, performance, network, debugging, memory (`--categoryMemory` default true). Default-off: `--categoryExtensions` (5), `--categoryExperimentalThirdParty` (2), `--categoryExperimentalWebmcp` (2), `--categoryPwa` (4), `--categoryWebauthn` (1) — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)
- `--memoryDebugging` (alias `--experimentalMemory`, default false) gates 13 of the 14 memory tools; only `take_heapsnapshot` is available by default — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md), [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- `click_at` gated by `--experimentalVision`; DevTools-UI automation by `--experimentalDevtools` — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)
- **Slim mode** (`--slim`) exposes exactly **3 tools**: `navigate`, `evaluate`, `screenshot` — [slim-tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/slim-tool-reference.md)

**Attach model (this is the key architectural fact)**
- Default: **launches its own Chrome** with `--userDataDir` defaulting to `$HOME/.cache/chrome-devtools-mcp/chrome-profile$CHANNEL_SUFFIX` (i.e. a *fresh* automation profile, not the user's daily profile); `--isolated` creates a temp profile — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)
- Attach to an already-running browser: `--browserUrl http://127.0.0.1:9222`, `--wsEndpoint ws://…/devtools/browser/<id>` (+ `--wsHeaders`), or `--autoConnect` — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)
- **`--autoConnect` is the "drive the user's signed-in browser" path**: Chrome **144+**, requires the user to start the remote debugging server at `chrome://inspect/#remote-debugging` and "allow the remote debugging connection prompt in the browser" — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md), [troubleshooting.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/troubleshooting.md)
- Consequence: attaching to the *default* profile via `--browserUrl` is blocked since Chrome 136, which stopped honouring `--remote-debugging-port` / `--remote-debugging-pipe` on the default data directory and now requires `--user-data-dir` pointing elsewhere — [Chrome for Developers, 2025-03-17](https://developer.chrome.com/blog/remote-debugging-port)
- Transport to the browser is **Puppeteer** over CDP ("Uses puppeteer to automate actions in Chrome") — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md)
- Runs as a subprocess of the MCP client (`npx chrome-devtools-mcp@latest`); a daemon exists for the CLI, and a fallback private unix socket is used — [CHANGELOG 1.11.0](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)

**Snapshot / ref model**
- `take_snapshot` is "a text snapshot of the target page based on the a11y tree… unique identifier (uid)"; "**Always use the latest snapshot**"; "Prefer taking a snapshot over taking a screenshot"; `verbose` includes the full a11y tree — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- UIDs are per-snapshot and only valid for the snapshot they came from; nodes without a `backendNodeId` are now emitted **without** a uid (1.12.0 fix) — [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- Every input tool takes `pageId` (required by default, `--pageIdRouting` default true) and optional `includeSnapshot` to fold a fresh snapshot into the action response — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- Snapshot noise reduction is an active line of work: "reduce StaticText noise", "skip more redundant data in text snapshots", "drop InlineTextBox nodes", "truncate data: URLs in accessibility snapshots" — [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)

### Inferences
- Default-on count of **33** is my arithmetic (61 − 5 extensions − 2 3p − 2 WebMCP − 4 PWA − 1 WebAuthn − 13 gated memory − 1 `click_at`), not a number published by the project.
- Because it launches its own profile by default, "signed-in browsing" is not the default experience; it requires a deliberate `--autoConnect` (Chrome 144+) or a manual `--user-data-dir` launch. That is a materially different posture from an extension that rides the user's existing profile.
- `--autoConnect` relies on a **human clicking an in-browser permission prompt**; see issue #825 below — this is the main reliability asymmetry vs. an extension-hosted agent.

### Gaps
- No published "stable vs experimental" API channel; the project uses per-category flags, so the split is my reconstruction from `configuration.md` defaults.
- Could not confirm whether `take_snapshot` UIDs survive DOM mutation within the same page (docs only say "always use the latest snapshot"); no explicit ref-invalidation contract found.

## Q2. Chrome DevTools MCP performance tooling: unique capabilities and published overhead measurements

### Takeaway
The performance stack is the one area a high-level tool layer cannot cheaply replicate: **DevTools' own trace + Insights engine**, **CrUX field data**, **Lighthouse (non-performance) audits**, and a **14-tool heap-snapshot analysis suite** — but the project publishes **no measured overhead numbers** for itself.

### Cited Findings
- `performance_start_trace` is documented as "Use to find frontend performance issues, **Core Web Vitals (LCP, INP, CLS)**, and improve page load speed"; options include `reload`, `ignoreCache` (cold-load measurement), `autoStop`, and `filePath` to dump raw `.json`/`.json.gz` traces — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- `performance_analyze_insight` returns detail for a named **Performance Insight** in an **insight set** produced by the trace; documented examples are `DocumentLatency` and `LCPBreakdown` — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- **CrUX field data is on by default**: "Performance tools may send trace URLs to the Google CrUX API to fetch real-user experience data… presenting field data alongside lab data"; disable with `--no-performance-crux` (`--performanceCrux` default true) — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md), [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)
- `lighthouse_audit` returns "Lighthouse scores, failing audits, and the DOM nodes they flag for **accessibility, SEO, best practices, and agentic browsing**" with full reports written to disk; "**This excludes performance**. For performance audits, run `performance_start_trace`" — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- Memory: `take_heapsnapshot` writes a `.heapsnapshot`; 13 analysis tools then cover summary, class nodes, dominators, retainers, retaining paths, edges, duplicate strings, object queries, and **snapshot-to-snapshot diffing** (`compare_heapsnapshots`), all cached server-side by file path; the analysis tools **work without a browser connection** as of 1.12.0 — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md), [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- Logpoints: `set_logpoints` binds expressions to script URLs or **source-map original sources**, survive reloads, and log to the console without pausing — explicitly "not available with --no-source-maps; scripts in workers and **out-of-process iframes are not supported**" — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- `get_css_styles` returns matched rules, inline styles, inherited styles, custom properties, and cascade wrappers (`@layer`, `@media`, `@container`, `@scope`), ordered by cascade precedence, with overridden declarations tagged `[overloaded]` — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- Screencast: `screencast_start`/`screencast_stop` record **.mp4**; the legacy ffmpeg-based implementation is deprecated and the **ffmpeg-free recorder is the default** (1.11.0) — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md), [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)

**On its own overhead / speed (what is actually documented)**
- Latency work in 1.12.0: "run independent tool calls in parallel with a **TaskRunner**" and "run page-scoped tools on different pages in parallel" — [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- Large-trace handling: "chunked trace buffer parser for large recordings" (1.10.0); Lighthouse bundle now "load the Lighthouse bundle on first use" and the CLI loads "a small third-party bundle" (1.12.0) — [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- A 60 s tool-call watchdog exists but was fixed not to kill a healthy browser; a profiler harness (`scripts/profile/profile_mcp.ts`, `npm run test:memory --threshold-percentage 1`) and `scripts/count_tokens.ts`/`update-metrics.ts` exist in-repo — [CHANGELOG 1.11.0](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md), [package.json scripts](https://registry.npmjs.org/chrome-devtools-mcp/latest)
- Token-relevant design: "**Token-Optimized**: Return semantic summaries. 'LCP was 3.2s' is better than 50k lines of JSON. Files are the right location for large amounts of data" and "Reference over Value: for heavy assets… return a file path or resource URI" — [design-principles.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/design-principles.md)
- Screenshot token controls exist because "**image tokens scale with dimensions** rather than encoded bytes"; JPEG/WebP are "~3–5x smaller than PNG"; `--screenshotMaxWidth`/`--screenshotMaxHeight` downscale before return — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)

### Inferences
- The heap-snapshot suite and the Insights engine are the two clearest "a high-level tool layer cannot do this" capabilities: both depend on DevTools' client-side trace/HeapSnapshot models, not on a single CDP call.
- **Critically for a `chrome.debugger` extension:** the `chrome.debugger` API does **not** expose the `Memory` or `Profiler` CDP domains (see Q7), so `take_heapsnapshot` + 13 analysis tools and any CPU-profile equivalent are **structurally unreachable** from an extension; `Tracing` *is* available, so trace capture is reachable but the Insights analysis would have to be re-implemented.

### Gaps
- **No published measurement of its own overhead** (startup time, per-call latency, tokens per snapshot) was found on the repo, npm page, or Chrome for Developers. The repo contains profiling scripts but no published results. Any "measurably faster/slower" claim about it remains unsourced.
- Exact count/names of Performance Insights beyond `DocumentLatency` and `LCPBreakdown` are not enumerated in the tool reference.

## Q3. Token cost per call and tool-schema overhead

### Takeaway
No vendor publishes a measured tokens-per-call figure; the only hard, citable facts are **structural cost controls** (pagination, truncation, file-offload, 3-tool slim mode, screenshot downscaling) and the industry's own admission that **large tool schemas + verbose a11y trees are the dominant cost**, which is why Microsoft now recommends CLI+skills over MCP for coding agents.

### Cited Findings
- Chrome DevTools MCP ships **server-side pagination** on the expensive reads (`list_network_requests`, `list_console_messages`, `get_css_styles` default **10 rules/page**, all heap tools default **50 items/page**, `pageIdx`/`pageSize`) and **name truncation** defaulting to **100 chars** (`maxNameLength`) — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- Heavy artifacts are offloaded to disk by default-ish design: traces, `.heapsnapshot`, screenshots, network request/response bodies (`.network-request` / `.network-response`), screencast `.mp4`, Lighthouse HTML — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- `--slim` reduces the entire server to **3 tools** ("Useful for basic browser tasks") — [configuration.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)
- Microsoft, in the Playwright MCP README: coding agents "increasingly favor CLI-based workflows exposed as SKILLs over MCP because CLI invocations are **more token-efficient: they avoid loading large tool schemas and verbose accessibility trees** into the model context" — [playwright-mcp README](https://github.com/microsoft/playwright-mcp/blob/main/README.md)
- Playwriter's comparison table claims context usage "**Low**" for its single `execute` tool vs "**High (tool schemas)**" for BrowserMCP's "12+ dedicated tools"; no numbers — [playwriter README](https://github.com/remorses/playwriter/blob/main/README.md) *(vendor claim)*
- Playwriter also claims a11y snapshots at "**5–20KB**" vs "Screenshots (100KB+)" for the Claude extension — [playwriter README](https://github.com/remorses/playwriter/blob/main/README.md) *(vendor claim, no methodology)*
- mcp-chrome claims "50–200ms inter-process communication" for Playwright-based servers vs "✅ Faster" for extension-based, with no measurement — [mcp-chrome README](https://github.com/hangwin/mcp-chrome/blob/main/README.md) *(vendor claim, unquantified)*
- Playwright MCP adds a fixed **500 ms settle delay** after each action by default (`--timeout-settle`, default 500 ms) and a 5 s action timeout — a per-call latency floor a CDP-native server need not pay — [playwright-mcp README](https://github.com/microsoft/playwright-mcp/blob/main/README.md)

### Inferences
- For our 20-tool surface, the schema cost is bounded and roughly comparable to Playwright MCP (~24 core tools) and smaller than chrome-devtools-mcp's 61; the 33-tool default set is the number to beat on schema tokens, not the 61 headline.
- Where a high-level layer can be *cheaper* per call: one `read_page`/`computer` call that returns a filtered tree replaces snapshot→click→verify chains. Where it is *dearer*: it cannot answer "which CSS rule won and why" or "what retains this object" in one call, so it pays in turns instead of tokens.

### Gaps
- No published per-call token or latency measurement exists for any of these servers that I could verify. Searches for benchmark blog posts were blocked (HTTP 402/429); treat all speed comparisons as unverified.

## Q4. Peer CDP-native servers: chrome-remote-interface, mcp-chrome, BrowserMCP, Playwriter, Steel, Selenium/BiDi, 2026 newcomers

### Takeaway
The field split into three architectures: **(a) launch-your-own-Chrome** (chrome-devtools-mcp, Playwright MCP default, agent-browser), **(b) extension + `chrome.debugger` relay** (BrowserMCP, Playwriter, mcp-chrome — the same architecture we are building), and **(c) WebDriver/WebDriver-BiDi** (mcp-selenium). Tool counts range from **1** (`playwriter` `execute`) to **61** (chrome-devtools-mcp) to **50+ CLI commands** (agent-browser).

### Cited Findings

| Server | Arch / attach | Tools | Version evidence | Notable |
|---|---|---|---|---|
| **Chrome DevTools MCP** | Node subprocess → Puppeteer → CDP; launches Chrome or `--browserUrl/--wsEndpoint/--autoConnect` | **61** (33 default) | 1.12.0, 2026-10-22 ([npm](https://registry.npmjs.org/chrome-devtools-mcp/latest)) | DevTools traces/insights, heap graph, Lighthouse, extensions, PWA, WebAuthn |
| **mcp-chrome** (hangwin) | Chrome **extension** + native-messaging host `mcp-chrome-bridge`; Streamable HTTP `127.0.0.1:12306` (stdio fallback) | **24** | bridge 1.0.31, npm publish ~2025-12-30 ([npm](https://registry.npmjs.org/mcp-chrome-bridge/latest)) | "Use Your Original Browser" (logins/configs); vector-DB semantic tab search; `chrome_read_page` a11y tree with `ref_*` |
| **BrowserMCP** | Extension = "thin **chrome.debugger** relay" + per-user daemon + **Playwright**; pairing with 6-digit code, one **Allow** per computer | "12+ dedicated tools" (per Playwriter's table; README does not enumerate) | npm `@browsermcp/mcp` ([repo](https://github.com/BrowserMCP/mcp)) | Explicitly refuses incognito (unless allowed), browser/extension pages; no Firefox (no `debugger` API) |
| **Playwriter** | Extension + WS relay `localhost:19988` exposing a **CDP endpoint** (`/cdp/:id`) → `chromium.connectOverCDP` → full Playwright | **1** MCP tool (`execute`) | 0.10.0 ([npm](https://registry.npmjs.org/playwriter/latest)) | Raw CDP first-class; `aria-ref` labels; tab groups per session; remote-control tunnels; *known issue*: all pages `about:blank` after `chrome.debugger` bug |
| **Playwright MCP** (Microsoft) | Launches browser with **per-workspace persistent profile**; `--extension` mode for real Chrome; `--cdp-endpoint` | ~24 core + `browser_tabs` + capability groups (vision/pdf/devtools/webmcp) | 0.0.84, Node ≥18 ([npm](https://registry.npmjs.org/@playwright/mcp/latest)) | a11y snapshots + `ref`; 500 ms settle; WebMCP tools collected by default |
| **agent-browser** (Vercel Labs) | Native **Rust CLI + daemon over CDP**; Chrome for Testing default; `--cdp` / `--auto-connect`; also `agent-browser mcp` | **50+ commands** across 11 groups | ([README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)) | 2026 "large surface" newcomer; refs `@e1`; `trace`, `profiler`, `vitals`, `react`, `a11y`, `record`, `diff` |
| **mcp-selenium** (angiejones) | **WebDriver** (chromedriver/geckodriver/Safari); **WebDriver BiDi** auto-enabled for diagnostics | **18** + 2 MCP resources | ([README](https://github.com/angiejones/mcp-selenium/blob/main/README.md)) | Only cross-browser option incl. Safari; `diagnostics` = console/errors/network via BiDi |

- **mcp-chrome's own framing**: "Unlike traditional browser automation tools (like Playwright), Chrome MCP Server directly uses your daily Chrome browser, leveraging existing user habits, configurations, and **login states**"; comparison table scores extension-based as better on resource usage, session reuse, startup, and response speed — [mcp-chrome README](https://github.com/hangwin/mcp-chrome/blob/main/README.md)
- **mcp-chrome tool breakdown** (24): browser mgmt 7 (`get_windows_and_tabs`, `chrome_navigate`, `chrome_switch_tab`, `chrome_close_tabs`, `chrome_go_back_or_forward`, `chrome_inject_script`, `chrome_send_command_to_inject_script`), screenshot 1, network 5 (`chrome_network_capture_start/stop` via webRequest, `chrome_network_debugger_start/stop` via `chrome.debugger` **with response bodies**, `chrome_network_request`), content 3 active (`chrome_read_page`, `search_tabs_content`, `chrome_get_web_content`; `chrome_get_interactive_elements` deprecated/unlisted), interaction 4 (`chrome_computer`, `chrome_click_element`, `chrome_fill_or_select`, `chrome_keyboard`), data 4 (history, bookmark search/add/delete) — [docs/TOOLS.md](https://github.com/hangwin/mcp-chrome/blob/main/docs/TOOLS.md)
- mcp-chrome's `chrome_read_page` returns "an accessibility-like tree… (visible viewport by default) with stable `ref_*` identifiers" and **falls back to interactive-elements logic** when the a11y tree is unavailable or too sparse — [docs/TOOLS.md](https://github.com/hangwin/mcp-chrome/blob/main/docs/TOOLS.md)
- BrowserMCP's extension "**enforces its own rules whatever the daemon asks**: no incognito tabs unless you turned on Allow in Incognito… no browser or extension pages, and nothing while you've pressed **Stop**" — a policy layer we should mirror — [BrowserMCP README](https://github.com/BrowserMCP/mcp/blob/main/README.md)
- Playwriter states the attach constraint plainly: "Chrome's `--remote-debugging-port` is **ignored on your default profile since Chrome 136**, so you must use a throwaway `--user-data-dir`… Connecting an external CDP client also shows an **'Allow remote debugging?' dialog an agent cannot click**" — [playwriter README](https://github.com/remorses/playwriter/blob/main/README.md) *(vendor framing, but consistent with Chrome's official 2025-03-17 post)*
- agent-browser's command groups include `snapshot`, `find`, `dialog`, `frame`, `tab`, `network`, `cookies`, `storage`, `trace`, `profiler`, `vitals`, `a11y`, `record`, `diff`, `batch`, `webmcp`, `flow` — [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)
- Steel / Browserbase / Browserless / Kernel appear in agent-browser as **cloud browser providers** (`--provider`), not as MCP tool surfaces — [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)

### Inferences
- The extension-relay architecture is now **validated by three independent projects** (BrowserMCP, Playwriter, mcp-chrome), all converging on: extension → localhost WebSocket → a driver process that speaks CDP. Our client-MCP-over-WebSocket design matches the winning shape; the differentiator left is the **tool layer's compactness and reliability**, not transport.
- Nobody in this set combines "user's real profile" + "CDP-native depth" at a small tool count: Playwriter has depth but 1 tool (requires the model to write Playwright); mcp-chrome has the profile but shallow CDP; chrome-devtools-mcp has depth but not the profile by default. That gap is our opening.

### Gaps
- **Steel**: no MCP server surface could be confirmed from primary sources in this pass; it appears as a browser-hosting provider, not an MCP tool server. Treat "Steel MCP" as unverified.
- **chrome-remote-interface–based servers**: no actively maintained, citable MCP server built directly on `chrome-remote-interface` was found. The `chrome-remote-interface` library itself is a CDP client, not an MCP server.
- **WebDriver BiDi servers**: the only citable BiDi-adjacent MCP is mcp-selenium (BiDi used for diagnostics, not as the primary protocol). No dedicated "BiDi MCP" with published tool inventory was found.
- BrowserMCP's exact tool list and version number are not in its README; the "12+" figure is Playwriter's characterization, not BrowserMCP's own.

## Q5. Where CDP-native competitors are broader than a 20-tool high-level layer

### Takeaway
Competitors are broader in **five domains a high-level tool layer cannot reach at all or cannot reach in one call**: (1) performance traces + Insights + CrUX, (2) heap-snapshot graph analysis, (3) CSS cascade truth, (4) protocol-level debugging (logpoints, source maps, service-worker eval), and (5) browser-surface automation (extensions, PWA install, virtual WebAuthn).

### Cited Findings
- **Trace → insight pipeline**: `performance_start_trace` → insight sets → `performance_analyze_insight("LCPBreakdown")`, plus CrUX field data. A `read_page`/`computer` layer can time navigations but cannot attribute LCP to sub-parts or compare lab vs field — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md), [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md)
- **Heap graph**: retainers, retaining paths, dominators, detached-DOM filters, duplicate strings, two-snapshot diff — needs `HeapProfiler`/`Memory` CDP + a snapshot parser; unavailable under `chrome.debugger` (Q7) — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md), [chrome.debugger domains](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- **CSS cascade**: `get_css_styles` returns winning vs `[overloaded]` declarations with `@layer/@media/@container/@scope` wrappers and source line numbers — "Treat the output as authoritative and complete". This is `CSS.getMatchedStylesForNode`, not computable reliably from `getComputedStyle` — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- **Protocol debugging**: `set_logpoints` (source-map-aware, persists across reloads), `evaluate_script` **inside a service worker** (`serviceWorkerId`), console messages with source-mapped stack traces and preserved messages across the last 3 navigations — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- **Browser-surface automation**: `install_extension`/`reload_extension`/`trigger_extension_action`/`uninstall_extension`; `install_pwa`/`launch_pwa`/`get_os_app_state` (installs via the PWA CDP domain "without a user gesture or install dialog"); `configure_webauthn` (virtual authenticator answering `navigator.credentials.create/get`) — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- **Lighthouse parity-ish**: `lighthouse_audit` returns failing audits *and the DOM nodes they flag*, which is a different output shape from a score-only report — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- **WebMCP / third-party tool discovery**: `list_webmcp_tools` / `execute_webmcp_tool` and `list_3p_developer_tools` / `execute_3p_developer_tool` (with `window.__dtmcp.executeTool` as an escape hatch for non-serializable returns) — a page-exposed-tool bridge no high-level layer has — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md), [third-party-developer-tools.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/third-party-developer-tools.md)
- Peer breadth: agent-browser exposes `trace`, `profiler`, `vitals`, `a11y`, `react`, `diff`, `record` as first-class CLI commands; mcp-chrome exposes browser-wide `history`/`bookmark` CRUD and cross-tab semantic search — surfaces no per-tab automation layer has — [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md), [mcp-chrome TOOLS.md](https://github.com/hangwin/mcp-chrome/blob/main/docs/TOOLS.md)

### Inferences
- Our 20 tools already cover or exceed the competitors on: tab lifecycle (`tabs_context/share/create/close`), batch execution, GIF capture, `ask_user`, `done`, image upload, and compact `find`. None of the four competitors has a documented `batch`, `ask_user`, `done`, or GIF-equivalent MCP tool (Playwriter's `batch` is CLI-only; agent-browser has `batch` as a command).
- The honest gap list to publish internally: performance attribution, heap analysis, CSS cascade, logpoints/source maps, service-worker eval, extension/PWA/WebAuthn automation, HAR/WS-frame export.

### Gaps
- No competitor documents a `done`/`ask_user` human-in-the-loop primitive; absence of evidence, not evidence of absence.

## Q6. Performance claims with evidence, and known weaknesses of each server

### Takeaway
Every speed comparison in this space is **vendor-authored and unquantified**; the only *engineering* evidence of performance work is chrome-devtools-mcp's changelog (parallel TaskRunner, chunked trace parsing, lazy Lighthouse bundle) and the documented per-action settle delay in Playwright MCP. Known weaknesses are concrete and mostly about **attach friction, tab count, and dialogs**.

### Cited Findings

**Chrome DevTools MCP — weaknesses (from its own issue tracker and docs)**
- **Many tabs → hang/crash**: "Browser hangs / crashes when MCP connects to Chrome with many tabs" (#1921, opened 2026-04-21, 18 comments, `confirmed`); troubleshooting says "Chrome DevTools MCP **forces all tabs to be loaded**… not recommended… with browser instances running hundreds of tabs" — [issue #1921](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/1921), [troubleshooting.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/troubleshooting.md)
- **Remote-debugging approval cannot be persisted** (#825, 21 comments): users must re-approve the `chrome://inspect` connection prompt — [issue #825](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/825)
- **No multi-session / multi-instance** (#3070, 11 comments) — [issue #3070](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/3070)
- **Password dialogs can block input events** (#2199, `confirmed`) — [issue #2199](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/2199)
- **URL allow/block bypass via SharedWorker/AudioWorklet** (#3399, `confirmed`, 2026-11-02) — [issue #3399](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/3399)
- **Missing capabilities users ask for**: network request interception/URL replacement (#848), HAR export (#632), WebSocket frame debugging (#1172), dedicated-worker eval (#316), JS/CSS coverage (#731), snapshot of a subtree/root element (#716), "select element to inspect" (#268), persistent remote-debugging approval (#825) — [issues list](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues?q=is%3Aissue+is%3Aopen+sort%3Acomments-desc)
- **Operational fragility**: last page cannot be closed; must not run as root (Chrome won't start); client sandboxes break Chrome's own sandbox; WSL needs Chrome inside Linux or `--browser-url`; macOS TCC blocks reading the Chrome profile for `--autoConnect` (EPERM) — [troubleshooting.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/troubleshooting.md), [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- **Cloud-side data egress**: trace URLs go to CrUX by default; **usage statistics are on by default** ("tool invocation success rates, latency, and environment information"; opt out via `--no-usage-statistics` / `CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS` / `CI`) — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md)

**Peer weaknesses**
- **Playwriter**: known issue "If all pages return `about:blank`, restart Chrome (**Chrome bug in the `chrome.debugger` API**)"; browser may switch to light mode on connect; a 1-tool surface pushes Playwright competence onto the model — [playwriter README](https://github.com/remorses/playwriter/blob/main/README.md)
- **BrowserMCP**: no Firefox ("Firefox has no `debugger` API"); self-built extension must be updated by hand; multiple profiles each connect as separate browsers — [BrowserMCP README](https://github.com/BrowserMCP/mcp/blob/main/README.md)
- **mcp-chrome**: "still in its early stages and is under intensive development"; native-messaging install is manual (load unpacked + `npm install -g` + register); latest npm publish ~2025-12-30, i.e. ~10 months stale as of this writing — [mcp-chrome README](https://github.com/hangwin/mcp-chrome/blob/main/README.md), [npm](https://registry.npmjs.org/mcp-chrome-bridge/latest)
- **Playwright MCP**: persistent profile "can only be used by one browser instance at a time, so concurrent MCP clients sharing the same workspace will conflict"; a fixed 500 ms settle cost per action; Microsoft itself now steers coding agents to CLI+skills — [playwright-mcp README](https://github.com/microsoft/playwright-mcp/blob/main/README.md)
- **mcp-selenium**: WebDriver round-trips through a driver process; Safari needs macOS + `safaridriver --enable` + manual "Allow Remote Automation", no headless — [mcp-selenium README](https://github.com/angiejones/mcp-selenium/blob/main/README.md)

### Inferences
- The recurring failure mode across all of them is **not the protocol**, it is **session/attach lifetime**: approval prompts, other debugger clients, tab count, and dialogs. Our extension should invest there (persistent pairing, per-tab opt-in, dialog pre-emption, lazy tab hydration) rather than in more tools.
- "Forces all tabs to be loaded" is the single most damaging documented behaviour for a real user profile — a `chrome.debugger`-per-tab design that never touches unshared tabs is directly better here, and is a headline differentiator.

### Gaps
- No numbers behind any speed claim (see Q3). chrome-devtools-mcp's own telemetry collects "latency" but Google has not published aggregates.

## Q7. Reliability engineering: auto-wait, ref stability, iframe/shadow-DOM reach, cross-origin frames, dialogs — and how a `chrome.debugger` extension compares

### Takeaway
Auto-wait quality tracks the **driver** (Puppeteer/Playwright >> raw CDP >> JS-injection), refs are **snapshot-scoped everywhere** (nobody has stable persistent refs), and a `chrome.debugger` extension has **hard protocol ceilings** — no `Memory`/`Profiler` domains, no recursive OOPIF auto-attach, and it is **detached the moment DevTools opens** on that tab.

### Cited Findings

**Auto-wait**
- chrome-devtools-mcp: "Uses puppeteer to automate actions in Chrome and **automatically wait for action results**"; `wait_for` matches text by accessible name or DOM substring, with opt-in `visible` (1.12.0), and now finds text in **dynamically attached iframes** (1.12.0 fix) — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/README.md), [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- Playwright MCP: Playwright actionability + `--timeout-settle` default **500 ms** after each action, action timeout default **5 s**, navigation **60 s** — [playwright-mcp README](https://github.com/microsoft/playwright-mcp/blob/main/README.md)
- agent-browser: "A click **fails, instead of reporting success**, when the target is hidden, disabled, outside the viewport, or covered by another element such as a consent banner" — a strong, explicit contract — [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)
- mcp-chrome: `chrome_computer` "prioritizes **high-level DOM actions with CDP fallback**", accepts `ref`, `selector`, or coordinates; no documented actionability guarantee — [mcp-chrome TOOLS.md](https://github.com/hangwin/mcp-chrome/blob/main/docs/TOOLS.md)
- mcp-selenium: explicit per-call `timeout` (default 10 000 ms) on locator actions; no documented actionability/auto-wait semantics beyond WebDriver's implicit waits — [mcp-selenium README](https://github.com/angiejones/mcp-selenium/blob/main/README.md)

**Ref stability**
- chrome-devtools-mcp: `uid` from the a11y snapshot, "**Always use the latest snapshot**"; `includeSnapshot` exists so the model re-reads after each action — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- agent-browser: "Refs describe the page **at the time of the snapshot**. After navigation or a DOM change, take a new snapshot before using refs again" — [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)
- Playwright MCP: `target` = "Exact target element reference from the page snapshot, **or a unique element selector**" — the selector fallback is the closest thing to ref persistence in this set — [playwright-mcp README](https://github.com/microsoft/playwright-mcp/blob/main/README.md)
- mcp-chrome: `ref_*` ids that are "stable" within a `chrome_read_page` result, with selector/coordinate fallbacks in every action tool — [mcp-chrome TOOLS.md](https://github.com/hangwin/mcp-chrome/blob/main/docs/TOOLS.md)

**iframes / shadow DOM / cross-origin**
- Same-process iframes appear as extra **execution contexts** on one target; **out-of-process iframes are separate targets**, reachable only via `Target.setAutoAttach` with `flatten: true` — and auto-attach is **not recursive**: for A→B→C all cross-origin, attaching at A reaches B, but you must call `setAutoAttach` again on B to reach C — [chrome.debugger reference](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- chrome-devtools-mcp's snapshot is a11y-tree-based, so frame content is included (subject to the a11y tree); its logpoints explicitly **exclude** "scripts in workers and out-of-process iframes"; `evaluate_script` targets a page or a service worker, not arbitrary child frames — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- Shadow DOM: no competitor documents an explicit shadow-root addressing model; a11y-tree snapshots pierce open shadow roots as part of the computed tree, but closed shadow roots are unreachable by definition (no primary source found stating per-server behaviour — see Gaps).

**Dialogs**
- chrome-devtools-mcp: `handle_dialog` (accept/dismiss/promptText), `navigate_page.handleBeforeUnload`, `evaluate_script.dialogAction` (accept/dismiss/string), and 1.12.0 "**block evaluate_script while a dialog is open**" + "clear handled dialog in McpPage.getDialog()" — dialogs hold the renderer, so blocking is the right call — [tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md), [CHANGELOG](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- Playwright MCP: `browser_handle_dialog` (`accept`, `promptText`) — [playwright-mcp README](https://github.com/microsoft/playwright-mcp/blob/main/README.md)
- mcp-selenium: `alert` with `accept`/`dismiss`/`get_text`/`send_text` — [mcp-selenium README](https://github.com/angiejones/mcp-selenium/blob/main/README.md)
- agent-browser: first-class `dialog` command group — [agent-browser README](https://github.com/vercel-labs/agent-browser/blob/main/README.md)

**The `chrome.debugger` ceiling (most important section for us)**
- Available CDP domains are whitelisted: **Accessibility, Audits, CacheStorage, Console, CSS, Database, Debugger, DOM, DOMDebugger, DOMSnapshot, Emulation, Fetch, IO, Input, Inspector, Log, Network, Overlay, Page, Performance, Runtime, Storage, Target, Tracing, WebAudio, WebAuthn** — [chrome.debugger reference](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- **Not available**: `Memory` (heap snapshots, `getHeapUsage`, `collectGarbage`), `HeapProfiler`, `Profiler` (CPU profile), `ServiceWorker` (worker lifecycle), `Browser` (browser-level target commands), `Security`, `Media`, `FedCm`, `DeviceOrientation`, `Cast`. This is the exact set chrome-devtools-mcp relies on for its 14 memory tools and (for CPU) its profiling.
- `Tracing` **is** available → `performance_start_trace`-style capture is reachable; the DevTools **Insights** aggregation is client-side (devtools-frontend's trace engine) and would have to be re-implemented or vendored.
- `Audits` is available → a Lighthouse-style audit is at least partially reachable; chrome-devtools-mcp instead runs the Lighthouse npm package in-process.
- Detach conditions: `onDetach` fires when "the tab is being closed **or Chrome DevTools is being invoked for the attached tab**" — opening DevTools on a tab we drive kicks us off it — [chrome.debugger reference](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- Flat sessions (Chrome 125+) let one `debugger.attach` cover child targets via `sessionId`; `browser.*` namespace for the API is Chrome 148+ — [chrome.debugger reference](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- Enterprise policy can hard-block attach per host: `debugger.attach()` fails with "This page cannot be scripted due to an ExtensionsSettings policy", and Chrome **detaches** if the target navigates into a blocked host — [chrome.debugger reference](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- Real-world corroboration from a shipping peer: Playwriter lists a `chrome.debugger` bug where all pages return `about:blank` until Chrome restarts — [playwriter README](https://github.com/remorses/playwriter/blob/main/README.md)

### Inferences
- Auto-wait is our biggest **achievable** reliability win: we can replicate Puppeteer-grade actionability inside the page (hit-testing via `DOM.getNodeForLocation`/`document.elementFromPoint`, visibility, stability over 2 rAFs, enabled/editable checks, scroll-into-view, then `Input.dispatchMouseEvent`), because `Input`, `DOM`, `Overlay`, `Runtime` and `Page` are all in the whitelist. Playwright's 500 ms settle delay is a floor we can beat with event-driven waits (`Page.lifecycleEvent` / network-idle / mutation quiescence).
- Ref stability: we should adopt **snapshot-scoped refs + a sticky selector fallback** (mcp-chrome/Playwright pattern), because every competitor's refs die on the next snapshot. Carrying `backendNodeId` + a generated robust selector per ref lets `computer` retry after re-render without a full re-read.
- We must design **around** the missing domains: no heap/CPU profiling in-product; expose `Tracing`-based trace capture + our own metrics instead, and say so explicitly in the tool docs rather than implying DevTools parity.
- Dialog handling must be **pre-emptive**: enable `Page` domain at attach, keep a `Page.javascriptDialogOpening` handler that auto-parks the dialog and returns its state to the model, and refuse to issue Runtime evaluations while a dialog is open (mirrors chrome-devtools-mcp's 1.12.0 fix).
- OOPIF reach needs explicit recursive `Target.setAutoAttach` per child session; a single top-level call will silently miss nested cross-origin frames.

### Gaps
- No primary source documents shadow-DOM (open vs closed) handling for any of these servers; the a11y-tree claim is an inference from how CDP's accessibility tree is computed, not a documented guarantee.
- Could not verify whether chrome-devtools-mcp's `evaluate_script` can target a child frame's execution context (only `pageId` and `serviceWorkerId` are documented).
- No published head-to-head reliability benchmark (task success rate, flake rate) for any of these servers was found.
