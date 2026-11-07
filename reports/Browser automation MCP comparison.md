# The live-session moat beats every tool count

Nothing on the market beats this extension's MCP server on the axis it was built for. Across fifteen comparable servers, **no other design combines a real signed-in Chrome profile, no local process, a client-agnostic MCP surface, a compact high-level tool layer and an executor-side policy engine**. The closest peer is Browser MCP 2.x, which matches the extension-plus-debugger architecture but needs a local daemon and a Playwright bridge; it wins only on raw CDP reach and eight-profile fan-out. Playwright MCP and Chrome DevTools MCP have far wider surfaces (**25 default / 72 capability-enabled** and **61 tools**) but neither drives the user's daily profile by default. Claude in Chrome is the only other in-extension MCP, and a live probe shows it is narrower than its reputation: roughly 22 tools, an LLM-backed `find`, no shadow-DOM or iframe coverage, and bare "Clicked" results. On performance, the honest position is that **no independent benchmark isolates extension-based control at all**: the best controlled tool-layer evidence puts every serious stack in a **48–60% success band on live-web tasks at 168k–1116k tokens and $0.010–$0.355 per attempt**, with model and harness choice moving results more than the browser driver. Wider tool counts exist; extraordinary measured performance does not. The gap that matters is not tool count but the handful of capabilities we cannot reach from `chrome.debugger`, and three of those are worth closing.

## Nothing in the field beats an in-extension MCP on the axis it optimises

