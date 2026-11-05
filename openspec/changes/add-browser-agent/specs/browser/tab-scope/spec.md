# Spec Delta

## Purpose

Defines which browser tabs the agent may see and act on, so each chat session works in its own clearly marked set of tabs and never touches the user's other tabs.

## ADDED Requirements

### Requirement: Each session owns one tab group
The extension SHALL keep at most one Chrome tab group per opencode session, titled with a short session label, and SHALL only let that session's calls read or act on tabs in its group or tabs the user shared with it.

#### Scenario: Acting outside the group
- **WHEN** a call names a tab that is not in the calling session's group and was not shared
- **THEN** it fails with `NOT_IN_GROUP` and lists the session's valid tab ids

#### Scenario: Group survives worker restart
- **WHEN** the background worker restarts during a session
- **THEN** the session's group and tab ids are recovered and later calls keep working

### Requirement: Listing the session's tabs
`tabs_context` SHALL return the session's tab ids, titles, URLs and which tab is current; with `createIfEmpty` it SHALL create the group with one blank tab when the session has none.

#### Scenario: No group yet
- **WHEN** a new session calls `tabs_context` with `createIfEmpty: true`
- **THEN** a new group with one blank tab is created in the user's last focused window and its id is returned

#### Scenario: Empty without create
- **WHEN** a session with no group calls `tabs_context` without `createIfEmpty`
- **THEN** the result says the session has no tabs and how to create one

### Requirement: Creating and closing tabs
`tabs_create` SHALL open a new tab in the session's group (optionally at a URL) without stealing focus from the user's current tab; `tabs_close` SHALL close only tabs in the session's group.

#### Scenario: Close last tab
- **WHEN** the session closes the last tab in its group
- **THEN** the group is removed and the next `tabs_context` with `createIfEmpty` starts a fresh group

#### Scenario: Current tab after close
- **WHEN** the current tab is closed and other tabs remain in the group
- **THEN** the most recently used remaining tab becomes current and later calls without a tab id use it

### Requirement: User can share an existing tab
The user SHALL be able to share the active tab with a session from the side panel; a shared tab joins the session's group and is released back to the user's tabs when the user unshares it or the session ends.

#### Scenario: Share current tab
- **WHEN** the user shares the active tab with the open chat
- **THEN** the tab moves into the session's group and the next `tabs_context` lists it

### Requirement: Popups follow their opener
A tab opened by a page inside a session's group (link with a new-window target, `window.open`) SHALL join that group automatically and appear in the next result's footer.

#### Scenario: Link opens new tab
- **WHEN** the agent clicks a link that opens a new tab
- **THEN** the click result names the new tab id and the tab is in the session's group

### Requirement: Restricted pages are read-only to navigation
On pages the extension cannot script (browser-internal pages, other extensions' pages, the Chrome Web Store, blank tabs) every tool except `navigate` and `tabs_*` SHALL fail with `RESTRICTED_PAGE`.

#### Scenario: Read a new-tab page
- **WHEN** the agent calls `read_page` on `chrome://newtab/`
- **THEN** it fails with `RESTRICTED_PAGE` telling the model to navigate to a web page first

### Requirement: Agent tabs are visibly marked
While a session is acting on a tab, the tab SHALL show a visible indicator in the page and the tab group SHALL be labelled, so the user can tell agent tabs from their own; the indicator SHALL never appear in screenshots taken by the agent.

#### Scenario: Indicator hidden from screenshots
- **WHEN** the agent takes a screenshot of a tab showing the indicator
- **THEN** the returned image does not contain the indicator
