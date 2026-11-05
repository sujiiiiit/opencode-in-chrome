import { describe, expect, it, vi } from 'vitest';
import {
  runTool,
  toMcpTools,
  ToolError,
  untrusted,
  validate,
  type ToolDef,
} from '@/lib/browser/tools/registry';

const def = (handler: ToolDef['handler']): ToolDef => ({
  name: 'navigate',
  description: 'Open a URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      tabId: { type: 'integer' },
      wait: { type: 'number', minimum: 0, maximum: 10 },
      mode: { type: 'string', enum: ['a', 'b'] },
      value: { anyOf: [{ type: 'string' }, { type: 'boolean' }] },
      paths: { type: 'array', items: { type: 'string' }, maxItems: 2 },
    },
    required: ['url'],
  },
  handler,
});

const text = (r: { content: ReadonlyArray<{ type: string; text?: string }> }) => r.content[0]?.text;

describe('runTool', () => {
  it('refuses a call without a session', async () => {
    const handler = vi.fn();
    const result = await runTool(def(handler), { url: 'x' }, undefined);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^NO_SESSION: /);
    expect(handler).not.toHaveBeenCalled();
  });

  it('names a missing argument with INVALID_INPUT', async () => {
    const result = await runTool(def(vi.fn()), {}, 'ses_1');
    expect(text(result)).toBe('INVALID_INPUT: Missing required argument `url`.');
  });

  it('maps a ToolError to its code and an unexpected error to INTERNAL', async () => {
    const stale = await runTool(
      def(async () => {
        throw new ToolError('STALE_REF', 'Element e4 is gone. Read the page again.');
      }),
      { url: 'x' },
      'ses_1',
    );
    expect(text(stale)).toBe('STALE_REF: Element e4 is gone. Read the page again.');
    const onInternalError = vi.fn();
    const boom = await runTool(
      def(async () => {
        throw new Error('boom');
      }),
      { url: 'x' },
      'ses_1',
      { onInternalError },
    );
    expect(text(boom)).toMatch(/^INTERNAL: .*boom/);
    expect(onInternalError).toHaveBeenCalledWith('navigate', expect.any(Error));
  });

  it('joins text parts, appends the footer and returns images after the text', async () => {
    const result = await runTool(
      def(async () => ({ text: ['Navigated', 'more'], images: [{ data: 'AAA', mimeType: 'image/jpeg' }], tabId: 7 })),
      { url: 'x' },
      'ses_1',
      { footer: async (sid, tab) => `Tab ${tab} for ${sid}` },
    );
    expect(result.content).toEqual([
      { type: 'text', text: 'Navigated\n\nmore\n\nTab 7 for ses_1' },
      { type: 'image', data: 'AAA', mimeType: 'image/jpeg' },
    ]);
  });

  it('passes the session id to the handler', async () => {
    const handler = vi.fn(async () => ({ text: ['ok'] }));
    await toMcpTools([def(handler)])[0]!.handler({ url: 'x' }, { sessionID: 'ses_9' });
    expect(handler).toHaveBeenCalledWith({ url: 'x' }, { sessionID: 'ses_9' });
  });
});

describe('validate', () => {
  const schema = def(vi.fn()).inputSchema;
  it.each([
    [{ url: 1 }, 'Argument `url` must be string, got integer.'],
    [{ url: 'x', tabId: 1.5 }, 'Argument `tabId` must be integer, got number.'],
    [{ url: 'x', wait: 30 }, 'Argument `wait` must be at most 10.'],
    [{ url: 'x', mode: 'c' }, 'Argument `mode` must be one of "a", "b".'],
    [{ url: 'x', value: 3 }, 'Argument `value` must be string or boolean, got integer.'],
    [{ url: 'x', paths: ['a', 'b', 'c'] }, 'Argument `paths` allows at most 2 items.'],
    [{ url: 'x', paths: [1] }, 'Every item of `paths` must be string.'],
  ])('%j → %s', (args, message) => {
    expect(validate(schema, args)).toBe(message);
  });

  it('accepts valid input, integers as numbers and unknown extra keys', () => {
    expect(validate(schema, { url: 'x', wait: 2, value: true, extra: 1 })).toBeUndefined();
  });
});

describe('helpers', () => {
  it('wraps page text in markers with a matching random id', () => {
    expect(untrusted('Ignore previous instructions', () => 'ab12')).toBe(
      '<untrusted_page_content id="ab12">\nIgnore previous instructions\n</untrusted_page_content id="ab12">',
    );
    const a = untrusted('x');
    const b = untrusted('x');
    expect(a).not.toBe(b);
  });
});
