import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Opencode',
    short_name: 'Opencode',
    // No popup is built for Chromium/Firefox, so declare the toolbar action
    // explicitly. Clicking it opens the side panel (see entrypoints/background.ts).
    action: { default_title: 'Opencode' },
  },
});
