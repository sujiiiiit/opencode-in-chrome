import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.output/**', '.wxt/**', 'temp/**', '.claude/**', '.agents/**'],
    mockReset: true,
    restoreMocks: true,
  },
});
