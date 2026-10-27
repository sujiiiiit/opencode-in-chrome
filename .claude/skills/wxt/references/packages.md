# Companion packages & ecosystem libraries

Versions are current as of the snapshot date (check live: `node scripts/wxt-docs.mjs versions`). Full official pages: `docs/storage.md`, `docs/i18n.md`, `docs/analytics.md`, `docs/auto-icons.md`, `docs/unocss.md`, `docs/is-background.md`, `docs/runner.md`.

| Package | What | Install / enable |
|---|---|---|
| `wxt/utils/storage` (= `@wxt-dev/storage` 1.x) | typed storage wrapper | built in: `import { storage } from '#imports'` |
| `wxt/browser` (= `@wxt-dev/browser`) | unified `browser` + `Browser` types | built in |
| `@wxt-dev/module-react` | React Vite plugin + React auto-imports | `modules: ['@wxt-dev/module-react']`, options key `react: { vite, vitePluginsBefore }` |
| `@wxt-dev/i18n` | typed i18n on top of `browser.i18n` | `modules: ['@wxt-dev/i18n/module']` + `manifest.default_locale` |
| `@wxt-dev/auto-icons` | generates icon sizes from one image | `modules: ['@wxt-dev/auto-icons']` |
| `@wxt-dev/analytics` | analytics with pluggable providers | `modules: ['@wxt-dev/analytics/module']` + `app.config.ts` |
| `@wxt-dev/unocss` | UnoCSS integration | `modules: ['@wxt-dev/unocss']` + `import 'virtual:uno.css'` |
| `@wxt-dev/webextension-polyfill` | restores the old polyfilled `browser` | `modules: ['@wxt-dev/webextension-polyfill']` + `webextension-polyfill` |
| `@wxt-dev/is-background` | `isBackground()` boolean | plain import |
| `@wxt-dev/runner` | future replacement for web-ext | **not ready for WXT use yet**: keep using `web-ext` |
| `@webext-core/messaging` 4.x | typed messaging | plain import |
| `@webext-core/proxy-service` 3.x | call background services from anywhere | plain import (peer: `@webext-core/messaging`) |
| `@webext-core/isolated-element` | used by `createShadowRootUi` (v3 in 0.21) | installed by WXT; pin `^1` only for the legacy html/head/body structure |
| `publish-browser-extension` 6.x | powers `wxt submit` | installed by WXT |

## Storage (`storage` from `#imports`)

Keys are **always prefixed** with an area: `local:`, `session:`, `sync:`, `managed:`. A missing prefix throws. Requires the `storage` permission.

```ts
// utils/storage.ts (auto-imported everywhere because it's in utils/)
export const settings = storage.defineItem<{ enabled: boolean; theme: 'light' | 'dark' }>('local:settings', {
  fallback: { enabled: true, theme: 'dark' },   // returned when missing (not written)
});
export const installId = storage.defineItem<string>('local:installId', {
  init: () => crypto.randomUUID(),               // written once if missing
});
export const blockedSites = storage.defineItem<{ id: string; host: string }[]>('sync:blockedSites', {
  fallback: [],
  version: 2,
  migrations: { 2: (old: string[]) => old.map((host) => ({ id: crypto.randomUUID(), host })) },
  onMigrationComplete: (value, targetVersion) => {},
});

await settings.getValue();               // typed, never null when fallback is set
await settings.setValue({ ...current, enabled: false });
await settings.removeValue();
const unwatch = settings.watch((newValue, oldValue) => {/* fires in EVERY context that watches */});
await settings.getMeta(); await settings.setMeta({ lastModified: Date.now() });
```
- `defaultValue` is deprecated: use `fallback`. Migrations run automatically when `defineItem` is called; reads and writes wait for them.
- Unversioned items are treated as v1, so you can add `version: 2` + `migrations[2]` later.
- Ad-hoc API: `storage.getItem<T>('local:k')`, `setItem`, `removeItem`, `watch`, `getMeta`/`setMeta`/`removeMeta`, bulk `getItems`/`setItems`/`getMetas`/`setMetas`/`removeItems` (accept keys or items), `clear('local')`, `snapshot('local')`/`restoreSnapshot`.
- Metadata lives at `key$`. Version metadata is `v`.
- Values must be JSON-serializable (no `Map`, `Set`, `Date` objects, or class instances).

**React hook pattern** (one source of truth across popup, side panel, and content UI):
```tsx
// hooks/useStorageItem.ts (auto-imported from hooks/)
import type { WxtStorageItem } from '#imports';
export function useStorageItem<T>(item: WxtStorageItem<T, any>) {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    item.getValue().then((v) => alive && setValue(v));
    const unwatch = item.watch((v) => setValue(v));
    return () => { alive = false; unwatch(); };
  }, [item]);
  return [value, (v: T) => item.setValue(v)] as const;
}
```

## `@wxt-dev/i18n`

