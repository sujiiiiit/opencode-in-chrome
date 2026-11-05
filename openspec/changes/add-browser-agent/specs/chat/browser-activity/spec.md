# Spec Delta

## Purpose

Defines how the side panel shows and controls the agent's browser work: readable timeline steps, approval prompts, the browser-access setting, the site list, tab sharing and the stop control.

## ADDED Requirements

### Requirement: Browser steps read as sentences in the timeline
Each browser tool call SHALL appear in the chat timeline as a web step titled from its tool and subject, using the `action_summary` when present, for example `Opening news.ycombinator.com`, `Reading the page` or `Clicked: Opens the Filters menu`. This applies to direct `browser_<tool>` calls and to `browser.<tool>` calls made inside a code-mode `execute` call.

#### Scenario: Click with summary
- **WHEN** the model calls the browser `computer` tool's `left_click` with summary "Opens the Filters menu"
- **THEN** the timeline shows a finished step reading `Clicked: Opens the Filters menu`

#### Scenario: Calls inside code mode
- **WHEN** an `execute` call's code makes browser `navigate` and `read_page` calls
- **THEN** the timeline shows that step as browser work, labelled from those calls (for example `Opening example.com · Reading the page`), not as a shell command

#### Scenario: Screenshot step
- **WHEN** a screenshot call finishes
- **THEN** the step shows a thumbnail of the captured image

### Requirement: Approvals appear in the chat
An approval request from the browser safety rules SHALL appear in the chat as a form showing the site, the action and its summary, with allow-once, always-allow-this-site (for site prompts) and deny choices.

#### Scenario: Site prompt
- **WHEN** the agent first acts on a new site
- **THEN** the chat shows a prompt naming the site with Allow once, Always allow and Deny

### Requirement: Browser access setting
Settings SHALL include a browser-access switch (off by default until the user turns it on), the approval mode choice and the per-site list where each site can be set to allow, ask or block, marked sensitive, or removed.

#### Scenario: Turn on browser access
- **WHEN** the user turns browser access on
- **THEN** the browser tools become available to new turns and the setting persists across restarts

#### Scenario: Block a site from settings
- **WHEN** the user sets a site to block
- **THEN** later calls on that site fail with `BLOCKED_SITE`

### Requirement: Share the current tab
The chat SHALL offer a control to share the active browser tab with the open session and show which tabs the session is using.

#### Scenario: Share
- **WHEN** the user presses share with a web page active
- **THEN** the tab joins the session and the control shows it as shared

### Requirement: Stop browser activity
While the session has browser activity, the chat SHALL show a stop control that triggers the safety kill switch.

#### Scenario: Stop
- **WHEN** the user presses stop
- **THEN** the in-flight browser call fails and the control changes to resume
