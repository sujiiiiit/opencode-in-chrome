import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      // WXT's sidepanel entrypoint adds a window-wide Chrome default. The panel is
      // configured per tab in background.ts, so an unclicked tab must have no fallback.
      if (wxt.config.browser !== 'firefox') delete manifest.side_panel;
    },
  },
  modules: ['@wxt-dev/module-react'],
  webExt: {
    // Keep one agent-accessible development browser instead of creating a
    // fresh session on every run. The profile lives under the gitignored
    // .wxt directory, so tabs, logins, and extension storage survive restarts.
    chromiumPort: Number(process.env.WXT_CDP_PORT ?? 9222),
    chromiumArgs: [
      `--remote-debugging-port=${process.env.WXT_CDP_PORT ?? 9222}`,
    ],
    // Must be absolute: on Windows, Chrome ignores a relative --user-data-dir,
    // falls back to the default profile, hands off to an already-open Chrome
    // and exits, which surfaces as "CDP connection closed before response".
    chromiumProfile: resolve('.wxt/chrome-profile'),
    keepProfileChanges: true,
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Opencode',
    short_name: 'Opencode',
    // No popup is built for Chromium/Firefox, so declare the toolbar action
    // explicitly. Clicking it opens the side panel (see entrypoints/background.ts).
    action: { default_title: 'Opencode' },
    // cookies: adopt the web UI's loopback session cookie after the user opens
    // an `opencode pair` link (see lib/opencode/browser-session.ts).
    // The rest drive the browser agent (lib/browser): debugger for trusted input,
    // screenshots, console and network; tabs/tabGroups to scope agent tabs;
    // scripting + webNavigation for page snapshots in every frame; alarms keep the
    // tool bridge alive; downloads saves GIF recordings (encoded in the worker).
    // Chrome does not allow `debugger` as an optional permission, so it is required.
    permissions: [
      'storage',
      'sidePanel',
      'cookies',
      'debugger',
      'tabs',
      'tabGroups',
      'scripting',
      'webNavigation',
      'alarms',
      'downloads',
    ],
    // Pages in any site are scripted for the browser agent; the opencode server
    // itself stays loopback-only (lib/opencode/link.ts).
    host_permissions: ['<all_urls>'],
    // Flat CDP child sessions (cross-origin iframes) need Chrome 125.
    minimum_chrome_version: '125',
  },
});
