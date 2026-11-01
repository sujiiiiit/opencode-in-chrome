import { describe, expect, it } from 'vitest';
import { initialReply, reduceReply, replyReasoning, replyText, type ReplyState } from '@/lib/opencode/reply';
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
    expect(state.steps[0]!.blocks.map((b) => [b.ordinal, b.text])).toEqual([
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
    expect(state.steps[0]!.tools).toEqual([{ id: 'call_1', name: 'read' }]);
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
    expect(state.steps[0]!.tools).toHaveLength(1);
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
