# Setup — local MCP servers for OpenCode & Claude Code

This repo ships **two local (stdio) MCP servers**. Both are just local
processes OpenCode / Claude Code start for you — no URL, no OAuth.

| Server | What it is | Start command |
|---|---|---|
| `opencode-in-chrome` | Browser tools from the Chrome extension (`mcp/server.mjs` → `mcp/host.mjs` → extension) | `node mcp/server.mjs` |
| `code-review-graph` | Code knowledge graph (callers, impact, review context) | `code-review-graph serve --repo <repo>` (or `uvx code-review-graph serve ...`) |

> **Key difference:** OpenCode reads `opencode.jsonc` — it does **not** read
> `.mcp.json`. Claude Code reads `.mcp.json`. You need to declare the same
> servers **twice**, once in each format.

---

## 0. Prerequisites

```sh
# Node + pnpm (for the browser MCP)
node --version
pnpm --version

# code-review-graph — pick one
#   a) binary (your current setup)
#   b) uvx
uvx code-review-graph --help
```

### Browser MCP only: install the native host (one-time)

`mcp/server.mjs` reaches the extension over a token-protected pipe owned by
`mcp/host.mjs`. Chrome starts the host; the MCP server connects to it.

```sh
# the pinned extension id is registered automatically; add another (e.g. a store build) with --extension-id
pnpm mcp:install
```

It copies `mcp/` into the state folder, `%LOCALAPPDATA%\opencode-in-chrome` on Windows and
`~/.opencode-in-chrome` elsewhere (override with `OPENCODE_BROWSER_STATE_DIR`). Chrome and the MCP
clients run that copy (`<state folder>/runtime/server.mjs`), so moving the checkout or switching
Node versions doesn't break them. **Run it again after changing anything in `mcp/`.**

Earlier builds used `%LOCALAPPDATA%\opencode-browser`. OpenCode Browse (`browse`) deletes that
folder as its own legacy data, so the install moves the agent browser profile and the tool cache out
of it. Close the agent browser first, or it reports that the profile is in use.

Keep **Chrome open with the extension enabled** while you use the MCP, otherwise
you get `The Opencode extension is not connected`.

---

## 1. OpenCode

### Config file

- **Project:** `./opencode.jsonc` (this repo) — shared with the project
- **Global:** `~/.config/opencode/opencode.jsonc` — every project

Use the V2 shape under `mcp.servers` + `$schema` `https://opencode.ai/config.json`.
Don't put server names directly under `mcp` (V1 shape).

### Option A — CLI (recommended, preserves other settings)

```sh
cd D:/opencode-in-chrome

# browser MCP (project-local; add --global to make it everywhere)
opencode mcp add opencode-in-chrome -- node mcp/server.mjs

# code-review-graph (binary form)
opencode mcp add code-review-graph -- "C:/Users/sujit/.local/bin/code-review-graph.exe" serve --repo "D:/opencode-in-chrome" --tools "build_or_update_graph_tool,detect_changes_tool,get_impact_radius_tool,get_review_context_tool,get_minimal_context_tool,query_graph_tool,semantic_search_nodes_tool,get_affected_flows_tool,get_architecture_overview_tool,list_communities_tool,refactor_tool"

# or the uvx form
# opencode mcp add code-review-graph -- uvx code-review-graph serve --repo "D:/opencode-in-chrome"
```

Env vars (repeat `--env`):

```sh
opencode mcp add code-review-graph --env PYTHONUTF8=1 --env CRG_MAX_SEARCH_RESULTS=10 --env CRG_MAX_IMPACT_NODES=200 -- "C:/Users/sujit/.local/bin/code-review-graph.exe" serve --repo "D:/opencode-in-chrome"
```

### Option B — Hand-edit `opencode.jsonc`

```jsonc title="./opencode.jsonc"
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "opencode-in-chrome": {
        "type": "local",
        "command": ["node", "mcp/server.mjs"]
      },
      "code-review-graph": {
        "type": "local",
        "command": [
          "C:/Users/sujit/.local/bin/code-review-graph.exe",
          "serve",
          "--repo",
          "D:/opencode-in-chrome",
          "--tools",
          "build_or_update_graph_tool,detect_changes_tool,get_impact_radius_tool,get_review_context_tool,get_minimal_context_tool,query_graph_tool,semantic_search_nodes_tool,get_affected_flows_tool,get_architecture_overview_tool,list_communities_tool,refactor_tool"
        ],
        "environment": {
          "PYTHONUTF8": "1",
          "CRG_MAX_SEARCH_RESULTS": "10",
          "CRG_MAX_IMPACT_NODES": "200"
        }
      }
    }
  }
}
```

Notes:

- `command` = executable + args array. OpenCode runs it over stdio.
- `cwd` defaults to the workspace. Relative `mcp/server.mjs` resolves from there.
- Secrets: use `{env:NAME}` in `environment`, not `$NAME`. Don't commit secrets — set them in your shell profile.
- `disabled: true` keeps it configured but disconnected. No `enabled` field.
- Tools show as `tools.<server>_<tool>()` in Code Mode (default). Set `"codemode": false` to expose them natively.

### Verify

```sh
opencode mcp list
```

```
✓ opencode-in-chrome  connected
✓ code-review-graph   connected
```

In the TUI run `/mcps` to connect / disconnect / inspect. Config saves reload automatically — no restart needed (or `/reload`).

---

## 2. Claude Code

### Config file

- **Project (shared):** `./.mcp.json` — commit it
- **User:** `~/.claude.json` — only you, every project

Format is `mcpServers` with `type: "stdio"`, `command`, `args`, `env`.

### Option A — CLI

