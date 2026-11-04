import { describe, expect, it } from 'vitest';
import {
  initialReply,
  reduceReply,
  replyParts,
  replyReasoning,
  replyText,
  snapshotStep,
  type ReplyState,
} from '@/lib/opencode/reply';
import type { ServerEvent } from '@/lib/opencode/sse';
import { ASSISTANT_MSG_ID, PROVIDER_ERROR, SESSION_ID, evt, failureEvents, successEvents } from '@/tests/support/testkit';

const run = (events: ServerEvent[], sessionID = SESSION_ID): ReplyState =>
  events.reduce(reduceReply, initialReply(sessionID));
const asEvents = (list: unknown[]) => list as ServerEvent[];

describe('reduceReply', () => {
  it('assembles the real success sequence', () => {
    const events = asEvents(successEvents());
    const mid = run(events.slice(0, 10));
    expect(mid.status).toBe('running');
    expect(replyText(mid)).toBe('po');
    const done = run(events);
    expect(done.status).toBe('succeeded');
    expect(replyText(done)).toBe('pong');
    expect(replyReasoning(done)).toBe('The user wants pong.');
    expect(done.steps).toHaveLength(1);
  });

  it('text.ended replaces whatever the deltas accumulated', () => {
    const done = run(asEvents(successEvents(SESSION_ID, ['wrong', ' partial'], 'pong')));
    expect(replyText(done)).toBe('pong');
  });

  it('keys text by assistantMessageID + ordinal', () => {
    const s = { sessionID: SESSION_ID, assistantMessageID: ASSISTANT_MSG_ID };
    const state = run(
      asEvents([
        evt('session.text.delta', { ...s, ordinal: 0, delta: 'A' }),
        evt('session.text.delta', { ...s, ordinal: 1, delta: 'B' }),
        evt('session.text.delta', { ...s, ordinal: 0, delta: 'C' }),
      ]),
    );
    expect(state.steps[0]!.parts.map((p) => [p.kind === 'tool' ? -1 : p.ordinal, p.kind === 'tool' ? '' : p.text])).toEqual([
      [0, 'AC'],
      [1, 'B'],
    ]);
    expect(replyText(state)).toBe('AC\n\nB');
  });

  it('creates one step per assistant message across tool use', () => {
    const a = { sessionID: SESSION_ID, assistantMessageID: 'msg_A' };
    const b = { sessionID: SESSION_ID, assistantMessageID: 'msg_B' };
    const state = run(
      asEvents([
        evt('session.execution.started', { sessionID: SESSION_ID }, { location: false }),
        evt('session.step.started', { ...a, agent: 'build' }),
        evt('session.tool.input.started', { ...a, id: 'call_1', name: 'read' }),
        evt('session.step.ended', { ...a, finish: 'tool-calls' }),
        evt('session.step.started', { ...b, agent: 'build' }),
        evt('session.text.ended', { ...b, ordinal: 0, text: 'Here are the files.' }),
        evt('session.execution.succeeded', { sessionID: SESSION_ID }, { location: false }),
      ]),
    );
    expect(state.steps.map((s) => s.id)).toEqual(['msg_A', 'msg_B']);
    expect(state.steps[0]!.parts).toMatchObject([{ kind: 'tool', id: 'call_1', name: 'read', status: 'streaming' }]);
    expect(replyText(state)).toBe('Here are the files.');
    expect(state.status).toBe('succeeded');
  });

  it('does not duplicate a step or tool seen twice', () => {
    const a = { sessionID: SESSION_ID, assistantMessageID: 'msg_A' };
    const state = run(
      asEvents([
        evt('session.step.started', a),
        evt('session.step.started', a),
        evt('session.tool.input.started', { ...a, id: 't', name: 'read' }),
        evt('session.tool.input.started', { ...a, id: 't', name: 'read' }),
      ]),
    );
    expect(state.steps).toHaveLength(1);
    expect(state.steps[0]!.parts).toHaveLength(1);
  });

  it('ignores events for other sessions', () => {
    const other = asEvents(successEvents('ses_other'));
    const state = run(other);
    expect(state).toEqual(initialReply(SESSION_ID));
  });

  it('ignores unknown events and events with missing fields', () => {
    const state = run(
      asEvents([
        evt('session.usage.updated', { sessionID: SESSION_ID }, { location: false }),
        evt('session.text.delta', { sessionID: SESSION_ID }),
        { type: 'session.text.delta' },
      ]),
    );
    expect(state.steps).toEqual([]);
    expect(state.status).toBe('idle');
  });

  it('handles events without a location (execution events)', () => {
    const state = run(asEvents([evt('session.execution.started', { sessionID: SESSION_ID }, { location: false })]));
    expect(state.status).toBe('running');
  });

  it('records the real provider-error failure sequence', () => {
    const state = run(asEvents(failureEvents()));
    expect(state.status).toBe('failed');
    expect(state.error).toEqual({ type: PROVIDER_ERROR.type, message: PROVIDER_ERROR.message });
    expect(state.steps[0]!.error).toBe(PROVIDER_ERROR.message);
  });

  it('records an interruption with its reason', () => {
    const state = run(
      asEvents([evt('session.execution.interrupted', { sessionID: SESSION_ID, reason: 'user' }, { location: false })]),
    );
    expect(state.status).toBe('interrupted');
    expect(state.interruptReason).toBe('user');
  });

  it('does not mutate the previous state', () => {
    const before = run(asEvents(successEvents()).slice(0, 9));
    const snapshot = JSON.stringify(before);
    reduceReply(before, asEvents(successEvents())[9]!);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('reduceReply: parts in order', () => {
  const a = { sessionID: SESSION_ID, assistantMessageID: 'msg_A' };
  const at = (created: number, event: ReturnType<typeof evt>) => ({ ...event, created });

  it('interleaves reasoning, text and tools as they arrived', () => {
    const state = run(
      asEvents([
        evt('session.reasoning.delta', { ...a, ordinal: 0, delta: 'plan' }),
        evt('session.text.delta', { ...a, ordinal: 0, delta: 'Let me look.' }),
        evt('session.tool.input.started', { ...a, id: 't1', name: 'shell' }),
        evt('session.text.delta', { ...a, ordinal: 1, delta: 'Found it.' }),
      ]),
    );
    expect(replyParts(state).map((p) => p.id)).toEqual(['msg_A:reasoning:0', 'msg_A:text:0', 't1', 'msg_A:text:1']);
  });

  it('records when text starts and ends, and the phase a model labels it with', () => {
    const state = run(
      asEvents([
        at(100, evt('session.text.started', { ...a, ordinal: 0 })),
        at(150, evt('session.text.delta', { ...a, ordinal: 0, delta: 'Checking' })),
        at(200, evt('session.text.ended', { ...a, ordinal: 0, text: 'Checking.', native: { phase: 'commentary' } })),
      ]),
    );
    expect(replyParts(state)[0]).toMatchObject({ text: 'Checking.', done: true, started: 100, ended: 200, phase: 'commentary' });
  });

  it('follows a tool call from its streamed input to its result', () => {
    const steps = [
      at(10, evt('session.tool.input.started', { ...a, id: 't1', name: 'shell' })),
      evt('session.tool.input.delta', { ...a, id: 't1', delta: '{"command":"npm ' }),
      evt('session.tool.input.delta', { ...a, id: 't1', delta: 'test"}' }),
    ];
    const streaming = run(asEvents(steps));
    expect(replyParts(streaming)[0]).toMatchObject({ status: 'streaming', inputText: '{"command":"npm test"}', input: {} });

    const done = run(
      asEvents([
        ...steps,
        evt('session.tool.input.ended', { ...a, id: 't1', text: '{"command":"npm test"}' }),
        evt('session.tool.called', { ...a, id: 't1', input: { command: 'npm test' }, executed: true }),
        evt('session.tool.progress', { ...a, id: 't1', metadata: { shellID: 'sh_1' } }),
        evt('session.tool.progress', { ...a, id: 't1', metadata: 'polling' }),
        at(90, evt('session.tool.success', { ...a, id: 't1', content: [{ type: 'text', text: 'ok' }, { bogus: 1 }], metadata: { exit: 0 } })),
      ]),
    );
    expect(replyParts(done)[0]).toEqual({
      kind: 'tool',
      id: 't1',
      name: 'shell',
      status: 'completed',
      inputText: '{"command":"npm test"}',
      input: { command: 'npm test' },
      metadata: { shellID: 'sh_1', exit: 0 },
      content: [{ type: 'text', text: 'ok' }],
      started: 10,
      ended: 90,
    });
  });

  it('records a failed tool call with its error', () => {
    const state = run(
      asEvents([
        evt('session.tool.input.started', { ...a, id: 't1', name: 'read' }),
        evt('session.tool.failed', { ...a, id: 't1', error: { type: 'tool', message: 'No such file' }, executed: true }),
      ]),
    );
    expect(replyParts(state)[0]).toMatchObject({ status: 'error', error: 'No such file', content: [] });
  });

  it('marks a call the interrupt failed as aborted, and only that one', () => {
    const state = run(
      asEvents([
        evt('session.tool.input.started', { ...a, id: 't1', name: 'webfetch' }),
        evt('session.tool.failed', { ...a, id: 't1', error: { type: 'aborted', message: 'Tool execution interrupted' } }),
      ]),
    );
    expect(replyParts(state)[0]).toMatchObject({ status: 'error', error: 'Tool execution interrupted', aborted: true });
    expect(run(asEvents([
      evt('session.tool.input.started', { ...a, id: 't2', name: 'read' }),
      evt('session.tool.failed', { ...a, id: 't2', error: { type: 'tool', message: 'No such file' } }),
    ]))).not.toHaveProperty('steps.0.parts.0.aborted');
  });

  it('ignores tool events for a call it never saw start', () => {
    const state = run(asEvents([evt('session.tool.success', { ...a, id: 'ghost', content: [{ type: 'text', text: 'x' }] })]));
    expect(replyParts(state)).toEqual([]);
  });
});

describe('snapshotStep', () => {
  it('rebuilds every part, in order, with tool states', () => {
    const step = snapshotStep({
      id: 'msg_S',
      content: [
        { type: 'reasoning', text: 'hmm', time: { created: 1, completed: 2 } },
        { type: 'text', text: 'Running tests.', native: { phase: 'commentary' } },
        {
          type: 'tool',
          id: 't1',
          name: 'shell',
          state: { status: 'completed', input: { command: 'npm test' }, content: [{ type: 'text', text: 'ok' }], metadata: { exit: 0 } },
          time: { created: 3, completed: 9 },
        },
        { type: 'tool', id: 't2', name: 'edit', state: { status: 'error', input: {}, error: { type: 'x', message: 'Denied' } }, time: { created: 10 } },
        { type: 'tool', id: 't3', name: 'write', state: { status: 'streaming', input: '{"path":"a' }, time: { created: 11 } },
        { type: 'text', text: 'Done.' },
        { type: 'mystery' },
      ],
    });
    expect(step.parts).toEqual([
      { kind: 'reasoning', id: 'msg_S:reasoning:0', ordinal: 0, text: 'hmm', done: true, started: 1, ended: 2 },
      { kind: 'text', id: 'msg_S:text:0', ordinal: 0, text: 'Running tests.', done: true, phase: 'commentary' },
      {
        kind: 'tool',
        id: 't1',
        name: 'shell',
        status: 'completed',
        inputText: '{"command":"npm test"}',
        input: { command: 'npm test' },
        metadata: { exit: 0 },
        content: [{ type: 'text', text: 'ok' }],
        started: 3,
        ended: 9,
      },
      expect.objectContaining({ id: 't2', status: 'error', error: 'Denied' }),
      expect.objectContaining({ id: 't3', status: 'streaming', inputText: '{"path":"a', input: {} }),
      { kind: 'text', id: 'msg_S:text:1', ordinal: 1, text: 'Done.', done: true },
    ]);
  });
});
