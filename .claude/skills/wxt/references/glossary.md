# Plain words → WXT terms

Format: *what users say* → **term**: where it lives. Name the proper term once in your reply.

## Visible UI
- *little window when I click the icon, toolbar dropdown, extension menu* → **popup**: `entrypoints/popup/`
- *toolbar icon, puzzle button, number on the icon* → **action / badge**: `manifest.action`, `browser.action.setBadgeText`
- *panel on the side, sidebar that stays open* → **side panel** (Chromium) / **sidebar** (Firefox): `entrypoints/sidepanel/`
- *settings/preferences page* → **options page**: `entrypoints/options/`
- *replace new tab / history / bookmarks page* → **URL overrides**: `entrypoints/newtab|history|bookmarks/`
- *welcome/onboarding/changelog page, full-page app* → **unlisted page**: `entrypoints/<name>.html` + `browser.runtime.getURL('/<name>.html')`
- *box/button/widget ON the website, inject UI* → **content script UI**: `createShadowRootUi` / `createIntegratedUi` / `createIframeUi`
- *popup/modal/toast shown on the website* → content script UI with `position: 'modal' | 'overlay'`
- *panel in DevTools* → **devtools page**: `entrypoints/devtools/` + `devtools.panels.create`
- *right-click item* → **context menu**: `browser.contextMenus` (`contextMenus` permission)
- *hotkey, keyboard shortcut* → **commands**: `manifest.commands` + `commands.onCommand`
- *desktop alert* → **notifications**; *address-bar suggestions* → **omnibox**; *site favicon in my UI* → **`_favicon` API** (Chromium, `favicon` permission)

## Code that runs
- *the brain, always-running part, where API calls go* → **background** (MV3 service worker / event page): `entrypoints/background.ts`, `defineBackground`
- *script that reads/changes the website, scrape the page* → **content script**: `entrypoints/<name>.content.ts`, `defineContentScript`
- *use the site's own JS variables, intercept its fetch/XHR* → **main-world script**: `injectScript` + `defineUnlistedScript` (or `world: 'MAIN'`)
- *run only when I click, inject on demand* → **programmatic injection**: `registration: 'runtime'` + `scripting.executeScript` + `activeTab`
- *hidden page for DOM/audio/clipboard from background* → **offscreen document** (Chromium): unlisted page + `offscreen.createDocument`
- *every X minutes, cron* → **alarms** (`alarms` permission), not `setInterval`
- *heavy work on a thread* → **Web Worker** (example `web-worker-setup`)
- *background keeps sleeping, variables reset* → **MV3 service worker termination**: keep state in storage

## Data & communication
- *save settings, remember X, database* → **extension storage**: `storage.defineItem('local:key')` (`storage` permission)
- *sync across my computers* → `sync:` area (~100 KB); *until browser closes* → `session:`; *admin-set* → `managed:`
- *popup talks to page, send data between parts* → **messaging**: `runtime/tabs.sendMessage`, `@webext-core/messaging`
- *call background function from anywhere* → **proxy service / RPC**: `@webext-core/proxy-service`, `comctx`, `trpc-chrome`
- *popup updates live when data changes* → **storage watchers**: `item.watch()`
- *talk to my website* → `externally_connectable` / content-script bridge; *talk to a desktop app/local server* → native messaging (`connectNative`) or `fetch` + host permission
- *API key in code, secrets* → **env vars** `WXT_*` via `import.meta.env` (public in the bundle!); *build-time settings, flags* → `app.config.ts` / `--mode`

## Build & ship
- *manifest.json, permissions file* → **generated manifest**: `manifest` in `wxt.config.ts` + entrypoint options (no manifest.json in source)
- *access to all websites, "read and change data" warning* → **host permissions** / optional permissions + `permissions.request`
- *make it work on Firefox/Safari/Edge* → **build targets**: `-b firefox`, `--mv3`, `import.meta.env.FIREFOX`, `include/exclude`
- *auto refresh while coding* → **dev mode** `wxt`; *it doesn't open the browser* → install `web-ext`; *stay logged in in dev* → persistent profile
- *build/dist folder* → `.output/<browser>-mv<n>/`; *zip for store* → `wxt zip`; *auto-upload from CI* → `wxt submit`
- *plugin for the build* → **hooks / WXT modules** (`modules/*.ts`); *why no imports needed* → **auto-imports** / `#imports`; *@/ shortcuts* → **aliases**
- *icons/logo* → `public/icon/<size>.png` or `@wxt-dev/auto-icons`; *translate* → **i18n** (`@wxt-dev/i18n`); *usage tracking* → `@wxt-dev/analytics`; *tests* → Vitest + `fakeBrowser`, Playwright

## Ambiguous: ask one short question if context doesn't decide
- **popup**: toolbar popup, a modal on the website, or a separate window (`windows.create({ type: 'popup' })`)?
- **sidebar**: browser side panel (persists across navigation) or a panel injected into the page?
- **background page**: MV3 has no page; DOM needs offscreen (Chromium) or an extension page
- **inject**: UI into the page, a script into page JS, or on-demand injection?
- **permissions**: manifest, host, or runtime/optional?
- **storage**: extension storage, the *site's* `localStorage` (what content scripts see), or IndexedDB?
- **it crashed/stopped**: normal SW termination, "Extension context invalidated", or a real error? → `testing-debugging.md`
