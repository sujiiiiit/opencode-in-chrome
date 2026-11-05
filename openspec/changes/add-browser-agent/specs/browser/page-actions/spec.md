# Spec Delta

## Purpose

Defines how the agent acts on a page: navigating, clicking, typing, pressing keys, scrolling, dragging, filling forms and uploading files, with results that report what changed.

## ADDED Requirements

### Requirement: Navigation waits for the page to settle
`navigate` SHALL accept a URL (https assumed when no scheme is given), `back` or `forward`, and SHALL return only after the page has loaded and its DOM has been quiet for 500 ms, or after 15 s, reporting the final URL and title.

#### Scenario: Normal navigation
- **WHEN** the agent navigates to `news.ycombinator.com`
- **THEN** the result reads `Navigated to https://news.ycombinator.com/ — "Hacker News"`

#### Scenario: Slow page
- **WHEN** the page is still loading after 15 s
- **THEN** the result reports the current URL and title and says the page may still be loading

#### Scenario: Navigation with snapshot
- **WHEN** the agent passes `snapshot: true`
- **THEN** the result also contains the interactive page tree

### Requirement: Real input events
Clicks, typing, key presses, scrolling, hovering and dragging SHALL be delivered as trusted browser input, so pages that ignore synthetic events still respond.

#### Scenario: Site checks trusted events
- **WHEN** a page only reacts to events with `isTrusted` true
- **THEN** a `left_click` by the agent triggers the page's handler

### Requirement: Targets by ref or coordinate
Each pointer action SHALL accept either a ref or a coordinate in the latest screenshot's coordinate frame; for a ref the element SHALL be scrolled into view and clicked at its visible centre.

#### Scenario: Click by ref
- **WHEN** the agent clicks a ref for a button below the fold
- **THEN** the page scrolls the button into view and clicks its centre

#### Scenario: Click by coordinate
- **WHEN** the agent clicks a coordinate read from a scaled screenshot
- **THEN** the click lands on the same page point the screenshot showed

### Requirement: Actionability checks before input
Before pointer input on a ref, the element SHALL be checked as visible, enabled and not covered by another element; a covered element SHALL fail with `OBSCURED` naming the covering element, and a disabled or zero-size element with `NOT_INTERACTABLE`, without sending input.

#### Scenario: Cookie banner covers button
- **WHEN** a fixed banner covers the target button
- **THEN** the click fails with `OBSCURED` naming the banner and no click is sent

### Requirement: Supported computer actions
`computer` SHALL support `left_click`, `right_click`, `double_click`, `triple_click`, `hover`, `left_click_drag`, `scroll` (direction and ticks at a point), `scroll_to` (ref), `type`, `key` (space-separated keys and chords such as `ctrl+a`, with `repeat`), `wait` (at most 10 s), `dialog`, `screenshot` and `zoom`, plus click modifiers.

#### Scenario: Keyboard chord
- **WHEN** the agent sends `key` with `ctrl+a`
- **THEN** the page receives a select-all key chord in the focused element

#### Scenario: Wait too long
- **WHEN** the agent asks to wait 30 seconds
- **THEN** the call fails with `INVALID_INPUT` stating the 10 second maximum

### Requirement: Every state-changing call carries a summary
`computer` clicks, drags, `key` and `type`, and `form_input` and `file_upload`, SHALL require an `action_summary` stating the effect in a few words; the summary is used for approvals and the timeline and SHALL be rejected if it contains the typed secret value.

#### Scenario: Missing summary
- **WHEN** the agent sends `left_click` without `action_summary`
- **THEN** the call fails with `INVALID_INPUT` asking for the summary

### Requirement: Results report what changed
Every action result SHALL state what was done and then what changed: URL or title change, tabs opened or closed, a dialog that appeared, focus moving, and up to 15 new or removed interactive elements near the target, or `No visible change`.

#### Scenario: Click opens a menu
- **WHEN** a click opens a dropdown menu
- **THEN** the result lists the menu's new items with their refs

#### Scenario: Click with no effect
- **WHEN** a click changes nothing observable within 1 s
- **THEN** the result ends with `No visible change`

### Requirement: Form filling by ref
`form_input` SHALL set the value of a text field, textarea, select (by option value or text), checkbox or radio (boolean) or contenteditable region by ref so that page frameworks register the change, and SHALL report the previous and new value.

#### Scenario: Framework-controlled input
- **WHEN** the agent fills a framework-controlled text input
- **THEN** the page's own state shows the new value and the result reads `Set "Customer name" to "Test User" (was "")`

#### Scenario: Unknown option
- **WHEN** the value matches no option of a select
- **THEN** the call fails with `INVALID_INPUT` listing the available options

### Requirement: File upload without the native picker
`file_upload` SHALL set files on a file input by ref from files the user attached to the chat or the session's workspace, without opening the operating system's file dialog, and SHALL refuse a combined size over 10 MB.

#### Scenario: Upload attachment
- **WHEN** the agent uploads a chat attachment to a file input ref
- **THEN** the input's `change` event fires with that file and the result names it

### Requirement: Page dialogs never hang the agent
When a page opens an alert, confirm, prompt or leave-page dialog, the extension SHALL report it in the current result and fail later page calls with `DIALOG_OPEN` until the agent or user answers it through `computer` action `dialog` (`accept` or `dismiss`, optional prompt text).

#### Scenario: Confirm dialog after click
- **WHEN** a click opens a confirm dialog
- **THEN** the click result contains `Dialog open: confirm "Delete item?"` and the next `read_page` fails with `DIALOG_OPEN`

### Requirement: Batched calls
`batch` SHALL run a list of tool calls in order in one request, stop at the first error, keep the results and images of the calls that completed, and run the safety check for each item.

#### Scenario: Error mid-batch
- **WHEN** the third of five items fails
- **THEN** the result has the first two results, the third's error and a line `2 completed, 2 not run`

### Requirement: Window size
`resize_window` SHALL set the outer size of the window holding the session's tab and report the resulting viewport size.

#### Scenario: Mobile width
- **WHEN** the agent resizes to 400x800
- **THEN** the result reports the new viewport size
