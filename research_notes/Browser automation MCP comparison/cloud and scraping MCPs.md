# Hosted Cloud-Browser, Scraping and Web-Data MCP Servers (November 2026)

> Scope: hosted/remote MCP servers that give an agent a browser, a scraper, or web-data/search APIs — and how they compare with an in-extension browser MCP that drives the user's own logged-in Chrome.
>
> Research date: **7 November 2026**. Every vendor page below was fetched on that date unless a page states its own "last updated" date. Prices and tool inventories in this market change monthly; treat anything older than ~90 days as suspect.
>
> Method note: the WebSearch tool was returning HTTP 402 during this research, so discovery relied on (a) vendor docs / `llms.txt` indexes, (b) GitHub and npm/PyPI metadata, and (c) DuckDuckGo HTML results. This biases coverage toward vendors with good machine-readable docs and away from registry aggregators (Glama, Smithery, PulseMCP, mcp.so), which were not systematically surveyed.

---

## 1. What hosted browser-as-a-service MCP servers exist, and what does each expose?

### Takeaway
There are two distinct product shapes: **thin agent-facing wrappers** (Browserbase 6 tools, Notte 8, Hyperbrowser 10) and **broad platform surfaces** (Steel 24, Anchor 23+ and an "all endpoints as tools" variant). Every one of them runs a *separate cloud browser*, not the user's browser. Pricing is converging on roughly **$0.06–$0.10 per browser-hour** plus proxy/CAPTCHA pass-through, with concurrency as the real plan differentiator (3–10 on free tiers, 25–100+ on paid).

### Cited Findings

