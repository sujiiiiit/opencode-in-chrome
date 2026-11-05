// Live (OPENCODE_LIVE=1): the browsing guide reaches a real session's instruction entries.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachGuide, BROWSER_GUIDE, GUIDE_KEY, type GuideStore } from '@/lib/browser/guidance';
import type { OpenCodeClient } from '@/lib/opencode/client';
import { createSession, LIVE, startOpencodeServe, type LiveServer } from './opencode-serve';

describe.runIf(LIVE)('browsing guide on a live server', () => {
  let server: LiveServer;
  beforeAll(async () => {
    server = await startOpencodeServe();
  }, 90_000);
  afterAll(() => server?.close());

  it('puts the guide as the session instruction entry and reads it back', async () => {
    const sessionID = await createSession(server);
    let value: Record<string, string> = {};
    const store: GuideStore = { get: async () => value, set: async (v) => void (value = v) };
    expect(await attachGuide(server.client as unknown as OpenCodeClient, sessionID, store)).toBe('attached');
    const entries = (await server.client.experimental.session.instructions.entry.list({ sessionID })) as Array<{ key: string; value: unknown }>;
    expect(entries).toContainEqual({ key: GUIDE_KEY, value: BROWSER_GUIDE });
    // The size limit, if the server reports one for an oversized value.
    const big = await server.client.experimental.session.instructions.entry
      .put({ sessionID, key: 'size-probe', value: 'x'.repeat(200_000) })
      .then(() => 'accepted 200 000 bytes')
      .catch((e: unknown) => JSON.stringify(e).slice(0, 200));
    console.info('[guide] size probe:', big);
  }, 60_000);
});
