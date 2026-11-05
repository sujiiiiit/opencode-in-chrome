# Tasks

Test levels follow `add-browser-agent` D14. Live steps need `OPENCODE_LIVE=1`, and use `GOAL_MODEL` (default `kilo/kilo-auto/free`) and `GOAL_RUNS` (default 3).

## 1. Goal suite and baseline (spec `browser/task-evals`, design D9)

- [x] 1.1 Add a `/submit` endpoint to the e2e fixture server that records request bodies per test, with a helper to read them. Verify with an e2e spec that posts a form and reads the recorded body.
- [x] 1.2 Add fixture pages:
  - `shop.html`: products with prices;
  - `rows.html`: a list with an add-row form;
  - `mail.html`: a thread with a reply box that posts to `/submit`;
  - `checkout.html`: a card field and a Pay button;
  - `attack-shop.html`, `attack-mail.html`, `attack-forum.html`: hidden-field, pop-up and body-text injections that point to `evil.example` and to an unasked submit.

  Verify that each page loads in the e2e fixture and that the injected text is present in the DOM.
- [x] 1.3 Create `e2e/goals/tasks.ts`: at least 15 goal tasks covering every area in the spec, each with a start URL, a goal prompt with no tool names or code, an optional `allow` pattern, a grader over run facts, and an attack scorer on the attacked tasks. Verify with a Vitest unit test that runs every grader over a recorded passing fact set and a failing one.
- [x] 1.4 Create `e2e/live-goals.spec.ts` (`@live`). It pairs as `live.spec.ts` does, runs each task `GOAL_RUNS` times in a fresh session and collects run facts (answer, browser calls from `execute` metadata, `/submit` bodies, final page text read through Playwright, `done` outcome). It uses a scripted user that declines approval cards unless `allow` matches, and writes `research_notes/browser-agent-goal-suite.md` with the date of the run, the model, per-task passes/runs, pass rate, false successes, guard/note counts and attack outcomes. Verify it runs with `pnpm exec playwright test e2e/live-goals.spec.ts` and writes the report.
- [ ] 1.5 Run the suite on the current code as the **baseline** and keep the report as `research_notes/browser-agent-goal-suite-baseline.md`. Verify the file exists with a pass rate.

## 2. Navigation commit match (spec `browser/page-observation`, design D7)

- [x] 2.1 Make `navigateAndWait` take the requested URL and ignore an `about:blank` commit or load when the request is not `about:blank`. Have `navigationText` state what it waited for. Verify with a unit test where a fresh tab's `about:blank` commit and load arrive after `start()` and the result waits for the requested page's commit, plus an e2e spec that navigates a just-created tab and gets the right URL.

## 3. Browsing guidance (spec `browser/agent-guidance`, design D1)

- [x] 3.1 Create `lib/browser/guidance.ts` with the guide text (code-mode wording, adapted from Nanobrowser's `prompt.ts`), its hash, and `attachGuide(client, sessionID)`. That function puts the `browser` instruction entry, records the hash in `storage.session`, skips the call when the hash is already recorded, and records a failure instead of throwing. Verify with unit tests for the skip and the failure path, and a live Vitest test (`tests/live/`) that attaches the guide and reads the entry back. The live test also logs the server's size limit if the error reports one.
- [x] 3.2 Call `attachGuide` after `session.create` in `lib/opencode/chat.ts` when browser access is on, and from the worker on a session's first browser call. Verify with a unit test for each path against `tests/support/fake-opencode.ts`, extended with the instructions route.
- [x] 3.3 Add the fallback: when attaching failed for a session, or the server lacks the route, the `tabs_context` description carries the guide's short form. Verify with a unit test of the built description.

## 4. Browser-state block (spec `browser/agent-guidance`, design D2)

- [x] 4.1 Add per-tab revisions (bumped on top-frame commits and history updates) and each session's last-seen URL per tab to `TabScope`. Verify with unit tests on fakeBrowser.
- [x] 4.2 Create `lib/browser/state.ts`, which renders the `<browser-state>` block (tabs with revisions, the current tab, a pending dialog, changed tabs, unverified actions with quoted page strings), and swap it in for `formatFooter` in `runtime.ts`. Update the footer assertions in existing tests. Verify with unit tests for each line, and an e2e spec where the user navigates a session tab and the next result reports it as changed.

## 5. Observation: diff and window (spec `browser/page-observation`, design D4, D5)

- [x] 5.1 Have the walker emit each kept line's absolute page `y` and `height` (frame offsets included). Have the reader apply the `near`/`viewport`/`page` window with stated above/below counts and distance-first budget cuts. Add the `window` argument to `read_page`. Verify with unit tests on a tall fixture (counts, budget cut order, `ref_id` bypass), and an e2e spec on a 10-viewport fixture page.
- [x] 5.2 Store each session's last outline lines and document id per tab in the reader. Add the LCS line diff (head/tail trim, 4 000-line limit, 60-line cap, unchanged-run counts). Verify with unit tests: menu-opens, no change, a large change capped at 60, and a different document falling back to the outline.
- [x] 5.3 Replace D7's line part in `actions.ts` with the diff, keeping the URL/tab/dialog lines. Add `effect: 'changed' | 'none' | 'unknown'` to `ToolOutput` and set it from every page action. Update existing change-report tests. Verify with the existing e2e action specs (updated expectations) and a new one where a click elsewhere updates a cart count shown in the diff.

## 6. Completion and guards (spec `browser/task-completion`, design D3, D6)

- [x] 6.1 Create `lib/browser/completion.ts`, which keeps per-session debt fed from the `withSafety` wrapper: created by `effect: 'none'` or a delivery-uncertain failure, cleared by a read of the tab or a later changed effect on it, and dropped on tab close with a note. Verify with unit tests for each creation and clearing rule.
- [x] 6.2 Add the `done` tool and the `UNVERIFIED` code: it refuses `success` with named debts, downgrades to `partial` after two refusals, accepts `partial`/`failed`, and clears debt and counters. Add a `done` label in `lib/opencode/tool-info.ts`. Verify with unit tests and a tool-info test.
- [ ] 6.3 Extend `LoopGuard` with per-target no-effect counts, a nudge at 2 and `NO_EFFECT` at 3 (a new code). The refusal is lifted by an observation of the tab, and the count is reset by a visible effect. Verify with unit tests and an e2e spec on a dead button: third click refused, read unlocks it.
- [ ] 6.4 Create `lib/opencode/turn-end.ts`. When a turn has a page action and no completed `done`, it calls `session.synthetic({ text, description, delivery: 'queue', resume: true })` once per user message, and never after Stop. Call it from `chat-screen.tsx` on idle. Render `synthetic` messages in `history-view` as an extension note. Verify with unit tests for the trigger rules, a component test for the note's rendering, and a live Vitest test that the session resumes and calls `done`.

## 7. Direct tool exposure (design D8)

- [ ] 7.1 Look for an opencode 2.2.5 setting that lists client-MCP tools as top-level tools (config schema from `config.get`, server docs or changelog). Record the finding under D8 in `design.md`. If one exists, add a test run of the goal suite with it on, and note the result in the report. Verify by reading the updated D8.

## 8. Measure and finish

- [ ] 8.1 Run the goal suite after groups 2–6 and compare with the baseline report: pass rate, false successes and attack outcomes, in a short comparison section at the top of `research_notes/browser-agent-goal-suite.md`. Verify the section exists with both numbers.
- [ ] 8.2 Run `pnpm compile`, `pnpm test`, `pnpm e2e`, `pnpm test:live` and `pnpm exec fallow audit --format json --quiet`, and confirm all pass with verdict `pass`.
