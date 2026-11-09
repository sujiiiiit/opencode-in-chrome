// The tab tools that wrap the rest of chrome.tabs / chrome.tabGroups.
import { beforeEach, describe, expect, it } from 'vitest';
import { TabScope } from '@/lib/browser/tabs';
import { runTool, toMcpTools, type ToolDef } from '@/lib/browser/tools/registry';
import { tabTools } from '@/lib/browser/tools/tabs';
import { FakeChrome, memoryStore } from '../../support/fake-chrome';

let chrome: FakeChrome;
let scope: TabScope;
let tools: Record<string, ToolDef>;
let a: number;
let b: number;
beforeEach(async () => {
  chrome = new FakeChrome();
  scope = new TabScope(chrome, memoryStore() as never);
  tools = Object.fromEntries(tabTools(scope).map((t) => [t.name, t]));
  a = (await scope.create('ses_1', 'https://a.example/')).id;
  b = (await scope.create('ses_1', 'https://b.example/')).id;
});

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await runTool(tools[name]!, args, 'ses_1');
  const first = result.content[0] as { text: string };
  return { text: first.text, isError: result.isError === true, content: result.content };
};

describe('registration', () => {
  it('exposes one tool per chrome.tabs operation with an object schema', () => {
    const names = Object.keys(tools);
    for (const name of [
      'tabs_context', 'tabs_share', 'tabs_switch', 'tabs_create', 'tabs_close', 'tabs_reload', 'tabs_duplicate', 'tabs_move',
      'tabs_discard', 'tabs_set_state', 'tabs_highlight', 'tabs_zoom', 'tabs_language', 'tabs_capture',
      'tabs_split', 'tabs_unsplit', 'tab_group',
    ]) expect(names).toContain(name);
    expect(toMcpTools(Object.values(tools)).every((t) => (t.inputSchema as { type: string }).type === 'object')).toBe(true);
  });
});

describe('tabs_context', () => {
  it('flags only the states that are set, keeping the plain line otherwise', async () => {
    chrome.tabs.get(a)!.audible = true;
    chrome.tabs.get(b)!.discarded = true;
    chrome.tabs.get(b)!.mutedInfo = { muted: true };
    const text = (await call('tabs_context')).text;
    expect(text).toContain(`- ${a} "" https://a.example/ [audible]`);
    expect(text).toContain(`- ${b} "" https://b.example/ [muted, discarded]`);
  });

  it('keeps tabs without flags unchanged', async () => {
    expect((await call('tabs_context')).text).toContain(`- ${a} "" https://a.example/\n`);
  });
});

describe('tabs_reload and tabs_duplicate', () => {
  it('reloads, optionally bypassing the cache', async () => {
    expect((await call('tabs_reload', { tabId: a, bypassCache: true })).text).toMatch(new RegExp(`Reloaded tab ${a}.*cache`));
    expect(chrome.reloads).toEqual([{ tabId: a, bypassCache: true }]);
  });

  it('duplicates into the session group and reports the new id', async () => {
    const text = (await call('tabs_duplicate', { tabId: a })).text;
    const copy = Math.max(...chrome.tabs.keys());
    expect(text).toContain(`Duplicated tab ${a} as tab ${copy}`);
    expect(chrome.tabs.get(copy)!.groupId).toBe(chrome.tabs.get(a)!.groupId);
  });
});

describe('tabs_move and tabs_discard', () => {
  it('moves to an index and requires one', async () => {
    expect((await call('tabs_move', { tabId: a, index: 0 })).text).toContain(`Moved tab ${a} to position 0`);
    expect((await call('tabs_move', { tabId: a })).text).toBe('INVALID_INPUT: Missing required argument `index`.');
  });

  it('discards a background tab and explains refusing a showing one', async () => {
    expect((await call('tabs_discard', { tabId: a })).text).toContain(`Discarded tab ${a}`);
    chrome.tabs.get(b)!.active = true;
    const refused = await call('tabs_discard', { tabId: b });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/^INVALID_INPUT:.*showing/);
  });
});

