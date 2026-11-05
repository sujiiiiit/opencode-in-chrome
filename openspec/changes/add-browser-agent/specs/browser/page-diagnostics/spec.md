# Spec Delta

## Purpose

Defines how the agent inspects and scripts a page for debugging: reading console output, reading network requests and running JavaScript in the page.

## ADDED Requirements

### Requirement: Console capture
`console` SHALL return console messages and uncaught exceptions logged by the tab's page since the tab joined the session, each with time, level and text, filtered by an optional regex `pattern`, `onlyErrors` and `limit` (default 100), with `clear` to drop returned messages.

#### Scenario: Filter by pattern
- **WHEN** the page logged `probe-log 1` and other messages and the agent passes pattern `probe`
- **THEN** only the `probe-log 1` message is returned, like `[1] 20:31:24 LOG probe-log 1`

#### Scenario: Uncaught error
- **WHEN** the page throws an uncaught exception
- **THEN** it is returned with level `ERROR` and its first stack frame

### Requirement: Console survives same-site navigation only
Console history SHALL be kept across navigations within the same site and cleared when the tab moves to a different site.

#### Scenario: Cross-site navigation
- **WHEN** the tab navigates from one site to another
- **THEN** a later `console` call returns only messages from the new site

### Requirement: Network capture from adoption
`network` SHALL return requests the page made since the tab joined the session, each with method, URL, resource type, status, size and duration, filtered by an optional `urlPattern` substring and `limit` (default 100), excluding `data:` URLs and the extension's own requests.

#### Scenario: API calls
- **WHEN** the agent passes `urlPattern: "/api/"`
- **THEN** only matching requests are returned, like `GET 200 fetch 1.2 kB 84 ms https://app.test/api/items`

#### Scenario: Before first call
- **WHEN** the page loaded before the agent first called `network`
- **THEN** the page's load requests are included

### Requirement: Response bodies on request
`network` SHALL return the response body of one request when given its id, capped at 20 000 characters, for text-like responses only.

#### Scenario: JSON body
- **WHEN** the agent asks for the body of a JSON response
- **THEN** the body is returned as text with a truncation note when longer than the cap

### Requirement: JavaScript in the page
`javascript` SHALL evaluate code in the page's main world with top-level `await`, return the last expression's value as JSON (capped at 20 000 characters) or the thrown error with its message, and work on pages whose content security policy forbids `eval`.

#### Scenario: Read page data
- **WHEN** the agent runs `document.title`
- **THEN** the result is the title as a JSON string

#### Scenario: Strict CSP page
- **WHEN** the page's policy blocks `eval`
- **THEN** the code still runs and returns its value

#### Scenario: Thrown error
- **WHEN** the code throws `new Error("boom")`
- **THEN** the result is an error containing `boom`

### Requirement: JavaScript runs time-boxed
A `javascript` call SHALL be abandoned after 30 s with `TIMEOUT`.

#### Scenario: Never-resolving promise
- **WHEN** the code awaits a promise that never settles
- **THEN** the call fails with `TIMEOUT` after 30 s
