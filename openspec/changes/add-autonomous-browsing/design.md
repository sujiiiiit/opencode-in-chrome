## Context

- opencode owns the agent loop. The extension is a client-MCP tool server (`add-browser-agent` D1). In opencode 2.2.5 the model reaches the tools only through code mode, as `tools.browser.<tool>(args)` inside `execute` (D13).
- Spike (2026-11-06, scratch script against `opencode serve` with `kilo/kilo-auto/free`):
  - `client.experimental.session.instructions.entry.put({ sessionID, key: 'browser', value: <string> })` succeeded. The model's next reply obeyed the canary instruction ("end every reply with PINEAPPLE-7731"), so entries reach the system prompt.
  - `client.session.synthetic({ sessionID, text, description, delivery: 'queue', resume: true })` on an idle session added a `synthetic` message (with `text` and `description`) and started a new assistant turn, which answered the note. The message order became `user, assistant, idle, synthetic, assistant, idle`.
- Today every result ends with a one-line tab footer (`registry.ts` `formatFooter`, from `scope.footer`).
- Change reports (`actions.ts`, D7) diff interactive lines near the target, capped at 15.
- `read_page` prints up to 30 000 characters from the top of the page. The walker already computes each element's `getBoundingClientRect` (for `(offscreen)`).
- `LoopGuard` (`policy.ts`) refuses an identical call after two failures. It does not look at calls that succeed with no effect.
- `navigateAndWait` sets `committed` on any top-frame commit, so a new tab's own `about:blank` commit can satisfy it. That caused the earlier `sort-control` live failure.
- Nanobrowser's equivalents, which this design adapts, are summarised in `research_notes/nanobrowser-reference.md`.

## Goals / Non-Goals

**Goals:**
- Give every browser session the same agent-side rules and state without owning the loop.
- Keep the changes inside the existing tool wrapper (`withSafety` / `toMcpTools`) so `batch` and code mode get them for free.

