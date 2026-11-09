import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabScope } from '@/lib/browser/tabs';
import { computerTool, scrollNote } from '@/lib/browser/tools/computer';
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
  it('does not need action_summary: the approval text is derived from the action', async () => {
    const guard = vi.fn(async (_call: { summary?: string }) => undefined);
    const guarded = computerTool({
      scope,
      reader: { callTop: vi.fn(async () => null) } as never,
      actor: { input: () => async () => undefined, act: async (_t: number, _s: string, run: () => Promise<string>) => ({ text: await run(), effect: 'changed' }) } as never,
      dialogs: { assertClear: () => undefined } as never,
      screenshots: { frameOf: () => undefined } as never,
      vision: vision as never,
      guard,
    });
    await runTool(guarded, { action: 'left_click', coordinate: [5, 6] }, 'ses_1');
    await runTool(guarded, { action: 'key', text: 'Enter' }, 'ses_1');
    await runTool(guarded, { action: 'type', text: 'hello' }, 'ses_1');
    expect(guard.mock.calls.map(([c]) => c.summary)).toEqual(['Clicked (5, 6)', 'Presses Enter', 'Types into the page']);
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

  it('derives the form_input approval text when action_summary is omitted', async () => {
    const guard = vi.fn(async (_call: { summary?: string }) => undefined);
    const tools = formTools({
      scope,
      reader: { refs: { lookup: () => ({ frameId: 0, documentId: 'd', n: 1 }) }, call: async () => ({ label: 'textbox "City"', value: 'Pune', previous: '' }) } as never,
      actor: {
        point: async () => ({ info: { label: 'textbox "City"', secret: null } }),
        act: async (_t: number, _s: string, run: () => Promise<string>) => ({ text: await run(), effect: 'changed' }),
      } as never,
      screenshots: {} as never,
      server: async () => undefined,
      directory: async () => undefined,
      guard,
    } as never);
    const fill = tools.find((t) => t.name === 'form_input')!;
    await runTool(fill, { ref: 'e1', value: 'Pune' }, 'ses_1');
    expect(guard).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Sets textbox "City"' }));
  });
});

describe('file_upload from an MCP session', () => {
  const upload = (sessionID: string, files: unknown) => {
    const setFiles = vi.fn(async () => ({ label: 'file input', names: ['a.txt'] }));
    const tools = formTools({
      scope,
      reader: { refs: { lookup: () => ({ frameId: 0, documentId: 'd', n: 1 }) }, call: setFiles } as never,
      actor: { point: async () => ({ info: {} }), act: async (_t: number, _s: string, run: () => Promise<string>) => ({ text: await run(), effect: 'changed' }) } as never,
      screenshots: {} as never,
      server: async () => undefined,
      directory: async () => undefined,
    });
    const run = async () => {
      await scope.create('mcp-abcd1234', 'https://example.com/');
      return ((await runTool(tools.find((t) => t.name === 'file_upload')!, { ref: 'e1', paths: ['a.txt'], files }, sessionID)).content[0] as { text: string }).text;
    };
    return { setFiles, run };
  };

  it('uploads the files the MCP server sent, without an opencode server', async () => {
    const { run, setFiles } = upload('mcp-abcd1234', [{ name: '/x/a.txt', base64: 'aGk=' }]);
    expect(await run()).toMatch(/^Uploaded "a\.txt"/);
    expect(setFiles).toHaveBeenCalledWith(expect.anything(), 'd', 'setFiles', [1, [{ name: 'a.txt', type: 'text/plain', base64: 'aGk=' }]]);
  });

  it('ignores embedded files in an ordinary session, and refuses more than 10 MB', async () => {
    expect(await upload('ses_1', [{ name: 'a.txt', base64: 'aGk=' }]).run()).toMatch(/^NEEDS_APPROVAL/);
    const big = 'A'.repeat(Math.ceil((UPLOAD_LIMIT_BYTES * 4) / 3) + 8);
    expect(await upload('mcp-abcd1234', [{ name: 'big.bin', base64: big }]).run()).toMatch(/^INVALID_INPUT: The files add up to more than 10 MB/);
  });
});

describe('screenshot save (P5)', () => {
  it('saves the image and gives a model without image input only the path', async () => {
    const saveImage = vi.fn(async () => '/home/me/Downloads/opencode/ss_1.jpg');
    const shot = { id: 'ss_1', image: { data: 'AA==', mimeType: 'image/jpeg' } };
    const tool = computerTool({
      scope,
      reader: { callTop: vi.fn(async () => null) } as never,
      actor: {} as never,
      dialogs: { assertClear: () => undefined } as never,
      screenshots: { screenshot: async () => ({ text: 'Screenshot ss_1 (800x600).', shot }) } as never,
      vision: { supports: async () => ({ vision: false, model: 'kilo/free' }) } as never,
      saveImage,
    });
    const result = await runTool(tool, { action: 'screenshot', save: true }, 'ses_1');
    expect((result.content[0] as { text: string }).text).toMatch(/^Screenshot ss_1 \(800x600\)\.\n\nSaved to \/home\/me\/Downloads\/opencode\/ss_1\.jpg/);
    expect(result.content.filter((c) => c.type === 'image')).toHaveLength(0);
    expect(saveImage).toHaveBeenCalledWith(shot.image, 'ss_1.jpg');
  });
});

describe('scrollNote', () => {
  const state = (scrollY: number, scrollHeight: number) => ({ height: 900, scrollX: 0, scrollY, scrollHeight });
  it('says where the page is and when the bottom or top is reached', () => {
    expect(scrollNote(state(0, 3000), state(720, 3000), 'down')).toBe('; page now at 0,720 of 3000 px.');
    expect(scrollNote(state(1900, 3000), state(2100, 3000), 'down')).toMatch(/This is the bottom of the page\. If it loads more .* wait_for \{idle: true\}/);
    expect(scrollNote(state(300, 3000), state(0, 3000), 'up')).toMatch(/This is the top of the page\./);
  });

  it('reports when an infinite list grew', () => {
    expect(scrollNote(state(0, 1500), state(700, 2800), 'down')).toBe('; page now at 0,700 of 2800 px. The page grew from 1500 to 2800 px: more content loaded.');
  });

  it('stays quiet when the position cannot be read', () => {
    expect(scrollNote(undefined, undefined, 'down')).toBe('.');
  });
});