**Browserbase**
- The self-hosted reference server "exposes 6 tools that match the hosted Browserbase MCP server": `start`, `end`, `navigate`, `act`, `observe`, `extract` — [Browserbase MCP GitHub README](https://github.com/browserbase/mcp-server-browserbase). The repository is now archived and marked "no longer maintained"; it says it is "a self-hostable version of the Browserbase hosted MCP server … with the same tools and functionality".
- Hosted endpoint is Streamable HTTP at `https://mcp.browserbase.com/mcp`, running on Browserbase infrastructure, built on Stagehand; the hosted server also pays for the LLM calls (Gemini) that Stagehand uses — [Browserbase MCP docs](https://docs.browserbase.com/integrations/mcp/introduction); [README](https://github.com/browserbase/mcp-server-browserbase).
- Self-hosted flags expose the platform differentiators: `--proxies`, `--verified` (Verified Identity, "Only for Scale Plan Users"), `--keepAlive`, `--contextId`, `--persist` — [README](https://github.com/browserbase/mcp-server-browserbase).
- Plans: Free $0 (3 concurrent), Developer $20, Startup $99 (100 concurrent), Scale custom — [Browserbase pricing](https://www.browserbase.com/pricing).

**Steel.dev**
- Hosted server at `https://mcp.steel.dev/mcp`; OAuth sign-in (Client ID Metadata Documents) or `Authorization: Bearer <STEEL_API_KEY>` / `steel-api-key` header; **cannot be self-hosted** ("The MCP server runs on Steel Cloud only") — [Steel MCP docs](https://docs.steel.dev/overview/mcp).
- Tool inventory is **24 tools**: `scrape`, `session_create`, `session_list`, `session_release`, `snapshot`, `find`, `get`, `screenshot`, `wait`, `navigate`, `click`, `hover`, `type`, `fill`, `press_key`, `select_option`, `check`, `drag`, `scroll`, `eval`, `tab`, `dialog`, `status`, `cancel` — counted from the tool tables in [Steel MCP docs](https://docs.steel.dev/overview/mcp).
- Session options include `use_proxy`, `solve_captcha`, `profile_id`, `persist_profile`, `use_credentials`, `timeout_minutes` (1–1440, default 60) — [Steel MCP docs](https://docs.steel.dev/overview/mcp).
- MCP limits: 10-minute idle timeout, `scrape` capped at **20 pages/minute per organization**, page text truncated at **30,000 characters**, session length capped by plan — [Steel MCP docs](https://docs.steel.dev/overview/mcp).
- Pricing: Launch $0 + usage ($30 one-time credits, ~300 browser hours), Scale $250/mo ($100/mo credits), Enterprise custom; browser hours **$0.10/hr → $0.08/hr**, proxies **$10/GB → $6/GB**, CAPTCHA **$3/1k → $1/1k**, browser tools (`/scrape`, `/screenshot`, `/pdf`) **$5/1k**; concurrency 10 → 100 → 1,000+ — [Steel pricing/limits](https://docs.steel.dev/overview/pricinglimits).
- Steel also ships a Commands API (HTTP browser control), Credentials API, Profiles, Extensions API, Files API, Agent Traces (timeline synced to session video), and live/past session embedding — [Steel docs index](https://docs.steel.dev/llms.txt).

**Anchor Browser**
- Three hosted servers on one account: `https://api.anchorbrowser.io/v1/mcp` (web tasks, actions, automations, identities, sessions, `call_endpoint`), `/v1/mcp/browser` (step-by-step live browser, `anchor_*` tools incl. snapshot/click/type/screenshot/network+console logs/Playwright codegen), `/v1/mcp/actions` (2 tools: `find_actions`, `run_action`) plus `/v1/mcp/actions/{domain}` for per-site typed tools; `/v1/mcp/all` exposes "every route tagged for agents as its own typed tool" — [Anchor MCP docs](https://docs.anchorbrowser.io/advanced/mcp).
- Core `Anchor` server exposes **23 tools** across web tasks (2), site actions (3), saved automations (4), managed logins (5), browser sessions (3), docs (2), and generic endpoint calls (4) — counted from the tables in [Anchor MCP docs](https://docs.anchorbrowser.io/advanced/mcp).
- Anchor claims "no concurrency limit", isolated VM per session, residential/mobile proxies, extra stealth, automatic CAPTCHA solving, managed identities with MFA, live view with user takeover, batch sessions, webhooks, recordings, Zero Data Retention, SOC 2 Type II / ISO 27001 / HIPAA / GDPR — [Anchor MCP docs](https://docs.anchorbrowser.io/advanced/mcp).
- Auth: OAuth sign-in (Cursor, Claude, ChatGPT, Grok, VS Code) or `anchor-api-key` header — [Anchor MCP docs](https://docs.anchorbrowser.io/advanced/mcp).

**Notte**
- Hosted browser connector at `https://api.notte.cc/mcp`; a broader developer surface at `https://api.notte.cc/mcp/full`; OAuth or Notte API key — [Notte MCP docs](https://docs.notte.cc/mcp-server).
- **8 tools** in the browser connector: `manage_browsers` (start/list/status/stop), `browser_observe`, `browser_scrape`, `browser_screenshot`, `browser_action`, `manage_files`, `manage_profiles`, `manage_auth` — [Notte MCP docs](https://docs.notte.cc/mcp-server).
- Pricing: Free $0 ($10 one-time credits, 5 concurrent, 15-min sessions), Developer $20/mo ($20 credits, 25 concurrent, 120-min), Startup $100/mo ($100 credits, 100 concurrent, 300-min), Enterprise custom. Usage: browser sessions **$0.01/hour**, browser functions $0.05/hour, residential proxies **$10/GB** (BYO $0.20/GB) — [Notte pricing](https://www.notte.cc/pricing).

**Hyperbrowser**
- **10 tools**: `scrape_webpage`, `crawl_webpages`, `extract_structured_data`, `search_with_bing`, `browser_use_agent`, `openai_computer_use_agent`, `claude_computer_use_agent`, `create_profile`, `delete_profile`, `list_profiles` — [Hyperbrowser MCP README](https://github.com/hyperbrowserai/mcp).
- Distributed via `npx hyperbrowser-mcp` (stdio) and Smithery; the README notes "the hyperbrowser API supports a superset of features present in the mcp server" — [Hyperbrowser MCP README](https://github.com/hyperbrowserai/mcp).
- Usage pricing: 1 credit = $0.001; browser **$0.10/hour**; proxy **$10/GB**; supports `useStealth`, `useProxy`, `solveCaptchas` — [Hyperbrowser pricing](https://www.hyperbrowser.ai/pricing).

**Kernel**
- Browser infrastructure sold per second: headful `$0.0001333336/sec` (~$0.48/hr), headless `$0.0000166667/sec` (~$0.06/hr), headful+GPU `$0.0008000016/sec` (~$2.88/hr); plans Developer $0 + $5 credits, Hobbyist $30 + $10, Start-Up $200 + $50 — [Kernel pricing](https://www.kernel.sh/pricing).
- Kernel's docs index positions it as CDP/Playwright/Puppeteer browser infrastructure rather than an MCP tool surface — [Kernel llms.txt](https://docs.kernel.sh/llms.txt).

**Browserless**
- Two MCP servers: the full **Browserless MCP Server** at `https://mcp.browserless.io/mcp` (OAuth, `Authorization: Bearer <token>`, or `?token=`) and a read-only **Connector** with five tools — [MCP overview](https://docs.browserless.io/mcp/overview); [MCP setup](https://docs.browserless.io/mcp/browserless-mcp-server/setup).
- Tool names documented across the server and connector include `browserless_read_page`, `browserless_export`, `browserless_search`, `browserless_map`, `browserless_performance` (Lighthouse), `browserless_agent`, `browserless_skill`, `browserless_live_url`, `browserless_smartscraper`, `browserless_crawl`, `browserless_function` (arbitrary Puppeteer JS), `browserless_profiles`, `browserless_link_connect`, `browserless_link_checkout`, `browserless_account`, `browserless_usage`, `browserless_sessions`, `browserless_logs` — ≥18 names, counted from [Connector docs](https://docs.browserless.io/mcp/browserless-mcp-server/connector) and [account tools](https://docs.browserless.io/mcp/account-tools).
- Standout capability: **Agentic Checkout** — "connect a Stripe Link wallet and complete user-approved purchases without exposing payment credentials to the model; Cloud-only" — [MCP overview](https://docs.browserless.io/mcp/overview).
- Sells hosted Chrome over CDP/REST with per-unit plans — [Browserless pricing](https://www.browserless.io/pricing).

**Airtop**
- Airtop's own developer docs currently expose only a **documentation** MCP (`https://docs.airtop.ai/_mcp/server`), not a product MCP — [Airtop llms.txt](https://docs.airtop.ai/llms.txt).
- Airtop's "Claude Code" integration ships an **Agent Skill**, not an MCP server: `npx skills add airtop-ai/airtop-skill` — [Airtop Claude Code page](https://www.airtop.ai/connect/claude-code).
- A community MCP exists (`npx airtop-mcp`) with 5 tools: `createSession`, `createWindow`, `pageQuery`, `terminateSession`, `paginatedExtraction` — [alecf/airtop-mcp](https://github.com/alecf/airtop-mcp).
- Airtop pricing: Free $0 (1,000 credits, 3 simultaneous sessions), Starter $29/mo (30k–150k credits, 3 sessions), Professional $189/mo (225k–500k credits, 30 sessions), Enterprise $558/mo (775k–1.5M credits, 100 sessions) — [Airtop pricing](https://www.airtop.ai/pricing).

### Inferences
- Tool count is a poor proxy for capability here. Browserbase's 6 tools do more per call (natural-language `act` / `observe` / `extract` via Stagehand) than Steel's 24 primitives; counting tools rewards low-level design, not coverage of web tasks.
- The "browser-as-a-service" category has largely converged: CDP session + accessibility snapshot + ref-based actions + profiles + proxies + CAPTCHA. Differentiation is now concurrency, IP diversity, deterministic replay/actions, and auth vaults.
- Price per browser-hour is nearly irrelevant at agent scale; a 3-minute task costs $0.003–$0.005 in browser time, so LLM tokens and failed retries dominate real cost. The Browserbase benchmark below puts a full 7-step workflow at ~$0.001 of browser time.

### Gaps
- No first-party **Kernel MCP server** could be verified; Kernel appears to be infrastructure that agents connect to over CDP directly.
- Browserless's per-plan prices, concurrency and session limits were not captured; only that it sells per-unit plans and runs two hosted MCP endpoints (full server + read-only connector).
- Hyperbrowser's hosted (remote) MCP endpoint and per-plan concurrency limits were not confirmed; only the stdio server and usage rates.
- Anchor's exact per-tool count for the `/browser` and `/all` variants is not enumerated in the docs ("step-by-step `anchor_*` tools… and more"), so 23 is a floor for the core server only.
- Oxylabs, Bright Data and Apify pricing per browser-hour/credit were not fully captured (see §2).

---

## 2. What scraping/extraction MCP servers exist, and what do they expose?

### Takeaway
This is where the **20+ tool surfaces** actually live: Bright Data (30), Firecrawl (~20–25 including monitors and research indexes), ScrapingBee (17), Oxylabs Agent Browser (~25). They are batch/queue-oriented (async jobs, schedules, webhooks, dataset search) rather than session-oriented, and most are priced per credit/record rather than per browser-hour.

### Cited Findings

**Firecrawl**
- Hosted MCP at `https://mcp.firecrawl.dev/v2/mcp` (API key) or `/v2/mcp-oauth` (browser sign-in); keyless mode exposes only `firecrawl_search`, `firecrawl_scrape`, `firecrawl_parse` — [Firecrawl MCP get-started](https://docs.firecrawl.dev/mcp-server); [Firecrawl MCP tools](https://docs.firecrawl.dev/mcp-server/tools).
- The current tool surface is large and includes: `firecrawl_scrape` (with JSON-schema/prompt extraction), `firecrawl_map`, `firecrawl_search`, `firecrawl_find_tools`, `firecrawl_parse`, `firecrawl_crawl` + `firecrawl_check_crawl_status`, `firecrawl_agent` + `firecrawl_agent_status`, `firecrawl_interact` + `firecrawl_interact_stop`, a `firecrawl_research_*` family, `firecrawl_developer_search`, `firecrawl_gov_search`, a `firecrawl_monitor_*` family (create/list/update/run/inspect/delete), plus `firecrawl_search_feedback` and `firecrawl_feedback` — [Firecrawl MCP tools](https://docs.firecrawl.dev/mcp-server/tools).
- Behaviours that matter operationally: `firecrawl_crawl` polls a crawl to a terminal state before returning; `firecrawl_agent` is asynchronous and returns a job id; `firecrawl_interact` keeps a live browser session keyed by `scrapeId` and must be stopped; `firecrawl_monitor_*` provides "recurring checks, diffs, and webhook or email notifications" — [Firecrawl MCP tools](https://docs.firecrawl.dev/mcp-server/tools).
- The former Extract MCP tool is **deprecated** and removed from the surface; structured extraction is now Scrape-with-JSON-schema or Agent — [Firecrawl MCP tools](https://docs.firecrawl.dev/mcp-server/tools).
- Pricing: Free 1,000 credits/mo (2 concurrent), Hobby $19/mo (5,000 credits, 5 concurrent), Standard $99/mo (100,000 credits, 25 concurrent), Growth $399/mo (500,000 credits, 50 concurrent) — [Firecrawl pricing](https://www.firecrawl.dev/pricing).

**Bright Data**
- "Reference for the **30** Bright Data MCP server tools"; **all 30 are enabled by default** and can be trimmed with `&groups=` / `&tools=` — [Bright Data MCP tools](https://docs.brightdata.com/products/mcp-server/tools).
- Tool groups: `all` (search_engine, scrape_as_markdown, ask_brightdata_assistant), `advanced_scraping` (`search_engine_batch` up to 5 parallel searches, `scrape_batch` up to 5 pages, `session_stats`), `scrapers` (search/get/run/progress/results/refresh for thousands of pre-built scrapers), `social`/`business` (`list_dataset_fields`, `search_dataset` over LinkedIn datasets), `browser` (12 `scraping_browser_*` tools incl. ARIA snapshot, click-ref, fill-form, screenshot, network requests, scroll-to-ref), `geo` (`chatgpt_ai_insights`, `perplexity_ai_insights`) — [Bright Data MCP tools](https://docs.brightdata.com/products/mcp-server/tools).
- Hosted remote MCP or local self-hosted; **5,000 free requests per month**; `scrape_as_markdown` has no JS rendering and times out at 45 s — [Bright Data MCP overview](https://docs.brightdata.com/ai/mcp-server/overview); [tools](https://docs.brightdata.com/products/mcp-server/tools).

**ScrapingBee**
- Hosted at `https://mcp.scrapingbee.com/mcp?api_key=YOUR_API_KEY`; **no OAuth or header auth** — the key is a query parameter — [ScrapingBee Remote MCP](https://www.scrapingbee.com/documentation/remote-mcp/).
- **17 tools**: `get_page_text`, `get_page_html`, `extract_page_data`, `get_screenshot`, `get_file`, `fast_search`, `get_google_search_results`, `ask_chatgpt`, `ask_gemini`, 5 Amazon/Walmart tools, 3 YouTube tools, `get_scrapingbee_usage` — counted from [ScrapingBee Remote MCP](https://www.scrapingbee.com/documentation/remote-mcp/).
- MCP calls bill "at exactly the same rate as the underlying API endpoint"; the hosted server enforces a **global concurrency limit shared across all customers**, returning 429 under load — [ScrapingBee Remote MCP](https://www.scrapingbee.com/documentation/remote-mcp/).

**Oxylabs**
- Two separate MCP servers: `oxylabs-web-api-mcp` (remote at `https://mcp.oxylabs.io/web-api-mcp`, Bearer key, or self-hosted) and `hb-mcp` for Agent Browser (**self-hosted only**, username/password) — [Oxylabs MCP docs](https://developers.oxylabs.io/ai-workflows/mcp).
- Web API server: **6 read-only tools** — `search`, `scrape`, `scrape_target`, `list_scrapers`, `check_scrape`, `read_scraped`; all read-only "so many clients can run them without asking for approval" — [Oxylabs MCP docs](https://developers.oxylabs.io/ai-workflows/mcp).
- Agent Browser server: ~25 tools across session lifecycle (`hb_connect`, `hb_disconnect`, `hb_session_info`, `hb_sessions_list`, `hb_session_stop`), page handler (`hb_page_status`, `hb_page_handle`, `hb_classify_page`), recordings (`hb_recordings_list`, `hb_recording_url`, `hb_recording_delete`), profiles (`hb_profiles_list`, `hb_profile_delete`), reference, and browser primitives (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_take_screenshot`, `browser_close`, "other `browser_*` tools … tabs, hovering, key presses, waiting, file upload, PDF export") — [Oxylabs MCP docs](https://developers.oxylabs.io/ai-workflows/mcp).
- Oxylabs sessions last up to 1 hour and count against a concurrent-session limit; persistent profiles and session recording are first-class features — [Oxylabs MCP docs](https://developers.oxylabs.io/ai-workflows/mcp); [Agent Browser docs](https://developers.oxylabs.io/products/agent-browser.md).

**Apify**
- Hosted at `https://mcp.apify.com` (OAuth or `Authorization: Bearer <APIFY_TOKEN>`), or local `npx @apify/actors-mcp-server`; the server exposes **Apify Actors as tools**, so the effective tool count is dynamic — [Apify MCP docs](https://docs.apify.com/mcp.md).
- Defaults load `actors` + `docs` categories plus `apify/rag-web-browser`, `apify/web-fetch`, and `report-problem`; optional categories are `runs`, `storage`, `tasks`, `schedules` — [Apify MCP docs](https://docs.apify.com/mcp.md).
- `search-actors` + `call-actor` let an agent "call any Actor by name … without needing to pre-configure it"; `call-actor` waits up to 45 s then returns run status and storage IDs, not results (results come from `get-dataset-items`) — [Apify MCP docs](https://docs.apify.com/mcp.md).
- Rate limit: **30 requests/second per user** across all operations — [Apify MCP docs](https://docs.apify.com/mcp.md).
- Agentic payments: agents can buy a prepaid, spend-capped token from Apify AGI and run limited-permission Actors without an account — [Apify MCP docs](https://docs.apify.com/mcp.md).

**Context.dev**
- Free 1,000 credits/mo (2 concurrent), Developer $20/mo (10,000 credits, 10 concurrent, $3/1k overage) — [Context.dev pricing](https://www.context.dev/pricing).

**Jina Reader**
- `r.jina.ai` is a URL-prefix reader service (prepend the URL, get Markdown) rather than a tool-based MCP server; it is best treated as a fetch backend an MCP server can wrap — [Jina Reader](https://jina.ai/reader/).

### Inferences
- Bright Data's 30 tools are the widest *static* surface in this survey; Firecrawl's is comparable once the `monitor_*` and `research_*` families are counted, and Apify's is effectively unbounded but only 7 by default.
- "Structured extraction" has consolidated into one pattern: scrape-a-URL with a JSON schema/prompt (Firecrawl, Oxylabs `json_schema`, Bright Data scrapers). Dedicated "extract" endpoints are being retired in favour of schema-on-scrape.
- Scheduled work is split between two models: **Firecrawl monitors** (diff + webhook/email, per-URL) and **Apify schedules** (cron over any Actor/task). Those are the only two clear "recurring crawl" primitives found in an MCP surface.

### Gaps
- Exact Oxylabs and Bright Data credit/per-GB prices were not captured; both vendors gate pricing behind a dashboard/quote.
- ScrapingBee's dollar tiers were not captured (only that MCP calls bill identically to API calls).
- Context.dev's tool inventory (names/count) and transport were not retrieved — only its pricing.
- Jina's pricing/token allowances were not verified.
- No independent test of extraction quality or success rate across Firecrawl / Bright Data / ScrapingBee / Oxylabs was found.

---

## 3. What search/research MCP servers exist?

### Takeaway
Search MCPs are cheap, low-tool-count (1–4 tools), and priced per request or per credit — typically **$0.005–$0.008 per call**. They are complements to a browser, not substitutes: they return ranked results or synthesized answers, with no ability to log in, click, or hold state.

### Cited Findings

**Perplexity**
- Hosted at `https://api.perplexity.ai/mcp` (Streamable HTTP), OAuth 2.1 + PKCE / DCR or `Authorization: Bearer`; local stdio via `npx @perplexity-ai/mcp-server` — [Perplexity MCP docs](https://docs.perplexity.ai/guides/mcp-server).
- **4 tools**: `perplexity_search` (Search API; `search_type: "fast"` for lower latency/cost), `perplexity_ask` (Agent API `fast` effort), `perplexity_research` (`high` effort), `perplexity_reason` (`medium` effort) — [Perplexity MCP docs](https://docs.perplexity.ai/guides/mcp-server).
- "Tool calls are billed at standard API pricing to the API key you connect with, or to the organization you chose when signing in" — [Perplexity MCP docs](https://docs.perplexity.ai/guides/mcp-server).

**Exa**
- Hosted MCP at `https://mcp.exa.ai/mcp`; Agent effort modes with default spend caps (`auto` $5, `ultra` $20) — [Exa pricing](https://exa.ai/pricing).

**Tavily**
- Hosted at `https://mcp.tavily.com/mcp/`; free 1,000 credits/mo, PAYG **$0.008/credit**, Project $30/mo for 4,000 credits — [Tavily pricing](https://www.tavily.com/pricing); [Tavily MCP docs](https://docs.tavily.com/documentation/mcp).

**Parallel**
- Hosted at `https://mcp.parallel.ai/mcp`; Personal tier free with no account; Developer PAYG with **$5 free monthly** and up to **5,000 free requests/mo**; rate limit **600/min** for Search and Extract — [Parallel pricing](https://parallel.ai/pricing); [Parallel MCP docs](https://docs.parallel.ai/integrations/mcp).

**Linkup**
- **4,000 free queries**; Fetch **$0.001–$0.006/request** (<2 s), Search **$0.005–$0.006/request** (1–3 s), Research async 1–10 min — [Linkup pricing](https://www.linkup.so/pricing).

**Brave Search**
- Search API plus an MCP server (`brave-search-mcp-server`); API pricing is **$5 per 1,000 queries** on the Base plan with a free tier — [Brave Search API](https://brave.com/search/api/); [brave-search-mcp-server](https://github.com/brave/brave-search-mcp-server).

### Inferences
- For an agent that already has a browser, a search MCP is worth adding only as a **cheap fast path**: one $0.005 SERP beats one 20-second browser session when the task is "find the URL". Steel's own cookbook recommends exactly this "prefer the cheap path, only open a session when interaction is required" pattern — [Steel cookbook: You.com search](https://docs.steel.dev/cookbook/you-com-search).
- Perplexity/Exa/Parallel "research" modes are agentic themselves (multi-step retrieval + synthesis). Composing them *inside* another agent duplicates planning loops and hides citations; they are better used as terminal answer engines.

### Gaps
- No published, independent head-to-head of answer quality/latency across Exa, Tavily, Perplexity, Parallel, Linkup, Brave was found for November 2026.
- Exact Tavily/Exa/Brave free-tier limits beyond the figures above were not confirmed against current pages.

---

## 4. Which servers expose 20+ tools or uniquely broad capabilities?

### Takeaway
**20+ static tools:** Bright Data (30), Steel (24), Anchor core (23), Oxylabs Agent Browser (~25), Firecrawl (~20–25), ScrapingBee (17, just under), Apify (dynamic, 7 by default). **Uniquely broad capabilities** cluster in four areas: batch jobs (Bright Data, Apify, Anchor batch sessions), scheduled crawls (Firecrawl monitors, Apify schedules), session replay/traces (Steel Agent Traces, Anchor recordings, Browserbase replays), and auth vaults (Anchor identities with MFA, Steel Credentials API, Notte `manage_auth`, Oxylabs persistent profiles).

### Cited Findings
- Batch: Bright Data `scrape_batch` (up to 5 pages) and `search_engine_batch` (up to 5 searches) — [Bright Data tools](https://docs.brightdata.com/products/mcp-server/tools); Apify `call-actor` with `maxItems`/`maxTotalChargeUsd` run limits — [Apify MCP](https://docs.apify.com/mcp.md); Anchor "batch sessions" — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp).
- Scheduled: Firecrawl `firecrawl_monitor_*` with "recurring checks, diffs, and webhook or email notifications" — [Firecrawl tools](https://docs.firecrawl.dev/mcp-server/tools); Apify `create-schedule`/`get-schedule`/`update-schedule`/`delete-schedule` (cron) — [Apify MCP](https://docs.apify.com/mcp.md).
- Replay/observability: Steel Agent Traces ("review recorded Steel sessions as a readable timeline synced with video, and export for debugging and replay") — [Steel docs index](https://docs.steel.dev/llms.txt); Anchor recordings + live view with takeover — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp); Browserbase "detailed session replays" — [Browserbase MCP](https://docs.browserbase.com/integrations/mcp/introduction).
- Auth vaults: Anchor identities ("Anchor signs in, handles MFA, and keeps credentials in its vault. No tool returns them"), plus `create_identity_link` / `create_reauth_link` so a human never hands over a password — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp); Steel Credentials API with `use_credentials` — [Steel MCP](https://docs.steel.dev/overview/mcp); Notte `manage_profiles` + `manage_auth` (`list`, `get`, `check`, `reauthenticate`) — [Notte MCP](https://docs.notte.cc/mcp-server).
- PDFs/screenshots: Steel `screenshot`, browser-tools `/pdf` at $5/1k — [Steel pricing](https://docs.steel.dev/overview/pricinglimits); ScrapingBee `get_screenshot`, `get_file` — [ScrapingBee](https://www.scrapingbee.com/documentation/remote-mcp/); Bright Data `scraping_browser_screenshot` — [Bright Data tools](https://docs.brightdata.com/products/mcp-server/tools).
- Extensions: Steel Extensions API / "Upload and run browser extensions" — [Steel docs index](https://docs.steel.dev/llms.txt); Airtop "Using Chrome Extensions" — [Airtop docs](https://docs.airtop.ai/guides/how-to/using-chrome-extensions.md).
- Deterministic repeat work: Anchor saved tasks + action index "run deterministic code and fall back to an AI step only where a page changed, so repeat work does not pay LLM cost" — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp); Steel `get(what:"locator")` converts a discovered element into a Commands API locator so "the same step then runs from your code, with no model in the loop" — [Steel MCP](https://docs.steel.dev/overview/mcp).
- Payments inside the browser: Browserless Agentic Checkout lets an agent complete a purchase with a single-use Stripe Link card, "without exposing payment credentials to the model" — [Browserless MCP overview](https://docs.browserless.io/mcp/overview); [agentic checkout docs](https://docs.browserless.io/mcp/agentic-checkout).
- Site audit/export breadth: Browserless exposes Lighthouse audits, HTML/PDF/full-offline-ZIP page export, file downloads, site crawling and arbitrary Puppeteer execution as MCP tools — [Browserless MCP overview](https://docs.browserless.io/mcp/overview).

### Inferences
- The genuine 20+ surfaces (Bright Data, Steel, Anchor, Oxylabs, Firecrawl) are **platform** surfaces: they expose primitives *and* account-level objects (profiles, scrapers, monitors, identities, recordings). A 20-tool in-extension MCP is a *browser-control* surface; the overlap is only the ~15 page-action primitives.
- "Deterministic replay" (Anchor action index, Steel locator export) is the most economically meaningful capability found: it converts per-run LLM cost into near-zero per-run compute for repeat workflows.

### Gaps
- No vendor publishes a capability matrix covering all of batch/schedule/replay/vault/extensions in one place; the table below is assembled from separate docs pages and may miss features that exist only in an API and are not exposed as MCP tools.
- Whether Anchor's `/v1/mcp/all` exceeds 100 tools is unstated.

---

## 5. Where can these MCPs *not* act inside a user's logged-in Chrome session?

### Takeaway
**None of them can.** Every server in this survey drives a browser in the vendor's cloud, in an isolated VM/session, with its own IP and its own cookie jar. They can *reconstruct* a logged-in state (upload a profile, store credentials, complete an MFA challenge), but they cannot inherit the user's live Chrome — so passkeys/WebAuthn hardware, device-bound sessions, corporate device posture, local password-manager autofill, installed extensions, intranet/VPN-only hosts, `file://` access and existing SSO cookies are all out of reach. That is the structural gap an in-extension browser MCP fills.

### Cited Findings
- Cloud sessions are explicitly separate machines: Anchor "Each session is an isolated VM destroyed when it ends" — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp); Steel sessions behave like "a fresh incognito window, but running in our cloud" — [Steel Sessions API](https://docs.steel.dev/overview/sessions-api/overview).
- Persistent auth is achieved by **copying state into the cloud**, not by attaching to the user's browser: Steel Profiles ("Reuse browser context, auth, cookies, extensions, credentials, and browser settings across sessions") — [Steel docs index](https://docs.steel.dev/llms.txt); Browserbase `--contextId` / `--persist` — [Browserbase README](https://github.com/browserbase/mcp-server-browserbase); Notte `manage_profiles` + `persist_profile` — [Notte MCP](https://docs.notte.cc/mcp-server).
- Credentials are vaulted server-side: "Anchor signs in, handles MFA, and keeps credentials in its vault. No tool returns them" — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp); Steel's "Programmatic access to storing credentials for users or agents" — [Steel docs index](https://docs.steel.dev/llms.txt).
- Human involvement is modelled as a **handoff link / live view**, not as using the user's own browser: Anchor `create_identity_link` / `create_reauth_link`, "a live view the user can watch or take over" — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp); Steel "How to let users take control of Steel browser sessions" — [Steel docs index](https://docs.steel.dev/llms.txt); Browserbase session replays for debugging — [Browserbase MCP](https://docs.browserbase.com/integrations/mcp/introduction).
- Distribution is a hosted HTTP endpoint or a local stdio process — never a browser extension: Browserbase `https://mcp.browserbase.com/mcp`, Steel `https://mcp.steel.dev/mcp`, Anchor `https://api.anchorbrowser.io/v1/mcp`, Notte `https://api.notte.cc/mcp`, ScrapingBee `https://mcp.scrapingbee.com/mcp`, Apify `https://mcp.apify.com`, Perplexity `https://api.perplexity.ai/mcp` — [Browserbase](https://docs.browserbase.com/integrations/mcp/introduction), [Steel](https://docs.steel.dev/overview/mcp), [Anchor](https://docs.anchorbrowser.io/advanced/mcp), [Notte](https://docs.notte.cc/mcp-server), [ScrapingBee](https://www.scrapingbee.com/documentation/remote-mcp/), [Apify](https://docs.apify.com/mcp.md), [Perplexity](https://docs.perplexity.ai/guides/mcp-server).
- The closest thing to "your environment" is extension upload into the cloud browser (Steel Extensions API, Airtop Chrome extensions) — still a cloud session, not the user's profile — [Steel docs index](https://docs.steel.dev/llms.txt); [Airtop docs](https://docs.airtop.ai/guides/how-to/using-chrome-extensions.md).

### Inferences
- Tasks blocked for every hosted MCP: anything behind a hardware passkey or device certificate; anything requiring a corporate-managed browser profile; anything on a VPN-only/intranet host; anything needing the user's locally installed extension (wallet, password manager, internal toolbar); anything needing the user's real cookies without re-auth.
- Uploading a full Chrome profile partially bridges the cookie gap, but is a **credential-exfiltration-shaped operation** and often breaks on device-bound refresh tokens — none of the vendors advertises passkey support.
- Even the "live view / takeover" flows are remote-desktop-style: the human drives the *cloud* browser, so the human's own session and history are still not used.

### Gaps
- No vendor documents passkey/WebAuthn support or device-posture attestation; absence of documentation is not proof of absence, but no positive claim was found either.
- No published measurement of how often profile/context reuse actually survives re-authentication on sites with device binding (banks, Google, Microsoft).

---

## 6. What published latency/cost comparisons exist between hosted browser MCPs and local Playwright/CDP?

### Takeaway
There is exactly one detailed, numbers-first public benchmark found, and it is **unfavourable to cloud browsers on latency and favourable on concurrency**: Browserbase added **+161% workflow time** vs local Playwright (25.0 s vs 9.57 s), but sustained 25 concurrent sessions at 84% success where a single-IP Playwright VM collapsed to **0% at 10 workers**. Steel self-hosted sat in between (12.83 s avg). Cost of browser time was negligible (~$0.001/workflow).

### Cited Findings
- **Browserbase Benchmark Report, dated 2026-04-06**, measured on an Azure 16 vCPU / 62 GiB VM against a 7-step healthcare RPA workflow (login → TOTP MFA → terms → NPI → patient search → prior auth → confirmation), with error injection enabled — [BROWSERBASE_BENCHMARK_REPORT.md](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
  - Sequential latency: local Playwright **9.57 s avg** vs Browserbase **25.00 s avg** = **+161.2%**; p95 18.76 s vs 32.96 s (**+75.7%**); success 10/10 vs 5/10. The author attributes the failures to a 6 s navigation timeout that is too tight for cloud CDP, not to Browserbase — [report §3](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
  - Per-step overhead ranged **+78% (terms)** to **+733% (MFA, 0.772 s → 6.436 s)**, with login 0.506 s → 2.403 s (**+375%**) and patient search 0.809 s → 3.759 s (**+365%**) — [report §3](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
  - Startup: session create **0.366 s** + CDP connect **1.057 s** = **1.42 s** (6% of workflow) — "much faster than Steel's 3.5s create + 3.1s release" — [report §1/§3](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
  - Concurrency: session create stayed 0.42 s → 0.73 s from 3 to 25 parallel sessions; wall time 33.6 s (3) → 35.1 s (10) → 69.2 s (25); success 100% / 90% / 84%; measured throughput 5.4 / 15.4 / 18.2 workflows per minute — [report §4](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
  - Stress test: raw Playwright on one VM IP went from 80% at 5 workers to **0% (0/30) at 10 workers** while using 35 MB RAM and 0.3% CPU — the constraint was target-site rate limiting, not the VM; Browserbase's distributed IPs kept 84% at 25 sessions — [report §7](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
  - Cost: "~0.5 min browser time per workflow = ~0.001$/workflow. 100 browser-hours supports ~12,000 workflows/month" on the $20 Developer plan — [report §1](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
  - Session reuse: login once + 10 patient lookups — local 33.4 s total (3.12 s/patient) vs Browserbase 182.6 s (18.52 s/patient), **+447%**, but reuse saved 41% vs fresh-login-per-item on Browserbase — [report §5](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
- Head-to-head table in the same report: single workflow avg — local Playwright **7.36–9.57 s**, Steel self-hosted **12.83 s**, Browserbase **25.00 s**; p95 9.99–18.76 s / 24.75 s / 32.96 s; success 100% / 80–90% / 50% — [report §6](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
- Vendor-side performance claims exist but are benchmark *scores*, not latency: Steel runs a public leaderboard aggregating "370 sourced results across 14 AI agent benchmarks" (WebVoyager, WebArena, OSWorld, BrowseComp, …) — [Steel leaderboard results](https://leaderboard.steel.dev/results); [source repo](https://github.com/steel-dev/leaderboard). No browser-vs-local latency numbers are published there.

### Inferences
- The honest summary is **~2–3× slower per action in the cloud, but ~2.5–5× more parallel throughput per unit of ops effort**, and vastly better survival against rate-limited targets because IPs are distributed.
- The +161% figure is a *round-trip* penalty: every CDP command crosses the public internet, so chatty workflows (many small DOM reads) suffer most, while few-large-action workflows (one navigate, one scrape) suffer least. A `scrape`-style tool call therefore hides cloud latency far better than a 24-primitive click/type loop.
- At ~$0.001–$0.005 of browser time per task, the cost argument for or against cloud browsers is decided by **retries and LLM tokens**, not by browser-hour pricing. A cloud run that fails twice costs more in tokens than in compute.

### Gaps
- The benchmark is a **single-workflow, n=10, single-author GitHub report** (not peer-reviewed, not vendor-run), dated April 2026 — seven months before this note. It is directionally useful, not authoritative.
- No benchmark comparing **hosted MCP tool calls** (as opposed to raw CDP from Playwright) against local MCP tool calls was found — i.e. nobody has measured the extra token/serialization overhead of returning accessibility trees over MCP.
- No independent benchmark exists for Hyperbrowser, Anchor, Notte, Kernel, Browserless, Oxylabs or Bright Data latency; their performance claims are unverified.
- No cost-per-successful-task comparison (including retries and LLM tokens) was found for any vendor.

---

## 7. Bottom line vs a 20-tool in-extension browser MCP

### Takeaway
Nothing in this survey covers *more kinds* of web tasks than an in-extension browser MCP; several cover *more tasks per hour* on the public, unauthenticated web. The trade is structural: hosted MCPs buy parallelism, IP diversity, replay and scheduled batch work by giving up the user's real session — which is precisely the capability an extension has and they cannot replicate.

### Cited Findings
- Hosted browser MCPs are uniformly slower per action (2–3×) but far more concurrent: 25–100+ sessions on paid plans (Browserbase Startup 100 — [pricing](https://www.browserbase.com/pricing); Notte Startup 100 — [pricing](https://www.notte.cc/pricing); Steel 1,000+ — [pricing](https://docs.steel.dev/overview/pricinglimits); Anchor "no concurrency limit" — [MCP docs](https://docs.anchorbrowser.io/advanced/mcp)).
- The concurrency advantage is really an **IP-diversity** advantage: 10 parallel browsers from one IP hit 0% success in the only measured stress test — [benchmark §7](https://github.com/wryonik/rpa-playwright-experiments/blob/main/BROWSERBASE_BENCHMARK_REPORT.md).
- Batch/schedule primitives are absent from every browser-control MCP and present only in scraping platforms: Bright Data batches of 5 — [tools](https://docs.brightdata.com/products/mcp-server/tools); Firecrawl monitors with webhooks/email — [tools](https://docs.firecrawl.dev/mcp-server/tools); Apify cron schedules — [Apify MCP](https://docs.apify.com/mcp.md).
- Auth vaults substitute for, rather than provide, a logged-in browser: Anchor identities + MFA + reauth links — [Anchor MCP](https://docs.anchorbrowser.io/advanced/mcp); Steel Credentials API — [Steel MCP](https://docs.steel.dev/overview/mcp).
- Cheap search is a better first hop than a browser session for navigation-only tasks: Linkup $0.005–$0.006/search — [Linkup pricing](https://www.linkup.so/pricing); Tavily $0.008/credit — [Tavily pricing](https://www.tavily.com/pricing); Brave $5/1k queries — [Brave API](https://brave.com/search/api/).

### Inferences
- The rational architecture is **layered, not either/or**: search MCP (cheap URL discovery) → in-extension browser MCP (authenticated, latency-sensitive, user-context work) → hosted scraping platform (bulk unauthenticated extraction, schedules, IP diversity).
- A hosted browser MCP would only "cover more web tasks" for a team whose work is mostly logged-out, high-volume, and tolerant of 2–3× latency. For anything involving the user's own accounts, the extension is not just faster — it is the only option.
- The most defensible differentiators for an in-extension MCP are therefore: real session/SSO reuse, passkey/device-bound support, zero per-hour infrastructure cost, and per-action latency — not tool count.

### Gaps
- No head-to-head task-coverage study (same task suite, cloud MCP vs extension MCP) exists; all comparisons here are inferred from capability docs plus one latency benchmark.
- Whether any vendor's "profile import" survives modern device-bound auth (Google, Microsoft, banks) is undocumented by all vendors surveyed.
