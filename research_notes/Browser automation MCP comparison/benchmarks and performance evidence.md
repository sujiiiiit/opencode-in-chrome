# Browser automation MCP comparison — benchmarks and performance evidence (as of November 2026)

Scope note: every figure below is tagged with provenance in square brackets. `[independent]` = benchmark authors, academic labs, or third-party harnesses with published code/tasks; `[vendor-run]` = the system's own vendor reporting its own score; `[vendor-adjacent]` = a company benchmarking competitors but also selling a competing product; `[secondary]` = a blog/report citing a primary source I did not retrieve. Sample sizes and judge types are given wherever the source states them. "As of Nov 2026" — the freshest compiled leaderboard snapshot I could retrieve is Steel's, last updated 2026-10-11.

---

## Q1. Which benchmarks measure end-to-end browser agents vs. the tool layer, and what are the current top scores?

### Takeaway
All the named public benchmarks (WebVoyager, WebArena, WebBench, BrowseComp, OSWorld, GAIA, Online-Mind2Web) measure **end-to-end task success of a full system** — model + prompt + observation mode + browser layer + retry policy — so none of them isolate MCP/tool-layer quality. The only measurements that isolate the tool layer are small harness-controlled studies (WebdriverIO's 100-task run, Stagehand's 8-task study, nsosio's ~300-task suite), and they disagree with the benchmark leaderboards in an important way: at the tool layer, almost all modern stacks succeed 48–60% on live-web tasks, and differences are driven more by harness/context design than by the browser driver.

### Cited Findings
**End-to-end benchmarks — definitions and what they actually score**

- WebVoyager: 643 tasks across 15 live websites; primary metric is task success rate; original paper used GPT-4V as automatic judge with **85.3% agreement with human judgment**; the original system scored **59.1%**. Steel's methodology page explicitly warns the benchmark is "unusually sensitive to task drift, removed tasks, evaluator choice, and whether the run used the full task suite," and that "small score gaps can reflect setup choices as much as capability" — [Steel WebVoyager leaderboard](https://leaderboard.steel.dev/leaderboards/webvoyager/) `[independent compilation; underlying rows are vendor/academic self-reports]`
- WebArena: 812 tasks on self-hosted, reproducible sites (shopping, forum, GitLab, CMS, maps, wiki); original GPT-4 baseline **14.41% vs 78.24% human**; evaluation is functional correctness via task validators; scores "can change with prompt scaffolding, observation mode, browser action space, and retry or step budget" — [Steel WebArena leaderboard](https://leaderboard.steel.dev/leaderboards/webarena/) `[independent compilation]`; project hub — [webarena.dev](https://webarena.dev/)
- WebBench (Halluminate + Skyvern, May 2025): 2,454 open-sourced tasks across 452 live sites drawn from the global top-1,000 by traffic, sampled from ~5,750 generated tasks; task mix is **64.4% READ, 20.9% CREATE, 7.1% UPDATE, 6.1% DELETE, 1.5% FILE_MANIPULATION**; judged by human annotators reviewing screen recordings, with a "Bad Task" label to drop sites that drifted — [Halluminate technical report](https://www.halluminate.ai/blog/benchmark) `[independent benchmark authors, partnered with vendor Skyvern]`
- Online-Mind2Web (COLM 2025): 300 tasks on 136 live websites; introduces **WebJudge**, an LLM-as-judge with **~85–86% agreement with human reviewers**; Steel notes judge methodology varies per submission (human eval vs WebJudge vs bespoke agentic judge) and "can produce different scores for the same agent" — [Steel Online-Mind2Web leaderboard](https://leaderboard.steel.dev/leaderboards/online-mind2web/) `[independent compilation]`
- BrowseComp (OpenAI): 1,266 "hard-to-find, entangled information" questions — [OpenAI announcement](https://openai.com/index/browsecomp/) `[vendor-published benchmark]`
- OSWorld / OSWorld 2.0: OS-level computer-use suites; Steel tracks 23 and 24 systems respectively and separates them because 2.0 is a different task set — [Steel results index](https://leaderboard.steel.dev/results) `[independent compilation]`

**Current top scores (compiled, last updated 2026-10-11)**

- **WebVoyager** (22 systems): #1 browser-control (Fable 5), Om Labs, **99.19%** (reported 2026-06, source is a GitHub repo, i.e. self-reported); #2 Alumnium **98.5%** (2026-03, vendor blog); #3 Surfer 2 (H Company) **97.1%** (2025-10); #4 Magnitude **93.9%** (2025-07); #5 Surfer-H + Holo1 **92.2%** (arXiv 2506.02865, 2025-06); #8 Browser Use **89.1%** (2024-12); #10 OpenAI Operator **87%** (2025-01); #13 Skyvern 2.0 **85.85%**; #19 the original WebVoyager system **59.1%** — [Steel WebVoyager leaderboard](https://leaderboard.steel.dev/leaderboards/webvoyager/) `[mixed: self-reports, vendor blogs, papers]`
- **WebArena** (52 systems): #1 WebTactix (DeepSeek v3.2) **74.3%** (2026-02, hosted on an anonymous paper-submission page — weak provenance); #2 OpAgent (CodeFuse AI) **71.6%** (2026-01); #3 ColorBrowserAgent **71.2%** (arXiv 2601.07262, 2025-12); **#4 Claude Code + GBOX MCP 68.0%** (2025-10-25, only MCP-based system in the top 5); #5 DeepSky Agent **66.9%**; #9 OpenAI Operator **58.1%** — [Steel WebArena leaderboard](https://leaderboard.steel.dev/leaderboards/webarena/) `[mixed]`
- **WebBench** (official leaderboard, still dated 2025-05-30 for every row): #1 Anthropic Sonnet 3.7 CUA **66.0%**, #2 Skyvern 2.0 **64.4%**, #3 Skyvern 2.0 on Browserbase **60.7%**, #4 OpenAI CUA **59.8%**, #5 Browser Use Cloud **43.9%** (Browser Use run on a **658-task subset**) — [webbench.ai](https://webbench.ai/) `[independent leaderboard, vendor-submitted runs]`. Note that OpenAI Operator and Convergence AI were only testable **human-in-the-loop on a random 323-task subset** because neither offered API access — [Halluminate](https://www.halluminate.ai/blog/benchmark)
- **Online-Mind2Web** (26 rows): #1 Browser Use Cloud (bu-max) **97.0%** — "self-reported using a custom agentic judge built on Claude Agent SDK; OpenAI's score uses a different screenshot-based judge — not directly comparable"; #2 GPT-5.4 Native Computer Use **93.0%** (OpenAI-reported, raw data not public); #3 ABP + Claude Opus 4.6 **90.53%** (all 300 task results published); #4 TinyFish **90.0%**; #5 CUAWright + GPT-5.5 **89.4%** (paper, terminal/filesystem harness rather than GUI-only); #6 UI-TARS-2 **88.2%**; Yutori Navigator **78.7%** (human eval; 64.7% under WebJudge); **ChatGPT Atlas Agent Mode 71.0%** (OpenAI-reported, run data not public); OpenAI Operator **61.3%** — [Steel Online-Mind2Web leaderboard](https://leaderboard.steel.dev/leaderboards/online-mind2web/) `[mixed]`
- **OSWorld** (23 rows, v1): #1 Qwen3.8-Max **86.1%** (2026-08); #2 Claude Mythos Preview **85.4%**; #3–4 Claude Mythos 5 / Claude Fable 5 **85.0%**; #5 Claude Opus 4.8 **83.4%**; #6 MiMo-V2.6-Pro **82.0%**; #11 GPT-5.4 **75.0%**; #17 UiPath Screen Agent w/ GPT-5 **53.6%** — [Steel results](https://leaderboard.steel.dev/results) `[mixed, mostly vendor model cards]`
- **OSWorld 2.0** (24 rows): #1 Claude Fable 5.1 **77.9%**; #2 Simular Sai **73.0%**; #3 GPT-6 Astra **72.6%**; #4 Claude Opus 5 **70.6%**; #5 GPT-6.1 Sol **70.5%**; #6 Gemini 4 Argon **69.2%**; #8 Muse Spark 1.3 (Meta) **66.9%** — [Steel results](https://leaderboard.steel.dev/results) `[mixed]`
- **BrowseComp** (~104 rows): #1 GPT-5.6 Sol Ultra **92.2%** (OpenAI, 2026-07-09); #2 GPT-6 Astra **91.5%** (OpenAI, 2026-09-03); #3 Kimi K3 **91.2%** (Moonshot, 2026-07-16); #4 Claude Opus 5 **90.8%**; #5 GPT-5.6 Sol **90.4%**; GPT-5.5 Pro **90.1%**; DeepSeek-V4-Pro-Max **83.4%**; search-API-style systems much lower (Exa Agent High **74.0%**, Parallel Ultra8x **58.0%**, Tavily + GPT-5.4 harness **42.0%**, Perplexity Agent Fast **10.0%**) — [Steel results](https://leaderboard.steel.dev/results) `[mixed, primarily vendor model cards]`
- **GAIA**: OPS-Agentic-Search (Alibaba Cloud) **92.36%** and openJiuwen-deepagent **92.36%** tied at #1 (2026-03-11); Lemon Agent **91.36%**; ShawnAgent **89.37%** — [Steel results](https://leaderboard.steel.dev/results) `[mixed; HF leaderboard submissions]`

**Evidence that these are end-to-end, not tool-layer, measurements**

- Steel's own framing: "Read each row as a full-system result: model, prompt, browser execution layer, retry policy, DOM or accessibility extraction, and visual grounding can all contribute to the final score" — [Steel WebVoyager](https://leaderboard.steel.dev/leaderboards/webvoyager/)
- The same base model produces wildly different WebVoyager numbers depending on the harness: GLM-5V-Turbo as a bare model eval **88.5%** vs Surfer-H + Holo1 **92.2%** vs Alumnium's harness **98.5%** — all in the same leaderboard, different scaffolds — [Steel WebVoyager](https://leaderboard.steel.dev/leaderboards/webvoyager/)
- WebBench's own error analysis separates "Browser Agent Problems" from "Infrastructure Problems" (proxy, CAPTCHA, login/auth) and states the two "are not necessarily correlated" — i.e., the benchmark cannot attribute failure to the tool layer — [Halluminate](https://www.halluminate.ai/blog/benchmark)

### Inferences
- A WebVoyager score above ~90% no longer discriminates between systems; the top 8 rows span 90.4–99.2% and are all self-reported with different task subsets/judges.
- WebArena is the most conservative "reproducible" signal and the most useful for comparing harnesses: the best systems are at ~71–74%, and the only MCP-harness entry (Claude Code + GBOX MCP) sits at 68.0% — within ~6 points of the best, which is roughly the noise band implied by scaffold variation.
- OSWorld 2.0, released later and harder, saturates around 70–78% at the frontier while OSWorld v1 is already at 85–86% — a sign v1 is effectively saturated and should no longer be cited as evidence of capability.

### Gaps
- I found **no verified numbers** for Mind2Web 2 or AssistantBench in this pass; both were requested but only Online-Mind2Web (the live successor to Mind2Web) had a compiled leaderboard with methodology notes.
- WebArena-Lite numbers were not retrieved; no separate leaderboard for it surfaced.
- BrowserGym/AgentLab appears only indirectly (a ServiceNow BrowserGym leaderboard discussion is cited as the source for A3-Qwen3.5-9B at 42.1% on WebArena), so I cannot report on AgentLab's own tooling/efficiency metrics.
- No public benchmark isolates "MCP server quality" as a variable; every end-to-end number confounds model, prompt, observation mode and browser layer.

---

## Q2. Tool-layer metrics: tokens/step, calls/task, latency, success, recovery, cost — and snapshot/refs vs. screenshot/vision vs. raw CDP

### Takeaway
The best-controlled tool-layer evidence says browser-driver choice moves success by roughly **±8 percentage points**, while **harness/context design moves tokens per task by 2–13×** and can move success by **20+ points** (nsosio: same CLI, 2.7k vs 35k tokens per step depending on harness). Text/ref snapshots are decisively cheaper per step than screenshots, but no study shows them to be more *reliable* on hard tasks; the one head-to-head on hard real tasks had Stagehand (hybrid NL primitives) ahead of Playwright MCP on success, and a hybrid DOM+vision driver (browser-use) mid-pack.

### Cited Findings
**Independent, pre-registered-style harness comparison (strongest single source)**

- WebdriverIO benchmark: **100 tasks sampled with a fixed seed from Online-Mind2Web** (300 tasks / 136 live sites), split easy/medium/hard in dataset proportions; same model, same Claude Agent SDK harness, same system prompt; WebJudge with `o4-mini` at a pinned commit (authors' recommended judge, ~86% agreement with humans); 95% CIs published; blocked/CAPTCHA runs count as failures for every tool; 1 run per task. All tool versions pinned (e.g. `@playwright/mcp@0.0.83`, `stagehand@4.1.0`, `@wdio/mcp@4.0.0`, `agent-browser@0.38.2`, `@playwright/cli@0.1.22`) — [webdriverio/benchmark README](https://github.com/webdriverio/benchmark) `[vendor-adjacent: WebdriverIO benchmarks its own MCP/CLI alongside rivals, publishes all code/results]`
- Results, **DeepSeek V4.1 Flash, 100 tasks, 2026-10-09**: playwright-mcp **652k tokens/task, $0.028, 48% (48/100), 123 s, 28 tool calls**; playwright-mcp-tuned (`--snapshot-mode none --codegen none`) **574k, $0.029, 50%, 106 s, 27.5 calls**; stagehand **354k, $0.022, 56%, 91 s, 22 calls**; wdio-mcp **340k, $0.016, 54%, 114 s, 32 calls**; wdio-session **168k, $0.010, 58%, 150 s, 26.5 calls**; agent-browser **735k, $0.036, 50%, 157 s, 36.5 calls**; playwright-cli **641k, $0.029, 57%, 149 s, 33 calls** — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)
- Results, **Claude Sonnet 5, 50 tasks, 2026-10-05**: playwright-mcp **363k, $0.177, 32% (16/50), 74 s, 16 calls**; tuned **284k, $0.165, 36%**; stagehand **549k, $0.216, 60% (30/50), 105 s, 26 calls**; wdio-mcp **241k, $0.107, 52%**; wdio-session **306k, $0.128, 54%**; agent-browser **1116k, $0.355, 48%**; playwright-cli **680k, $0.259, 40%** — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)
- Stated limitations: live sites drift; WebJudge disagrees with humans on ~1 run in 7; the judge only sees the page after each tool call, so tools that batch several actions per call (`perform_actions`, Stagehand `run`) leave fewer intermediate screenshots and can **hide evidence** of an intermediate step — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)

**Vendor study of the same three setups (numbers differ from the independent replication)**

- Stagehand/Browserbase, 2026-09-29: 8 tasks (4 public sites: saucedemo login+cart total, books.toscrape cross-page price scan, 4-hop Wikipedia navigation, one fact in a 670 KB Node.js docs page; 4 local fixtures: cross-origin iframe form, closed-shadow-DOM button, unlabeled icon button, 12-page form flow); 3 runs per task, Claude Sonnet 5 with thinking disabled, Claude Agent SDK 0.3.282 — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage) `[vendor-run]`
- Playwright MCP 0.0.82 default: **97k tokens/task, $0.051, 75% (18/24), 31 s**; Playwright MCP tuned: **105k, $0.051, 88% (21/24), 30 s**; Stagehand v4 facade: **32k, $0.026, 100% (24/24), 18 s**. Total over 72 runs at list price: $2.16 / $2.12 / $1.67 — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage)
- Per model call: Stagehand **6.9k** median input tokens vs **12.9k–14.1k** for the two Playwright MCP configs — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage)
- On the 12-page form flow, both Playwright MCP setups **hit the 40-step limit in all 3 runs without finishing**; Stagehand finished in 27 steps by batching several actions per call; Stagehand's context grew ~1.8k tokens/step vs ~0.55k for MCP — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage)
- Playwright MCP exposes **25 tools = 17,857 characters of tool definitions** before any user instruction — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage)
- Mechanism claims: default `full` snapshot mode returns a new accessibility snapshot after *every* action; old snapshots stay in history, so a 15-step task carries 15 snapshots; this is why users report context loss "after 2–3 navigations" — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage) (linking a Reddit report)

