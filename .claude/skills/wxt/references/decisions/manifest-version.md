# Targeting MV2 vs MV3 per browser

WXT defaults: **Chromium → MV3; Firefox and Safari → MV2** (source: `resolve-config`).
- Chrome Web Store accepts only MV3.
- Firefox supports both. Choose MV3 (`wxt build -b firefox --mv3` or `manifestVersion: 3`) for parity with Chrome code (event-page background, `action`, `scripting`); MV2 if you need a persistent background or broad `webRequest` blocking with fewer changes.
- Safari: MV3 is supported on Safari 15.4+/macOS 12+; pass `--mv3` explicitly if you rely on MV3 APIs.

**Recommend:** set it explicitly per browser in the scripts (`"build:firefox": "wxt build -b firefox --mv3"`) so nobody is surprised by the MV2 default.
