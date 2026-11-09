import { describe, expect, it } from 'vitest';
import { initialReply, reduceReply, snapshotStep, type ReplyStep, type ReplyTextPart } from '@/lib/opencode/reply';
import type { ServerEvent } from '@/lib/opencode/sse';
import { emptyTimeline, reduceTimeline, timelineFromSnapshot, type Turn } from '@/lib/opencode/timeline';
import { formatSpeed, turnStats, variantLabel } from '@/lib/opencode/turn-stats';
import { SESSION_ID } from '@/tests/support/testkit';

const ev = (type: string, created: number, data: Record<string, unknown> = {}): ServerEvent => ({
  type,
  created,
  data: { sessionID: SESSION_ID, ...data },
});
const text = (value: string): ReplyTextPart => ({ kind: 'text', id: 't', ordinal: 0, text: value, done: true });
const turn = (steps: ReplyStep[], created?: number): Turn => ({
  id: 'u1',
  text: 'hi',
  reply: { ...initialReply(SESSION_ID), status: 'succeeded', steps },
  ...(created !== undefined ? { created } : {}),
});
const MODEL = { id: 'claude', providerID: 'anthropic', variant: 'high' };

describe('step metadata', () => {
  it('records agent, model, timings and tokens from step events', () => {
    const a = { assistantMessageID: 'a1' };
    const state = [
      ev('session.step.started', 1000, { ...a, agent: 'build', model: MODEL, started: 1005 }),
      ev('session.step.streamed', 3005, a),
      ev('session.step.ended', 3100, { ...a, tokens: { input: 9, output: 30, reasoning: 10, cache: { read: 0, write: 0 } } }),
    ].reduce(reduceReply, initialReply(SESSION_ID));
    expect(state.steps[0]).toMatchObject({
      agent: 'build',
      model: { providerID: 'anthropic', modelID: 'claude', variant: 'high' },
      created: 1005,
      streamed: 3005,
      completed: 3100,
      tokens: { input: 9, output: 30, reasoning: 10, cacheRead: 0, cacheWrite: 0 },
    });
  });

  it('a restarted step drops the timings of its earlier attempt', () => {
    const a = { assistantMessageID: 'a1' };
    const state = [
      ev('session.step.started', 1000, { ...a, started: 1000 }),
      ev('session.step.streamed', 1500, a),
      ev('session.step.failed', 1600, { ...a, error: { type: 'x', message: 'boom' } }),
      ev('session.step.started', 2000, { ...a, started: 2000 }),
    ].reduce(reduceReply, initialReply(SESSION_ID));
    expect(state.steps[0]).toMatchObject({ created: 2000 });
    expect(state.steps[0]!.streamed).toBeUndefined();
    expect(state.steps[0]!.completed).toBeUndefined();
  });

  it('reads the same fields from a snapshot message', () => {
    const step = snapshotStep({
      id: 'a1',
      type: 'assistant',
      agent: 'build',
      model: MODEL,
      time: { created: 10, streamed: 20, completed: 30 },
      tokens: { input: 1, output: 5, reasoning: 0, cache: { read: 0, write: 0 } },
      content: [{ type: 'text', text: 'hi' }],
    });
    expect(step).toMatchObject({ agent: 'build', created: 10, streamed: 20, completed: 30, tokens: { output: 5 } });
  });

  it('a turn knows when its prompt was sent, live and from a snapshot', () => {
    const live = [
      ev('session.inbox.enqueued', 500, { inboxID: 'u1', item: { type: 'user', payload: { text: 'hi' }, delivery: 'steer' } }),
      ev('session.inbox.delivered', 600, { inboxID: 'u1' }),
    ].reduce(reduceTimeline, emptyTimeline(SESSION_ID));
    expect(live.turns[0]!.created).toBe(500);

    const snap = timelineFromSnapshot(SESSION_ID, {
      messages: [{ id: 'u1', type: 'user', text: 'hi', time: { created: 42 } }],
      inbox: [],
      running: false,
    });
    expect(snap.turns[0]!.created).toBe(42);
  });
});

describe('turnStats', () => {
  it('measures the turn from the prompt to its last step, and speed over streaming time only', () => {
    const steps: ReplyStep[] = [
      // A tool step: 1s streaming, then the tool runs for a long time.
      { id: 'a1', parts: [], created: 1000, streamed: 2000, completed: 2100, tokens: { input: 0, output: 10, reasoning: 10, cacheRead: 0, cacheWrite: 0 } },
      { id: 'a2', parts: [text('done')], model: { providerID: 'p', modelID: 'm' }, created: 9000, streamed: 10_000, completed: 10_500, tokens: { input: 0, output: 20, reasoning: 0, cacheRead: 0, cacheWrite: 0 } },
    ];
    const stats = turnStats(turn(steps, 500));
    expect(stats.durationMs).toBe(10_000);
    expect(stats.tokensPerSecond).toBe(20); // 40 tokens over 2s of streaming
    expect(stats.model).toEqual({ providerID: 'p', modelID: 'm' });
  });

  it('reports no speed until every step has streamed, and no duration before any step ends', () => {
    const stats = turnStats(turn([{ id: 'a1', parts: [text('x')], created: 1000, tokens: { input: 0, output: 5, reasoning: 0, cacheRead: 0, cacheWrite: 0 } }], 500));
    expect(stats.tokensPerSecond).toBeUndefined();
    expect(stats.durationMs).toBeUndefined();
  });

  it('falls back to the step start without a prompt time, and ignores clock skew', () => {
    const steps: ReplyStep[] = [{ id: 'a1', parts: [text('x')], created: 1000, completed: 4000 }];
    expect(turnStats(turn(steps)).durationMs).toBe(3000);
    expect(turnStats(turn(steps, 9000)).durationMs).toBeUndefined();
  });

  it('formats speed and variant like opencode', () => {
    expect(formatSpeed(42.25)).toBe('42.3 tok/s');
    expect(variantLabel('high')).toBe('High');
    expect(variantLabel('default')).toBeUndefined();
  });
});
