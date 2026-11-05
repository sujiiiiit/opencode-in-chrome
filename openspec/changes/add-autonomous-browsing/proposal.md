## Why

The browser layer from `add-browser-agent` passes every eval (807 unit tests, 35 e2e, 21/21 live). But each live task hands the model exact code, so the suite never shows whether the agent can finish a task from a plain instruction. Nanobrowser (see `research_notes/nanobrowser-reference.md`) shows that this ability comes from the agent side: a browsing prompt, checks before claiming success, loop guards and a compact observation after each action. Today our model gets none of that. It sees only tool descriptions. A spike on 2026-11-06 confirmed that opencode 2.2.5 lets the extension attach per-session instructions (`experimental.session.instructions.entry.put`) and inject resumable notes (`session.synthetic`). So we can add the agent-side logic without owning the loop.

## What Changes

- **Browsing instructions.** For every session that uses the browser tools, the extension puts a fixed browsing guide into opencode's per-session instructions. The guide covers how to work, reading results, verifying, the untrusted-content contract, user-owned steps and how to finish.
- **Browser state in every result.** The tab footer becomes a short browser-state block listing the session's tabs, the current tab and its revision, pending dialogs, tabs that changed without the agent acting, and unverified actions.
- **Verification debt and a `done` tool.**
  - An action whose result does not show its effect is recorded as unverified until a later read of that tab clears it.
  - A new `done(outcome, summary)` tool refuses `success` while unverified actions remain.
  - When a turn in the side panel ends after page actions without `done`, the extension injects one note and resumes the run.
- **Outline diff after actions.** By default, every page action returns an exact diff of the page outline against the last outline that session saw, instead of a short change summary.
- **Viewport-windowed reads.** By default, `read_page` covers the viewport plus one viewport height above and below. It states how many actionable elements lie above or below, and cuts the lines farthest from the viewport first when over budget. `window: "page"` reads the whole page.
- **No-effect guard.** The same action on the same target with no visible effect gets a nudge on the second try. On the third, the guard refuses further calls on that target and tells the model to try another way or finish with `done`.
- **Navigation race fix.** `navigate` waits for the commit of the URL it asked for, not for any commit (such as a fresh tab's own `about:blank`). It reports what it waited for (load and quiet, or the cap).
- **Goal-only eval suite.**
  - A live suite of tasks given only as goals (read a price, add rows, reply to a message, follow a link, filter and sort a list, pick a date, multi-tab, a payment hand-off, two public sites).
  - It is graded on run facts: answer, calls, fixture-server posts and final page text.
  - It includes attacked fixtures scored as attempted / gated / completed, and repeated runs.
- **Direct tool exposure (investigation only).** Find out whether opencode can expose the browser tools as top-level tools instead of only through code mode, and record the answer. No behaviour change unless the server supports it.

## Capabilities

### New Capabilities
- `browser/agent-guidance`: the per-session browsing instructions and the browser-state block every result carries.
- `browser/task-completion`: verification debt, the `done` tool, the end-of-turn nudge and the no-effect guard.
- `browser/page-observation`: the outline diff after actions and the viewport window for `read_page`.
- `browser/task-evals`: the goal-only live suite, its graders, attacked fixtures and report.

### Modified Capabilities
None in `openspec/specs/`: the browser specs still live in the unarchived `add-browser-agent` change. This change adds to them through the new capabilities above. The navigation fix restores behaviour that `browser/page-actions` already requires ("waits for the page to load") and adds no new requirement there.

## Impact

- Code: `lib/browser/tools/registry.ts` (footer → state block), `lib/browser/safety.ts` (no-effect guard), `lib/browser/actions.ts` (diff instead of change report), `lib/browser/snapshot/reader.ts` (window, per-session last outline), `lib/browser/navigation.ts` (commit match), new `lib/browser/guidance.ts`, `lib/browser/completion.ts`, `lib/browser/tools/done.ts`; side panel `components/chat/chat-screen.tsx` (end-of-turn nudge); `lib/opencode/tool-info.ts` (label for `done`).
- opencode APIs (experimental, server 2.2.5): `experimental.session.instructions.entry.put`, `session.synthetic`. If they change, the guidance falls back to a long `tabs_context` description and the nudge is skipped (design D1).
- Tests: unit tests for each new module, e2e specs for the diff and window, a new live spec `e2e/live-goals.spec.ts` with fixtures under `e2e/pages/`, and the report written to `research_notes/browser-agent-goal-suite.md`.
- No new dependencies and no manifest changes.
