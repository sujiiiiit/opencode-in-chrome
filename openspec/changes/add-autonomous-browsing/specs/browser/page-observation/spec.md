## Purpose

Defines what the model sees of a page after reading it and after acting on it, so the relevant part fits in context and the model rarely needs to re-read a whole page.

## ADDED Requirements

### Requirement: Page actions return an outline diff
After every page action (computer click, type, key, scroll, hover, drag; `form_input`; `navigate` within the same document), the result SHALL include an exact line diff. The diff compares the page outline with the last outline that session saw of that tab. The diff SHALL:
- use the same line format and refs as `read_page`;
- mark each line as added (`+`) or removed (`-`), with unchanged runs collapsed to a count;
- be capped at 60 changed lines, stating how many more were left out.

When the session has not read the tab since its last navigation, or the document changed, the result SHALL include the windowed outline instead and say why. When the page did not change, the result SHALL say `No visible change`. The outline the result was built from SHALL become the session's last outline for that tab.

#### Scenario: Menu opens
- **WHEN** a session that read the page clicks a menu button and three menu items appear
- **THEN** the result lists the three items as `+` lines with their refs, and no unchanged lines

#### Scenario: Nothing changed
- **WHEN** a click changes nothing in the outline, the URL or the tabs
- **THEN** the result says `No visible change`

#### Scenario: New document
- **WHEN** a click follows a link to another page
- **THEN** the result names the new URL and includes the windowed outline of the new page instead of a diff

#### Scenario: Large change
- **WHEN** an action replaces a list of 200 rows
- **THEN** the diff shows the first 60 changed lines and states how many more changed

### Requirement: `read_page` is windowed around the viewport
By default, `read_page` SHALL list the elements within the viewport plus one viewport height above and one below. It SHALL state how many actionable elements lie above and below the window, and how to see them (scroll, `window: "page"` or `find`). A `window` argument SHALL accept `viewport`, `near` (the default) or `page`. When the output exceeds `max_chars`, lines farthest from the viewport SHALL be cut first, and the result SHALL state how many lines and actionable elements were cut above and below. A `ref_id` scope SHALL print that subtree whole, whatever the window.

#### Scenario: Long page
- **WHEN** the model reads a page 10 viewports tall while scrolled to the top
- **THEN** the result lists the elements in the first two viewport heights and states how many actionable elements are below

#### Scenario: Whole page asked for
- **WHEN** the model calls `read_page` with `window: "page"`
- **THEN** every element is listed, subject only to `max_chars`

#### Scenario: Over budget
- **WHEN** the window's lines exceed `max_chars`
- **THEN** lines farthest from the viewport are dropped first, and the result says how many were dropped above and below

### Requirement: Navigation waits for its own document
`navigate` to a URL SHALL count the navigation as loaded only after a top-frame commit for that navigation. A commit or load still finishing for the tab's previous document, such as a new tab's `about:blank`, SHALL NOT count. The result SHALL say what it waited for: load plus quiet, or the time cap.

#### Scenario: Fresh tab
- **WHEN** the model navigates a tab that was created a moment earlier and is still loading `about:blank`
- **THEN** the result reports the requested page's URL and title, not `about:blank`
