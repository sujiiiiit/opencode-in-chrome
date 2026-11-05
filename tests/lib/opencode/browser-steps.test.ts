import { describe, expect, it } from 'vitest';
import { browserCallLabel, browserCalls, browserImages } from '@/lib/opencode/browser-steps';
import type { ReplyToolPart } from '@/lib/opencode/reply';
import { toolLabel, toolSubject, toolSummary, toolTitle } from '@/lib/opencode/tool-info';

const tool = (name: string, extra: Partial<ReplyToolPart> = {}): ReplyToolPart => ({
  kind: 'tool',
  id: `call_${name}`,
  name,
  status: 'completed',
  inputText: '',
  input: {},
  metadata: {},
  content: [],
  ...extra,
});

/** An `execute` call in code mode that made these browser calls (as opencode 2.2.5 reports them). */
const execute = (calls: Array<{ tool: string; input?: Record<string, unknown> }>, extra: Partial<ReplyToolPart> = {}) =>
  tool('execute', {
    input: { code: 'await tools.browser.navigate(...)' },
    metadata: { toolCalls: calls.map((c) => ({ tool: c.tool, status: 'completed', input: c.input ?? {} })) },
    ...extra,
  });

describe('browserCalls', () => {
  it('reads direct browser_ parts and inner browser. calls of code mode', () => {
    expect(browserCalls(tool('browser_navigate', { input: { url: 'https://example.com' } }))).toEqual([
      { tool: 'navigate', input: { url: 'https://example.com' }, status: 'completed' },
    ]);
    const part = execute([{ tool: 'browser.navigate', input: { url: 'https://example.com/' } }, { tool: 'search' }, { tool: 'browser.read_page' }]);
    expect(browserCalls(part).map((c) => c.tool)).toEqual(['navigate', 'read_page']);
    expect(browserCalls(execute([{ tool: 'opencode.list_mcp_resources' }]))).toEqual([]);
    expect(browserCalls(tool('shell'))).toEqual([]);
  });
});

describe('browserCallLabel', () => {
  it.each<[string, Record<string, unknown>, boolean, string]>([
    ['computer', { action: 'left_click', action_summary: 'Opens the Filters menu' }, true, 'Clicked: Opens the Filters menu'],
    ['computer', { action: 'left_click', action_summary: 'Opens the Filters menu' }, false, 'Clicking: Opens the Filters menu'],
    ['computer', { action: 'screenshot' }, true, 'Took a screenshot'],
    ['computer', { action: 'type', action_summary: 'Types the city' }, true, 'Typed: Types the city'],
    ['navigate', { url: 'https://www.news.ycombinator.com/' }, false, 'Opening news.ycombinator.com'],
    ['navigate', { url: 'back' }, true, 'Went back'],
    ['read_page', {}, false, 'Reading the page'],
    ['find', { query: 'login link' }, true, 'Found "login link"'],
    ['form_input', { action_summary: 'Sets the date to 29 September' }, true, 'Filled: Sets the date to 29 September'],
    ['batch', { actions: [{}, {}, {}] }, true, 'Ran 3 browser steps'],
    ['javascript', {}, true, 'Ran page script'],
    ['done', { outcome: 'success', summary: 'x' }, true, 'Finished: done'],
    ['done', { outcome: 'partial', summary: 'x' }, false, 'Finishing: partly done'],
    ['done', {}, true, 'Finished'],
    ['mystery_tool', {}, true, 'Used mystery tool'],
  ])('%s %j (done: %s) → %s', (name, input, done, label) => {
    expect(browserCallLabel({ tool: name, input }, done)).toBe(label);
  });
});

describe('browser parts in the timeline', () => {
  it('labels a direct click from its action_summary', () => {
    const part = tool('browser_computer', { input: { action: 'left_click', action_summary: 'Opens the Filters menu' } });
    expect(toolLabel(part, false)).toBe('Clicked: Opens the Filters menu');
    expect(toolTitle(part, false)).toBe('Browsed');
  });

  it('labels a code-mode execute call from its inner browser calls, not as a command', () => {
    const part = execute([{ tool: 'browser.navigate', input: { url: 'https://example.com/' } }, { tool: 'browser.read_page' }]);
    expect(toolLabel(part, false)).toBe('Opened example.com · Read the page');
    expect(toolSubject(part)).toBe('Opened example.com · Read the page');
    const running = { ...part, status: 'running' as const };
    expect(toolTitle(running, true)).toBe('Browsing');
    expect(toolLabel(running, true)).toBe('Opening example.com · Reading the page');
  });

  it('shows three calls then a count', () => {
    const part = execute(Array.from({ length: 5 }, () => ({ tool: 'browser.read_page' })));
    expect(toolLabel(part, false)).toBe('Read the page · Read the page · Read the page +2 more');
  });

  it('counts browser steps in summaries', () => {
    const parts = [execute([{ tool: 'browser.navigate', input: { url: 'a' } }, { tool: 'browser.read_page' }]), tool('browser_find', { id: 'x', input: { query: 'q' } }), tool('shell', { input: { command: 'ls' } })];
    expect(toolSummary(parts)).toBe('1 command · 3 browser steps');
  });

  it('finds screenshot images in the content', () => {
    const part = tool('browser_computer', {
      content: [
        { type: 'text', text: 'Screenshot ss_1' },
        { type: 'file', uri: 'data:image/jpeg;base64,AAA', mime: 'image/jpeg' },
      ],
    });
    expect(browserImages(part)).toEqual([{ uri: 'data:image/jpeg;base64,AAA', mime: 'image/jpeg' }]);
  });
});
