import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fakeBrowser.reset();
});
