# Best practices index (WXT 0.21)

Open only the file for the area you're touching (each 0.2-1.4k tokens): full rule, reason, ❌/✅ code. Rule ids describe the rule; **C**=critical **H**=high **M**=medium **L**=low.

| Area | File | Rules |
|---|---|---|
| Background / service worker lifecycle | `best-practices/svc.md` | register-listeners-synchronously C, avoid-global-state C, handle-install-update H, no-keepalive-hacks H, offscreen-documents H, declarative-net-request H, alarms-not-timers H, no-dynamic-import-in-sw M |
| Content script injection | `best-practices/inject.md` | use-main-function C, use-ctx C, choose-world C, run-at-timing H, spa-navigation H, dynamic-registration H, all-frames M, narrow-matches H, observe-efficiently M |
| Messaging | `best-practices/msg.md` | return-true-for-async H, type-safe-messaging H, use-tabs-sendmessage H, handle-no-receiver H, use-ports-for-streams M, avoid-circular-messages M, prefer-storage-for-state H, validate-senders H |
| Storage | `best-practices/store.md` | use-define-item H, choose-storage-area H, group-related-data M, watch-for-changes H, handle-quota-errors M, versioned-migrations H, serializable-values M |
| Bundle size & performance | `best-practices/bundle.md` | analyze-size M, light-content-scripts H, split-by-entrypoint M, lazy-load-in-pages M, choose-lean-deps M, wasm-and-heavy-assets M, strip-dev-code L |
| Manifest & permissions | `best-practices/manifest.md` | minimal-permissions C, use-optional-permissions H, web-accessible-resources H, content-security-policy H, let-wxt-generate H, version-from-package-json M |
| UI: popup, side panel, on-page UI | `best-practices/ui.md` | use-shadow-dom H, cleanup-on-unmount H, iframe-for-heavy-ui M, defer-popup-work M, popup-is-ephemeral H, sidepanel-persistence M, avoid-layout-thrashing M, respect-the-host-page M, hash-routing L |
| TypeScript & project hygiene | `best-practices/ts.md` | use-imports-module H, use-browser-not-chrome H, strict-null-safety M, avoid-any-in-handlers M, type-entrypoint-options L, augment-browser-types L, import-meta-env M, path-aliases L, entrypoint-layout H |
| Cross-browser | `best-practices/cross-browser.md` | explicit-manifest-version H, feature-detect H, firefox-id-and-consent C, firefox-host-permissions H, test-every-target H |
| Security & store policy | `best-practices/security.md` | no-remote-code C, no-secrets-in-bundle C, no-privileged-proxy C, validate-senders H, untrusted-page-data H, safe-dom-writes H, shadow-dom-is-not-a-boundary H, token-storage H, least-exposure M, csp-strict M, supply-chain M, privacy-and-data-policy M |
| Release & updates | `best-practices/release.md` | permission-changes C, test-update-path H, cws-api-v2 H, firefox-sources-zip H |

Also: `best-practices/review-checklist.md` (use for any code review) and `best-practices/wrong-advice.md` (stale/wrong patterns from community guides and how to fix them).