```sh
cd D:/opencode-in-chrome

# browser MCP (project scope so it's shared)
claude mcp add --scope project opencode-in-chrome -- node mcp/server.mjs

# code-review-graph (binary form)
claude mcp add --scope project code-review-graph -- "C:/Users/sujit/.local/bin/code-review-graph.exe" serve --repo "D:/opencode-in-chrome" --tools "build_or_update_graph_tool,detect_changes_tool,get_impact_radius_tool,get_review_context_tool,get_minimal_context_tool,query_graph_tool,semantic_search_nodes_tool,get_affected_flows_tool,get_architecture_overview_tool,list_communities_tool,refactor_tool"

# with envs (multiple --env allowed)
# claude mcp add --scope project --env PYTHONUTF8=1 --env CRG_MAX_SEARCH_RESULTS=10 code-review-graph -- "C:/Users/sujit/.local/bin/code-review-graph.exe" serve --repo "D:/opencode-in-chrome"
```

Use `--scope local` (default) for just you, `--scope user` for everywhere.

### Option B — Hand-edit `.mcp.json`

```json title="./.mcp.json"
{
  "mcpServers": {
    "opencode-in-chrome": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp/server.mjs"]
    },
    "code-review-graph": {
      "type": "stdio",
      "command": "C:/Users/sujit/.local/bin/code-review-graph.exe",
      "args": [
        "serve",
        "--repo",
        "D:/opencode-in-chrome",
        "--tools",
        "build_or_update_graph_tool,detect_changes_tool,get_impact_radius_tool,get_review_context_tool,get_minimal_context_tool,query_graph_tool,semantic_search_nodes_tool,get_affected_flows_tool,get_architecture_overview_tool,list_communities_tool,refactor_tool"
      ],
      "env": {
        "PYTHONUTF8": "1",
        "CRG_MAX_SEARCH_RESULTS": "10",
        "CRG_MAX_IMPACT_NODES": "200"
      }
    }
  }
}
```

Notes:

- The `--` in `claude mcp add ... -- <cmd>` separates Claude's flags from the server command.
- Claude sets `CLAUDE_PROJECT_DIR` in the server's env (project root) — useful if your server resolves relative paths itself.
- On first run, a `.mcp.json` server shows `Pending approval (run claude to approve)` — run `claude` interactively and approve it. Until trusted, approvals from the cloned repo's `.claude/settings.json` don't apply.
- `timeout` (ms) can be set per-server in `.mcp.json`.

### Verify

```sh
claude mcp list
claude mcp get opencode-in-chrome
claude mcp get code-review-graph
```

In session: `/mcp`. Statuses: `Connected`, `Failed to connect`, `Pending approval`, `Disabled`.

---

## 3. Side-by-side cheat sheet

| | OpenCode | Claude Code |
|---|---|---|
| Project file | `opencode.jsonc` | `.mcp.json` |
| Global file | `~/.config/opencode/opencode.jsonc` | `~/.claude.json` |
| Root keys | `mcp.servers` | `mcpServers` |
| Local type | `"type": "local"` | `"type": "stdio"` |
| Command | `"command": ["node", "mcp/server.mjs"]` | `"command": "node", "args": ["mcp/server.mjs"]` |
| Env | `"environment": {...}` | `"env": {...}` |
| Add CLI | `opencode mcp add <name> -- <cmd>` | `claude mcp add --scope project <name> -- <cmd>` |
| List | `opencode mcp list`, `/mcps` | `claude mcp list`, `/mcp` |
| Secrets | `{env:NAME}` expansion | `${VAR:-default}` / shell env |

---

## 4. Troubleshooting

- **`The Opencode extension is not connected`** → Chrome is closed / extension disabled / native host not installed. Run `pnpm mcp:install --extension-id <id>` and open Chrome with the extension on.
- **`type` / shape mismatch** → OpenCode needs `mcp.servers` + `"type": "local"`. Claude needs `mcpServers` + `"type": "stdio"`. Don't copy one into the other.
- **`needs authentication` (OpenCode remote only)** — local MCPs don't use OAuth. Remote servers: run `/mcps` in OpenCode, or `/mcp` in Claude.
- **Absolute vs relative paths** — project files use relative `mcp/server.mjs`. Binaries like `code-review-graph.exe` use absolute paths so they work from any `cwd`. On macOS/Linux, derive the path with `which code-review-graph`.
- **Windows quoting** — quote paths with spaces. Keep `.exe` for the binary form.
- **Repo root** — `code-review-graph serve --repo` must point at the indexed repo (`D:/opencode-in-chrome`). Rebuild it after moving the folder.

## Which browser the MCP server drives

`pnpm build:setup` builds the extension, registers the MCP server in Claude Code
and OpenCode, and starts a dedicated **agent browser** (its own Chrome profile,
runs in the background). Any number of browsers can be connected at once; each
one that runs the extension appears in `list_connected_browsers`.

| Goal | Command |
|---|---|
| Background automation in a separate profile | `pnpm build:setup` (default) |
| Use **your own Chrome** with your real sign-ins (no warm-up, no extra bot checks) | `pnpm build:setup --my-chrome`, then in `chrome://extensions` turn on Developer mode and **Load unpacked** the printed folder (once; Chrome keeps it) |
| Switch after a rebuild | `pnpm mcp:browser --restart` (agent browser); reload the extension in your own Chrome |

With both connected, the MCP server uses your own profile. The agent can call
`select_browser` (`own`, `agent`, or an id), or set `OPENCODE_BROWSER=agent` in
the MCP server's environment to pin it. In your own Chrome the extension asks
before acting on a site (manual mode); MCP clients only see the *site* of your
other open tabs, never their titles or paths, and a client's tabs are closed
five minutes after it disconnects (tabs you shared are only released).
