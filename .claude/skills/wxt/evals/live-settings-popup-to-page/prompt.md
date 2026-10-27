---
tags: [wxt]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

add a settings area in the popup: an on/off switch and a highlight color picker. the content script should highlight all links on the page in that color when its on, and it should change instantly when i change it in the popup, without reloading the tab. also whats the best way for the popup and the page to talk to each other here?

Input files: the WXT project in this folder (package.json, wxt.config.ts, entrypoints/, public/, assets/)