**Harness overhead dwarfs driver choice**

- nsosio/web-agent-bench: ~300 tasks, 5 reps, `claude-sonnet-4-6`, local deterministic fixtures with runtime-generated gated answers; pass rates were a near tie at **95–100% for every driver** (i.e., on easy controlled fixtures all tool layers work), but **the same agent-browser CLI cost 2.7k tokens per step on a minimal API loop vs 35k inside the Claude Code harness** — a ~13× harness tax — [nsosio/web-agent-bench](https://github.com/nsosio/web-agent-bench) `[independent, single author, small local site; low external validity, high internal validity]`
- Their cost note: "Most of the heavy drivers' volume is cache reads, which are nearly free on a subscription, so the billed gap is much smaller than the token gap" — [nsosio](https://github.com/nsosio/web-agent-bench)

**Snapshot/refs vs. screenshots vs. raw CDP**

- Text refs are structurally cheaper: WebBench found "text is cheaper than images and refs more reliable than complex selectors or pixel coordinates" is the theory, but accessibility trees are "handwritten by humans and sometimes completely missing or only partial," and closed shadow DOM + cross-origin iframes remain blind spots for pure a11y-tree agents — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage); Stagehand claims its hybrid snapshot covers nested/cross-origin iframes and closed shadow roots — same source `[vendor claim]`
- A raw-CDP, no-screenshot architecture is claimed to beat screenshot agents on both speed and cost: Taskmosis reports **0.8 min average task time vs 4.3 min (Browser Use), 6.8 min (Claude Computer Use), 20.7 min (OpenAI Operator)** on WebBench, attributing the gap to DOM/CDP element targeting instead of "screenshot → vision model → coordinate clicking," which it says costs "2–5 s per screenshot analysis" and has "10x" higher API cost — [Taskmosis WebBench post](https://taskmosis.com/blog/web-bench-results) `[vendor-run, self-graded; numbers conflict with the official WebBench leaderboard — see Q3]`
- Action batching (a tool-layer design choice) measurably changes success on OS-level tasks: on OSWorld 2.0, Claude Opus 4.8 scores **54.8% with batched tools vs 49.33% unbatched** (+5.5 pp) — [Steel OSWorld 2.0 rows, sourced to osworld-v2.xlang.ai](https://leaderboard.steel.dev/results) `[vendor-reported]`
- Chrome DevTools MCP: the only quantitative claim I found is a single-author Medium post titled "Browser DevTools MCP — 78% Fewer Tokens vs Playwright MCP, Faster and More Consistent" — [Medium](https://medium.com/@serkan_ozal/browser-devtools-mcp-78-fewer-tokens-vs-playwright-mcp-faster-and-more-consistent-32f314004d30) `[secondary, single author, no methodology visible in snippet — treat as unverified]`

### Inferences
- The honest summary of tool-layer efficiency: **tokens/task is dominated by (a) whether snapshots are returned automatically after each action, (b) how many actions are batched per model call, and (c) the client harness's system prompt** — not by which browser driver is underneath.
- Turning off automatic snapshots is not free: Playwright MCP tuned used *more* tokens (105k vs 97k) in Stagehand's study while scoring higher, because the agent compensated with explicit `browser_find`/`browser_snapshot` calls that cache better. Any "fewer tokens" claim that ignores prompt-cache behavior is misleading.
- `tool calls/task` is a decent proxy for batching: 16–16 calls (Playwright MCP, Sonnet, 50 tasks) vs 26 (Stagehand) vs 36.5 (agent-browser) in WebdriverIO, but the relationship to success is non-monotonic.
- Text-snapshot stacks look cheap on read tasks and collapse on long form flows: the 12-page form is the discriminator, and both Playwright MCP configs failed it 3/3 by exhausting 40 steps.

### Gaps
- No study measures **error recovery rate** (retry-after-failure success) or **flaky-action rate** as a first-class metric. WebdriverIO publishes failed runs and step logs but does not aggregate recovery; this is a real measurement gap in the literature.
- No head-to-head exists for **Chrome DevTools MCP** against Playwright MCP/Stagehand on a shared task set; it is absent from both WebdriverIO's seven setups and nsosio's five.
- Latency per individual action (click→settle ms) is not published anywhere I found; only wall-clock per task.
- Raw CDP vs a11y-tree vs vision has no controlled academic comparison with published tasks; Taskmosis's CDP claim is vendor-run and self-graded.

---

## Q3. Head-to-head results: Playwright MCP vs Chrome DevTools MCP vs browser-use vs Stagehand vs Claude in Chrome vs Operator/Atlas vs Gemini/Comet

### Takeaway
There is **no single task set on which all of these have been run**. MCP/SDK stacks (Playwright MCP, Stagehand, browser-use, wdio-mcp) have been compared head-to-head twice in 2026 with published harnesses; consumer agentic browsers (Claude in Chrome, Atlas, Comet, Gemini-in-Chrome) have **never** been compared to MCP stacks on a common task set — they appear only as vendor-reported rows on end-to-end leaderboards or in security studies.

### Cited Findings
**MCP/SDK stacks, live-web tasks (the only apples-to-apples comparison)**

- WebdriverIO, 2026-10-09, DeepSeek V4.1 Flash, 100 Online-Mind2Web tasks, 1 run/task: success **58% wdio-session > 57% playwright-cli > 56% stagehand > 54% wdio-mcp > 50% playwright-mcp-tuned = 50% agent-browser > 48% playwright-mcp**; cost **$0.010–$0.036/task**; time **91–157 s/task** — [webdriverio/benchmark](https://github.com/webdriverio/benchmark) `[vendor-adjacent, n=100, 95% CIs published]`
- WebdriverIO, 2026-10-05, Claude Sonnet 5, 50 tasks: **stagehand 60% > wdio-session 54% > wdio-mcp 52% > agent-browser 48% > playwright-cli 40% > playwright-mcp-tuned 36% > playwright-mcp 32%**; cost **$0.107–$0.355/task** — [webdriverio/benchmark](https://github.com/webdriverio/benchmark) `[n=50, 1 run/task]`
- Note the model interaction: Playwright MCP went from 48% (DeepSeek V4.1 Flash) to 32% (Sonnet 5) on the same task sample, and Stagehand from 56% to 60% — the ranking is **not** model-invariant, and 50-task cells carry wide CIs — same source
- Stagehand's own study, 8 tasks × 3 runs, Sonnet 5: Stagehand **100% (24/24)**, Playwright MCP tuned **88% (21/24)**, Playwright MCP default **75% (18/24)** — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage) `[vendor-run, n=24 per setup]`
- nsosio, ~300 tasks × 5 reps, sonnet-4-6, local fixtures: **95–100% for all five drivers** — i.e., no reliability separation on easy tasks; the separation is tokens/step (2.7k thin-loop agent-browser vs 35k in Claude Code vs Playwright MCP carrying full a11y snapshot + schemas every call) — [nsosio](https://github.com/nsosio/web-agent-bench) `[independent single author]`

**browser-use specifically**

- browser-use self-reports **89.1% on WebVoyager** (2024-12) — [browser-use SOTA report via Steel](https://browser-use.com/posts/sota-technical-report) `[vendor-run]`
- On WebBench's official autonomous leaderboard, Browser Use Cloud is **43.9%**, last of five, on a 658-task subset — [webbench.ai](https://webbench.ai/) `[vendor-submitted, independent leaderboard]`
- On Online-Mind2Web, Browser Use Cloud claims **97.0%** using its own agentic judge, while Browser Use with gpt-4o scored **30.0%** on the official leaderboard in Nov 2024 — a 67-point spread that is mostly judge + stack change, not model change — [Steel Online-Mind2Web](https://leaderboard.steel.dev/leaderboards/online-mind2web/)
- browser-use's driver (hybrid DOM + screenshot, own loop) is mid-pack in WebdriverIO-style comparisons — but note WebdriverIO did not test browser-use; only nsosio did, where it tied at 95–100% on easy fixtures

**Consumer agentic browsers (Claude in Chrome, Atlas, Comet, Gemini)**

- ChatGPT Atlas Agent Mode: **71.0% on Online-Mind2Web** per OpenAI's GPT-5.4 announcement; "underlying run data not public" — [Steel, citing OpenAI](https://leaderboard.steel.dev/leaderboards/online-mind2web/)
- Gemini 2.5 Computer Use: **69.0%** on Online-Mind2Web under Yutori's identical evaluation settings (57.3% under WebJudge auto-eval) — [Steel, citing Yutori](https://leaderboard.steel.dev/leaderboards/online-mind2web/)
- Claude in Chrome and Perplexity Comet: **no published task-success score on any of these benchmarks** was found. Their only measured appearance is in a security evaluation (Q5).
- Claude 4.5/4.0 as agents under Yutori's harness: **55.0% / 61.0%** human-eval on Online-Mind2Web; Navigator (Yutori's own) **78.7%** human-eval but **64.7%** under WebJudge — an ~14-point judge swing on the same system — [Steel Online-Mind2Web](https://leaderboard.steel.dev/leaderboards/online-mind2web/) `[vendor-run for Navigator]`

**WebBench 2026: vendor self-reports diverge sharply from the official board**

- Official WebBench leaderboard still lists the May 2025 runs only: Anthropic CUA 66.0%, Skyvern 64.4%, Skyvern-on-Browserbase 60.7%, OpenAI CUA 59.8%, Browser Use 43.9% — [webbench.ai](https://webbench.ai/)
- Taskmosis (Jan 2026) claims **83.5% overall (91.2% read / 68.8% write)**, with rtrvr.ai 81.39%, Browser Use 59.77%, and — implausibly — **identical 57.65% for Claude Computer Use and OpenAI Operator**, plus Operator at 20.7 min/task vs its own 0.8 min — [Taskmosis](https://taskmosis.com/blog/web-bench-results) `[vendor-run; the duplicated 57.65% and absence of published per-task results are red flags]`
- AgentSmith claims **82.4%** on WebBench (Feb 2026) — [AgentSmith](https://agentsmith.so/benchmark) `[vendor-run]`; rtrvr.ai claims **81.4%** and "7–23× faster" — [rtrvr.ai](https://rtrvr.ai/blog/web-bench-results) `[vendor-run]`
- All three 2026 vendor claims are 15–19 points above the best 2025 independently-annotated run, with no published task subsets — treat WebBench 2026 numbers as unverified until reproduced

### Inferences
- For "which stack is fastest and most reliable," the defensible ranking as of Nov 2026 is: **Stagehand and CLI/session-style harnesses beat Playwright MCP on real live-web tasks by ~8–28 pp depending on model, at 40–65% lower token cost; browser-use is competitive but judge-dependent; Playwright MCP's default configuration is the slowest and lowest-scoring of the MCP options tested, and its tuned configuration recovers only part of the gap.**
- The Stagehand result (100% vs 75–88%) and the WebdriverIO result (56–60% vs 32–50%) disagree on magnitude but agree on direction. The disagreement is explained by task difficulty (8 curated tasks vs 100 live-web tasks) — the curated set is exactly the kind of task an NL-primitive SDK is designed for.
- "Claude in Chrome / Comet / Atlas are better than MCP stacks" is **not supported by any public measurement**; the only cross-comparable numbers put Atlas at 71.0% on Online-Mind2Web, below several MCP/SDK stacks and below Browser Use's self-report.

### Gaps
- No common-task-set comparison including Chrome DevTools MCP, Claude in Chrome, Comet, or Gemini-in-Chrome.
- WebdriverIO runs 1 rep per task (Sonnet arm only 50 tasks), so per-cell CIs are wide; only the DeepSeek 100-task arm has enough n to separate adjacent ranks.
- No published per-task results for Taskmosis/AgentSmith/rtrvr WebBench claims, so their 81–83% figures cannot be audited.
- No head-to-head at all for Gemini/Comet on a browser-agent benchmark with published methodology.

---

## Q4. Cost data, and the effect of tool-description size / tool count on accuracy

### Takeaway
Measured cost is **$0.010–$0.036 per task** for cheap models and **$0.107–$0.355 per task** for Claude Sonnet 5 on 100 live-web tasks; **cost per *completed* task** is 1.5–2.3× higher than cost per attempt because of failures. On tool count, the best evidence (BFCL, 370 tools) shows that showing ~7 well-chosen tools beats showing 50 at near-identical coverage, and improves the model's downstream selection accuracy by ~6 pp overall and ~16 pp on medium-difficulty queries.

### Cited Findings
**Published cost per task**

- Stagehand study (8 tasks, Sonnet 5): **$0.051/task** Playwright MCP default, **$0.051** tuned, **$0.026** Stagehand; totals over 72 runs $2.16 / $2.12 / $1.67 — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage) `[vendor-run]`
- WebdriverIO (100 tasks, DeepSeek V4.1 Flash): **$0.010 (wdio-session) to $0.036 (agent-browser)** per attempt — [webdriverio/benchmark](https://github.com/webdriverio/benchmark) `[vendor-adjacent]`
- WebdriverIO (50 tasks, Sonnet 5): **$0.107 (wdio-mcp) to $0.355 (agent-browser)** per attempt — same source
- Derived cost per **completed** task (cost ÷ success rate, my arithmetic on WebdriverIO's published rows): DeepSeek arm — wdio-session **$0.017**, wdio-mcp **$0.030**, stagehand **$0.039**, playwright-mcp-tuned **$0.058**, playwright-mcp **$0.058**, agent-browser **$0.072**; Sonnet arm — wdio-mcp **$0.206**, wdio-session **$0.237**, stagehand **$0.360**, playwright-mcp **$0.553**, agent-browser **$0.740** — computed from [webdriverio/benchmark](https://github.com/webdriverio/benchmark)
- Token volume ≠ billed cost: "most of the heavy drivers' volume is cache reads, which are nearly free on a subscription, so the billed gap is much smaller than the token gap" — [nsosio](https://github.com/nsosio/web-agent-bench)
- WebBench infrastructure note: Browser Use Cloud had to be run on **658 tasks** rather than 2,454 "due to cost constraints," and Operator/Convergence could only be run on **323 tasks** human-in-the-loop — an explicit statement that full-suite evaluation is cost-prohibitive at vendor scale — [Halluminate](https://www.halluminate.ai/blog/benchmark)

**Tool description size**

- Playwright MCP: 25 tools → **17,857 characters** of tool definitions injected before any task instruction — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage)
- Rule-of-thumb from a practitioner writeup: 150–400 tokens per function schema, so a 20-tool MCP server costs 3,000–8,000 tokens before the agent does anything — [tianpan.co](https://tianpan.co/blog/2026/04/19/over-tooled-agent-problem) `[secondary, no measurement]`

**Tool-count degradation (best-sourced)**

- arXiv 2605.24660, "How Many Tools Should an LLM Agent See? A Chance-Corrected Answer" (May 2026, v2 Jun 2026): evaluated across three tool-selection benchmarks and registries ranging **20 to 3,251 tools**; on **BFCL (370 tools)** a learned shortlist policy presenting **7 tools on average** achieves **90.3% coverage vs 90.8% for always showing 50**; on **ToolBench (3,251 tools)** a fixed shortlist of 5 gets higher aggregate coverage (**64.7% vs 61.9%**) but finds **nothing** on hard queries where the correct tool ranks 6th–20th, while the adaptive policy finds **16.7%** of those — [arXiv:2605.24660](https://arxiv.org/abs/2605.24660) `[independent academic]`
- Same paper, downstream validation with **Claude Sonnet 4.6**: shorter adaptive lists improve actual tool selection to **93.1% vs 87.1%** when always shown 5 tools, widening to **76.8% vs 60.9%** on medium-difficulty queries where the correct tool is present but not ranked first — [arXiv:2605.24660](https://arxiv.org/abs/2605.24660)
- A related paper argues leaderboard "accuracy falls as tool lists grow" partly conflates benchmark artifacts (reference tool sets listing tools the task doesn't need, so recall penalizes correct abstention) with real degradation — [OpenReview, "Tool Graph Complexity for LLM Tool-Calling"](https://openreview.net/forum?id=1c6vOPI94n) `[academic, position paper]`

### Inferences
- For a 20-tool MCP, the tool-definition tax is real but modest (~3–6k tokens once, then cached); the dominant cost driver is **per-step page observation**, not tool count. A 20-tool server with a compact snapshot is cheaper than a 5-tool server returning full a11y trees after every click.
- The tool-count evidence supports **task-shaped tool exposure** (a "find" tool + a scoped snapshot instead of 20 always-on tools) rather than a hard cap on tool count. The 7-vs-50 result is about *retrieval quality*, not about 20 being a magic threshold.
- Cost per completed task is the only comparable unit across stacks; published per-attempt costs systematically flatter low-success systems.

### Gaps
- **No published dollar cost per task for OpenAI Operator, ChatGPT Atlas, Claude in Chrome, Comet, or Gemini.** All are subscription- or credit-priced with no per-task telemetry; every "Operator costs $X/task" figure circulating is an estimate, not a measurement.
- No study measures cost of a *failed* task including human cleanup time — the number that actually matters for approval-gated workflows.
- The "65–78% accuracy at 20+ tools" figure from presenc.ai appeared in search results but the source is an SEO-style aggregator with no methodology; I did not include it as evidence.

---

## Q5. Reliability: prompt injection, CAPTCHA/login failure, flaky actions, approval gating

### Takeaway
Prompt injection against browser agents is **not a marginal risk**: a UW study found 4 of 7 agentic browsers allow same-origin-policy bypass, one with a working end-to-end PoC; BrowseSafe++ shows that injections which fail on replay succeed **up to 95.41%** of the time once adapted to the agent. Meanwhile CAPTCHA/login/proxy failures are the single largest *infrastructure* blocker in real-web benchmarks, and no public study quantifies how approval gating changes completion rate.

### Cited Findings
**Prompt injection / agentic browser security**

- University of Washington (presented 2026-04-26 at the Agents in the Wild Workshop, Rio): studied **7 popular agentic browsers**; **4** create ways to bypass the same-origin policy — **ChatGPT Atlas** (successful end-to-end PoC: an embedded site stole data from another site), plus the right conditions found in **Chrome with Gemini, Claude for Chrome, and Perplexity Comet**; **Firefox AI Mode** was least risky "mostly because it grants agents the fewest permissions"; the paper also documents **memory poisoning** — agents "would mingle information from different origins, likely because they were revising and compressing their memory" — [UW News, 2026-06-30](https://www.washington.edu/news/2026/06/30/some-agentic-ai-browsers-come-with-major-cybersecurity-risks-uw-study-finds/) `[independent academic; paper at agent-security.cs.washington.edu]`
- UW quote: "Browser agents aren't ready for the public… if these agents have access to a browser that contains your credentials — your email, your bank account, whatever it is — you should not trust that these systems are ready to truly protect your information" — David Kohlbrenner, UW Allen School — [UW News](https://www.washington.edu/news/2026/06/30/some-agentic-ai-browsers-come-with-major-cybersecurity-risks-uw-study-finds/)
- BrowseSafe++ (Oct 2026): **38,675 page pairs** (up from 14,719 in BrowseSafe), most injections **observed in the wild** on production sites, each attacked page paired with a clean control, provided as **HTML, Markdown, accessibility tree, and screenshot** — i.e., the same four observation modes MCP servers choose between; **12 website types, 24 attack types, 18 injection locations on a page**; **BrowseSafe-Adapt** "revises benchmark injections from browser-agent feedback, and attacks that succeed on only a few percent of tasks when replayed directly reach **up to 95.41% success** once adapted"; two **0.8B-parameter** detectors (text and screenshot) beat a frontier-model-based detector on F1 at lower inference cost — [arXiv:2610.17457](https://arxiv.org/abs/2610.17457) `[independent academic]`
- Secondary report of Anthropic's Claude Opus 4.6 system card: a single prompt-injection attempt against a GUI agent succeeds **17.8%** of the time without safeguards; by the **200th** attempt the breach rate reaches **78.6%** — [cyberdesserts blog](https://blog.cyberdesserts.com/prompt-injection-attacks/) `[secondary; primary system card not retrieved — treat as indicative]`
- Zenity Labs demonstrated at Black Hat USA 2026 that Claude in Chrome, Gemini in Chrome, Perplexity Comet, ChatGPT Atlas and Copilot Edge "can all be turned against their own users by ordinary [email]" — [Notebookcheck](https://www.notebookcheck.net/Claude-Gemini-Comet-five-AI-browsers-hijacked-by-a-single-email.1362568.0.html) `[secondary reporting of a vendor security-lab demo]`

**CAPTCHA / login / proxy failures**

- WebBench: "Infrastructure issues remain a huge blocker to browser agent performance on the real web. These include proxies, captcha, and login/authentication"; infrastructure failures are tracked as a separate bucket from agent failures, and fixing infrastructure "does not necessarily guarantee the agent would still successfully complete the task" — [Halluminate](https://www.halluminate.ai/blog/benchmark)
- Consequence in the data: **write-heavy tasks top out at 46.6%** (best fully automated agent, Skyvern 2.0) vs **>75% for read-heavy tasks**, and write tasks "may require 2–5x more steps," which the authors attribute partly to login/auth and longer trajectories — [Halluminate](https://www.halluminate.ai/blog/benchmark)
- nsosio's `auth` suite: "login works, but a 2FA wall blocks the vault — **every driver fails**: fresh login can't satisfy MFA → why you need pre-baked sessions" — [nsosio](https://github.com/nsosio/web-agent-bench) `[independent, synthetic fixture]`
- WebdriverIO counts blocked/CAPTCHA runs as failures for every tool and runs all tools on the same runner/IP interleaved in time specifically because "websites block by IP address" — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)

**Flaky actions / recovery**

- WebBench error taxonomy (agent-side): navigation issue (stuck, popup-blocked), timeout/step-limit, incomplete execution ("thinks it is done when it is not"), information-extraction error, leaving the domain — [Halluminate](https://www.halluminate.ai/blog/benchmark)
- Hard evidence of step-limit fragility: both Playwright MCP configurations hit the 40-step limit in **3/3 runs** on a 12-page form — [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage)
- Judge sensitivity as a reliability metric: ~1 in 7 WebJudge judgments disagrees with humans, meaning single-run success/failure labels are noisy at the ±14% level — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)

**Approval gating**

- No study found that measures how approval gating (human confirmation before each action) changes task completion rate, latency, or abandonment for browser agents. The nearest data is an enterprise-oversight survey: mandatory human approval is the dominant model at **58.5%** of organizations, human-on-the-loop exception review **29.8%**, fully autonomous **11.7%** — [CodeNinety PDF](https://codeninety.com/downloads/agentic-ai-penetration-and-oversight-2026.pdf) `[secondary survey; not browser-agent-specific, not completion-rate data]`

### Inferences
- Any browser MCP that executes irreversible actions without a gate is shipping a known-exploitable surface: the UW result means the *browser integration*, not just the model, is the vulnerability. An extension-based MCP that reads the user's real session has the largest blast radius of any architecture in this comparison.
- BrowseSafe++'s 95.41% adapted-attack number implies static injection benchmarks under-report risk by 1–2 orders of magnitude; a system evaluated only against replayed attacks will look far safer than it is.
- Because every driver failed the 2FA fixture, **session reuse (pre-authenticated profile) is a bigger reliability lever than any tool-layer optimization** — consistent with the "runs in your actual browser session" advantage that extension-based agents claim.
- Write-task ceilings (~47–69%) mean any claim of "extraordinary" end-to-end performance must be read as read-task performance unless write tasks are reported separately.

### Gaps
- No measured **CAPTCHA success rate** per agent, and no measured **login failure rate** as a percentage — WebBench reports the categories but not per-cause rates.
- No published **flaky-action rate** (same action, same page, nondeterministic outcome) for any of these stacks.
- **Approval gating's effect on completion rate is unmeasured.** This is the single biggest evidence gap relative to the product question, since a `ask_user`/approval design trades success for safety and nobody has published the exchange rate.
- Anthropic's 17.8% / 78.6% injection numbers are from a secondary source; the primary system card should be checked before quoting.

---

## Q6. Synthesis: what "extraordinary performance" means quantitatively (Nov 2026)

### Takeaway
On current public evidence, "extraordinary" for a browser MCP/agent means roughly: **≥90% on WebVoyager, ≥70% on WebArena, ≥80% overall and ≥65% on write-heavy tasks on WebBench, ≥90% on Online-Mind2Web with a published judge, ≤$0.03 per completed task at Sonnet-class pricing, ≤30 s per task, ≤25 tool calls per task, and zero infrastructure-caused failures.** Anything at 45–60% on live-web tasks with $0.10–$0.35 per completed task is *ordinary* — which is where most measured MCP stacks currently sit.

### Cited Findings
- Median measured live-web success across seven real MCP/SDK setups: **48–58%** (100 tasks, DeepSeek V4.1 Flash) and **32–60%** (50 tasks, Sonnet 5) — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)
- Best independently-annotated real-web score for an automated agent (WebBench 2025): **66.0%** overall, **46.6%** write — [webbench.ai](https://webbench.ai/), [Halluminate](https://www.halluminate.ai/blog/benchmark)
- Best reproducible-environment score for a full system (WebArena): **74.3%**, with the best MCP-harness entry at **68.0%** — [Steel WebArena](https://leaderboard.steel.dev/leaderboards/webarena/)
- Frontier self-reported scores now: WebVoyager **99.19%**, BrowseComp **92.2%**, GAIA **92.36%**, OSWorld v1 **86.1%**, OSWorld 2.0 **77.9%** — [Steel results](https://leaderboard.steel.dev/results)
- Best measured cost: **$0.010/task** (58% success ⇒ $0.017 per completed task) — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)
- Best measured latency on real tasks: **74–91 s/task** median (Sonnet, real sites); **18–31 s/task** on curated tasks — [webdriverio/benchmark](https://github.com/webdriverio/benchmark), [stagehand.dev](https://www.stagehand.dev/blog/playwright-mcp-token-usage)
- Tool-call floor: **16 calls/task** (Playwright MCP, Sonnet, 50 tasks) vs 22–36.5 for other stacks — [webdriverio/benchmark](https://github.com/webdriverio/benchmark)

### Inferences
- A defensible internal target for a 20-tool extension-based MCP, benchmarked on 100 Online-Mind2Web tasks with WebJudge and published CIs: **beat 58% success / $0.017 per completed task / 150 s** — i.e., the current best measured point — and report write-task success separately.
- "Extraordinary" should be claimed only with: (a) ≥100 tasks, (b) judge named + agreement rate, (c) cost per *completed* task, (d) write/read split, (e) infrastructure failures counted as failures, (f) 95% CIs. No vendor claiming 81–99% in 2026 published all six.
- The largest available wins are structural, not algorithmic: pre-authenticated session reuse (avoids the 2FA wall that failed every driver), batching actions per model call (5.5 pp on OSWorld 2.0; the difference between finishing a 12-page form and hitting the step limit), and not returning a full snapshot after every action.

### Gaps
- No benchmark reports a **composite** score combining success, cost, latency, and safety. Any "fastest and most reliable" claim is therefore a multi-objective judgement, not a measured ranking.
- No published data on how much a `snapshot-with-refs` reader specifically (as opposed to Playwright's a11y tree) improves tokens or success — the closest analogues are Stagehand's hybrid snapshot (vendor claim: 80% fewer tokens, 50% faster) and Taskmosis's CDP/DOM approach (vendor claim: 0.8 min vs 4.3–20.7 min per task).
