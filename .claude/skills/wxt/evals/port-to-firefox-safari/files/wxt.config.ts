import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Page Summarizer',
    permissions: ['storage', 'sidePanel', 'offscreen', 'tabs'],
    host_permissions: ['https://api.example.com/*'],
  },
});
