# Zipping, publishing, CI (WXT 0.21 / publish-browser-extension 6.x)

Official page: `docs/guide/essentials/publishing.md`. `wxt submit --help` lists every flag (it's an alias for `publish-extension`).

## Zips

```sh
wxt zip                    # .output/<name>-<packageVersion>-chrome.zip
wxt zip -b firefox         # also .output/<name>-<packageVersion>-sources.zip (prints every included file)
wxt zip -b edge            # only if Edge-specific code exists (otherwise reuse the chrome zip)
wxt zip --sources          # force a sources zip for any browser
```
Config (`zip:` in `wxt.config.ts`):
- `artifactTemplate` (default `'{{name}}-{{packageVersion}}-{{browser}}{{modeSuffix}}.zip'`), `sourcesTemplate` (default `'{{name}}-{{packageVersion}}-sources{{modeSuffix}}.zip'`). Variables: `name`, `version` (manifest.version), `versionName`, `packageVersion`, `browser`, `mode`, `modeSuffix`, `manifestVersion`.
- `name`, `compressionLevel` (0–9, default 9), `exclude` (globs to drop from the extension zip, e.g. `['**/*.map']`).
- Sources zip (0.21 semantics: **allowlist minus blocklist**): `includeSources`, `excludeSources`, `dotSources` (include hidden files; careful with secrets), `sourcesRoot`, `zipSources`, `downloadPackages` (private npm packages bundled for reviewers; needs `.npmrc`).

## Version numbers

The version comes from **package.json**. `1.4.0-beta.1` → manifest `version: "1.4.0"` + `version_name: "1.4.0-beta.1"`. Stores reject re-uploads of the same `version`, so bump package.json (`npm version patch`) before zipping. Use only 1–4 dot-separated integers in the numeric part.

## `wxt submit`

```sh
wxt submit init                 # interactive: writes .env.submit with credentials (gitignore it!)
wxt submit --dry-run \
  --chrome-zip .output/*-chrome.zip \
  --firefox-zip .output/*-firefox.zip --firefox-sources-zip .output/*-sources.zip \
  --edge-zip .output/*-chrome.zip
wxt submit …                    # same without --dry-run
```
Also: `wxt submit status`, `wxt submit set-deploy-percentage`.

### Chrome Web Store: use API v2
- **CWS API v1 (refresh-token auth) was scheduled to stop working on Oct 15, 2026.** Use v2: run `wxt submit init` and choose v2. Auth is a **service account** (`--chrome-service-account-client-email`, `--chrome-service-account-private-key`, or `--chrome-service-account-access-token`) plus `--chrome-publisher-id` and `--chrome-extension-id`. Flags: `--chrome-api-version v2`, `--chrome-publish-type STAGED_PUBLISH` (publish manually later), `--chrome-deploy-percentage`, `--chrome-cancel-pending`, `--chrome-skip-review` (only eligible updates), `--chrome-skip-submit-review`.
- v1-only (deprecated) flags you may see in old CI: `--chrome-client-id`, `--chrome-client-secret`, `--chrome-refresh-token`, `--chrome-publish-target`.
- The first publish must be done manually in the Developer Dashboard (listing, privacy practices, permission justifications, screenshots).

### Firefox AMO
- `--firefox-extension-id` (the `gecko.id`), `--firefox-jwt-issuer`, `--firefox-jwt-secret` (AMO API keys), `--firefox-sources-zip`, `--firefox-channel listed|unlisted`, `--firefox-compatibility firefox,android`, `--firefox-amo-metadata-file`.
- **Sources zip**: reviewers rebuild your code. Test it: unzip it into an empty folder, run `pnpm i && pnpm zip:firefox`, and confirm the output is identical. Include a `README.md`/`SOURCE_CODE_REVIEW.md` with the exact commands (and Node/pnpm versions). `.env` files change chunk hashes: either include a non-secret `.env` via `includeSources` + `dotSources`, or build without it.
- Needs `gecko.id` and (new listings) `data_collection_permissions` in the manifest.

### Edge Add-ons
`--edge-product-id`, `--edge-client-id`, `--edge-api-key`, `--edge-zip` (the chrome zip works).

### Opera
`--opera-package-id`, `--opera-session-id`, `--opera-zip`.

### Safari
Not supported by `wxt submit`. `wxt build -b safari` → `xcrun safari-web-extension-packager .output/safari-mv2` (or `-mv3`) → build, sign, and upload with Xcode / App Store Connect.

## GitHub Actions template

```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      dryRun: { type: boolean, default: true }
jobs:
  submit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }   # WXT 0.21 requires Node >= 22
      - run: pnpm install --frozen-lockfile
      - run: pnpm compile                          # tsc --noEmit (optional)
      - run: pnpm zip && pnpm zip:firefox
      - run: >
          pnpm wxt submit ${{ inputs.dryRun && '--dry-run' || '' }}
          --chrome-zip .output/*-chrome.zip
          --firefox-zip .output/*-firefox.zip --firefox-sources-zip .output/*-sources.zip
        env:
          CHROME_API_VERSION: v2
          CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
          CHROME_PUBLISHER_ID: ${{ secrets.CHROME_PUBLISHER_ID }}
          CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL: ${{ secrets.CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL }}
          CHROME_SERVICE_ACCOUNT_PRIVATE_KEY: ${{ secrets.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY }}
          FIREFOX_EXTENSION_ID: ${{ secrets.FIREFOX_EXTENSION_ID }}
          FIREFOX_JWT_ISSUER: ${{ secrets.FIREFOX_JWT_ISSUER }}
          FIREFOX_JWT_SECRET: ${{ secrets.FIREFOX_JWT_SECRET }}
```
Each CLI flag maps to an env var: upper snake case of the flag (`--chrome-publisher-id` → `CHROME_PUBLISHER_ID`; verified against publish-browser-extension 6.2). Run `wxt submit init` locally to see exactly which variables it writes to `.env.submit`, and mirror those as repo secrets. Real-world workflows with version bumps and changelogs: `aklinker1/github-better-line-counts` (`.github/workflows/submit.yml`), `GuiEpi/plex-skipper`.

## Pre-release checklist

- [ ] package.json version bumped
- [ ] `node scripts/inspect-manifest.mjs --build chrome,firefox`: permissions minimal and identical in intent across stores; no dev-only permissions (`tabs`/`scripting`/localhost come only from dev builds)
- [ ] Permissions didn't grow since the last release (or new ones are optional), otherwise users get disabled
- [ ] No secrets in the bundle (`WXT_*` values are public); no `.env.submit` in git
- [ ] Firefox: `gecko.id`, `data_collection_permissions`, sources zip rebuilt and verified
- [ ] Privacy policy URL ready if you handle user data; store "single purpose" description matches the features
- [ ] Full policy checklist (data disclosure, Limited Use, 2-Step Verification, Firefox data_collection_permissions, Apple App Privacy): `store-policies.md`
- [ ] Tested the update path (`runtime.onInstalled` with `reason: 'update'`, storage migrations)
