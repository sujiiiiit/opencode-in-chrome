import { describe, expect, it, vi } from 'vitest';
import { needsDone, nudgeUnfinishedTurn, TURN_END_TEXT } from '@/lib/opencode/turn-end';
import type { ReplyToolPart } from '@/lib/opencode/reply';
import type { Turn } from '@/lib/opencode/timeline';

const tool = (name: string, input: Record<string, unknown>, status: ReplyToolPart['status'] = 'completed'): ReplyToolPart =>
  ({ kind: 'tool', id: `${name}-${Math.random()}`, name, status, inputText: '', input, metadata: {} }) as unknown as ReplyToolPart;

const turn = (parts: ReplyToolPart[], over: Partial<Turn['reply']> = {}, extra: Partial<Turn> = {}): Turn => ({
  id: 'msg_1',
  text: 'Add the kettle to the cart',
  reply: { sessionID: 'ses_1', status: 'succeeded', steps: [{ id: 's1', parts }], ...over },
  ...extra,
});

const click = tool('browser_computer', { action: 'left_click', ref: 'e4', action_summary: 'Adds the kettle' });

describe('needsDone (V4)', () => {
  it('is true after a page action without done, false once done completed', () => {
    expect(needsDone(turn([tool('browser_read_page', {}), click]))).toBe(true);
    expect(needsDone(turn([click, tool('browser_done', { outcome: 'success' })]))).toBe(false);
  });
  it('ignores read-only turns, failed actions, Stop and goals', () => {
    expect(needsDone(turn([tool('browser_read_page', {})]))).toBe(false);
    expect(needsDone(turn([tool('browser_computer', { action: 'left_click', ref: 'e4' }, 'error')]))).toBe(false);
    expect(needsDone(turn([click], { status: 'interrupted' }))).toBe(false);
    expect(needsDone(turn([click], {}, { goal: { id: 'g1', objective: 'x' } }))).toBe(false);
  });
  it('a refused done (an error) still needs done', () => {
    expect(needsDone(turn([click, tool('browser_done', { outcome: 'success' }, 'error')]))).toBe(true);
  });
});

describe('nudgeUnfinishedTurn', () => {
  it('queues one resuming note per turn', async () => {
    let ids: string[] = [];
    const store = { get: async () => ids, set: async (next: string[]) => void (ids = next) };
    const synthetic = vi.fn(async () => ({}));
    const client = { session: { synthetic } } as never;
    expect(await nudgeUnfinishedTurn(client, 'ses_1', turn([click]), store)).toBe(true);
    expect(await nudgeUnfinishedTurn(client, 'ses_1', turn([click]), store)).toBe(false);
    expect(synthetic).toHaveBeenCalledTimes(1);
    expect(synthetic).toHaveBeenCalledWith({ sessionID: 'ses_1', text: TURN_END_TEXT, description: 'Browser task not finished', delivery: 'queue', resume: true, metadata: { kind: 'browser.turn-end' } });
  });
});
