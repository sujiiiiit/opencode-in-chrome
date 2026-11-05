# Explore `D:/opencode` — 4-Phase Todo List

> Target: the OpenCode monorepo at `D:/opencode` (v2.2.5, Bun + Turborepo workspaces).
> Note: you described 3 phases; **Phase 4 is proposed** as synthesis/reporting. Swap it for another exploration phase if you prefer.

---

## Phase 1 — Local codebase (A): explore `D:/opencode`

Goal: understand what the repo is, how it is organized, and how the pieces fit together.

- [ ] Read the entry docs: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- [ ] Map the monorepo: workspaces in root `package.json` (`packages/*`, `packages/plugins/*`, `packages/console/*`, `packages/stats/*`, `services/*`)
- [ ] Classify the packages by role:
  - [ ] Runtime/core: `packages/core`, `packages/server`, `packages/protocol`, `packages/session-ui`
  - [ ] Clients: `packages/cli`, `packages/tui`, `packages/app`, `packages/desktop`
  - [ ] Shared: `packages/ui`, `packages/theme`, `packages/util`, `packages/sdk`, `packages/client`, `packages/plugin`
  - [ ] Services: `packages/web`, `packages/console`, `packages/stats`, `services/*`
  - [ ] Experimental: `packages/ai`, `packages/codemode`, `packages/merman`, `packages/simulation`, etc.
- [ ] Trace one request end-to-end: CLI/TUI → server → session → provider/model → streaming output
- [ ] Understand the plugin, agent, tool, and MCP extension points
- [ ] Identify build tooling: Bun 1.4.4, Turbo, oxlint, ast-grep, Playwright, Drizzle
- [ ] Note dev commands: `bun install`, `bun run dev`, `bun run dev:desktop`, `bun run typecheck`
- [ ] Start the CLI locally and capture first-run behavior (config, auth, providers)

**Deliverable:** package map + architecture notes (core runtime, clients, services) + open questions.

---

## Phase 2 — Web surfaces (B): explore "the web part"

Goal: separate and understand every browser-facing surface, not just one folder.

- [ ] `packages/web` — Astro + Starlight site (docs/content, lander, i18n)
  - [ ] Inspect `src/content/docs`, `src/pages/[...slug].md.ts`, `src/components`, `src/i18n`, `astro.config.mjs`
  - [ ] Run it: `bun --cwd packages/web dev`
  - [ ] Note how docs are generated/exported (Markdown route, llms.txt-style output, search)
- [ ] `packages/app` — the SolidJS + Vite web app / PWA
  - [ ] Inspect `src/`, `manifest.json`, `vite.pwa.ts`, `playwright.config.ts`
  - [ ] Run it: `bun run dev:web`
  - [ ] Map routes, state, and how it talks to the server (`packages/client`, `packages/sdk`)
- [ ] `packages/console` — cloud/dashboard app (`app/` + `resource/`)
  - [ ] Run it: `bun run dev:console`
  - [ ] Identify auth, billing, and resource-management flows
- [ ] `services/www` — marketing/www service (`bun run dev:www`)
- [ ] Shared web UI: `packages/ui`, `packages/session-ui`, `packages/theme`, `packages/stories`
- [ ] `packages/desktop` — how the desktop shell reuses the web app
- [ ] Document: which surface owns which URL, data source, and deployment target

**Deliverable:** web-surface map (site, app, console, www, desktop) + route/data-flow diagrams + run instructions.

---

## Phase 3 — Internet research (C): learn more from external resources

Goal: complement the source reading with official and community knowledge, then reconcile it with the code.

- [ ] Official docs: <https://opencode.ai/docs> (getting started, agents, tools, MCP, providers, config)
- [ ] GitHub: <https://github.com/anomalyco/opencode> — README, releases, issues, discussions, roadmap
- [ ] Changelog and release notes (cross-check against local `v2.2.5`)
- [ ] npm: `@opencode/cli`, `@opencode/sdk`, related packages
- [ ] Community: Discord, blog posts, YouTube walkthroughs, HN/Reddit threads
- [ ] Comparisons: Claude Code, Cursor, Aider, Codex CLI — where OpenCode differs
- [ ] Collect sources in a bibliography with dates and versions
- [ ] Flag anything the docs claim that the local source contradicts (or vice versa)

**Deliverable:** annotated source list + external-knowledge notes + doc-vs-code discrepancy list.

---

## Phase 4 — Synthesize and report (D) *(proposed)*

Goal: turn the three explorations into one reusable reference.

- [ ] Merge Phase 1–3 notes into a single report: `OPENCODE-EXPLORATION-REPORT.md`
- [ ] One architecture diagram (packages, runtime boundaries, data flow)
- [ ] One web-surface matrix (site / app / console / www / desktop)
- [ ] Key takeaways: design patterns worth reusing, risks, and surprising findings
- [ ] Open questions and a prioritized deep-dive backlog
- [ ] Relate findings to `D:/opencode-in-chrome` (what applies to this workspace)
- [ ] Review the report with the user and pick the next deep dive

**Deliverable:** final report + prioritized backlog.

---

## Progress

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 1 — Local codebase | ☐ Not started | |
| 2 — Web surfaces | ☐ Not started | |
| 3 — Internet research | ☐ Not started | |
| 4 — Synthesis | ☐ Not started | Proposed phase |
