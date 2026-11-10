# OpenCode in Chrome

A Chrome extension that lets an AI agent use the browser for you.

You open a chat panel next to any tab, describe a task ("open my GitHub PRs and list the failing checks", "fill this form from my notes"), and the [OpenCode](https://opencode.ai) agent does it **in your own Chrome**, with your existing sign-ins. You watch every step as it happens. The agent asks before anything risky, and it never types passwords, card numbers or one-time codes.

The same browser tools are also served as an **MCP server**, so Claude Code, Cursor, Codex or any other MCP client can drive the browser under the same safety rules.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Setup](#setup)
  - [1. Install and build](#1-install-and-build)
  - [2. Load the extension in Chrome](#2-load-the-extension-in-chrome)
  - [3. Connect to an OpenCode server](#3-connect-to-an-opencode-server)
  - [4. Turn on browser access](#4-turn-on-browser-access)
  - [5. Optional: use the browser from Claude Code, Cursor, Codex (MCP)](#5-optional-use-the-browser-from-claude-code-cursor-codex-mcp)
  - [6. Optional: Firefox](#6-optional-firefox)
  - [Uninstall](#uninstall)
- [Using it](#using-it)
- [Browser tools](#browser-tools)
- [Safety model](#safety-model)
- [Development](#development)
- [Environment variables](#environment-variables)
- [Where data is stored](#where-data-is-stored)
- [Troubleshooting](#troubleshooting)
- [Project layout](#project-layout)

---

## Features

**Chat panel**
- Side-panel chat with the OpenCode agent, opened per tab from the toolbar icon.
- Streaming replies with Markdown, code blocks, images (single, mosaic gallery, viewer) and collapsible "thinking" and tool rows.
- Live steps: every browser action the agent takes shows up in the chat as it happens.
- Image attachments by `+` menu, drag and drop, or paste.
- `@` and `/` mention menus with chips in the prompt box.
- Model picker with provider logos. Models and web search are configured in Settings.
- Chat history, subagent rows and background subagents.
- `/goal`: the agent keeps working across turns until a reviewer finds the goal met. Each round shows as its own turn.
- `/compact` and a context-window meter, so you can see how full the context is and shrink it.
- Permission mode: **Manual** (ask before consequential steps) or **Auto**.

**Browser agent**
- 37 tools: reading pages, clicking, typing, forms, tabs, waits, data extraction, downloads, console and network capture, screenshots and GIF recording. See [Browser tools](#browser-tools).
- Real mouse and keyboard input through the Chrome DevTools Protocol (`chrome.debugger`), which works on sites that ignore scripted events, including cross-origin iframes.
- Pages are read as a compact outline with element refs (`e12`). After each action the agent gets only the lines that changed.
- The agent works in its own tab group and only touches tabs from its session or tabs you share with it.

**MCP server**
- `node mcp/server.mjs` is a stdio MCP server for any MCP client.
- It reaches the extension through a native messaging host. Several browsers can be connected at once (your own Chrome and a separate agent browser), and the agent picks one with `select_browser`.

---

## How it works

```
                        ┌───────────────────────────── Chrome ─────────────────────────────┐
                        │                                                                   │
 opencode serve  ◄──────┼── side panel (React)  ── chat over HTTP + SSE (/api/event)        │
 (127.0.0.1)            │                                                                   │
      ▲                 │   background service worker                                      │
      │ client-MCP      │   ├─ tool bridge  ── WebSocket, tools/list + tools/call ──────────┼──► opencode
      │ (WebSocket)     │   ├─ safety layer (site gate, tiers, approvals, guards)           │
      └─────────────────┼── ├─ browser tools ── chrome.debugger (CDP), scripting, tabs       │
                        │   └─ native bridge  ── chrome.runtime.connectNative ─────┐        │
                        │                                                           │        │
                        │   snapshot.js, injected into every frame of agent tabs    │        │
                        └───────────────────────────────────────────────────────────┼────────┘
                                                                                    │ native messaging
                                                     mcp/host.mjs (started by Chrome)
                                                                                    │ per-user pipe + token
                                       mcp/server.mjs (stdio MCP) ◄── Claude Code / Cursor / Codex
```

1. **Pairing.** You run `opencode pair` and open its link in Chrome. The extension picks up the session the OpenCode web UI sets (or you paste the link), checks the token against `/api/info`, and stores it in `storage.local`. Only loopback servers (`127.0.0.1`, `localhost`) are accepted.
2. **Chat.** The side panel talks to the server over HTTP and a custom SSE reader. It uses `fetch` rather than `EventSource` so it can send the `Authorization` header, and it handles split and oversized frames.
3. **Tools to OpenCode.** With browser access on, the service worker opens a **client-MCP** connection to the paired server over WebSocket. OpenCode is the MCP client, and the extension answers `tools/list` and `tools/call`. Tickets are single-use, so the extension reconnects itself with backoff from 500 ms to 10 s. An alarm wakes the worker if Chrome stopped it while idle.
4. **Tools to other agents.** Chrome starts `mcp/host.mjs` when the extension connects. The host opens a pipe private to your user (a named pipe on Windows, a unix socket elsewhere) and registers itself with a random token. Each `mcp/server.mjs` process picks a browser, proves it knows the token (compared in constant time), and its requests are relayed to the extension.
5. **Every call passes the safety layer** in the extension, whichever path it came from. See [Safety model](#safety-model).

---

## Requirements

| What | Version | Why |
|---|---|---|
| Chrome (or Edge, Brave, Chromium) | **125+** | Flat CDP child sessions for cross-origin iframes (`minimum_chrome_version`) |
| Node.js | 20+ (developed on 22) | Build, MCP server, native host |
| pnpm | 9+ (developed on 12) | Package manager (`pnpm-lock.yaml`) |
| OpenCode | **2.2.5+** | Client-MCP, pairing and the session APIs the extension uses |

Firefox can build the chat panel, but **the browser agent and the MCP bridge need a Chromium browser** (they use `chrome.debugger`, `sidePanel` and native messaging).

The extension ID is pinned by a public key in the manifest (`mcp/extension-key.mjs`), so every build on every machine has the same ID:

```
ojondpikmcfbfknohcndbolkcnheddle
```

---

## Setup

### 1. Install and build

```sh
git clone https://github.com/sujiiiiit/opencode-in-chrome.git
cd opencode-in-chrome
pnpm install          # also runs `wxt prepare` (postinstall)
pnpm build            # production build -> .output/chrome-mv3
```

### 2. Load the extension in Chrome

Pick one way:

**A. Development browser (for working on the extension)**

```sh
pnpm dev
```

WXT opens a dedicated Chrome with the extension loaded and hot reload on. It uses a persistent profile at `.wxt/chrome-profile` (gitignored), so tabs, sign-ins, pairing and extension storage survive restarts. It exposes the DevTools Protocol on `http://127.0.0.1:9222`. See [Shared development browser](#shared-development-browser).

**B. Your everyday Chrome**

1. Run `pnpm build`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick `.output/chrome-mv3`.
4. Pin **Opencode** in the toolbar. Clicking it opens the side panel for the current tab.

After a rebuild, click the reload icon on the extension card.

**C. A separate agent browser**, which `pnpm build:setup` does for you. See [step 5](#5-optional-use-the-browser-from-claude-code-cursor-codex-mcp).

### 3. Connect to an OpenCode server

Start a local server that allows the extension's origin. `--cors` is required: the client-MCP ticket request comes from `chrome-extension://…`.

```sh
opencode serve --cors chrome-extension://ojondpikmcfbfknohcndbolkcnheddle
```

`opencode service start` has no CORS option, so use `opencode serve`. Keep it running while you use the extension.

Then pair:

```sh
opencode pair --url http://127.0.0.1:<port printed by serve>
```

Open the printed link **in the same Chrome that has the extension**. Then open the side panel: the extension finds the web UI's session on its own. If it can't, paste the pairing link into the panel's pair screen.

In the development browser, you can pair without clicking. The link is read from stdin, so it never appears in process arguments:

```sh
opencode pair --url http://127.0.0.1:<port> | node scripts/dev-cdp.mjs pair
```

### 4. Turn on browser access

Open **Settings** (the gear in the side panel) and then **Browser**, and turn on **Let chats use the browser**. The tool bridge connects, and the OpenCode models in that workspace can now call the browser tools.

In the same Settings page:
- **Browser → Sites:** a rule per site, **Allow**, **Ask** (the default) or **Block**, plus an optional *sensitive* flag. Answering "always" to a site prompt saves it as Allow.
- **Permissions:** OpenCode permission mode, **Manual** (asks before consequential actions) or **Auto**.
- **Models:** which models appear in the picker.
- **Web search:** which provider the agent uses (**Server default** or **Any available**).

### 5. Optional: use the browser from Claude Code, Cursor, Codex (MCP)

One command does everything:

```sh
pnpm build:setup
```

It:
1. builds the production extension (skip with `--no-build`),
2. copies `mcp/` into the per-user state folder and registers the native host `com.opencode.browser` for Chrome, Edge, Chromium and Brave (HKCU registry keys on Windows, `NativeMessagingHosts` folders on macOS and Linux),
3. adds that copy of the MCP server to **Claude Code** and **OpenCode** (global config, edited with `jsonc-parser` so your comments and other settings are kept),
4. starts a dedicated **agent browser** (its own profile, runs in the background) with the extension loaded, waits until it connects, and prints how many tools it serves.

| Flag | Effect |
|---|---|
| `--no-build` | Skip step 1 |
| `--my-chrome` (alias `--manual`) | Use **your own** Chrome profile instead of the agent browser. Load the printed folder once with **Load unpacked** |
| `--headless` | Agent browser without a window. Approvals then need **Auto** mode, since there is no popup to click |
| `--chrome <path>` | Another Chromium-based browser (or set `CHROME_PATH`) |
| `--no-open` | Don't start a browser |
| `--uninstall` | Undo steps 2 and 3 |

The server is added to Claude Code with `--scope user`, so it's available in every project.

**Agent browser vs your own Chrome.** Both can be connected at once. The MCP server prefers your own profile when it's connected. The agent can switch with `select_browser` (`own`, `agent`, or an id), or you can pin one with `OPENCODE_BROWSER=agent|own` in the MCP server's environment. In your own Chrome the extension asks before acting on a site. MCP clients only see the **site** of your other tabs, never their titles or paths. A client's tabs are closed 5 minutes after it disconnects (tabs you shared are only released).

The agent browser on its own:

```sh
pnpm mcp:browser              # open it (sign in to the sites you want it to use)
pnpm mcp:browser --restart    # close and reopen, to load a rebuilt extension
pnpm mcp:browser --headless   # no window
```

Chrome 137+ ignores `--load-extension`, so the script loads the extension the way Puppeteer and Playwright do: it starts Chrome with a debugging port on `127.0.0.1` and calls `Extensions.loadUnpacked`.

**Doing it by hand.** Register only the native host:

```sh
pnpm mcp:install                          # the pinned id is registered automatically
pnpm mcp:install --extension-id <id>      # add another id (e.g. a store build)
```

Then add the server to your client:

```sh
# Claude Code
claude mcp add --scope user opencode-in-chrome -- node "<state folder>/runtime/server.mjs"

# OpenCode
opencode mcp add opencode-in-chrome --global -- node "<state folder>/runtime/server.mjs"
```

Any other MCP client: run `node <state folder>/runtime/server.mjs` as a **stdio** server.

> **Run `pnpm mcp:install` (or `pnpm build:setup`) again after changing anything in `mcp/`.** Chrome and the MCP clients run the copy in the state folder, not your checkout. That way, moving the repo or switching Node versions (nvm, fnm, volta) doesn't break them.

Check that it works:

```sh
claude mcp list        # opencode-in-chrome: Connected
opencode mcp list      # ✓ opencode-in-chrome connected
```

Keep Chrome open with the extension enabled, or tools fail with `The Opencode extension is not connected`.

Hand-written config files for both clients (`opencode.jsonc` and `.mcp.json`), plus setup for the `code-review-graph` MCP used while developing, are in [`setup.md`](setup.md).

### 6. Optional: Firefox

```sh
pnpm dev:firefox       # or: pnpm build:firefox / pnpm zip:firefox  (MV2)
```

This gives you the chat panel as a Firefox sidebar. Browser tools and MCP are Chromium-only.

### Uninstall

```sh
pnpm build:setup --uninstall      # removes the native host registration and the MCP client entries
```

Then remove the extension from `chrome://extensions`. The state folder (see [Where data is stored](#where-data-is-stored)) can be deleted by hand.

---

## Using it

1. Click the **Opencode** toolbar icon on any tab. The side panel opens for that tab, and the tab joins the chat.
2. Type a task. Use `@` to mention things and `/` for commands.
3. Watch the steps in the chat. When the agent needs you, it shows a form in the chat: approve or deny an action, answer a question, or take over for a sign-in or CAPTCHA.
4. The agent finishes with `done` and a summary of what was and wasn't done.

| Command | What it does |
|---|---|
| `/goal <objective>` | Keeps the agent working across turns until a reviewer finds the goal met. Shown in a goal tray above the prompt box |
| `/compact` | Summarizes the conversation so far to free up context (shown as a row in the chat) |

Approvals for chat sessions are forms in the chat. MCP sessions have no chat, so approvals for them open a small **approval window**. Closing it denies. Unanswered approvals time out after 5 minutes.

---

## Browser tools

The tools are defined once in `lib/browser/tools/` and served to both OpenCode and MCP clients.

| Group | Tools |
|---|---|
| Read the page | `read_page` (outline with refs), `find` (an element by description), `get_page_text`, `extract` (a table or list as CSV/JSON) |
| Act | `computer` (click, double/right click, drag, type, key, scroll, hover, wait, screenshot, zoom, dialogs), `form_input`, `file_upload`, `upload_image`, `javascript` |
| Navigate and wait | `navigate`, `wait_for` (text, text gone, or idle) |
| Tabs | `tabs_context`, `tabs_create`, `tabs_close`, `tabs_switch`, `tabs_share`, `tabs_reload`, `tabs_duplicate`, `tabs_move`, `tabs_highlight`, `tabs_discard`, `tabs_zoom`, `tabs_language`, `tabs_set_state`, `tabs_split`, `tabs_unsplit`, `tabs_capture`, `tab_group`, `resize_window` |
| Debug | `console`, `network` (with capture start/stop and response bodies) |
| Files and media | `downloads`, `gif` (records the run in the service worker and saves it through `chrome.downloads`) |
| Control flow | `batch` (several calls in one round trip), `ask_user` (a question or a takeover), `done` |
| Browsers (MCP) | `list_connected_browsers`, `select_browser` |

**How pages are read.** `snapshot.js` is injected into every frame of an agent tab. The service worker walks the frames, stitches child frames under their iframe lines, and gives each element a ref that's unique for the tab and never reused. A ref remembers the document it came from, so after a navigation it fails as `STALE_REF` instead of hitting an element on the new page. After an action, the result is a line diff of the outline (`+` added, `-` removed), so the model doesn't re-read the whole page.

**Guidance.** Every session that uses the tools gets a short browsing guide as a per-session instruction (`lib/browser/guidance.ts`). A short form is also carried in the `tabs_context` description, for servers that can't take the instruction.

---

## Safety model

The rules live in the extension (`lib/browser/policy.ts`, `lib/browser/safety.ts`), so they apply to every caller: OpenCode, Claude Code, or anything else over MCP.

| Check | What it does |
|---|---|
| **Kill switch** | The `opencode.browser.stop` runtime message stops all browser activity, releases the debugger and denies every pending approval. It's stored, so it holds across service worker restarts. There's no button for it in the UI yet |
| **Site gate** | Every call that touches a page checks the site against your per-site rules, and asks the first time when needed |
| **Risk tiers** | Each state-changing call is classified as `read`, `navigate`, `mutate`, `consequential` or `handoff` |
| **Hand-off** | Passwords, one-time codes, card numbers, CAPTCHAs and sign-in consent screens are **never** done by the agent. It must ask you to do them |
| **Consequential approval** | Send, pay, buy, delete, post, submit, sign up, merge, deploy and similar actions (and Enter inside a form, `javascript`, uploads) need approval in Manual mode |
| **Sensitive sites** | After reading a site you marked *sensitive*, navigating or acting on another site needs approval, to stop data being carried off |
| **Loop guard** | Stops a session that keeps repeating a failing call |
| **No-effect guard** | Flags clicks and typing that changed nothing, so the agent tries something else instead of repeating |
| **Bot checks** | A "Just a moment…" or "unusual traffic" page is reported as a bot check, not read as the page the agent asked for |
| **Session scope** | MCP sessions are always `mcp-…`, so they can never act as, or in the tabs of, an OpenCode chat session |

---

## Development

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev build with hot reload in the shared development browser |
| `pnpm dev:cdp` | Inspect and drive that browser over CDP (see below) |
| `pnpm build` / `pnpm zip` | Production build / zip for Chrome (MV3) |
| `pnpm dev:firefox` / `build:firefox` / `zip:firefox` | Firefox (MV2) |
| `pnpm compile` | Type check (`tsc --noEmit`) |
| `pnpm test` | Unit and integration tests (Vitest, happy-dom) |
| `pnpm e2e` | Build, then Playwright E2E against a fake OpenCode server |
| `pnpm test:live` | Live tests against a real `opencode serve` |
| `pnpm check` / `check:changes` / `check:dupes` | fallow: dead code, duplicates, complexity / audit of your changes / duplicates only |
| `pnpm mcp` | Run the MCP server from the checkout |
| `pnpm mcp:install` | Register the native host |
| `pnpm mcp:browser` | Start the agent browser |
| `pnpm build:setup` | Full setup (build + host + MCP clients + agent browser) |
| `pnpm import:doodles` | Regenerate `components/ui/doodle-paths.ts` from an SVG sheet |

### Shared development browser

`pnpm dev` keeps one Chrome running with the extension and the DevTools Protocol on port `9222` (WXT's own dev server uses port 3000). You use the window normally, while an automation agent connects to `9222` to inspect and drive extension pages. Closing `pnpm dev` closes the browser, but the profile in `.wxt/chrome-profile` keeps everything.

```sh
node scripts/dev-cdp.mjs status            # list open page targets (title, URL, id)
node scripts/dev-cdp.mjs ensure            # use the running browser, or start `pnpm dev` in the background and wait up to 60 s
node scripts/dev-cdp.mjs inspect           # print the side panel's title, URL and visible text
node scripts/dev-cdp.mjs screenshot [path] # screenshot the side panel (default .wxt/sidepanel.png)
opencode pair --url <url> | node scripts/dev-cdp.mjs pair   # paste the link into the pair screen and connect
```

`inspect`, `screenshot` and `pair` need the side panel open in that browser.

Another port for one run:

```powershell
$env:WXT_CDP_PORT = '9333'; pnpm dev      # PowerShell
```
```sh
WXT_CDP_PORT=9333 pnpm dev                # bash/zsh
```

Only one process can listen on the port at a time. The profile path must be absolute (it's set in `wxt.config.ts`). Otherwise Chrome on Windows falls back to your default profile and the launch fails with *"CDP connection closed before response"*.

### Tests

| Suite | Where | Runs against |
|---|---|---|
| Unit and integration (Vitest, ~1,170 tests) | `tests/` | `happy-dom`, a fake Chrome API (`tests/support/fake-chrome.ts`) and a fake OpenCode server (`tests/support/fake-opencode.ts`) |
| E2E (Playwright, 16 specs) | `e2e/` | The built extension in Chromium, with a fake OpenCode server. Run `pnpm e2e`, or `pnpm build` first |
| Live | `tests/live/`, `@live` Playwright specs | A real `opencode serve` with the `kilo/kilo-auto/free` model. Run `pnpm test:live` (sets `OPENCODE_LIVE=1`) |

```sh
pnpm test                       # all Vitest tests
pnpm exec vitest run tests/lib/browser      # one folder
pnpm e2e                        # build + Playwright
pnpm exec playwright test e2e/safety.spec.ts   # one spec (after pnpm build)
```

### Code quality

```sh
pnpm compile                                      # types
pnpm exec fallow audit --format json --quiet      # must report "verdict":"pass" before a change is done
pnpm exec fallow dupes --format json --quiet      # check for existing code before writing a helper
```

Config lives in `.fallowrc.json`. WXT auto-import folders (`components/`, `hooks/`, `utils/`, …) are marked as entries, so check usages yourself before deleting anything there.

### Conventions

- **UI:** shadcn/ui on **Base UI** (`@base-ui/react`, style `base-luma`), not Radix. Use `render` instead of `asChild`. See `CLAUDE.md` for the Base UI rules.
- **Colours:** only through tokens in the global CSS. No raw colours in components.
- **Specs:** larger changes go through OpenSpec (`openspec/`). Module comments refer to specs and design decisions such as `spec browser/action-safety, design D9`.
- **Agents:** `AGENTS.md` / `CLAUDE.md` describe the code-review-graph and fallow workflows for coding agents.

---

## Environment variables

| Variable | Used by | Effect |
|---|---|---|
| `WXT_CDP_PORT` | `pnpm dev`, `dev-cdp.mjs` | DevTools port of the development browser (default `9222`) |
| `OPENCODE_BROWSER` | `mcp/server.mjs` | Pin the browser: `agent` or `own` |
| `OPENCODE_BROWSER_STATE_DIR` | host, server, install | Override the state folder |
| `OPENCODE_BROWSER_PIPE` | host, server | Override the pipe path |
| `CHROME_PATH` | `agent-browser.mjs` | Chromium-based browser to launch |
| `XDG_CONFIG_HOME` | `build:setup` | Where OpenCode's global config is found |
| `OPENCODE_LIVE=1` | Playwright | Include `@live` specs |

---

## Where data is stored

| What | Where |
|---|---|
| Pairing token, settings, site rules, permission mode | `chrome.storage.local`. Never `storage.sync`, so secrets aren't uploaded to your Google account |
| State folder (MCP runtime copy, host manifest, launcher, pipe registry, agent browser profile) | `%LOCALAPPDATA%\opencode-in-chrome` on Windows, `~/.opencode-in-chrome` elsewhere |
| Development browser profile | `.wxt/chrome-profile` (gitignored) |
| GIF recordings and saved screenshots | Your Chrome downloads folder |

Earlier builds used `%LOCALAPPDATA%\opencode-browser`. OpenCode Browse deletes that folder as its own legacy data, so the installer moves what belongs to this project out of it. Close the agent browser first, or the install reports that its profile is in use.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Side panel can't connect / CORS error | Start the server with `opencode serve --cors chrome-extension://ojondpikmcfbfknohcndbolkcnheddle` |
| "Only a local opencode server … is supported" | Use a `127.0.0.1` or `localhost` URL. Remote servers aren't supported yet |
| Pairing doesn't stick | Open the `opencode pair` link in the **same** Chrome profile as the extension, or paste the link into the pair screen |
| Models can't see browser tools | Turn on **Settings → Browser → Let chats use the browser**, and check the chat uses the extension's workspace |
| `The Opencode extension is not connected` (MCP) | Chrome is closed, the extension is disabled, or the host isn't registered. Run `pnpm mcp:install` and open Chrome |
| MCP still runs old code after editing `mcp/` | Run `pnpm mcp:install` again (clients run the copy in the state folder) |
| Agent browser runs an old build | `pnpm build`, then `pnpm mcp:browser --restart` |
| Approvals never show in headless mode | There is no window. Switch the permission mode to **Auto** or run with a window |
| `CDP connection closed before response` on `pnpm dev` | Another Chrome took over the profile, or port `9222` is in use. Close it or set `WXT_CDP_PORT` |
| Claude Code shows `Pending approval` | Run `claude` interactively once and approve the project server |

---

## Project layout

```
entrypoints/
  background.ts        service worker: side panel per tab, browser agent, native bridge
  sidepanel/           chat UI entry
  settings/            settings page entry
  approval/            approval window for MCP sessions
  snapshot.ts          page script injected into every frame of agent tabs
components/
  chat/                chat screen, message list, prompt box, model picker, history, goal, subagents
  settings/            browser, permissions, models, web search, doodles sections
  pair/                pairing screen
  ui/                  shadcn/Base UI components and primitives
lib/
  opencode/            server client, pairing, SSE, chat store, history, models, goal, compaction
  browser/             tools, safety and policy, CDP debugger and input, snapshots and diffs,
                       tool bridge, native bridge, approvals, recorder (GIF), guidance
mcp/
  server.mjs           stdio MCP server
  host.mjs             native messaging host
  framing.mjs          native-messaging and line framing
  paths.mjs            state folder, pipe and registry
scripts/               setup, native host install, agent browser, dev CDP, live tests
tests/                 Vitest unit and integration tests, fakes in tests/support
e2e/                   Playwright specs, fixtures and test pages
openspec/              specs and change proposals
```
