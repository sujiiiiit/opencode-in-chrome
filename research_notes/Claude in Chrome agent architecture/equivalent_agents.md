# Browser-agent systems comparable to Claude in Chrome: architecture fact sheet (as of Nov 2026)

Research budget note: about 17 tool calls. Primary sources (GitHub READMEs and repo docs, vendor blogs) were used where reachable. BrowserMCP's GitHub page returned HTTP 504, and browser-use's `system_prompt.md` path returned 404 (the file has probably moved). Taxy AI, Fellou, Sider, HARPA and MultiOn were not researched in this pass. Anything below that comes from prior knowledge and not a fetched source is marked "UNVERIFIED (prior knowledge)" and sits only under Inferences or Gaps.

## Extension-based agents: how do they observe the page and act?

### Takeaway
The extension agents that publish their internals (the current Nanobrowser, and Playwright MCP's extension bridge) do the same three things. They attach to the user's real tabs with `chrome.debugger`, send raw CDP for input, and give the model element references that fail closed when they go stale. Nanobrowser has dropped its well-known planner/navigator multi-agent design for a single agent loop. The commercial agents (Operator/CUA, Atlas, Mariner/Gemini auto browse, Comet) are closed. Only OpenAI documents a perception method: screenshots plus mouse and keyboard.

### Cited Findings
**Nanobrowser (nanobrowser/nanobrowser): rewritten, WXT-based, single agent**
- The current README describes one agent running from the side panel in the user's own browser. Each task gets its own tab group. The README does not name a planner or navigator role. — [nanobrowser README](https://github.com/nanobrowser/nanobrowser)
- AGENTS.md says outright: "One agent, not the old planner and navigator: one loop per conversation." It lists "several cooperating agents" as out of scope. The multi-agent design is therefore superseded. — [nanobrowser AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md)
- Repo layout:
  - `src/agent/`: loop, hooks, agent tools, prompts, context management, run records
  - `src/llm/`: providers, which "knows nothing about browsers"
  - `src/browser-control/core/`: perception and interaction
  - `src/browser-control/protocol/`: request, result and error types, plus the tool catalogue
  - `src/store/`: IndexedDB storage
  - Build is WXT (`wxt.config.ts`, `entrypoints/`). — [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md); [README](https://github.com/nanobrowser/nanobrowser)
- Browser control layer:
  - `chrome.debugger` is "the only route to CDP."
  - Puppeteer is used only to detect frames and track per-frame sessions. Element commands are raw CDP sent to the right frame session. It uses no selectors and no `ElementHandle` clicks.
  - The layer is deterministic and contains no AI model ("the same input always gives the same result"). — [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md); [README](https://github.com/nanobrowser/nanobrowser)
- Element refs:
  - A ref is tied to the browser's handle for the exact node, and actions operate on "the node the agent was shown."
  - A ref is valid only in the document where the agent saw it. Otherwise the action returns a typed error, so the ref fails closed.
  - Observation is read-only, and the result must state any partial capture or truncation. — [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md)
- Actions:
  - Before acting, the layer checks that the element is visible, stable, enabled and not covered.
  - Input is real browser input, sent once. Retries happen only before dispatch, and the layer never resends input on its own.
  - Each result reports three things separately: input dispatched, page reacted, expected state reached.
  - Every command, wait and list has a budget. — [README](https://github.com/nanobrowser/nanobrowser); [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md)
- Tools are the same for every model, except that the `screenshot` tool is exposed only to vision models. The first release has no tool switches, no model tiers and no skills. — [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md)
- Permissions:

  | Action | Ask mode (default) | Auto mode |
  |---|---|---|
  | Read, click links, scroll, switch tabs | Proceeds | Proceeds |
  | Submit, send, delete, upload | Asks first | Proceeds |
  | Pay, enter a password or code, grant access | Hands the step to the user | Hands the step to the user |

  Per-site Allow/Ask/Block rules exist. Page content goes to the model inside marked boundaries and is treated as data. — [README](https://github.com/nanobrowser/nanobrowser); [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md)
- MV3 robustness: layer state is disposable. A service-worker restart, debugger detach or navigation clears it cleanly. — [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md)
- Status: about 14.2k stars. It supports Chrome and Edge, and models must support tool calling. The README claims no benchmarks. — [README](https://github.com/nanobrowser/nanobrowser)

**Playwright MCP extension bridge ("Playwright MCP Bridge")**
- `--extension` "connect[s] to a running browser instance (Edge/Chrome only)" and requires the Playwright extension. `--profile-dir-name` picks the profile. When `extension` is set, the `browser` config is ignored. Setup lives in `packages/extension` in microsoft/playwright. — [playwright-mcp README](https://github.com/microsoft/playwright-mcp)
- The official docs present it as the way to reuse existing tabs, logins, cookies and extensions, and as the simplest route for SSO or 2FA sites. — [playwright.dev browser-extension docs](https://playwright.dev/mcp/configuration/browser-extension)
- Relay design, from third-party forks of the code, so illustrative only:
  - A local WebSocket relay has a `/cdp/<guid>` endpoint for the Playwright client and an `/extension/<guid>` endpoint for the extension, which forwards to `chrome.debugger`.
  - The relay answers some commands itself, such as `Browser.getVersion`.
  - When the client disconnects, it detaches from the tab. — [glama.ai cdpRelay.ts fork](https://glama.ai/mcp/servers/@nzjami/mcpPlaywright/blob/65d99fe5957f368387d0f61362338917b2ce3391/src/extension/cdpRelay.ts)
- Chrome Web Store listing: "Playwright Mcp Bridge" v0.1.0, about 30K+ users, last updated 2026-04-07 (per an aggregator). — [chromeboard listing](https://chromeboard.com/extension/playwright-mcp-bridge-mmlmfjhmonkocbjadbfplnigmagldckm)

**Chrome DevTools MCP extension support**
- The README does not document an "extension mode" for driving the user's browser. The server uses Puppeteer and launches Chrome lazily. Advanced docs cover connecting to a running Chrome and WebSocket configuration. — [chrome-devtools-mcp README](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- Its "Extensions" category is for debugging extensions, not for running as one. It has 5 tools (`install_extension`, `list_extensions`, `reload_extension`, `trigger_extension_action`, `uninstall_extension`) behind `--categoryExtensions=true`. `list_pages` shows extension service workers as `sw-N`, and `list_console_messages` includes content-script logs. — [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)

**OpenAI Operator / CUA**
- CUA combines GPT-4o vision with RL-trained reasoning. It takes screenshots into context, reasons with chain of thought over current and past screenshots, and acts through mouse and keyboard, not web APIs. — [OpenAI: Computer-Using Agent](https://openai.com/index/computer-using-agent/)

**ChatGPT Atlas agent mode**
- On Dec 22, 2025, OpenAI described hardening Atlas agent mode with an RL-trained automated attacker, a "rapid response loop", and an adversarially trained browser-agent model. Secondary reports say Atlas now flags embedded instructions and asks the user. — [OpenAI: Hardening Atlas against prompt injection](https://openai.com/index/hardening-atlas-against-prompt-injection); [ITPro](https://www.itpro.com/technology/artificial-intelligence/openai-chatgpt-atlas-ai-browser-prompt-injection-attack-risk)
- OpenAI calls prompt injection a problem "unlikely to ever be fully solved" (as reported). — [ITPro](https://www.itpro.com/technology/artificial-intelligence/openai-chatgpt-atlas-ai-browser-prompt-injection-attack-risk)

**Project Mariner / Gemini in Chrome**
- Mariner started on Gemini 2.0 and moved to Gemini 2.5 Pro. From Oct 2025, production traffic reportedly ran on versions of the public Gemini 2.5 Computer Use model. — [aiwiki: Project Mariner](https://www.aiwiki.ai/wiki/project_mariner)
- One source says standalone Mariner was shut down on May 4, 2026, and its technology was folded into Gemini Agent, Chrome auto browse and the Computer Use model. Other lower-reliability sources claim a GA at Cloud Next in April 2026 with 10 concurrent tasks. The sources CONFLICT. — [helentech.jp](https://helentech.jp/news-project-mariner-shutdown-gemini-agent-85807/); [DEV Community](https://dev.to/skilaai/google-just-shipped-a-web-agent-that-runs-10-tabs-at-once-it-beat-openais-score-1h)

**Perplexity Comet**
- Comet is closed source. The agent runs in the browser, and a sidebar shows the action trace. The MIT AI Agent Index rates its autonomy L4–L5 and notes MCP support. — [MIT AI Agent Index: Comet](https://aiagentindex.mit.edu/2025/comet)
- Brave showed in July 2025 that hidden text in a Reddit comment could hijack a "summarize this thread" request. A later attack, HashJack, used URL-fragment injection. — [WebProNews](https://www.webpronews.com/brave-discovers-prompt-injection-flaw-in-perplexity-ais-comet-browser); [dev.to](https://dev.to/dsikorska/prompt-injection-in-production-the-2025-perplexity-comet-attack-4ka5)

### Inferences
- Open-source extension agents have converged on **`chrome.debugger` + raw CDP + fail-closed node refs**. Content-script DOM manipulation and synthetic `dispatchEvent` are out, because real CDP `Input.*` events are trusted (`isTrusted`) and work across cross-origin iframes. This matches the MV3 constraints this project faces.
- Nanobrowser's move from multi-agent to a single loop suggests the planner/navigator split was not worth its latency and token cost once models became strong at tool calling.
- Tiered per-action permissions, with page text wrapped as untrusted data, are table stakes, and every commercial vendor admits injection is unsolved.
- UNVERIFIED (prior knowledge): the old Nanobrowser (v0.1.x) used Planner, Navigator and Validator agents. It was built on a fork of browser-use's DOM-indexing approach and ran Puppeteer over `chrome.debugger`.

### Gaps
- **BrowserMCP:** the repo page timed out (504). UNVERIFIED (prior knowledge): it is a Playwright MCP adaptation that uses an extension plus a local WebSocket and aria-snapshot refs, and it has seen little maintenance since 2025.
- **Taxy AI, Fellou, Sider, HARPA, MultiOn:** not researched here. UNVERIFIED (prior knowledge): Taxy AI sent a simplified DOM to the model, which acted through `chrome.debugger`. Taxy AI and MultiOn's consumer extension appear dormant.
- **Atlas, Comet and Gemini auto browse perception (DOM vs. screenshot):** I found no official technical documentation.

## Library/framework agents: exact snapshot formats and why

### Takeaway
There are two families:
- **Accessibility-tree text snapshots with ref/uid handles:** Playwright MCP's `browser_snapshot`, Chrome DevTools MCP's `take_snapshot` uid, and Stagehand's "hybrid accessibility-tree trimming".
- **Indexed DOM serialization of interactive elements:** browser-use, which now runs on raw CDP via `cdp-use` with a rich node identity.

Both families avoid sending pixels by default and keep screenshots optional or vision-only.

### Cited Findings
**Playwright MCP**
- It uses "Playwright's accessibility tree, not pixel-based input." `browser_snapshot` is "better than screenshot," and actions take a "reference from the page snapshot."
- `browser_take_screenshot` explicitly says you "can't perform actions based on the screenshot."
- Options:
  - `--snapshot-mode full|none`
  - `--snapshot-boxes` adds `[box=x,y,width,height]`
  - `browser_find` searches the snapshot by text or regex, which is cheaper than fetching a full snapshot
- Coordinate tools are opt-in with `--caps=vision` (`browser_mouse_click_xy` and others).
- Other capability groups: network, storage, devtools, pdf, testing, config. — [playwright-mcp README](https://github.com/microsoft/playwright-mcp)
- Microsoft now recommends **CLI + Skills** (microsoft/playwright-cli) for coding agents because "CLI invocations are more token-efficient." It says MCP "remains relevant for specialized agentic loops" with persistent state. MCP is not deprecated. — [playwright-mcp README](https://github.com/microsoft/playwright-mcp)

**Chrome DevTools MCP**
- 61 tools in 12 categories. `take_snapshot(pageId, verbose?, filePath?)` returns a text a11y-tree snapshot in which each element has a `uid`.
- The docs say "Always use the latest snapshot" and recommend snapshots over screenshots.
- `click`, `hover`, `fill`, `fill_form`, `drag(from_uid, to_uid)`, `upload_file`, `take_screenshot(uid?)` and `get_css_styles` all take uids. Input tools accept `includeSnapshot?`, which returns a fresh snapshot after the action and saves a round trip.
- `click_at(x,y)` needs `--experimentalVision=true`.
- Newer categories: WebMCP (`list_webmcp_tools`, `execute_webmcp_tool`), third-party developer tools, PWA, WebAuthn, and memory heap-snapshot tools. — [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)
- It drives Chrome through Puppeteer, whose auto-wait is cited as the reliability mechanism. — [README](https://github.com/ChromeDevTools/chrome-devtools-mcp)

**browser-use**
- Aug 20, 2025 post: browser-use dropped Playwright for raw CDP. Reasons given:
  - Playwright's Node relay adds "a 2nd network hop" on thousands of CDP calls.
  - State drifts between browser, relay and client.
  - Sharp edges: full-page screenshots over 16,000px "reliably crash playwright", plus dialogs, uploads and downloads, and crashed tabs. Chrome has "at least 10 different ways a tab can crash."
  - The gains are qualitative ("massively increased the speed"), with no numbers. — [browser-use: Playwright to CDP](https://browser-use.com/posts/playwright-to-cdp)
- Node identity (`EnhancedDOMTreeNode`) carries `target_id`, `frame_id`, `backend_node_id`, a frame path and a stable element index, so input is routed to the right CDP session, including in nested cross-origin iframes.
- An event-driven "watchdog" design on the `bubus` event bus handles downloads and crashes.
- `cdp-use` is thin, type-safe Python CDP bindings generated from the spec. — [browser-use: Playwright to CDP](https://browser-use.com/posts/playwright-to-cdp)
- API: `Agent(task, llm, tools).run()` returns a history object. `save_history()` and `load_and_rerun()` replay steps without calling the model.
- Benchmark claims: "BU Bench V2" (numbers shown only in a chart), and 90.5% on "Stealth Bench V2" for the cloud product. — [browser-use README](https://github.com/browser-use/browser-use)

**Stagehand (browserbase)**
- Primitives:
  - `act`: natural-language action, "self-heals when the site redesigns"
  - `observe`: returns real selectors, "so credentials never reach the model"
  - `extract`: schema-validated (Zod, Pydantic, Go struct)
- Page context comes from "Hybrid accessibility-tree trimming."
- `cache: true` on Browserbase returns identical calls with "no tokens spent."
- Stagehand "runs as an extension next to the browser, cutting round-trip latency."
- Claims "2x faster execution than Playwright cloud" (method not given). — [stagehand README](https://github.com/browserbase/stagehand)

### Inferences
- Why a11y snapshots with refs: they are compact, semantic (role and name), and handles are deterministic and verifiable. Pixels can't be acted on reliably without vision grounding, which explains why Playwright MCP and CDT MCP both gate coordinate tools behind flags.
- Lesson for an MV3 extension: the industry's direction is to (a) return a fresh snapshot with each action result (`includeSnapshot`), (b) offer a search/find tool to avoid dumping the whole tree, and (c) key refs on `backendNodeId` plus frame/target so cross-origin iframes work. Claude in Chrome's own `read_page`/`find`/`ref` tools follow the same pattern.
- UNVERIFIED (prior knowledge): browser-use serializes the DOM as indented lines like `[12]<button aria-label=...>Text</button>`, marks newly appeared elements with `*`, and can draw a highlight overlay of index boxes on the screenshot (set-of-marks). The agent outputs `evaluation_previous_goal`, `memory`, `next_goal` and a list of actions (several per step). I could not confirm this from the repo this session; `browser_use/agent/system_prompt.md` returned 404.
- UNVERIFIED (prior knowledge): Playwright aria snapshots are YAML-like, e.g. `- button "Submit" [ref=e12]`. Stagehand v3 also moved off Playwright to direct CDP.

### Gaps
- I did not retrieve verbatim example output for the Playwright MCP or CDT MCP snapshots.
- Stagehand's cache-key and self-heal mechanism are not explained in the README.

## Agent loop design: planner vs. executor, tools, limits, memory, "answer vs. browse"

### Takeaway
The documented trend is a single tool-calling loop with a rich but uniform tool catalogue, auto-compaction of history, and per-action budgets. Nanobrowser explicitly abandoned planner/navigator. No source I found documents how commercial agents decide between "just answer" and "use the browser". Perplexity frames it as separate Assistant (explain) and Agent (do) modes.

### Cited Findings
- Nanobrowser:
  - One loop per conversation.
  - The conversation is auto-compacted before the context window fills, and every user message is kept in full.
  - Run records and IndexedDB persistence.
  - Budgets on every command, wait and list.
  - Detected writes require approval in Ask mode. — [AGENTS.md](https://raw.githubusercontent.com/nanobrowser/nanobrowser/master/AGENTS.md)
- browser-use's Claude toolset example passes `max_iterations=100` to Anthropic's tool runner. Replay of saved histories avoids per-step LLM calls. — [browser-use README](https://github.com/browser-use/browser-use)
- Perplexity separates an Assistant focused on understanding and explaining from an Agent focused on doing. — [MIT AI Agent Index: Comet](https://aiagentindex.mit.edu/2025/comet)
- Playwright MCP and CDT MCP expose many fine-grained tools (CDT has 61) behind capability flags, so the client loads only what it needs. — [playwright-mcp README](https://github.com/microsoft/playwright-mcp); [tool-reference.md](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)
- Stagehand mixes deterministic code with targeted LLM primitives, and caches repeat actions. — [stagehand README](https://github.com/browserbase/stagehand)

### Inferences
- For an extension chat-plus-browse product, the common pattern is one model loop where browsing tools are simply available. The model answers directly when no tool is needed, and no separate router model is used.
- Gating tools by capability, as Playwright MCP and CDT MCP do, keeps the prompt small.
- UNVERIFIED (prior knowledge): browser-use defaults to about 100 max steps, allows multiple actions per step, and has optional planner and judge LLMs.

### Gaps
- I found no primary source on how Atlas, Comet or Gemini auto browse route between chat and agent mode internally, or on their step limits and memory compaction.

## Known benchmark numbers

### Takeaway
The headline numbers are vendor-reported and mostly on WebVoyager:

| System | Score | Benchmark |
|---|---|---|
| OpenAI CUA (Jan 2025) | 87% | WebVoyager |
| OpenAI CUA (Jan 2025) | 58.1% | WebArena |
| OpenAI CUA (Jan 2025) | 38.1% | OSWorld |
| Project Mariner (Dec 2024) | 83.5% | WebVoyager |

browser-use claims results on its own benchmarks (BU Bench V2, Stealth Bench V2). Nanobrowser and Stagehand claim no task-success benchmarks. Stagehand claims only speed.

### Cited Findings
- CUA scores, with prior state of the art and human baselines:

  | Benchmark | CUA | Prior SOTA | Human |
  |---|---|---|---|
  | OSWorld | 38.1% | 22.0% | 72.4% |
  | WebVoyager | 87% | 56.0% | not given |
  | WebArena | 58.1% | 36.2% | 78.2% |

  OpenAI notes WebVoyager tasks are relatively simple. — [OpenAI: Computer-Using Agent](https://openai.com/index/computer-using-agent/)
- Project Mariner: 83.5% on WebVoyager at its Dec 2024 announcement. A 90.5% "tree search" figure appears in only one Japanese source, so it is unconfirmed. — [aiwiki: Project Mariner](https://www.aiwiki.ai/wiki/project_mariner); [weel.co.jp](https://weel.co.jp/media/innovator/project-mariner/)
- browser-use: a 60-task subset of BU Bench V2 is shown as a chart only. The cloud product claims 90.5% on Stealth Bench V2. — [browser-use README](https://github.com/browser-use/browser-use)
- Stagehand: "2x faster execution than Playwright cloud" (no method given). — [stagehand README](https://github.com/browserbase/stagehand)
- Nanobrowser: no benchmarks claimed. — [README](https://github.com/nanobrowser/nanobrowser)

### Inferences
- The vendor numbers are not comparable. Benchmark versions, task subsets and harnesses differ, and WebVoyager is near saturation. Robustness under prompt injection is arguably the more relevant metric for an extension agent.
- UNVERIFIED (prior knowledge): browser-use earlier claimed about 89% on WebVoyager (Dec 2024).

### Gaps
- I found no current (2026) official numbers for Atlas agent mode, Comet, Gemini auto browse, or Gemini 2.5 Computer Use (Online-Mind2Web, etc.) in this pass.
- No independent cross-system benchmark was found.
