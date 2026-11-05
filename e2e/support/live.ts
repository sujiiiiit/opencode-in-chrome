// Shared by the @live specs: pairs the built extension with a private `opencode serve` and
// turns a live tool part into the shape the timeline code reads.
import type { Worker } from '@playwright/test';
import type { ReplyToolPart } from '../../lib/opencode/reply';
import { pairToken, type LiveServer } from '../../tests/live/opencode-serve';
import { expect } from '../fixtures';

export type SitePolicy = { mode: 'ask' | 'act'; sites: Record<string, { rule: 'allow' | 'ask' | 'block'; autoConsequential?: boolean }> };

/** Pairs the extension with the live server, turns browser access on and applies `policy`. Returns the workspace directory. */
export async function pairExtension(
  server: LiveServer,
  sw: Worker,
  policy: SitePolicy = { mode: 'act', sites: { '127.0.0.1': { rule: 'allow' } } },
): Promise<string> {
  const token = await pairToken(server);
  expect(Number(token.split('.')[0]) * 1000).toBeGreaterThan(Date.now());
  await sw.evaluate(
    async ({ baseUrl, token: t, policy: p }) => {
      await chrome.storage.local.set({
        'opencode.connection': { baseUrl, token: t, expiresAt: Number(t.split('.')[0]) * 1000, serverVersion: '2.2.5', pairedAt: Date.now() },
        'opencode.browser.enabled': true,
        'opencode.browser.policy': p,
      });
    },
    { baseUrl: server.baseUrl, token, policy },
  );
  // The bridge offers the tools to sessions in the extension's workspace directory.
  let workspace: string | undefined;
  await expect
    .poll(async () => (workspace = await sw.evaluate(async () => ((await chrome.storage.local.get('opencode.workspace'))['opencode.workspace'] as { directory?: string } | undefined)?.directory)), {
      timeout: 30_000,
    })
    .toBeTruthy();
  await new Promise((r) => setTimeout(r, 1500));
  return workspace!;
}

export const asPart = (p: { name: string; state: Record<string, unknown> }): ReplyToolPart => ({
  kind: 'tool',
  id: 'live',
  name: p.name,
  status: 'completed',
  inputText: '',
  input: (p.state.input ?? {}) as Record<string, unknown>,
  metadata: (p.state.metadata ?? {}) as Record<string, unknown>,
  content: [],
});
