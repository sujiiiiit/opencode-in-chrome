import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  webExt: {
    chromiumPort: process.env.WXT_CDP_PORT ? Number(process.env.WXT_CDP_PORT) : undefined,
    chromiumArgs: process.env.WXT_CDP_PORT ? [`--remote-debugging-port=${process.env.WXT_CDP_PORT}`] : [],
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
    // Loopback only: the extension talks to the local opencode server and
    // nothing else. Non-loopback servers need optional_host_permissions later.
    // cookies: adopt the web UI's loopback session cookie after the user opens
    // an `opencode pair` link (see lib/opencode/browser-session.ts).
    permissions: ['storage', 'sidePanel', 'cookies'],
    host_permissions: ['http://127.0.0.1/*', 'http://localhost/*'],
  },
});