describe('tabs_set_state', () => {
  it('mutes a tab and reports what changed', async () => {
    const result = await call('tabs_set_state', { tabId: a, muted: true });
    expect(result.text).toContain(`Updated tab ${a}: muted`);
    expect(chrome.tabs.get(a)!.mutedInfo).toEqual({ muted: true });
  });

  it('refuses pinned: true and an empty call', async () => {
    expect((await call('tabs_set_state', { tabId: a, pinned: true })).text).toMatch(/^INVALID_INPUT:.*group/);
    expect((await call('tabs_set_state', { tabId: a })).text).toMatch(/^INVALID_INPUT: Nothing to change/);
  });

  it('highlights tabs by id', async () => {
    chrome.tabs.get(a)!.windowId = 1;
    chrome.tabs.get(a)!.index = 0;
    expect((await call('tabs_highlight', { tabIds: [a] })).text).toContain(`Highlighted tab ${a}`);
    expect((await call('tabs_highlight', { tabIds: [] })).text).toMatch(/^INVALID_INPUT/);
  });
});

describe('tabs_zoom', () => {
  it('reads the zoom when given nothing', async () => {
    expect((await call('tabs_zoom', { tabId: a })).text).toContain('zoom 100%');
  });

  it('sets a factor, resets with 0 and sets mode and scope', async () => {
    expect((await call('tabs_zoom', { tabId: a, factor: 1.5 })).text).toContain('zoom 150%');
    expect((await call('tabs_zoom', { tabId: a, factor: 0 })).text).toContain('zoom 100%');
    await call('tabs_zoom', { tabId: a, mode: 'manual', scope: 'per-tab' });
    expect(chrome.zoomSettings.get(a)).toMatchObject({ mode: 'manual', scope: 'per-tab' });
  });

  it('rejects a mode outside the enum', async () => {
    expect((await call('tabs_zoom', { tabId: a, mode: 'sideways' })).text).toMatch(/^INVALID_INPUT:.*one of/);
  });
});

describe('tabs_language and tabs_capture', () => {
  it('reports the language code', async () => {
    expect((await call('tabs_language', { tabId: a })).text).toContain('language: en');
  });

  it('returns the capture as an image part, not as text', async () => {
    chrome.tabs.get(a)!.active = true;
    chrome.tabs.get(a)!.windowId = 1;
    const { content } = await call('tabs_capture', { tabId: a });
    expect(content[1]).toMatchObject({ type: 'image', mimeType: 'image/png', data: 'FAKE' });
  });

  it('explains that a background tab cannot be captured', async () => {
    expect((await call('tabs_capture', { tabId: a })).text).toMatch(/^NOT_INTERACTABLE:.*background/);
  });
});

describe('tabs_split and tabs_unsplit', () => {
  it('splits two tabs and separates them again', async () => {
    expect((await call('tabs_split', { tabId: a, withTabId: b })).text).toMatch(new RegExp(`Split tabs ${a} and ${b}`));
    expect(chrome.tabs.get(a)!.splitViewId).toBeGreaterThanOrEqual(0);
    expect((await call('tabs_unsplit', { tabId: a })).text).toContain(`Unsplit tab ${a}`);
    expect(chrome.tabs.get(b)!.splitViewId).toBe(-1);
  });
});

describe('tab_group', () => {
  it('reads the group when given nothing', async () => {
    expect((await call('tab_group')).text).toMatch(/Tab group "Opencode".*orange.*expanded/);
  });

  it('renames, recolours and collapses', async () => {
    const text = (await call('tab_group', { title: 'Research', color: 'blue', collapsed: true })).text;
    expect(text).toMatch(/Tab group "Research".*blue.*collapsed/);
  });

  it('moves the group', async () => {
    await call('tab_group', { index: 0 });
    expect(chrome.groupMoves).toHaveLength(1);
  });

  it('rejects an unknown colour', async () => {
    expect((await call('tab_group', { color: 'magenta' })).text).toMatch(/^INVALID_INPUT:.*one of/);
  });
});
