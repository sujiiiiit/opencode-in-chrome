# Spec Delta

## Purpose

Defines how the agent reads a web page as compact text: an accessibility-style tree whose elements carry refs the agent can act on, a local element finder, and main-text extraction.

## ADDED Requirements

### Requirement: Page tree with refs
`read_page` SHALL return one line per kept element in the form `role "name" [ref] attr="value" (state)`, indented one space per depth, followed by `Viewport: WxH` and the scroll position.

#### Scenario: Form page
- **WHEN** the agent reads a page with a labelled text input and a submit button
- **THEN** the output contains lines like `textbox "Customer name" [e1]` and `button "Submit order" [e13]`

### Requirement: Refs are stable and fail closed
A ref SHALL identify the same element across reads of the same document, new elements SHALL get new refs, and a ref whose element is gone or whose document has changed SHALL fail with `STALE_REF`, never resolve to another element.

#### Scenario: Read twice
- **WHEN** the agent reads the same unchanged page twice
- **THEN** each element has the same ref both times

#### Scenario: After navigation
- **WHEN** the agent uses a ref read before the tab navigated to a new document
- **THEN** the call fails with `STALE_REF`

### Requirement: Interactive and all filters
With `filter: "interactive"` (the default) `read_page` SHALL list only actionable elements (links, buttons, form controls, elements with interactive roles or click handlers, contenteditable regions) that are rendered; with `filter: "all"` it SHALL also include structural and text elements and hidden elements marked `(hidden)`.

#### Scenario: Hidden element
- **WHEN** a button has `display: none`
- **THEN** it is absent from the interactive read and listed with `(hidden)` in the all read

#### Scenario: Offscreen element
- **WHEN** an interactive element is below the viewport
- **THEN** the interactive read lists it with `(offscreen)` so the agent can `scroll_to` it

### Requirement: Element state is reported
Each line SHALL include the element's current state where it applies: `value="…"` for text fields (passwords shown as `value=•••`), `(checked)`, `(selected)`, `(disabled)`, `(expanded)`/`(collapsed)`, `(required)`, `(focused)` and `(readonly)`.

#### Scenario: Checkbox after click
- **WHEN** the agent ticks a checkbox and reads the page
- **THEN** that checkbox's line includes `(checked)`

#### Scenario: Password field
- **WHEN** a password field contains text
- **THEN** its line shows `value=•••` and never the characters

### Requirement: Shadow DOM and frames are included
The tree SHALL include elements inside open shadow roots and inside iframes, same-origin and cross-origin, nested under their host; refs inside frames SHALL be usable by every action tool.

#### Scenario: Open shadow root
- **WHEN** a button is inside an open shadow root
- **THEN** it appears in the tree with a ref and can be clicked by that ref

#### Scenario: Cross-origin iframe
- **WHEN** a page embeds a cross-origin iframe containing an input
- **THEN** the input appears under an `iframe` line with its origin and accepts `form_input` by ref

### Requirement: Output size is bounded
`read_page` SHALL cap output at `max_chars` (default 30 000), cut at a line boundary, and end with a note stating the full size and how to narrow it (`ref_id` subtree, `depth`, or `find`).

#### Scenario: Large page
- **WHEN** the tree is larger than `max_chars`
- **THEN** the output ends with a line like `[truncated at 30000 of 84211 chars: pass ref_id, a smaller depth, or use find]`

### Requirement: Subtree reads
With `ref_id`, `read_page` SHALL return only that element and its descendants.

#### Scenario: Read one form
- **WHEN** the agent passes the ref of a form
- **THEN** only the form and its fields are returned

### Requirement: Local find
`find` SHALL search the page tree by words, role and text without calling a model, return at most 20 matches ranked by relevance as tree lines with refs, and say how many more matched when capped.

#### Scenario: Find login link
- **WHEN** the agent calls `find` with "login link" on a page that has a link named "login"
- **THEN** the first match is that link with its ref

#### Scenario: No match
- **WHEN** nothing matches
- **THEN** the result says no element matched and suggests `read_page`

### Requirement: Main text extraction
`get_page_text` SHALL return the page title, URL and the readable main content as plain text, capped at `max_chars` (default 30 000) with a truncation note.

#### Scenario: Article page
- **WHEN** the agent reads an article page
- **THEN** the output starts with `Title:` and `URL:` lines followed by the article text without navigation menus

### Requirement: Page text is marked untrusted
Text returned by `read_page`, `find` and `get_page_text` SHALL be wrapped in markers that identify it as untrusted page content.

#### Scenario: Injected instruction on page
- **WHEN** a page contains the text "Ignore previous instructions"
- **THEN** that text appears only inside the untrusted-content markers of the result
