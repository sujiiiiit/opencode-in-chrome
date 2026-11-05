# Spec Delta

## Purpose

Defines how the extension serves its browser tools to the paired opencode server so that any session's model can call them during a normal chat turn.

## ADDED Requirements

### Requirement: Extension serves browser tools to the paired server
While the extension is paired and browser access is enabled, it SHALL keep a client tool connection to the paired opencode server under the name `browser`, so the server lists the browser tools to models as `browser_<tool>`.

#### Scenario: Tools appear after pairing
- **WHEN** the user pairs the extension with a server and browser access is enabled
- **THEN** the server's tool list for new turns includes `browser_tabs_context`, `browser_navigate`, `browser_read_page` and the other browser tools

#### Scenario: Browser access disabled
- **WHEN** the user turns browser access off
- **THEN** the extension closes the connection and the server no longer lists `browser_*` tools for new turns

#### Scenario: Unpaired
- **WHEN** the extension has no stored connection or the stored token has expired
- **THEN** no tool connection is attempted

### Requirement: Connection authenticates without exposing the long-lived token
The extension SHALL authenticate the tool connection with a short-lived ticket obtained from the server using the stored connection token, and SHALL never place the long-lived token in a URL.

#### Scenario: Ticket used for the socket
- **WHEN** the extension opens the tool connection
- **THEN** it first requests a client-MCP ticket with the stored token and opens the socket with that ticket in the URL

#### Scenario: Ticket rejected
- **WHEN** the server rejects the ticket
- **THEN** the extension requests a new ticket before its next reconnect attempt

### Requirement: Connection recovers on its own
The extension SHALL reconnect with backoff (500 ms rising to at most 10 s) after the connection drops, after the server restarts, and after the background worker is restarted by the browser.

#### Scenario: Server restart
- **WHEN** the opencode server restarts while the extension stays paired
- **THEN** the browser tools are listed again within 15 seconds of the server accepting connections

#### Scenario: Worker restarted
- **WHEN** the browser stops and later restarts the extension's background worker
- **THEN** the worker reopens the tool connection on startup without user action

### Requirement: Calls are attributed to the calling session
Every tool call SHALL be handled in the context of the opencode session that issued it; a call without a session SHALL be refused with error code `NO_SESSION`.

#### Scenario: Two sessions in parallel
- **WHEN** two sessions call `browser_tabs_context` at the same time
- **THEN** each receives only its own session's tabs

### Requirement: Results use a fixed text and image shape
Each tool result SHALL be MCP content of text parts and at most the images that tool produces, and SHALL end with a one-line tab footer naming the tab the call acted on and the session's tab count.

#### Scenario: Footer present
- **WHEN** any page tool succeeds
- **THEN** the last text line reads like `Tab 412 (1 of 2 in this session): "Hacker News" https://news.ycombinator.com/`

### Requirement: Errors are typed and actionable
A failed call SHALL return `isError: true` with a text that starts with an error code from the fixed set `NO_SESSION`, `NO_TAB`, `NOT_IN_GROUP`, `RESTRICTED_PAGE`, `STALE_REF`, `OBSCURED`, `NOT_INTERACTABLE`, `TIMEOUT`, `DIALOG_OPEN`, `NEEDS_APPROVAL`, `DENIED`, `BLOCKED_SITE`, `DEBUGGER_DETACHED`, `INVALID_INPUT`, `INTERNAL` (an unexpected failure), followed by a sentence saying what to do next.

#### Scenario: Stale ref
- **WHEN** the model clicks a ref whose element was removed
- **THEN** the result is an error starting `STALE_REF:` that tells the model to read the page again

#### Scenario: Bad input
- **WHEN** a call is missing a required argument
- **THEN** the result is an error starting `INVALID_INPUT:` naming the argument
