import { defineConfig } from '@playwright/test';

// E2E tests load the built extension (.output/chrome-mv3; run `pnpm build` first, or use
// `pnpm e2e`, which builds) into Chromium and drive it through a fake opencode server.
// Specs tagged @live talk to a real `opencode serve` and only run with OPENCODE_LIVE=1.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  grepInvert: process.env.OPENCODE_LIVE === '1' ? undefined : /@live/,
  use: { trace: 'retain-on-failure' },
});
