## Purpose

Keeps the agent from claiming a browser task succeeded when it has not seen the outcome, and stops it from repeating actions that do nothing.

## ADDED Requirements

### Requirement: Unverified actions are tracked
The extension SHALL record a page action as unverified when its result does not show the action's effect: the diff shows no change and no navigation, new tab, dialog or download followed; the action failed after input may have been delivered; or the page could not be observed afterwards. An unverified action SHALL be cleared by a later successful `read_page`, `find`, `get_page_text` or screenshot of the same tab, or by a later action result on that tab whose diff shows a change. Unverified actions SHALL be kept per session and SHALL be dropped when their tab closes. The `done` summary SHALL then say that they could not be verified.

#### Scenario: Click with no visible effect
- **WHEN** a click's result shows "No visible change"
- **THEN** the click is listed as unverified in that result's browser-state block

#### Scenario: Cleared by a read
- **WHEN** the session then reads the same tab with `read_page`
- **THEN** the click is no longer listed as unverified

#### Scenario: Action with a visible diff
- **WHEN** a click's result shows new or removed lines in its diff
- **THEN** the click is not recorded as unverified

### Requirement: The `done` tool reports the outcome honestly
The extension SHALL provide a `done` tool taking `outcome` (`success`, `partial` or `failed`) and `summary`.
- `done` with `success` SHALL be refused while the session has unverified actions. The refusal SHALL name each one and say how to verify it.
- After two refusals in a row, a third `done` with `success` SHALL be recorded as `partial` with the unverified actions listed.
- `partial` and `failed` SHALL always be accepted.
- An accepted `done` SHALL clear the session's unverified actions and loop counters, and SHALL return text telling the model to give the summary as its final reply.

#### Scenario: Success refused
- **WHEN** a session with one unverified click calls `done` with `success`
- **THEN** the call returns `UNVERIFIED` naming the click and telling the model to observe the tab and call `done` again

#### Scenario: Partial accepted
- **WHEN** the same session calls `done` with `partial`
- **THEN** the call is accepted

#### Scenario: Success after verifying
- **WHEN** the session reads the tab and then calls `done` with `success`
- **THEN** the call is accepted

### Requirement: Side-panel turns end with `done` after page actions
When a side-panel session's turn ends after at least one page action and without an accepted `done` call, the side panel SHALL inject one note into the session. The note SHALL say the agent acted on a page and must finish with `done` and an honest outcome, and the side panel SHALL resume the run. It SHALL do this at most once per user message. The note SHALL be shown in the timeline as coming from the extension, not from the user.

#### Scenario: Turn ends without done
- **WHEN** the model clicks a button and then replies in plain text without calling `done`
- **THEN** the side panel injects the note once, the run resumes, and the model's next reply calls `done`

#### Scenario: Read-only turn
- **WHEN** the model only reads pages and answers in plain text
- **THEN** no note is injected

#### Scenario: Stopped by the user
- **WHEN** the user stops the run
- **THEN** no note is injected

### Requirement: Actions with no effect are not repeated blindly
The extension SHALL count, per session and target, page actions (click, type, key, form_input) whose result shows no effect and does not show an expected state reached.
- On the second count, the result SHALL carry a note telling the model to try another way or ask the user.
- On the third count, further actions on that target SHALL be refused with `NO_EFFECT` until the session observes the tab again or calls `done`.

A call with a different target, or any observation of the tab, SHALL NOT reset the count. A visible effect on that target SHALL reset it.

#### Scenario: Second no-effect click
- **WHEN** a session clicks the same ref twice and neither click has a visible effect
- **THEN** the second result carries a note to try another way

#### Scenario: Third attempt refused
- **WHEN** the session clicks that ref a third time without observing the tab in between
- **THEN** the call fails with `NO_EFFECT` and sends no input

#### Scenario: Observation unlocks the target
- **WHEN** the session reads the page and the ref is still listed
- **THEN** a new click on it is dispatched