```ts
// wxt.config.ts
export default defineConfig({
  modules: ['@wxt-dev/i18n/module'],
  manifest: { default_locale: 'en', name: '__MSG_extName__', description: '__MSG_extDescription__' },
  // i18n: { localesDir: 'src/locales' }   // default `<srcDir>/locales`
});
```
```yml
# <srcDir>/locales/en.yml  (.yml/.yaml/.json/.jsonc/.json5/.toml)
extName: My Extension
extDescription: Does things
greeting: Hello $1!
welcome: Hello {name}, welcome to {appName}!
items:
  0: No items
  1: 1 item
  n: $1 items
dialogs:
  confirm:
    title: Are you sure?
```
```ts
import { i18n } from '#i18n';      // also auto-imported
i18n.t('greeting', ['Ada']);
i18n.t('welcome', { name: 'Ada', appName: 'X' });
i18n.t('items', 3);                 // plural by count
i18n.t('dialogs.confirm.title');
```
- Types are generated by `wxt prepare`/build. The language follows the browser UI language (there's no in-app switching).
- Existing `_locales/<lang>/messages.json` files can be moved as-is to `locales/<lang>.json`.
- No i18n library at all: `public/_locales/<lang>/messages.json` + `browser.i18n.getMessage('key')`.

## `@wxt-dev/auto-icons`

Base image at `<srcDir>/assets/icon.png` (SVG supported). Options key `autoIcons`: `{ enabled: true, baseIconPath: 'assets/icon.png', sizes: [128, 48, 32, 16], developmentIndicator: 'grayscale' | 'overlay' | false }` (`grayscaleOnDevelopment` is deprecated).

## `@wxt-dev/analytics`

```ts
// wxt.config.ts: modules: ['@wxt-dev/analytics/module']
// <srcDir>/app.config.ts
import { googleAnalytics4 } from '@wxt-dev/analytics/providers/google-analytics-4';
// also: '@wxt-dev/analytics/providers/posthog' (posthog), '/umami' (umami), '/moderok' (moderok)
export default defineAppConfig({
  analytics: {
    debug: true,
    enabled: storage.defineItem('local:analytics-enabled', { fallback: true }), // DISABLED by default
    userId: storage.defineItem('local:user-id', { init: () => crypto.randomUUID() }),
    providers: [googleAnalytics4({ apiSecret: import.meta.env.WXT_GA_API_SECRET, measurementId: 'G-XXXX' })], // api secret ships in the bundle (anyone can send fake events); proxy through your server if that matters
  },
});
// anywhere:
import { analytics } from '#analytics';
await analytics.track('clicked_button', { where: 'popup' });
await analytics.page(); await analytics.identify('user-id', { plan: 'pro' });
analytics.autoTrack(document);   // or the content UI container
analytics.setEnabled(true);
```
Custom provider: `defineAnalyticsProvider` from `@wxt-dev/analytics/client`. The PostHog provider supports `errorTracking: true` + `analytics.captureException(err)`. Privacy: disclose analytics in the store listing; for Firefox, declare it in `data_collection_permissions`.

## `@wxt-dev/unocss`

`pnpm add -D @wxt-dev/unocss unocss`, `modules: ['@wxt-dev/unocss']`, then `import 'virtual:uno.css'` in each entrypoint. Options key `unocss: { excludeEntrypoints: ['background'] }`. A "uno.css not found" warning in dev is expected.

## Messaging libraries

**`@webext-core/messaging`** (one listener per message type per context; `sendMessage` throws when no listener exists):
```ts
// utils/messaging.ts
import { defineExtensionMessaging } from '@webext-core/messaging';
interface ProtocolMap {
  getTabTitle(tabId: number): string;          // function syntax: (data) => return
  notify(data: { text: string }): void;
}
export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

// background main()
onMessage('getTabTitle', async ({ data, sender }) => (await browser.tabs.get(data)).title ?? '');
// popup / content
const title = await sendMessage('getTabTitle', tabId);
// background → content script in a tab (and optional frame)
await sendMessage('notify', { text: 'hi' }, tabId);              // or { tabId, frameId: 0 }
```
Content script ↔ page/injected script: `import { defineCustomEventMessaging, defineWindowMessaging } from '@webext-core/messaging/page'`, then `defineCustomEventMessaging<Map>({ namespace: 'my-ext' })` on both sides.

**`@webext-core/proxy-service`** (v3 API: there's no `defineProxyService` anymore):
```ts
// utils/math-service.ts
export class MathService { async add(a: number, b: number) { return a + b; } }
export const MATH_KEY = 'math-service' as import('@webext-core/proxy-service').ProxyServiceKey<MathService>;
// background main()
registerService(MATH_KEY, new MathService());
// anywhere else
const math = createProxyService(MATH_KEY);
await math.add(1, 2);
```

**`webext-bridge`** (any-to-any routing; MUST be imported in the background): `import { sendMessage, onMessage } from 'webext-bridge/background' | '/content-script' | '/popup' | '/options' | '/devtools' | '/window'`, `sendMessage('id', data, 'content-script@' + tabId)`. Types via a `declare module 'webext-bridge' { interface ProtocolMap { … } }` augmentation with `ProtocolWithReturn<Data, Return>`.

**`comctx`**: `defineProxy(() => new Service(), { namespace })` → `[provide, inject]`; you implement an adapter (`sendMessage`/`onMessage`) per context pair. Good for worker/iframe/offscreen RPC.

**`trpc-chrome`**: `createChromeHandler({ router })` in the background, `chromeLink({ port: browser.runtime.connect() })` in clients. It requires `@trpc/server`/`@trpc/client` **v10**.