**Non-Goals:**
- Replacing the injected walker with CDP `Accessibility.getFullAXTree` (Nanobrowser's tier 1). Rejected again for the reasons in D5. The diff and window work on our walker's output.
- Context elision or compaction of old page payloads. opencode compacts on its own. Revisit only if the goal suite shows context overflow.
- Semantic `{role, name}` targets, the four-layer URL policy and print revalidation. These are worthwhile later, but not needed for finishing tasks.
- Removing page JavaScript from the agent's tools.

## Decisions

### D1. Guidance through per-session instruction entries
- `lib/browser/guidance.ts` holds the guide: about 60 lines adapted from Nanobrowser's `prompt.ts`, written for code mode (`tools.browser.read_page(...)`, `tools.browser.done(...)`).
- **When it is attached:**
  - The side panel puts the entry right after `session.create` in `lib/opencode/chat.ts`, when browser access is on.
  - The worker puts it on a session's first browser call (other clients), from the bridge's connection client.
- A per-session set of guide hashes in `storage.session` prevents repeats.
- The key is `browser`, and the value is the guide string.
- **Why not MCP `instructions`:** `connectClientMcp` has no such field.
- **Why not a custom opencode agent:** that needs server config the extension doesn't own, and it would apply only to sessions using that agent.
- **Fallback:** if `put` throws (the API is experimental), the session is marked as failed and the guide's key rules are prepended to the `tabs_context` description at build time, so they are always present in a shorter form.

### D2. Browser-state block replaces the footer
- The footer hook becomes `state(sessionID, tabId)`, returning a `<browser-state>` block: tabs with ids and revisions, the current tab, a pending dialog, changed tabs and unverified actions.
- **Revisions:** a per-tab counter bumped on every top-frame commit or same-document navigation (from the existing `NavEvents`).
- **"Changed since last seen":** each session remembers the last URL it was shown per tab. A tab whose URL now differs, without a tool call of that session in between, is listed.
- It is built in `lib/browser/state.ts` from `TabScope`, `Dialogs` and the completion tracker (D3).
- Nanobrowser appends the block after the last message instead. We can't, because tool results are the only per-turn channel we control.

### D3. Verification debt and `done`
- `lib/browser/completion.ts` keeps per-session debt. The rules follow Nanobrowser's `completion.ts`, mapped to our results:
  - A **mutating** tool, judged by the same classifier `withSafety` already uses for tiers, creates debt when its diff says `No visible change` and nothing else happened. It also creates debt when it fails after dispatch (`TIMEOUT` after input, `DEBUGGER_DETACHED`).
  - A successful read of the tab clears it, as does a later mutation on the same tab whose diff shows a change.
- The tracker is fed from the `withSafety` wrapper after each call. It needs a structured `effect: 'changed' | 'none' | 'unknown'` on `ToolOutput`. Tools set it, and the actor sets it from its diff (D4).
- `done` (`lib/browser/tools/done.ts`) is a normal tool. It returns `UNVERIFIED: …` (a new error code) to refuse, and plain text to accept. Two refusals followed by another `success` downgrade it to `partial` (Nanobrowser's rule).
- `done` is not page-touching, so it skips the site gate.
- **End-of-turn note:** `chat-screen.tsx` already sees the session go idle. If the turn had a page action (from `browser-steps` parts) and no completed `done`, it calls `session.synthetic({ text, delivery: 'queue', resume: true })` once per user message. The note is labelled in the timeline through `tool-info` / `history-view` as an extension note.
- **Why the side panel and not the worker:** the worker doesn't see turn ends. The panel already subscribes to session events.
- **If a later server drops `synthetic`:** the note is skipped. The `done` refusal still prevents false success, and the eval suite counts plain-text endings.

### D4. Outline diff instead of change reports
- The reader keeps, per (session, tab), the last rendered outline lines it returned (`read_page`, `navigate` with snapshot, or an action's diff/outline) and that tab's document id.
- After an action settles, the actor renders the windowed outline (D5) and diffs it with LCS against the stored lines. This is Nanobrowser's `diff.ts`: trim the common head and tail first, and give up past 4 000 lines.
- Output: up to 60 `+`/`-` lines, with `… N unchanged` between runs and URL/title/new-tab/dialog lines kept from D7.
- If there's no stored outline or the document changed, the action returns the windowed outline instead.
- **Why a full re-render instead of D7's local fingerprint:** refs are already stable per document (D5), so the diff is exact and shows changes far from the target too (toasts, cart counts). The cost is one walk per action, which is within budget in the e2e timings (about 100 ms on the fixtures).
- D7's tab, URL and dialog detection stays. Only the line part changes.

### D5. Viewport window
- The walker adds the absolute page `y` (and `height`) to each kept line: `rect.top + scrollY` plus the frame's offset, which the reader already computes for stitching.
- The reader then applies the window: `near` covers viewport ± one height, then filters, then cuts by distance from the viewport until under `max_chars`. It reports `N more actionable elements above/below`.
- Parent lines of kept lines are always kept, so the tree stays readable.
- `ref_id` scope bypasses the window.
- `find` and `get_page_text` stay unwindowed. `find` is how the model reaches off-window elements.

### D6. No-effect guard
- This extends `LoopGuard` with a per-session map from target key (tool + `ref` or coordinate, rounded to 8 px) to a no-effect count, using the same `effect` field as D3.
- Count 2 → a nudge line is appended to the result. Count 3 → `NO_EFFECT` (a new code) is thrown before dispatch.
- The count is reset by a visible effect on that target. A read of the tab only unlocks the refused target. It doesn't reset the count, so a read followed by the same failing click goes back to refused after one more no-effect attempt.
- The existing two-failure rule stays.

### D7. Navigation commit match
- `navigateAndWait` gets the requested URL. A `committed` event counts only if its URL is not `about:blank` (when the request isn't), or matches the requested origin, or arrives after `start()` resolved and is that navigation's first commit.
- The URL rule alone is the simplest fix for the observed race. A redirect to another origin still commits a non-blank URL, so it still counts.
- `navigationText` adds what it waited for.

### D8. Direct tool exposure through a session permission
- Check opencode 2.2.5 config and server source for a route that lists client-MCP tools as top-level tools.
- Apply only to browser-capable sessions so other MCPs and skills remain registered.

**Finding (2026-11-06):** The local OpenCode source at `D:/opencode/packages/core/src/tool.ts` exposes every registered tool directly when the session's permission rules wholly deny `execute` (`action: "execute", resource: "*", effect: "deny"`). `McpTool` registers client-MCP tools as `browser_<name>`; the browser session can therefore select direct tools without changing global server config or disabling other MCPs or skills. The side panel and live goal runner now set this session rule, and the browsing guide names direct tools. With the requested Nemotron model, goal-only live runs passed read-price, add-to-cart, fill-order, follow-link, payment handoff, and attack-shop. The previous code-mode add-to-cart run timed out. Direct tools increased call count in the observed runs, so the wider suite still needs to measure reliability and time.

### D9. Goal suite
- `e2e/live-goals.spec.ts` (tagged `@live`) reuses the `live.spec.ts` pairing. Each task creates a session the way the side panel does (guide entry and end-of-turn note), so the suite tests the real product path. The note logic is factored into `lib/opencode/turn-end.ts` and called from both places.
- Task definitions go in `e2e/goals/tasks.ts`, modelled on Nanobrowser's `eval-tasks.ts`.
- The fixture server gains a `/submit` endpoint that records bodies.
- New fixtures: `shop.html`, `mail.html`, `rows.html`, `checkout.html` and `attack-{shop,mail,forum}.html`. Existing `tasks.html`, `form.html`, `frames.html` and `shadow.html` are reused.
- The scripted user declines every approval card unless the task's `allow` pattern matches.
- Runs per task come from `GOAL_RUNS`, default 3. The model comes from `GOAL_MODEL`, default `kilo/kilo-auto/free`, so a stronger model can be compared without code changes.

## Risks / Trade-offs

- **[Experimental APIs change in a later opencode]** → Both calls are wrapped. The guide falls back to the tool description (D1) and the note is skipped (D3). A live test covers both APIs, so an upgrade that breaks them fails loudly.
- **[Full re-render per action is slower on huge pages]** → It uses the existing node/time caps. If a walk is capped, the diff says so and falls back to "outline changed, read the page".
- **[The windowed default hides what the model needs]** → Every cut is stated with a count and the way to see it. `find` covers the rest. The goal suite measures it.
- **[The free model ignores `done`]** → The end-of-turn note gives one more chance. The suite reports false successes and plain-text endings separately, so the effect of each piece is visible.
- **[The guide competes with opencode's own system prompt]** → Keep it short and specific to browsing, and measure it in the suite.

## Migration Plan

All changes are additive behind the existing browser-access switch. Change reports turn into diffs in place. The old format isn't kept, because only the model reads it. To roll back, revert the change. The extension stores no new persistent data, only `storage.session` state.

## Open Questions

- How does the existing timeline render a `synthetic` message? It is a new message type for `history-view`. It is handled in task 3.4 and needs no spec change.
- How large can the instruction value be (`InstructionEntryValueTooLargeError.maxBytes`)? The guide is about 4 KB. Read the limit from the error in the guidance unit test against the live server.
