# Decision guides index

When a task has real alternatives, open the ONE matching file (~150-400 tokens). It has the options table, the recommendation, why, and when to deviate. Present it to the user as described in SKILL.md, step 3.

| Decision | File |
|---|---|
| Where should this UI live? | `decisions/ui-location.md` |
| On-page UI: `createIntegratedUi` vs `createShadowRootUi` vs `createIframeUi` | `decisions/onpage-ui.md` |
| Messaging between contexts | `decisions/messaging.md` |
| Talking to the page's own JavaScript (main world) | `decisions/main-world.md` |
| Static vs on-demand content scripts | `decisions/injection-mode.md` |
| Storage: API and area | `decisions/storage.md` |
| Shared state across popup / content / background | `decisions/shared-state.md` |
| Network requests and CORS | `decisions/network-cors.md` |
| Blocking or modifying requests | `decisions/request-blocking.md` |
| Permissions strategy | `decisions/permissions.md` |
| Background long-running work in MV3 | `decisions/long-running-work.md` |
| Styling approach | `decisions/styling.md` |
| i18n | `decisions/i18n.md` |
| Config, secrets, and environments | `decisions/config-secrets.md` |
| Targeting MV2 vs MV3 per browser | `decisions/manifest-version.md` |
| Testing approach | `decisions/testing.md` |
| Authentication | `decisions/auth.md` |
