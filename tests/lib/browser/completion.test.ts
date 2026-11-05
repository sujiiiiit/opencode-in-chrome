import { beforeEach, describe, expect, it } from 'vitest';
import { Completion } from '@/lib/browser/completion';
import { LoopGuard } from '@/lib/browser/policy';
import { withSafety } from '@/lib/browser/safety';
import { doneTool } from '@/lib/browser/tools/done';
import { runTool, type ToolDef, type ToolOutput } from '@/lib/browser/tools/registry';
import type { Policy } from '@/lib/browser/policy';
import type { TabScope } from '@/lib/browser/tabs';

const click = { action: 'left_click', ref: 'e12', action_summary: 'Adds the blue kettle' };

describe('Completion (verification debt)', () => {
  let c: Completion;
  beforeEach(() => (c = new Completion()));

  it('records a click with no visible effect, and a read of the tab clears it', () => {
    c.recordResult('s', 'computer', click, { text: [], tabId: 4, effect: 'none' });
    expect(c.labels('s')).toEqual(['left_click [e12] "Adds the blue kettle" on tab 4']);
    c.recordResult('s', 'read_page', {}, { text: [], tabId: 9 });
    expect(c.labels('s')).toHaveLength(1);
    c.recordResult('s', 'read_page', {}, { text: [], tabId: 4 });
    expect(c.labels('s')).toEqual([]);
  });

  it('does not record an action whose result shows a change, and a later change on the tab clears earlier debt', () => {
    c.recordResult('s', 'computer', click, { text: [], tabId: 4, effect: 'changed' });
    expect(c.labels('s')).toEqual([]);
    c.recordResult('s', 'form_input', { ref: 'e3', value: 'x' }, { text: [], tabId: 4, effect: 'unknown' });
    c.recordResult('s', 'computer', { action: 'key', text: 'Enter' }, { text: [], tabId: 4, effect: 'changed' });
    expect(c.labels('s')).toEqual([]);
  });

  it('ignores calls that are not page actions, and screenshots count as looking', () => {
    c.recordResult('s', 'computer', { action: 'wait' }, { text: [], tabId: 4, effect: 'none' });
    expect(c.labels('s')).toEqual([]);
    c.recordResult('s', 'computer', click, { text: [], tabId: 4, effect: 'none' });
    c.recordResult('s', 'computer', { action: 'screenshot' }, { text: [], tabId: 4 });
    expect(c.labels('s')).toEqual([]);
  });

  it('records a failure that may have reached the page, not a refusal', () => {
    c.recordFailure('s', 'computer', click, 'DENIED', 4);
    expect(c.labels('s')).toEqual([]);
    c.recordFailure('s', 'computer', click, 'TIMEOUT', 4);
    expect(c.labels('s')[0]).toMatch(/failed with TIMEOUT; it may have reached the page/);
  });

  it('moves debt of a closed tab to the list done reports', () => {
    c.recordResult('s', 'computer', click, { text: [], tabId: 4, effect: 'none' });
    c.dropTab(4);
    expect(c.labels('s')).toEqual([]);
    expect(c.finish('s', 'success')).toEqual({ accepted: true, outcome: 'success', unverified: ['left_click [e12] "Adds the blue kettle" on tab 4: not verified, the tab closed'] });
  });
});

describe('done', () => {
  let completion: Completion;
  let loop: LoopGuard;
  let done: ToolDef;
  beforeEach(() => {
    completion = new Completion();
    loop = new LoopGuard();
    done = doneTool({ completion, loop });
  });
  const call = async (outcome: string) => {
    const r = await runTool(done, { outcome, summary: 'Added the kettle.' }, 's');
    return { text: (r.content[0] as { text: string }).text, isError: r.isError === true };
  };

  it('refuses success while an action is unverified, naming it, and accepts partial', async () => {
    completion.recordResult('s', 'computer', click, { text: [], tabId: 4, effect: 'none' });
    const refused = await call('success');
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/^UNVERIFIED: You have not seen the result of this action: left_click \[e12\] "Adds the blue kettle" on tab 4\. Read the tab/);
    const partial = await call('partial');
    expect(partial).toEqual({ isError: false, text: expect.stringMatching(/^Done \(partial\)\. Now give the user this summary as your final reply:\n\nAdded the kettle\./) });
  });

  it('accepts success after verifying', async () => {
    completion.recordResult('s', 'computer', click, { text: [], tabId: 4, effect: 'none' });
    expect((await call('success')).isError).toBe(true);
    completion.recordResult('s', 'read_page', {}, { text: [], tabId: 4 });
    expect((await call('success')).text).toMatch(/^Done \(success\)/);
  });

  it('records the third success in a row as partial, listing what was never verified', async () => {
    completion.recordResult('s', 'computer', click, { text: [], tabId: 4, effect: 'none' });
    expect((await call('success')).isError).toBe(true);
    expect((await call('success')).isError).toBe(true);
    const third = await call('success');
    expect(third.isError).toBe(false);
    expect(third.text).toContain('Done (partial)');
    expect(third.text).toContain('(Recorded as "partial": these actions were never verified.)');
    expect(third.text).toContain('Also tell the user these were not verified: left_click [e12]');
  });
});

describe('no-effect guard', () => {
  const policy = { assertRunning: () => undefined, siteGate: async () => undefined } as unknown as Policy;
  const scope = { tabIdsOf: async () => [4], resolve: async () => ({ id: 4, url: 'https://shop.test/' }) } as unknown as TabScope;
  let sent: number;
  let effect: ToolOutput['effect'];
  let tools: Record<string, ToolDef>;
  beforeEach(() => {
    sent = 0;
    effect = 'none';
    const defs: ToolDef[] = [
      { name: 'computer', description: '', inputSchema: { type: 'object', properties: {} }, handler: async () => (sent++, { text: ['Clicked.'], tabId: 4, effect }) },
      { name: 'read_page', description: '', inputSchema: { type: 'object', properties: {} }, handler: async () => ({ text: ['tree'], tabId: 4 }) },
    ];
    tools = Object.fromEntries(withSafety(defs, { policy, scope, loop: new LoopGuard(), completion: new Completion() }).map((t) => [t.name, t]));
  });
  const run = async (name: string, args: Record<string, unknown> = click) => {
    const r = await runTool(tools[name]!, args, 's');
    return (r.content[0] as { text: string }).text;
  };

  it('nudges on the second no-effect click and refuses the third without sending it', async () => {
    expect(await run('computer')).toBe('Clicked.');
    expect(await run('computer')).toMatch(/Note: this action had no effect 2 times on the same target/);
    expect(await run('computer')).toMatch(/^NO_EFFECT: This action had no visible effect 2 times on the same target, so it was not sent again\./);
    expect(sent).toBe(2);
  });

  it('a read of the tab lets the target be tried again, and its count stays', async () => {
    await run('computer');
    await run('computer');
    await run('read_page');
    expect(await run('computer')).toMatch(/had no effect 3 times/);
    expect(sent).toBe(3);
    expect(await run('computer')).toMatch(/^NO_EFFECT:/);
  });

  it('another target is not refused, and a visible effect resets the count', async () => {
    await run('computer');
    await run('computer');
    expect(await run('computer', { ...click, ref: 'e13' })).toBe('Clicked.');
    await run('read_page');
    effect = 'changed';
    expect(await run('computer')).toBe('Clicked.');
    effect = 'none';
    expect(await run('computer')).toBe('Clicked.');
  });
});
