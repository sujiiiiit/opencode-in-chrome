<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**This project has a knowledge graph. Start with the code-review-graph
MCP tools to narrow scope, then read the source.** The graph is cheaper than scanning files and
gives you structural context (callers, dependents, test coverage) that file search cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

### Verify in the source

- Narrow scope with the graph, then read the source. Do not change code from graph output alone.
- For any non-trivial change, read the implementation and the relevant tests before concluding.
- Verify the exact source when touching behavior, database logic, migrations, retries, fallbacks,
  recovery, or compatibility code.
- When the graph and the source disagree, the source wins. The graph may be stale or may not
  model that relationship.
- An empty graph result can mean "not indexed" or "not statically visible", not "does not exist".

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Token budget rules

- First call for any code task: `get_minimal_context_tool(task="...")` (~100 tokens); it suggests the next tool.
- Pass `detail_level="minimal"` wherever accepted; keep `max_results`/`limit` small and widen only when output says `truncated`.
- Prefer one targeted `query_graph_tool` (`callers_of`, `tests_for`, `file_summary`, ...) over listing tools; ~5 graph calls per task, then read only the needed line ranges.

### Model selection: small models for small work

- Lookups ("where/who calls/which tests"): Agent `graph-lookup` (haiku). Broad sweeps: `Explore` (haiku).
- Small, well-specified edits (1-3 files): Agent `small-edit` (sonnet). Give exact files, symbols and expected outcome.
- Keep design, cross-cutting refactors, unclear debugging and reviews in the main session.

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
<!-- /code-review-graph MCP tools -->

<!-- fallow -->
## Code quality: fallow (dead code, duplicates, complexity)

Run it from the CLI (pinned devDependency, config in `.fallowrc.json`). Use JSON output for yourself:

| When | Command |
| ---- | ------- |
| Before saying a change is done | `pnpm exec fallow audit --format json --quiet`: must be `"verdict":"pass"`; fix what *your change introduced* |
| Before writing a new helper/component | `pnpm exec fallow dupes --format json --quiet`: reuse or extract existing code instead of copying |
| Cleanup / refactor requests | `pnpm exec fallow --format json --quiet` (health + dupes + dead code), then `pnpm exec fallow fix --dry-run` before any `fix` |
| Before deleting an export | `pnpm exec fallow dead-code --trace <file>:<export>` |

Rules:
- Exit code 1 = findings, 2 = config/usage error. Never hide either with `|| true`.
- WXT auto-imports (`components/`, `composables/`, `hooks/`, `utils/`) are seeded as entries in `.fallowrc.json`, so dead code there is NOT reported; grep for usages yourself before deleting anything there.
- An "unused" report can be wrong when code is used only via auto-import, `browser.runtime.getURL`, the manifest, or HTML. Verify before deleting. Never run `fallow fix` without the dry run.
- Don't run `fallow watch` (it never exits). Don't add suppression comments unless the user agrees.
- code-review-graph does not resolve WXT's `@/`/`~/` alias imports: when checking impact, also grep for the module name. fallow does resolve them.
<!-- /fallow -->

<!-- shadcn-baseui -->
## UI: shadcn/ui + Base UI (not Radix)

This project uses shadcn/ui with **Base UI**: `components.json` has `"style": "base-luma"` and the dependency is `@base-ui/react`. Load the `shadcn-baseui` skill before any UI work and never use Radix-only APIs.

- Use the `render` prop instead of `asChild` on every trigger/wrapper part (Dialog, AlertDialog, DropdownMenu, Popover, Tooltip, Select, Tabs, Accordion, ...).

  ```tsx
  <DropdownMenuTrigger render={<Button variant="outline" />}>Open</DropdownMenuTrigger>
  ```

- `Button` rendered as a link or other non-button element: pass `nativeButton={false}` with `render`.
- `Accordion`: no `type` prop. Use the boolean `multiple` prop; `defaultValue` is always an array (`<Accordion multiple defaultValue={["item-1"]}>`).
- `SelectContent`: use `alignItemWithTrigger={false}` instead of `position="popper"`.
- Dropdown menu group parts: `DropdownMenuLabel` must be inside `DropdownMenuGroup` (or `DropdownMenuRadioGroup`), otherwise Base UI throws `MenuGroupContext is missing` and the whole menu renders blank. Keep labels and their items/radio groups in the same `DropdownMenuGroup`.
- When a Base UI prop is unclear, check the actual types in `node_modules/@base-ui/react/<component>` or the shadcn registry; do not assume Radix prop names.
<!-- /shadcn-baseui -->
