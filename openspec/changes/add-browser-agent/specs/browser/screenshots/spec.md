# Spec Delta

## Purpose

Defines how the agent sees a page as an image: screenshots and zoomed regions sized to a token budget with a coordinate frame for clicking, bounded image history, and GIF recordings of a session's actions.

## ADDED Requirements

### Requirement: Screenshots fit a token budget
`screenshot` SHALL capture the tab's viewport as JPEG, downscaled so its long edge is at most 1568 px, and SHALL report the image size, an image id and the coordinate frame the agent must click in.

#### Scenario: Wide viewport
- **WHEN** the viewport is 1920x911 CSS pixels
- **THEN** the result reads like `Screenshot ss_8f2k (1568x744 jpeg) — coordinate frame 1568x744` and includes the image

#### Scenario: Scale parameter
- **WHEN** the agent passes `scale: 0.5`
- **THEN** the image is half the frame's width and height while coordinates stay in the full frame

### Requirement: Coordinates map back exactly
A coordinate given in a screenshot's coordinate frame SHALL be mapped to the same CSS-pixel point of the viewport, regardless of device pixel ratio or browser zoom.

#### Scenario: High-density display
- **WHEN** the display has a device pixel ratio of 2
- **THEN** clicking the screenshot coordinate of a button's centre clicks that button

### Requirement: Background tabs can be captured
A screenshot of a tab that is not the active tab of its window SHALL either succeed or fail within 5 s with `TIMEOUT` that says the tab must be brought to front, and SHALL never hang the call.

#### Scenario: Hidden tab
- **WHEN** the agent screenshots a tab behind the user's active tab
- **THEN** the result arrives within 5 s

### Requirement: Zoomed region
`zoom` SHALL capture a rectangle given in the coordinate frame at higher detail, with the output long edge at most 1568 px.

#### Scenario: Small icon
- **WHEN** the agent zooms a 200x100 region
- **THEN** the image shows that region enlarged and the result states the region

### Requirement: Screenshots only for vision models
The screenshot and zoom actions SHALL be described to the model only as available when the session's model accepts images; for other models they SHALL fail with `INVALID_INPUT` advising `read_page`.

#### Scenario: Text-only model
- **WHEN** a model without image input calls `screenshot`
- **THEN** the call fails with `INVALID_INPUT` and suggests `read_page`

### Requirement: Image history is bounded
The extension SHALL keep at most the last 10 screenshot ids per session for coordinate mapping and uploads; older ids SHALL fail with `STALE_REF`.

#### Scenario: Old screenshot id
- **WHEN** the agent uploads a screenshot id that is no longer kept
- **THEN** the call fails with `STALE_REF` asking for a new screenshot

### Requirement: Screenshot upload to a page
`upload_image` SHALL put a kept screenshot into a file input by ref or drop it at a coordinate.

#### Scenario: Upload to file input
- **WHEN** the agent uploads a screenshot id to a file input ref
- **THEN** the input receives an image file named as given or `image.png`

### Requirement: GIF recording
`gif` SHALL start and stop recording frames for the session's tabs, and export the frames as an animated GIF with optional click markers and action labels, saved as a browser download named by the agent.

#### Scenario: Record a flow
- **WHEN** the agent starts recording, performs three clicks and exports with filename `checkout.gif`
- **THEN** a file `checkout.gif` is downloaded containing frames for each action with click markers

#### Scenario: Export with no frames
- **WHEN** the agent exports with no recorded frames
- **THEN** the call fails with `INVALID_INPUT` saying nothing was recorded
