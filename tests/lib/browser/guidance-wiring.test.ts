// @vitest-environment node
// Integration: both paths that attach the browsing guide, against the fake opencode server.
import { afterEach, describe, expect, it } from 'vitest';
import { attachGuide, BROWSER_GUIDE, GUIDE_KEY, GUIDE_SHORT, type GuideStore } from '@/lib/browser/guidance';
import { serverAccess } from '@/lib/browser/server';
import { tabTools } from '@/lib/browser/tools/tabs';
import { toMcpTools, type ToolDef } from '@/lib/browser/tools/registry';
import type { TabScope } from '@/lib/browser/tabs';
import { startFakeOpencode, type FakeOpencode } from '../../support/fake-opencode';

let fake: FakeOpencode | undefined;
afterEach(async () => fake?.close());

const memory = (): GuideStore => {
  let value: Record<string, string> = {};
  return { get: async () => value, set: async (v) => void (value = v) };
};

const access = (f: FakeOpencode) =>
  serverAccess(async () => ({ baseUrl: f.baseUrl, token: f.token, expiresAt: 1999999999000, serverVersion: '2.2.5', pairedAt: 0 }));

const echo: ToolDef = { name: 'echo', description: 'echo', inputSchema: { type: 'object', properties: {} }, handler: async () => ({ text: ['ok'] }) };

describe('guide attachment', () => {
  it("worker path: a session's first browser call attaches the guide, later calls do not repeat it", async () => {
    fake = await startFakeOpencode();
    const server = access(fake);
    const store = memory();
    const pending: Array<Promise<unknown>> = [];
    const [tool] = toMcpTools([echo], { onCall: (sessionID) => void pending.push(server().then((c) => c && attachGuide(c, sessionID, store))) });
    await tool!.handler({}, { sessionID: 'ses_other' } as never);
    await tool!.handler({}, { sessionID: 'ses_other' } as never);
    expect(await Promise.all(pending)).toEqual(['attached', 'already']);
    expect(fake.instructions.get('ses_other')?.get(GUIDE_KEY)).toBe(BROWSER_GUIDE);
  });

  it('side-panel path: the guide is on the session before the first prompt', async () => {
    fake = await startFakeOpencode();
    const client = (await access(fake)())!;
    expect(await attachGuide(client, 'ses_panel', memory())).toBe('attached');
    const entries = await client.experimental.session.instructions.entry.list({ sessionID: 'ses_panel' });
    expect(entries).toEqual([{ key: GUIDE_KEY, value: BROWSER_GUIDE }]);
  });

  it('a server without the route: the call fails quietly and tabs_context still carries the rules', async () => {
    fake = await startFakeOpencode({ noInstructions: true });
    const client = (await access(fake)())!;
    expect(await attachGuide(client, 'ses_old', memory())).toBe('failed');
    const context = tabTools({} as TabScope).find((t) => t.name === 'tabs_context')!;
    expect(context.description).toContain(GUIDE_SHORT);
  });
});
