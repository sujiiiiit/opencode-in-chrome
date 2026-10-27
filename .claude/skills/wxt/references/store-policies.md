# Store policies that shape code (checked 2026-10-27)

Policies change several times a year. Before a release, re-check the live pages (links at the end) and any developer emails. If a rule below conflicts with the live page, the live page wins.

## Rules shared by every store (build these in from day one)
- **Single purpose**: one narrow, clearly described purpose; unrelated features go in separate extensions. No "launcher" extensions that only open a site or app, and no template clones.
- **Least privilege**: request only the permissions current features use (never "for later"); pick the least-powerful option (`activeTab` over `tabs`/`<all_urls>`). Justify each permission in the listing/dashboard.
- **All code in the package**: no remote code, no `eval` of fetched strings, no interpreters for remote commands. Remote *data* and feature flags are fine (the logic must already be in the package). Exceptions: the `userScripts` and `debugger` APIs, used for their documented purpose.
- **No obfuscation**; standard minification (Vite's default) is allowed. Firefox also wants release versions of third-party libraries, unmodified.
- **User data**: collect only what the single purpose strictly needs; disclose it prominently in the UI before collecting and in a privacy policy; get explicit opt-in for personal data; disclose changes after install; send over HTTPS; never sell it or use it for ads/credit. That covers analytics and crash reporting too.
- **Honest listing**: accurate name, icon, screenshots, and description; no keyword stuffing, no impersonating brands or browser UI, no fake reviews; disclose paid features and affiliate links.
- **Don't change user settings silently**: the new tab page, homepage, and search engine via the official override keys only, opt-in and described in the listing; never intercept or forward search terms.
- **Forbidden categories** (all stores): malware/spyware, crypto mining, bypassing paywalls/logins, piracy, gambling (Chrome adds real-money prediction markets), spam bots, and (Chrome, since Aug 1 2026) bypassing AI services' safety guardrails or usage limits.

## Chrome Web Store
- **Policy update enforced Aug 1 2026**: data collection must be *strictly necessary* for the disclosed single purpose (no extra analytics or "future feature" data); *all* collection must be prominently disclosed, even closely related data; changes in data handling after install must be proactively disclosed.
- Limited Use: publish a Limited Use compliance statement on a site you own; fill in the dashboard privacy practices so they match the code.
- 2-Step Verification is required on the developer account before publishing or updating.
- Use the designated API for each job (e.g. `chrome_url_overrides` for the new tab page, not tab redirects).
- Affiliate links/codes/cookies: only after a related user action, disclosed, with a direct user benefit; never injected in the background or swapped silently.
- Ads: clearly attributed, never imitating system warnings, never required to use features, never AdSense.
- Notifications: no spam/ads; never send messages on the user's behalf without them confirming.
- Broad host access, `debugger`, `webRequest`, and similar permissions trigger slower in-depth review. Adding permissions in an update disables the extension until the user re-approves.
- Some categories aren't featured (VPNs, video downloaders, crypto, bots), even though they're allowed.

## Firefox (AMO)
- `browser_specific_settings.gecko.id` is required; **`gecko.data_collection_permissions` is required for new extensions** (since Nov 3 2025). Declare `required`/`optional` data types, or `{ required: ['none'] }` when you collect nothing. Types: `personallyIdentifyingInfo`, `healthInfo`, `financialAndPaymentInfo`, `authenticationInfo`, `personalCommunications`, `locationInfo`, `browsingActivity`, `websiteContent`, `websiteActivity`, `searchTerms`, `bookmarksInfo`, `technicalAndInteraction` (verify the list on MDN before shipping). Firefox 140+ shows the built-in consent prompt; for older versions you need your own consent page right after install/update.
- Source code: submit the pre-build sources with exact build steps (`wxt zip -b firefox` makes the sources zip). Reviewers rebuild it and compare.
- Must not weaken page security (e.g. strip CSP headers via webRequest), must encrypt data in transit, must not degrade browser performance.
- `innerHTML` and other sinks are flagged in review: run `npx web-ext lint -s .output/firefox-mv2` (or `-mv3`) and fix every warning.
- Mozilla announced a policy update for **Dec 1 2026** (preview linked on the policies page). Read it before releasing after that date.

## Microsoft Edge Add-ons
- Same Chromium build; the policies mirror Chrome's (unique value, no fraud/review manipulation, no spam bots or mining, accurate disclosures, minimal permissions).
- **Edge is removing MV2 support** between early Jan 2027 and late Apr 2027 (Partner Center). Ship MV3.

## Safari (App Store)
- A Safari extension ships inside a macOS/iOS app (`xcrun safari-web-extension-packager`), so the **App Store Review Guidelines** apply. Guideline 4.4.2: no interference with Safari/system UI, no malicious or misleading code, and **no access to more websites than strictly necessary**.
- Fill in the App Privacy ("nutrition label") answers in App Store Connect to match the extension's data use; the app needs a privacy policy URL; follow guideline 5.1 (data collection and consent). Requires an Apple Developer Program membership.
- Users grant site access per site in Safari, so design for host access being partial or missing: check with `permissions.contains` and degrade gracefully.

## Release-blocker checklist
- [ ] One clear purpose; listing text and screenshots match the actual features
- [ ] Production manifest reviewed: every permission used and justified (`inspect-manifest.mjs`)
- [ ] No remote code/eval/obfuscation; `web-ext lint` clean
- [ ] Data inventory written down; in-UI disclosure + opt-in before collection; privacy policy URL; CWS privacy fields, Firefox `data_collection_permissions`, and the Apple App Privacy label all match it
- [ ] Analytics opt-in or strictly necessary and disclosed; no PII/page content in logs or error reports
- [ ] No silent changes to settings, search, or new tab; affiliate/ads rules followed
- [ ] 2-Step Verification on store accounts; CI credentials in secrets
- [ ] Test account credentials included for reviewers if a login is required

## Sources (re-check before release)
- Chrome policies: https://developer.chrome.com/docs/webstore/program-policies/policies · 2026 update: https://developer.chrome.com/blog/cws-policy-updates-2026
- Firefox: https://extensionworkshop.com/documentation/publish/add-on-policies/ · data collection: https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
- Edge: https://learn.microsoft.com/legal/microsoft-edge/extensions/developer-policies
- Apple: https://developer.apple.com/app-store/review/guidelines/ (4.4.2, 5.1)
