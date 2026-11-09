import { describe, expect, it } from 'vitest';
import { awaitingPickup, formatDuration, groupSpan, replyFlow, type FlowItem } from '@/lib/opencode/flow';
import type { ReplyPart, ReplyState, ReplyStatus, ReplyTextPart, ReplyToolPart } from '@/lib/opencode/reply';
import { SESSION_ID } from '@/tests/support/testkit';

const text = (id: string, extra: Partial<ReplyTextPart> = {}): ReplyTextPart => ({
  kind: 'text',
  id,
  ordinal: 0,
  text: id,
  done: true,
  ...extra,
});
const reasoning = (id: string, extra: Partial<ReplyTextPart> = {}): ReplyTextPart => ({ ...text(id, extra), kind: 'reasoning' });
const tool = (id: string, extra: Partial<ReplyToolPart> = {}): ReplyToolPart => ({
  kind: 'tool',
  id,
  name: 'shell',
  status: 'completed',
  inputText: '',
  input: {},
  metadata: {},
  content: [],
  ...extra,
});
const reply = (status: ReplyStatus, ...steps: ReplyPart[][]): ReplyState => ({
  sessionID: SESSION_ID,
  status,
  steps: steps.map((parts, i) => ({ id: `s${i}`, parts })),
});

/** The flow as `work[a,b]` / `answer:x` strings. */
const shape = (items: FlowItem[]) =>
  items.map((item) => {
    if (item.type === 'work') return `work[${item.parts.map((p) => p.id).join(',')}]`;
    if (item.type === 'agents') return `agents[${item.parts.map((p) => p.id).join(',')}]`;
    if (item.type === 'round') return `round:${item.label}`;
    if (item.type === 'compaction') return `compaction:${item.compaction.id}`;
    return `answer:${item.part.id}`;
  });

describe('replyFlow', () => {
  it('sets subagent calls apart where they were made, stacking the ones started together', () => {
    const agent = (id: string) => tool(id, { name: 'subagent' });
    const flow = replyFlow(reply('succeeded', [reasoning('r1'), agent('a1'), agent('a2')], [tool('t1'), agent('a3'), text('done')]));
    expect(shape(flow)).toEqual(['work[r1]', 'agents[a1,a2]', 'work[t1]', 'agents[a3]', 'answer:done']);
  });

  it('starts new work where the reply picked up after a background completion', () => {
    const base = reply('running', [tool('t1')], [tool('t2'), text('done')]);
    const flow = replyFlow({ ...base, notices: [{ id: 'n1', afterStep: 1 }] });
    expect(shape(flow)).toEqual(['work[t1]', 'work[t2]', 'answer:done']);
    // Keyed by the completion, so the placeholder that stood in for it is the same group.
    expect(flow[1]!.key).toBe('work:after:n1');
    // Delivered before the next step arrives: the work is unsplit, and the reply awaits the pickup.
    const before = { ...base, notices: [{ id: 'n1', afterStep: 2 }] };
    expect(shape(replyFlow(before))).toEqual(['work[t1,t2]', 'answer:done']);
    expect(awaitingPickup(before)).toBe('n1');
    expect(awaitingPickup({ ...base, notices: [{ id: 'n1', afterStep: 1 }] })).toBeUndefined();
  });

  it('folds the work before the last tool call and keeps the answer after it outside', () => {
    const flow = replyFlow(
      reply('succeeded', [reasoning('r1'), text('t1', { phase: 'commentary' }), tool('x1')], [reasoning('r2'), tool('x2')], [text('answer')]),
    );
    expect(shape(flow)).toEqual(['work[r1,t1,x1,r2,x2]', 'answer:answer']);
    expect(flow[0]!.key).toBe('work:r1');
  });

  it('shows a reply without tools as plain answer text after its thinking', () => {
    expect(shape(replyFlow(reply('succeeded', [reasoning('r1'), text('pong')])))).toEqual(['work[r1]', 'answer:pong']);
  });

  it('keeps an unlabelled text part in place when a later tool call starts', () => {
    const before = replyFlow(reply('running', [reasoning('r1'), text('t1', { done: false })]));
    expect(shape(before)).toEqual(['work[r1]', 'answer:t1']);
    const after = replyFlow(reply('running', [reasoning('r1'), text('t1'), tool('x1', { status: 'running' })]));
    expect(shape(after)).toEqual(['work[r1]', 'answer:t1', 'work[x1]']);
    expect(after[0]!.key).toBe(before[0]!.key);
    expect(after[1]!.key).toBe(before[1]!.key);
  });

  it('lets a model label win over position', () => {
    const flow = replyFlow(
      reply('succeeded', [text('early', { phase: 'final_answer' }), tool('x1'), text('late', { phase: 'commentary' }), text('end')]),
    );
    expect(shape(flow)).toEqual(['answer:early', 'work[x1,late]', 'answer:end']);
  });

  it('preserves the model phase even when an interrupted turn has no final answer', () => {
    const flow = replyFlow(reply('interrupted', [text('t1', { phase: 'commentary' }), tool('x1'), text('t2', { phase: 'commentary' })]));
    expect(shape(flow)).toEqual(['work[t1,x1,t2]']);
  });

  it('keeps every commentary text folded while the turn still runs', () => {
    const flow = replyFlow(reply('running', [text('t1', { phase: 'commentary' }), tool('x1', { status: 'running' })]));
    expect(shape(flow)).toEqual(['work[t1,x1]']);
  });

  it('drops empty text and reasoning', () => {
    const flow = replyFlow(reply('succeeded', [reasoning('r1', { text: '' }), text('t0', { text: '  ' }), text('ok')]));
    expect(shape(flow)).toEqual(['answer:ok']);
  });

  it('returns nothing for a reply with no parts', () => {
    expect(replyFlow(reply('running'))).toEqual([]);
  });
});

describe('groupSpan and formatDuration', () => {
  it('spans from the first start to the last end the parts report', () => {
    const [group] = replyFlow(
      reply('succeeded', [reasoning('r1', { started: 100, ended: 300 }), tool('x1', { started: 400, ended: 2_500 })], [text('a')]),
    );
    expect(group?.type === 'work' && groupSpan(group)).toEqual({ started: 100, ended: 2_500 });
  });

  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(4_900)).toBe('4s');
    expect(formatDuration(125_000)).toBe('2m 5s');
    expect(formatDuration(3_780_000)).toBe('1h 3m');
    expect(formatDuration(-5)).toBe('0s');
  });
});
