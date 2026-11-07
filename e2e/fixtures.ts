// Playwright fixtures: Chromium with the built extension, a fake opencode server the
// extension is paired with, the fixture page server, and a `tool` helper that calls a
// browser tool exactly as opencode would (over the extension's client-MCP socket).
import { test as base, chromium, expect, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import { startFakeOpencode, type FakeOpencode, type McpResult } from '../tests/support/fake-opencode';
import { startPageServer, type PageServer } from './support/page-server';

const EXTENSION = path.resolve(import.meta.dirname, '../.output/chrome-mv3');

export type ToolCall = (name: string, args?: Record<string, unknown>, sessionID?: string) => Promise<McpResult & { text: string }>;

type Fixtures = {
  /** Viewport of every page in the context (override with test.use). */
  viewportSize: { width: number; height: number };
  /** How approval forms are answered: allowed at once (default), or left for the spec. */
  approvals: 'allow' | 'manual';
  fake: FakeOpencode;
  pages: PageServer;
  context: BrowserContext;
  sw: Worker;
  extensionId: string;
  /** Pairs the extension with the fake server and turns browser access on. */
  connect: () => Promise<void>;
  tool: ToolCall;
};

export const SESSION = 'ses_e2e_0001';

export const test = base.extend<Fixtures>({
  viewportSize: [{ width: 1280, height: 800 }, { option: true }],
  approvals: ['allow', { option: true }],
  fake: async ({ approvals }, use) => {
    const fake = await startFakeOpencode({ autoAnswer: approvals === 'allow' ? () => ({ choice: 'once' }) : undefined });
    await use(fake);
    await fake.close();
  },
  pages: async ({}, use) => {
    const pages = await startPageServer();
    await use(pages);
    await pages.close();
  },
  context: async ({ viewportSize }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: process.env.HEADED !== '1',
      viewport: viewportSize,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    // The worker can register before or after the context hands control back: poll, then wait.
    const deadline = Date.now() + 20_000;
    let worker = context.serviceWorkers()[0];
    while (!worker && Date.now() < deadline) {
      worker = await context.waitForEvent('serviceworker', { timeout: 2_000 }).catch(() => context.serviceWorkers()[0]);
    }
    if (!worker) throw new Error('The extension service worker did not start (is .output/chrome-mv3 built?)');
    await use(worker);
  },
  extensionId: async ({ sw }, use) => {
    await use(new URL(sw.url()).host);
  },
  connect: async ({ sw, fake }, use) => {
    await use(async () => {
      await sw.evaluate(
        async ({ baseUrl, token }) => {
          await chrome.storage.local.set({
            'opencode.connection': { baseUrl, token, expiresAt: 1999999999000, serverVersion: '2.2.5', pairedAt: Date.now() },
            'opencode.browser.enabled': true,
          });
        },
        { baseUrl: fake.baseUrl, token: fake.token },
      );
      await fake.waitForConnection(15_000);
    });
  },
  tool: async ({ fake, connect }, use) => {
    let connected = false;
    await use(async (name, args = {}, sessionID = SESSION) => {
      if (!connected) {
        await connect();
        connected = true;
      }
      const connection = await fake.waitForConnection();
      const result = await connection.callTool(sessionID, name, args);
      const text = result.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('\n');
      return { ...result, text };
    });
  },
});

export { expect };

/**
 * Opens a URL in a new session tab and waits for it to load (for specs that run before
 * `navigate` is under test). Returns the tab id.
 */
export async function openPage(tool: ToolCall, sw: Worker, url: string, sessionID = SESSION): Promise<number> {
  const created = await tool('tabs_create', { url }, sessionID);
  const tabId = Number(/Created tab (\d+)/.exec(created.text)?.[1]);
  await expect
    .poll(() => sw.evaluate(async (id) => (await chrome.tabs.get(id)).status, tabId), { timeout: 15_000 })
    .toBe('complete');
  return tabId;
}

/** The ref on the first line matching `pattern` in a read_page/find result. */
export function refOf(text: string, pattern: RegExp): string {
  const line = text.split('\n').find((l) => pattern.test(l));
  const ref = line && /\[(e\d+)\]/.exec(line)?.[1];
  if (!ref) throw new Error(`No line matching ${pattern} with a ref in:\n${text}`);
  return ref;
}

/** The id of the session's current tab, from tabs_context. */
export async function currentTab(tool: ToolCall, sessionID = SESSION): Promise<number> {
  let result = await tool('tabs_context', {}, sessionID);
  if (!/current: \d+/.test(result.text)) {
    await tool('tabs_create', {}, sessionID);
    result = await tool('tabs_context', {}, sessionID);
  }
  const match = /current: (\d+)/.exec(result.text);
  if (!match) throw new Error(`No current tab in: ${result.text}`);
  return Number(match[1]);
}