The comparison splits cleanly once you separate *surface area* from *access*. Surface area is cheap: Bright Data ships **30 tools**, Chrome DevTools MCP **61**, Playwright MCP **72** with every capability group enabled, Steel **24**, mcp-chrome **24** ([Bright Data](https://docs.brightdata.com/products/mcp-server/tools), [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md), [Playwright MCP](https://github.com/microsoft/playwright-mcp#tools), [Steel](https://docs.steel.dev/overview/mcp), [mcp-chrome](https://github.com/hangwin/mcp-chrome/blob/main/docs/TOOLS.md)). Access is not: every hosted product in the survey runs a **separate cloud browser in an isolated VM**, so passkeys, device-bound sessions, corporate profiles, VPN-only intranets and locally installed wallets are out of reach by construction ([Anchor](https://docs.anchorbrowser.io/advanced/mcp), [Steel sessions](https://docs.steel.dev/overview/sessions-api/overview)).

| Axis | Who leads | Why |
|---|---|---|
| Tool-count breadth | Chrome DevTools MCP (61), Playwright MCP (72 with caps), Bright Data (30) | Ours is 20 by design; broader surfaces are mostly opt-in devtools and storage primitives |
| DevTools depth | Chrome DevTools MCP | 3 performance tools, **14 memory tools**, Lighthouse, CSS cascade, logpoints, WebAuthn |
| Raw protocol reach | Playwriter, Browser MCP | Full Playwright plus CDP via `execute` / `cdp --caps` |
| Signed-in user session | **Ours**, Claude in Chrome, Browser MCP, Playwriter, mcp-chrome | The five extension-attached designs; all others cannot inherit logins |
| No local process | **Ours**, Claude in Chrome side panel | Every other extension design ships a daemon, relay or native host |
| Client-agnostic MCP | **Ours**, Browser MCP, Playwriter, Playwright MCP | Claude in Chrome's server is documented for Claude Code only |
| Executor-side policy | **Ours** | Playwright MCP states outright it "is not a security boundary"; relays delegate gating to the client |
| Published safety evidence | Claude in Chrome | 23.6% → 11.2% injection success at pilot, 0% for Sonnet 5/Opus 5 at GA behind probes and a classifier |
| Measured task success | A statistical tie at 48–60% | No extension server has a published score at all |
| Cost per completed task | CLI/session harnesses, not browser drivers | $0.017–$0.072 on a cheap model, $0.206–$0.740 on Sonnet 5 |

Two conclusions follow. First, **"wider range of tools" is real but not decisive**: the only head-to-head evidence on tool count shows a shortlist of **7 tools reaching 90.3% coverage versus 90.8% for always showing 50**, while downstream selection accuracy improves from 87.1% to **93.1%** with shorter lists ([arXiv:2605.24660](https://arxiv.org/abs/2605.24660)). Second, every product that beats us on a single axis pays with an architecture we rejected — a daemon, a bundled browser, or a cloud VM.

The one place we are genuinely behind on *evidence* rather than capability is safety. Anthropic publishes red-team numbers and runs server-side probes plus an action classifier; our policy layer is well designed but unmeasured, and **no study quantifies how approval gating changes completion rate** — the exchange rate between safety and success is unpublished across the entire field ([WebdriverIO](https://github.com/webdriverio/benchmark)).

## Fifteen servers, four architectures, one that inherits your logins

Four architectures account for every product: **bundled-browser automation** (Playwright MCP default, Selenium, WebdriverIO), **CDP-native introspection** (Chrome DevTools MCP, agent-browser), **extension-attached real Chrome** (ours, Browser MCP, Playwriter, mcp-chrome, Claude in Chrome), and **hosted cloud browsers plus scrapers** (everything else). Only the third can act inside a session the user is already signed into.

| Server (version, date) | Tools | Transport / architecture | Browser target | Acts in user's signed-in Chrome? |
|---|---|---|---|---|
| **Playwright MCP** 0.0.84 (2026-10-31) | 25 default, 72 with `--caps` | Node stdio server or HTTP on :8931; launches its own profile, `--extension` for real Chrome | Chromium, Firefox, WebKit, Edge | Only via Playwright Extension: tab-picker, per-client tab group ([README](https://github.com/microsoft/playwright-mcp#readme)) |
| **Chrome DevTools MCP** 1.12.0 (2026-10-22) | 61 (≈33 default, 3 in `--slim`) | Node subprocess → Puppeteer → CDP; own profile by default | Chrome, Chrome for Testing | `--autoConnect` needs Chrome 144+ and a per-connection approval prompt ([configuration](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)) |
| **Browser MCP** ext 2.2.1, server 2.4.0 (2026-11-02) | 1 (`browser`, ~40 commands) | MV3 extension → daemon on 127.0.0.1:9010 → Playwright `connectOverCDP` | Any Chromium (no Firefox) | **Yes** — closest architectural peer ([docs](https://docs.browsermcp.io/how-it-works)) |
| **Browser Use** (docs 2026-11) | 16 | `uvx` stdio server or hosted cloud MCP | Launched Chrome or cloud | No confirmed extension path ([MCP docs](https://docs.browser-use.com/customize/mcp-server)) |
| **Claude in Chrome** GA 2026-08-26 | ≈22 (live probe 2026-11-05) | Extension side panel; native messaging host plus cloud relay for Claude Code | Chrome only | **Yes** ([GA post](https://claude.com/blog/claude-in-chrome-generally-available)) |
| **Stagehand / Browserbase** Stagehand 4.1.0 (benchmarked 2026-10-09) | 3 facade (`run`, `snapshot`, `screenshot`); Browserbase's 6-tool server archived 2026-07-20 | Hosted HTTP MCP or local SDK | Cloud browsers | No ([Stagehand](https://github.com/browserbase/stagehand)) |
| **Playwriter** 0.10.0 (2026-11-06) | 2 (`execute`, `reset`) | Extension → local WS relay :19988 → full Playwright + CDP | Any Chromium | **Yes**, after click-to-control ([README](https://github.com/remorses/playwriter)) |
| **Steel** (docs 2026-11-07) | 24 | Hosted HTTP MCP only, cannot self-host the MCP | Cloud | No ([MCP docs](https://docs.steel.dev/overview/mcp)) |
| **Browserless** (docs 2026-11-07) | 8 stateless + agent + account tools (~18 names) | Hosted Streamable HTTP MCP | Cloud | No ([MCP tools](https://docs.browserless.io/mcp/rest-api-tools)) |
| **Hyperbrowser** (docs 2026-11-07) | 10 | `npx` stdio server, cloud execution | Cloud | No ([README](https://github.com/hyperbrowserai/mcp)) |
| **Firecrawl** (docs 2026-11-07) | ~20–25 | Hosted HTTP MCP | Cloud scraper | No ([tools](https://docs.firecrawl.dev/mcp-server/tools)) |
| **Bright Data** (docs 2026-11-07) | 30 | Hosted or self-hosted MCP | Cloud plus proxies | No ([tools](https://docs.brightdata.com/products/mcp-server/tools)) |
| **Apify** (docs 2026-11-07) | Dynamic, 7 by default | Hosted `mcp.apify.com` or stdio; Actors become tools | Cloud | No ([MCP docs](https://docs.apify.com/mcp.md)) |
| **mcp-chrome** bridge 1.0.31 (~2025-12-30) | 24 | Extension + native-messaging host + HTTP 127.0.0.1:12306 | Chrome | **Yes** ([TOOLS.md](https://github.com/hangwin/mcp-chrome/blob/main/docs/TOOLS.md)) |
| **Selenium MCP** (last push 2026-02-23) | 18 | WebDriver, WebDriver BiDi for diagnostics | Chrome, Firefox, Edge, Safari | No — new driver profile ([README](https://github.com/angiejones/mcp-selenium)) |

The also-rans sharpen the picture rather than change it. **Nanobrowser** (14.3k stars, Apache-2.0) is an in-extension agent with per-site Allow/Ask/Block, but ships no MCP at all ([README](https://github.com/nanobrowser/nanobrowser)). **Notte** (8 tools), **Anchor** (23+ tools, the widest auth story: vaulted identities, MFA, reauth links), **Oxylabs** (~25), **ScrapingBee** (17) and **WDIO MCP** (a dynamic, session-shaped surface) are all cloud-side or driver-side ([Notte](https://docs.notte.cc/mcp-server), [Anchor](https://docs.anchorbrowser.io/advanced/mcp), [Oxylabs](https://developers.oxylabs.io/ai-workflows/mcp), [ScrapingBee](https://www.scrapingbee.com/documentation/remote-mcp/), [WDIO](https://github.com/webdriverio/mcp)). Notably, **Browserbase's original MCP was archived in July 2026** and replaced by Stagehand's three-tool facade — the market's own verdict on granular-tool servers ([GitHub](https://api.github.com/repos/browserbase/mcp-server-browserbase)).

The field converged on `chrome.debugger` because Chrome 136 stopped honouring `--remote-debugging-port` on the default profile ([Chrome blog](https://developer.chrome.com/blog/remote-debugging-port)). Browser MCP, Playwriter and mcp-chrome all landed on extension → localhost socket → driver. Ours matches that shape and removes the driver, which is the only structural difference left in transport.

## Twenty tools, five with no equivalent anywhere, and a bounded set of real gaps

Tool-for-tool, most of our surface is parity, and the parity rows hide the interesting part: several competitors are *narrower in practice* than their counts suggest. Claude in Chrome's `find` is a secondary LLM call over the same tree, so it costs latency and money and cannot see what the tree lacks; `read_page` misses open shadow roots, same-origin srcdoc and cross-origin iframes, and does not report checked, value or focused state ([live probe, 2026-11-05](./Claude%20in%20Chrome%20agent%20architecture.md)).

| Our tool | Closest competitor equivalent | Who leads |
|---|---|---|
| `tabs_context` | Claude `tabs_context_mcp`; Browser MCP `tab list`; Playwright `browser_tabs` | Parity; only Claude and ours treat the tab set as first-class context |
| `tabs_share` | No share tool anywhere; Claude uses drag-into-group | **Ours** — a consent primitive no competitor exposes |
| `tabs_create` / `tabs_close` | `createIfEmpty`; `tab new/close`; `browser_tabs` | Parity; Browser MCP refuses to close user tabs |
| `navigate` | `goto`, `browser_navigate`, `navigate_page` | Parity; ours verifies load, Claude returns only a URL |
| `resize_window` | Playwright `browser_resize`; CDT `resize_page` + `emulate` | Competitors lead on emulation (device, media, network) |
| `read_page` | `browser_snapshot`, `take_snapshot`, `chrome_read_page` | Parity on tree+refs; **we must add checked/value/focused/disabled** |
| `find` | Playwright `browser_find` (deterministic); Claude `find` (LLM) | Ours and Playwright lead on cost |
| `get_page_text` | `browser_evaluate` or `extract` | Ours is a named, cheaper path |
| `computer` | Playwright splits into ~10 tools; CDT into 9 | **Competitors are broader** — drag, drop, hover, select, modifiers, mouse down/up/wheel |
| `form_input` | `browser_fill_form`, CDT `fill_form` | Parity |
| `file_upload` | `browser_file_upload`, `upload_file` | Parity; their any-path upload is a documented exfiltration risk |
| `upload_image` | None | **Ours** |
| `console` | `browser_console_messages`, `list_console_messages` | Parity |
| `network` | `browser_network_requests`; Playwright adds 4 route/mock tools | Competitors lead on mocking; parity on reading |
| `javascript` | `browser_evaluate`, `evaluate_script`, Playwriter `execute` | Competitors lead on depth (full Playwright, raw CDP) |
| `gif` | No GIF tool; Playwright video (13 devtools tools), CDT mp4 screencast | **Ours** |
| `ask_user` | None; implemented as a UI mode (Claude prompts, Nanobrowser Ask) | **Ours** |
| `done` | None at MCP level; Browser Use `is_done` is library-level | **Ours** |
| `batch` | Claude `browser_batch`; Browser MCP multi-command; Playwriter `execute` | Parity with Claude; unique among all non-Anthropic servers |

Five tools — `tabs_share`, `upload_image`, `ask_user`, `done`, `gif` — have no equivalent anywhere in the survey. `batch` has exactly one. That is a defensible, if narrow, moat: it is a *contract* moat, not a capability one, and it is copyable in a quarter by anyone who reads the docs.

The gaps that matter are the ones the architecture cannot reach in one call. The important distinction is technical, not cosmetic: `chrome.debugger` whitelists Page, DOM, Runtime, Network, Fetch, Input, Emulation, Tracing, CSS, Debugger, Audits and Storage, but **not Memory, HeapProfiler, Profiler, ServiceWorker or Browser** ([debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)).

| Competitor capability | Who has it | Reachable from our architecture? | Priority |
|---|---|---|---|
| Raw CDP escape hatch | Browser MCP `--caps cdp`; Playwriter `/cdp` | Yes — we already speak CDP | **P1** |
| Execute/script escape hatch with helpers | Playwriter `execute`; Playwright `browser_run_code_unsafe` | Yes | **P1** |
| Network mocking and routing | Playwright 4 `--caps=network` tools | Yes, via `Fetch` | P2 |
| Tracing and performance attribution | CDT `performance_start_trace` + Insights + CrUX | Trace capture yes (`Tracing`); Insights engine must be built | P2 |
| CSS cascade truth | CDT `get_css_styles` (`CSS.getMatchedStylesForNode`) | Yes | P3 |
| Lighthouse-style audits | CDT `lighthouse_audit` | Partial (`Audits` domain; the npm engine does not run in an extension) | P3 |
| Heap and CPU profiling | CDT 14 memory tools | **No** — structurally impossible | Refuse |
| Storage and cookie management | Playwright 17 storage tools | Yes (`Storage`, `Network`) | P3 |
| Multi-browser fan-out | Browser MCP 8 profiles (2.4.0); Claude `list/select/switch_browser` | Yes — we already pair devices | **P1** |
| Visual grounding with labelled screenshots | Playwriter `screenshotWithAccessibilityLabels`; CDT `click_at`; Playwright `vision` (6 tools) | Yes (`Overlay` + screenshot) | P2 |
| Scheduled crawls | Firecrawl monitors; Apify cron schedules; Claude scheduled shortcuts | Partial (`chrome.alarms`; the host must be awake) | Refuse |
| Extraction at scale | Firecrawl, Bright Data (batches of 5), Steel `scrape` (20 pages/min) | No — one session, no fan-out | Refuse |
| Auth vaults and MFA | Anchor identities; Steel Credentials; Notte `manage_auth` | No, and should not | Refuse |
| Human takeover of a live view | Anchor, Steel, Browserless live URL | Partial — the user is already in the browser; `ask_user` plus pause is the analogue | P3 |
| Deterministic replay | Steel locator export; Anchor action index | Yes — export a stable selector per ref | **P1** |
| Per-site permissions | Ours leads; Claude per-site allow; Nanobrowser Allow/Ask/Block | Already ours | Keep |

The "refuse" rows are not modesty. Heap analysis would require a CDP domain Chrome does not expose to extensions; a scheduled-crawl product would need the user's laptop awake and would compete with Firecrawl on its home turf. Both would dilute the one claim we can defend.

## Measured numbers put every MCP stack in the same 48–60% band

There is one well-controlled head-to-head, and it is vendor-adjacent: WebdriverIO ran **100 seeded Online-Mind2Web tasks** with the same model, prompt and Claude Agent SDK harness, pinned every tool version, published 95% CIs, and counted blocked or CAPTCHA runs as failures ([benchmark](https://github.com/webdriverio/benchmark)).

| Setup | Tokens/task | $/attempt | Success | s/task | Calls/task |
|---|---|---|---|---|---|
| wdio-session | **168k** | **$0.010** | **58%** | 150 | 26.5 |
| playwright-cli | 641k | $0.029 | 57% | 149 | 33 |
| stagehand | 354k | $0.022 | 56% | 91 | 22 |
| wdio-mcp | 340k | $0.016 | 54% | 114 | 32 |
| agent-browser | 735k | $0.036 | 50% | 157 | 36.5 |
| playwright-mcp tuned | 574k | $0.029 | 50% | 106 | 27.5 |
| playwright-mcp default | 652k | $0.028 | 48% | 123 | 28 |

Read the same table as cost per *completed* task and the spread widens to **$0.017–$0.072** on DeepSeek V4.1 Flash and **$0.206–$0.740** on Claude Sonnet 5, because low-success systems pay for retries they never report ([derived from WebdriverIO](https://github.com/webdriverio/benchmark)). Model choice flips ranks: Playwright MCP fell from 48% to **32%** between the two arms while Stagehand rose from 56% to 60%, so no single ranking generalises.

Four other measurements matter more than any vendor headline. **Harness dominates driver**: the same agent-browser CLI cost **2.7k tokens/step in a minimal API loop versus 35k inside Claude Code**, a 13× tax, while pass rates on easy fixtures were 95–100% for every driver ([nsosio](https://github.com/nsosio/web-agent-bench)). **Cloud browsers are 2–3× slower per action**: local Playwright averaged **9.57 s** against Browserbase's **25.00 s** (+161%), with per-step penalties from +78% to **+733% on MFA**, while sustaining 84% success at 25 concurrent sessions where a single-IP VM collapsed to **0% at 10 workers** ([Browserbase report, 2026-04-06](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md)). **Batching is measurable**: Claude Opus 4.8 scored **54.8% with batched tools versus 49.33% unbatched** on OSWorld 2.0, a 5.5-point gain that is the difference between finishing a 12-page form and hitting the step cap ([Steel results](https://leaderboard.steel.dev/results)). **Cold start is cheap for everyone**: Playwright MCP 197 ms, Chrome DevTools MCP 358 ms ([7-MCP benchmark, 2026-05-27](https://github.com/pleasedodisturb/web-agent-comparison)).

What is missing is as important as what is measured. **No independent benchmark isolates extension-based control.** The only published datapoint is an out-of-scope probe showing Browser MCP working end-to-end on a real Chrome and preserving the operator's TLS fingerprint (`ja4_hash: 3fc5444b6956`) before hitting a `server.close` stack overflow ([same benchmark](https://github.com/pleasedodisturb/web-agent-comparison)). Claude in Chrome has **no published success rate on any benchmark**; its only measured appearance is in security research. And **no vendor publishes p50/p95 per-action latency** — every speed claim in this market is architectural inference.

The vendor numbers should be read as marketing until reproduced. Stagehand's own 8-task study reports **97k tokens, 75%, 31 s** for Playwright MCP default versus **32k, 100%, 18 s** for itself, and **17,857 characters** of schemas for 25 tools ([Stagehand](https://www.stagehand.dev/blog/playwright-mcp-token-usage)). Playwriter claims "90% fewer tokens than Playwright", "5–20 KB snapshots versus 100 KB screenshots" and video "100× more efficient" with no methodology ([HN](https://news.ycombinator.com/item?id=46590260)). Browser Use's **97.0%** Online-Mind2Web result uses a custom agentic judge and is "not directly comparable" to the screenshot-based judge used for OpenAI's rows ([Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/)). The 2026 WebBench crop — Taskmosis 83.5%, AgentSmith 82.4%, rtrvr 81.4% — sits 15–19 points above the best independently annotated 2025 run with no published task subsets, and Taskmosis reports an implausible identical 57.65% for two different competitors ([Taskmosis](https://taskmosis.com/blog/web-bench-results), [Halluminate](https://www.halluminate.ai/blog/benchmark)). The single most credible audited result remains **ABP + Claude Opus 4.6 at 90.53%** with all 300 trajectories public ([Steel](https://leaderboard.steel.dev/leaderboards/online-mind2web/)).

One structural effect deserves emphasis because it is our main advantage: **pre-authenticated sessions beat every tool-layer optimisation**. In nsosio's auth fixture, "login works, but a 2FA wall blocks the vault — every driver fails", and WebBench's write-heavy tasks top out at **46.6%** against >75% for read tasks, attributed partly to login and auth friction ([nsosio](https://github.com/nsosio/web-agent-bench), [Halluminate](https://www.halluminate.ai/blog/benchmark)). A design that starts already inside the user's session removes the failure mode that no amount of schema tuning fixes.

## What "extraordinary" would have to look like to be claimable

The evidence supports concrete targets. Everything below is measurable with a harness of our own and is stated against the best *measured* number, not the best claimed one.

| Metric | Best measured today | Ordinary | Target we should hold ourselves to |
|---|---|---|---|
| Success, live-web tasks | 58% (100 tasks, DeepSeek); 60% (50 tasks, Sonnet) | 32–54% | **≥60%** on 100 Online-Mind2Web tasks with WebJudge and CIs |
| Success, write-heavy subset | 46.6% (2025 best) | 20–35% | **≥50%**, reported separately from reads |
| Tokens/task | 168k | 340k–735k | **≤150k** on the same 100-task suite |
| Tokens/step | 2.7k (thin API loop) | 6.5k–14k | **≤3k median**, ≤5k p95 |
| Tool calls/task | 16 | 22–36.5 | **≤20** |
| Cost per completed task | $0.017 (DeepSeek), $0.206 (Sonnet) | $0.058–$0.072, $0.553–$0.740 | **≤$0.02 / ≤$0.25** |
| Wall clock/task | 74–91 s (real sites) | 106–157 s | **≤90 s median** |
| Per-action latency | Unpublished anywhere | Unknown | **p50 ≤150 ms, p95 ≤500 ms** for non-navigation calls |
| Infrastructure failures | Counted as failures, never published | Embedded in success | **0** on our suite; blocked = failure |
| Unapproved consequential actions | 0% at GA for Claude, behind server-side probes | 23.6% undefended, 11.2% mitigated (pilot) | **0** on a scripted injection suite, with the attack set adaptively revised |

Two cautions. The token and call targets are aggressive because **prompt caching makes token counts and billed cost diverge**: "most of the heavy drivers' volume is cache reads, which are nearly free on a subscription" ([nsosio](https://github.com/nsosio/web-agent-bench)). And the injection target is harder than a static suite suggests: attacks that succeed a few percent of the time on replay reach **up to 95.41%** once adapted to the agent's feedback ([BrowseSafe++, arXiv:2610.17457](https://arxiv.org/abs/2610.17457)), and a UW study found **4 of 7 agentic browsers** allow same-origin-policy bypass ([UW News](https://www.washington.edu/news/2026/06/30/some-agentic-ai-browsers-come-with-major-cybersecurity-risks-uw-study-finds/)). Any published claim of "extraordinary" needs six things simultaneously: ≥100 tasks, a named judge with an agreement rate, cost per *completed* task, a read/write split, infrastructure failures counted as failures, and 95% CIs. **No vendor claiming 81–99% in 2026 published all six.**

## Six changes worth making, and five things to refuse

Ranked by evidence of need, not novelty. The highest-value items are the ones where a documented competitor capability exists, the architecture supports it, and its absence costs turns rather than tokens.

| Rank | Change | Evidence of need | Effort |
|---|---|---|---|
| 1 | **Ship a `run_script` escape hatch** with the Playwright-ish helpers we already have, gated as a sensitive action | Playwriter's entire product is one `execute`; Playwright's `browser_run_code_unsafe`; Microsoft now recommends CLI+skills over MCP for coding agents because reading large schemas and verbose a11y trees into context is not token-efficient ([README](https://github.com/microsoft/playwright-mcp#readme)) | Low |
| 2 | **Add a raw `cdp` tool behind a capability flag**, returning compact results and refusing `Memory`/`Profiler` explicitly | Browser MCP ships `cdp` under `--caps`; Playwriter exposes `/cdp`; it is the only way to cover long-tail cases without adding 40 tools ([Browser MCP](https://docs.browsermcp.io/browser-tool)) | Low |
| 3 | **Multi-browser fan-out**: `tabs_context` should enumerate paired devices with `deviceId`, plus `select_browser` | Browser MCP 2.4.0 supports 8 profiles; Claude has `list_connected_browsers`, `select_browser`, `switch_browser` ([changelog](https://docs.browsermcp.io/changelog), [Claude Code](https://code.claude.com/docs/en/chrome)) | Medium |
| 4 | **Ref-to-selector export** so a discovered element becomes deterministic replay with no model in the loop | Called "the most economically meaningful capability found" in the cloud survey; Steel `get(what:"locator")`, Anchor action index ([Steel](https://docs.steel.dev/overview/mcp), [Anchor](https://docs.anchorbrowser.io/advanced/mcp)) | Medium |
| 5 | **Fix observation fidelity**: checked, value, focused, disabled, expanded, required; pierce open shadow roots and same-origin frames; recursive OOPIF attach | Claude's `read_page` demonstrably misses all of these and every non-HTML frame; a11y-only readers have known blind spots ([probe](./Claude%20in%20Chrome%20agent%20architecture.md), [Stagehand](https://www.stagehand.dev/blog/playwright-mcp-token-usage)) | Medium |
| 6 | **Instrument and publish**: tokens/step, calls/task, p50/p95 per tool, cost per completed task, 100-task success with CIs, plus a scripted injection suite | Nobody publishes per-action latency or approval-gating cost; this is the cheapest credibility available ([WebdriverIO](https://github.com/webdriverio/benchmark)) | Medium |

Three refinements follow. Keep returning **post-action deltas** rather than full snapshots — Stagehand attributes Playwright MCP's 97k tokens/task to a fresh a11y tree after every action, at 12.9–14.1k input tokens per call versus 6.9k ([Stagehand](https://www.stagehand.dev/blog/playwright-mcp-token-usage)). Make `batch` return a resumable index on failure instead of dropping images, which is exactly what Claude's `browser_batch` does badly today. And keep `find` deterministic, with semantics only as opt-in.

What not to copy is as important as what to copy.

**Do not build a 61-tool devtools surface.** Chrome DevTools MCP earns its 61 tools on debugging jobs we are not competing for, and its own issue tracker shows the cost: hangs with many tabs, no multi-session, approval prompts that cannot persist ([#1921](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/1921), [#3070](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/3070), [#825](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/825)). Google itself ships a **3-tool slim mode** ([slim reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/slim-tool-reference.md)). **Do not return a snapshot after every action** by default; the measured gap between a snapshot-per-action MCP and a delta-returning facade is roughly **3× tokens per task** (97k versus 32k) for a success gain that goes the wrong way ([Stagehand](https://www.stagehand.dev/blog/playwright-mcp-token-usage)). **Do not make screenshots or vision the default observation** — coordinate clicking is opt-in for a reason, and image tokens scale with dimensions. **Do not add a local daemon or native host**, even as an optional path: most reliability bugs in this survey live at that hop — daemon pairing, native-host conflicts, pipe collisions, 15-second tab-readiness hangs ([Browser MCP changelog](https://docs.browsermcp.io/changelog), [Claude Code](https://code.claude.com/docs/en/chrome)). **Do not build auth vaults, agentic checkout or scheduled crawls**: they are separate products with separate liability, and they solve problems our architecture already solves by existing inside the session.

## What could not be verified

| Item | Status |
|---|---|
| Claude in Chrome's full tool list and schemas | Not public. The ~22 count comes from a live probe on 2026-11-05; official docs name only `tabs_context_mcp` and `browser_batch` ([Claude Code](https://code.claude.com/docs/en/chrome)) |
| Whether `claude-in-chrome` can be attached by non-Claude MCP clients | Unverified; documentation frames it as a Claude Code integration |
| Airtop browser-control MCP | Only a docs-retrieval MCP is documented; a 5-tool community server exists ([Airtop](https://docs.airtop.ai/llms.txt)) |
| Browser Use extension mode | Not documented; only launched Chrome and cloud |
| Browser MCP's exact tool list | README does not enumerate; "12+" is Playwriter's characterisation, not Browser MCP's |
| Browserless agent and account tool counts; Anchor `/all` count; Oxylabs exact count; Steel's count in one pass | Enumerations are partial or conflicting across docs pages |
| Pricing for Browserbase, Steel, Browserless | Pricing pages are JS-rendered; only Steel's rates were captured |
| Any independent latency benchmark for an extension relay | Does not exist. No p50/p95 for Browser MCP, Playwriter, Playwright `--extension`, Claude in Chrome or ours |
| Any study isolating extension-attached real profiles from cloud or fresh profiles | Does not exist; all leaderboard rows confound model, harness and infrastructure |
| Anthropic's 17.8% / 78.6% injection figures from its system card | Secondary source only; primary card not retrieved |
| Security audits or CVE records for Browser MCP, Playwriter, Nanobrowser, Playwright MCP | None found; security claims are vendor self-descriptions |

## Conclusion

The competitive question is not whether someone has more tools — several do, and the evidence says a 7-tool shortlist retrieves almost everything 50 tools do. It is whether anyone else can put an agent inside the session where the work actually happens without asking the user to install a daemon or surrender their cookies to a VM. Nobody can. That leaves one honest gap: we have a better architecture and no measurements, while the field has worse architectures and a leaderboard full of numbers that do not survive scrutiny. The next unit of work with the highest expected return is therefore not a 21st tool. It is a published 100-task run with CIs, a cost-per-completed-task figure, per-action latency, and an adaptive injection suite — the four numbers nobody in this market has all of, and the only ones that would let "extraordinary" mean something.
