import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabScope } from '@/lib/browser/tabs';
import { computerTool } from '@/lib/browser/tools/computer';
import { formTools, UPLOAD_LIMIT_BYTES } from '@/lib/browser/tools/forms';
import { runTool, type ToolDef } from '@/lib/browser/tools/registry';
import { FakeChrome, memoryStore } from '../../support/fake-chrome';

let scope: TabScope;
let computer: ToolDef;
let tabId: number;
const vision = { supports: vi.fn(async () => ({ vision: true as boolean | undefined, model: 'anthropic/claude-sonnet-5-5' })) };

beforeEach(async () => {
  scope = new TabScope(new FakeChrome(), memoryStore() as never);
  tabId = (await scope.create('ses_1', 'https://example.com/')).id;
  computer = computerTool({
    scope,
    reader: { callTop: vi.fn(async () => null) } as never,
    actor: { input: () => async () => undefined, act: async (_t: number, _s: string, run: () => Promise<string>) => ({ text: await run(), effect: 'changed' }) } as never,
    dialogs: { assertClear: () => undefined } as never,
    screenshots: { frameOf: () => undefined } as never,
    vision: vision as never,
  });
});

const call = async (args: Record<string, unknown>) => {
  const r = await runTool(computer, args, 'ses_1');
  return (r.content[0] as { text: string }).text;
};

describe('computer input validation', () => {
  it('requires action_summary on clicks, drags, keys and typing', async () => {
    for (const action of ['left_click', 'right_click', 'double_click', 'triple_click', 'left_click_drag', 'key', 'type']) {
      expect(await call({ action, coordinate: [1, 1] })).toMatch(/^INVALID_INPUT: `action_summary` is required/);
    }
  });

  it('caps wait at 10 seconds', async () => {
    expect(await call({ action: 'wait', duration: 30 })).toBe('INVALID_INPUT: Argument `duration` must be at most 10.');
  });

  it('needs a ref or coordinate for pointer actions', async () => {
    expect(await call({ action: 'left_click', action_summary: 'Clicks it' })).toMatch(/needs `ref` .* or `coordinate`/);
  });

  it('rejects unknown keys', async () => {
    expect(await call({ action: 'key', text: 'ctrl+Launchpad', action_summary: 'Presses a key' })).toMatch(/^INVALID_INPUT: Unknown key "Launchpad"/);
  });

  it('clicks a coordinate when given one', async () => {
    expect(await call({ action: 'left_click', coordinate: [100, 200], action_summary: 'Opens the menu' })).toMatch(/^Clicked \(100, 200\)\./);
    expect(tabId).toBeGreaterThan(0);
  });

  it('refuses screenshots for a model without image input', async () => {
    vision.supports.mockResolvedValueOnce({ vision: false, model: 'kilo/kilo-auto/free' });
    expect(await call({ action: 'screenshot' })).toBe(
      "INVALID_INPUT: The session's model (kilo/kilo-auto/free) does not accept images, so screenshots are not available. Use read_page or find instead.",
    );
  });
});

describe('file_upload size cap', () => {
  it('refuses more than 10 MB in total', async () => {
    const big = new Uint8Array(UPLOAD_LIMIT_BYTES / 2 + 1);
    const tools = formTools({
      scope,
      reader: { refs: { lookup: () => ({ frameId: 0, documentId: 'd', n: 1 }) } } as never,
      actor: {} as never,
      screenshots: {} as never,
      server: async () => ({ file: { read: async () => big } }) as never,
      directory: async () => 'C:/ws',
    });
    const upload = tools.find((t) => t.name === 'file_upload')!;
    const result = await runTool(upload, { ref: 'e1', paths: ['a.bin', 'b.bin'] }, 'ses_1');
    expect((result.content[0] as { text: string }).text).toMatch(/^INVALID_INPUT: The files add up to more than 10 MB/);
  });

  it('requires action_summary for form_input', async () => {
    const tools = formTools({ scope, reader: {} as never, actor: {} as never, screenshots: {} as never, server: async () => undefined, directory: async () => undefined });
    const fill = tools.find((t) => t.name === 'form_input')!;
    const result = await runTool(fill, { ref: 'e1', value: 'x' }, 'ses_1');
    expect((result.content[0] as { text: string }).text).toMatch(/^INVALID_INPUT: `action_summary` is required for form_input/);
  });
});
