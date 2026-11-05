# Spec Delta

## Purpose

Defines the safety rules the extension enforces on every browser tool call, whoever the caller is, so a confused or hijacked model cannot take consequential actions in the user's signed-in browser without the user's say.

## ADDED Requirements

### Requirement: Every call is classified into a tier
Each call SHALL be classified as `read` (tree, text, screenshot, scroll, hover, console, network, tab listing), `navigate`, `mutate` (click, type, key, drag, form fill), `consequential` (submitting a form, clicking a control whose name or `action_summary` says send, pay, buy, delete, post, publish, confirm, sign up, plus `javascript`, `file_upload`, `upload_image` and downloads) or `hand-off`.

#### Scenario: Submit button
- **WHEN** the agent clicks a button named "Submit order"
- **THEN** the call is classified `consequential`

#### Scenario: Plain link
- **WHEN** the agent clicks a link to another page of the same site
- **THEN** the call is classified `mutate`

### Requirement: Site permissions gate actions
For each site the user SHALL be able to choose `allow`, `ask` (the default for a site not yet seen) or `block`; `read` and `mutate` calls on an `allow` site proceed, calls on an `ask` site need approval once per session, and any call on a `block` site fails with `BLOCKED_SITE`.

#### Scenario: First visit
- **WHEN** the agent first acts on a site the user has not decided on
- **THEN** the user is asked to allow it once, always, or deny

#### Scenario: Blocked site
- **WHEN** the agent navigates to a blocked site
- **THEN** the call fails with `BLOCKED_SITE` and no request is made

### Requirement: Consequential actions need approval each time
A `consequential` call SHALL proceed only after the user approves that specific call, shown with the site, tool and `action_summary`, unless the user has enabled auto-approve for consequential actions on that site.

#### Scenario: Approve
- **WHEN** the user approves a pending submit
- **THEN** the call runs and its result is returned to the model

#### Scenario: Deny
- **WHEN** the user denies it
- **THEN** the call fails with `DENIED` and no input is sent to the page

#### Scenario: No answer
- **WHEN** the user does not answer within 5 minutes
- **THEN** the call fails with `NEEDS_APPROVAL` and no input is sent

### Requirement: Hand-off actions go to the user
The extension SHALL never type into password, one-time-code or payment-card fields, solve CAPTCHAs, or approve OAuth consent screens; such calls fail with `DENIED` and a message asking the user to do that step, and the side panel shows that request.

#### Scenario: Password field
- **WHEN** the agent types into a password field
- **THEN** the call fails with `DENIED` and the side panel asks the user to enter it themselves

### Requirement: Site is re-checked before input
Right before sending input, the extension SHALL confirm the tab is still on the site the call was approved for, and SHALL fail with `NEEDS_APPROVAL` if it has changed.

#### Scenario: Redirect between approval and click
- **WHEN** the page redirects to another site after approval but before the click
- **THEN** no click is sent and the call fails with `NEEDS_APPROVAL`

### Requirement: Cross-site data flow after sensitive reads
After a session reads a site the user marked sensitive, navigating to or submitting a form on any other site SHALL be treated as `consequential` for the rest of the session.

#### Scenario: Read mail then visit other site
- **WHEN** the agent reads a page on a site marked sensitive and then navigates to an unrelated site
- **THEN** the navigation needs the user's approval

### Requirement: Approval mode
The user SHALL be able to choose `ask before acting` (the default: the rules above) or `act on allowed sites` (`ask` sites act without the once-per-session prompt for `read`, `navigate` and `mutate`), and the hand-off and block rules SHALL apply in every mode.

#### Scenario: Act mode on password field
- **WHEN** the mode is `act on allowed sites` and the agent types into a password field
- **THEN** the call still fails with `DENIED`

### Requirement: Kill switch
The user SHALL be able to stop all browser activity at once from the side panel; in-flight calls fail with `DENIED`, the debugger detaches from every agent tab and new calls fail until the user resumes.

#### Scenario: Stop during a batch
- **WHEN** the user presses stop while a batch is running
- **THEN** no further item runs and the batch result says it was stopped by the user

### Requirement: Runaway loops are stopped
The extension SHALL fail a call with `DENIED` when the same action on the same target has failed twice in a row in a session, and SHALL tell the model to change approach.

#### Scenario: Repeated failing click
- **WHEN** the same ref click fails with `OBSCURED` twice
- **THEN** the third identical call fails with `DENIED` saying to try a different approach
