import { describe, expect, it } from 'vitest';
import { replyText } from '@/lib/opencode/reply';
import type { ServerEvent } from '@/lib/opencode/sse';
import {
  admitPrompt,
  emptyTimeline,
  leadingOrphans,
  pendingStatus,
  prependHistory,
  reduceTimeline,
  syncInbox,
  timelineFromSnapshot,
  type Timeline,
} from '@/lib/opencode/timeline';
import { PROVIDER_ERROR, SESSION_ID } from '@/tests/support/testkit';

let time = 1000;
const ev = (type: string, data: Record<string, unknown> = {}, sessionID = SESSION_ID): ServerEvent => ({
  type,
  created: (time += 10),
  data: { sessionID, ...data },
});
const enqueued = (inboxID: string, text: string, delivery: 'steer' | 'queue' = 'steer') =>
  ev('session.inbox.enqueued', { inboxID, item: { type: 'user', payload: { text }, delivery } });
const delivered = (inboxID: string) => ev('session.inbox.delivered', { inboxID });
const say = (text: string, assistantMessageID: string) => [
  ev('session.step.started', { assistantMessageID }),
  ev('session.text.started', { assistantMessageID, ordinal: 0 }),
  ev('session.text.delta', { assistantMessageID, ordinal: 0, delta: text }),
  ev('session.text.ended', { assistantMessageID, ordinal: 0, text }),
];
const run = (events: ServerEvent[], start: Timeline = emptyTimeline(SESSION_ID)) => events.reduce(reduceTimeline, start);

describe('reduceTimeline', () => {
  it('does not label a model choice made before the first user message as a switch', () => {
    const t = run([ev('session.model.selected', { model: { id: 'chosen', providerID: 'p' } }), enqueued('m1', 'hello'), delivered('m1')]);
    expect(t.turns[0]?.switches).toBeUndefined();
    expect(t.switches).toEqual([]);
  });

  it('keeps a live model switch before the next delivered prompt', () => {
    const switched = run([enqueued('m0', 'first'), delivered('m0'), ev('session.model.selected', { model: { id: 'new', providerID: 'p' } })]);
    expect(switched.switches[0]?.model.modelID).toBe('new');
    const deliveredTurn = run([enqueued('m1', 'hello'), delivered('m1')], switched);
    expect(deliveredTurn.switches).toEqual([]);
    expect(deliveredTurn.turns[1]?.switches).toEqual(switched.switches);
  });
  it('tracks a prompt from the inbox into a turn and streams its reply', () => {
    const t = run([
      enqueued('m1', 'hello'),
      ev('session.execution.started'),
      delivered('m1'),
      ...say('pong', 'a1'),
      ev('session.execution.succeeded'),
    ]);
    expect(t.working).toBe(false);
    expect(t.pending).toEqual([]);
    expect(t.turns).toHaveLength(1);
    expect(t.turns[0]).toMatchObject({ id: 'm1', text: 'hello' });
    expect(t.turns[0]!.reply.status).toBe('succeeded');
    expect(replyText(t.turns[0]!.reply)).toBe('pong');
  });

  it('holds enqueued prompts as pending in admission order with their delivery', () => {
    const t = run([enqueued('m1', 'a', 'queue'), enqueued('m2', 'b', 'steer')]);
    expect(t.pending.map((p) => [p.id, p.text, p.delivery])).toEqual([
      ['m1', 'a', 'queue'],
      ['m2', 'b', 'steer'],
    ]);
  });

  it('is running while working and marks the delivered turn running', () => {
    const t = run([enqueued('m1', 'hello'), ev('session.execution.started'), delivered('m1')]);
    expect(t.working).toBe(true);
    expect(t.turns[0]!.reply.status).toBe('running');
  });

  it('closes the earlier turn when a steer is delivered mid-execution and streams into the new turn', () => {
    const t = run([
      enqueued('m1', 'first'),
      ev('session.execution.started'),
      delivered('m1'),
      ...say('working on it', 'a1'),
      enqueued('m2', 'also do X'),
      delivered('m2'),
      ...say('doing X', 'a2'),
    ]);
    expect(t.turns.map((turn) => turn.id)).toEqual(['m1', 'm2']);
    expect(t.turns[0]!.reply.status).toBe('succeeded');
    expect(replyText(t.turns[0]!.reply)).toBe('working on it');
    expect(t.turns[1]!.reply.status).toBe('running');
    expect(replyText(t.turns[1]!.reply)).toBe('doing X');
  });

  it('runs a queued prompt as the next turn inside the same execution', () => {
    const t = run([
      enqueued('m1', 'first'),
      ev('session.execution.started'),
      delivered('m1'),
      enqueued('m2', 'next', 'queue'),
      ...say('one', 'a1'),
      delivered('m2'),
      ...say('two', 'a2'),
      ev('session.execution.succeeded'),
    ]);
    expect(t.turns.map((turn) => [turn.id, turn.reply.status, replyText(turn.reply)])).toEqual([
      ['m1', 'succeeded', 'one'],
      ['m2', 'succeeded', 'two'],
    ]);
  });

  it('puts a failure on the current turn', () => {
    const t = run([
      enqueued('m1', 'x'),
      ev('session.execution.started'),
      delivered('m1'),
      ev('session.execution.failed', { error: PROVIDER_ERROR }),
    ]);
    expect(t.turns[0]!.reply.status).toBe('failed');
    expect(t.turns[0]!.reply.error).toEqual({ type: PROVIDER_ERROR.type, message: PROVIDER_ERROR.message });
  });

  it('marks the current turn interrupted and keeps queued prompts parked', () => {
    const t = run([
      enqueued('m1', 'x'),
      ev('session.execution.started'),
      delivered('m1'),
      enqueued('m2', 'later', 'queue'),
      ev('session.execution.interrupted', { reason: 'user' }),
    ]);
    expect(t.working).toBe(false);
    expect(t.turns[0]!.reply.status).toBe('interrupted');
    expect(t.turns[0]!.reply.interruptReason).toBe('user');
    expect(t.pending.map((p) => p.id)).toEqual(['m2']);
  });

  it('does not touch a finished turn when the next execution starts', () => {
    const t = run([
      enqueued('m1', 'x'),
      ev('session.execution.started'),
      delivered('m1'),
      ev('session.execution.succeeded'),
      ev('session.execution.started'),
    ]);
    expect(t.turns[0]!.reply.status).toBe('succeeded');
    expect(t.working).toBe(true);
  });

  it('removes cancelled prompts and applies delivery changes', () => {
    const t = run([
      enqueued('m1', 'a', 'queue'),
      enqueued('m2', 'b', 'queue'),
      ev('session.inbox.cancelled', { inboxID: 'm1' }),
      ev('session.inbox.delivery.changed', { inboxID: 'm2', delivery: 'steer' }),
    ]);
    expect(t.pending.map((p) => [p.id, p.delivery])).toEqual([['m2', 'steer']]);
  });

  it('counts queued control items (compaction, move) as reorder blockers, not prompts', () => {
    const t = run([
      ev('session.inbox.enqueued', { inboxID: 'c1', item: { type: 'compaction', payload: {}, delivery: 'queue' } }),
    ]);
    expect(t.pending).toEqual([]);
    expect(t.controls).toEqual([{ id: 'c1', delivery: 'queue' }]);
    expect(run([ev('session.inbox.delivered', { inboxID: 'c1' })], t).controls).toEqual([]);
  });

  it('ignores events from other sessions and unknown events', () => {
    const start = emptyTimeline(SESSION_ID);
    expect(run([enqueued('m1', 'x'), ev('session.execution.started', {}, 'ses_other')]).working).toBe(false);
    expect(run([ev('session.usage.updated'), ev('something.else')], start)).toEqual(start);
  });

  it('ignores a re-sent enqueue for a prompt that is already a turn', () => {
    const t = run([enqueued('m1', 'x'), delivered('m1'), enqueued('m1', 'x')]);
    expect(t.pending).toEqual([]);
    expect(t.turns).toHaveLength(1);
  });

  it('tracks a staged revert', () => {
    expect(run([ev('session.revert.staged', { messageID: 'm1' })]).reverted).toBe(true);
    expect(run([ev('session.revert.staged'), ev('session.revert.cleared')]).reverted).toBe(false);
    expect(run([ev('session.revert.staged'), ev('session.revert.committed')]).reverted).toBe(false);
  });
});

describe('admitPrompt', () => {
  const ack = { id: 'm1', text: 'hi', delivery: 'queue' as const, created: 5 };

  it('adds an admitted prompt the stream has not reported yet', () => {
    expect(admitPrompt(emptyTimeline(SESSION_ID), ack).pending).toEqual([ack]);
  });

  it('does not duplicate a prompt the stream already reported or delivered', () => {
    const reported = run([enqueued('m1', 'hi', 'queue')]);
    expect(admitPrompt(reported, ack).pending).toHaveLength(1);
    const done = run([enqueued('m1', 'hi'), delivered('m1')]);
    expect(admitPrompt(done, ack).pending).toEqual([]);
  });
});

describe('syncInbox', () => {
  it('replaces pending prompts and controls with the server list, in its order', () => {
    const t = run([enqueued('m1', 'stale', 'queue')]);
    const synced = syncInbox(t, [
      { id: 'm3', type: 'user', payload: { text: 'c' }, delivery: 'queue', time: { created: 3 } },
      { id: 'm2', type: 'user', payload: { text: 'b' }, delivery: 'steer', time: { created: 2 } },
      { id: 'c1', type: 'compaction', payload: {}, delivery: 'queue', time: { created: 4 } },
      { bogus: true },
    ]);
    expect(synced.pending.map((p) => [p.id, p.text, p.delivery, p.created])).toEqual([
      ['m3', 'c', 'queue', 3],
      ['m2', 'b', 'steer', 2],
    ]);
    expect(synced.controls).toEqual([{ id: 'c1', delivery: 'queue' }]);
  });

  it('drops listed items that are already turns', () => {
    const t = run([enqueued('m1', 'x'), delivered('m1')]);
    const synced = syncInbox(t, [{ id: 'm1', type: 'user', payload: { text: 'x' }, delivery: 'steer', time: { created: 1 } }]);
    expect(synced.pending).toEqual([]);
  });
});

describe('pendingStatus', () => {
  it('is queued for queued prompts', () => {
    const t = run([enqueued('m1', 'x', 'queue')]);
    expect(pendingStatus(t, t.pending[0]!)).toBe('queued');
  });

  it('is starting for a steer into an idle session that has never gone idle', () => {
    const t = run([enqueued('m1', 'x')]);
    expect(pendingStatus(t, t.pending[0]!)).toBe('starting');
  });

  it('is starting for a steer before the running execution delivered any input', () => {
    const t = run([ev('session.execution.started'), enqueued('m1', 'x')]);
    expect(pendingStatus(t, t.pending[0]!)).toBe('starting');
  });

  it('is steering while it waits behind input the execution already delivered', () => {
    const t = run([enqueued('m1', 'a'), ev('session.execution.started'), delivered('m1'), enqueued('m2', 'b')]);
    expect(pendingStatus(t, t.pending[0]!)).toBe('steering');
  });

  it('is stranded when the execution ended without delivering it', () => {
    const t = run([
      enqueued('m1', 'a'),
      ev('session.execution.started'),
      delivered('m1'),
      enqueued('m2', 'b'),
      ev('session.execution.interrupted', { reason: 'user' }),
    ]);
    expect(pendingStatus(t, t.pending[0]!)).toBe('stranded');
  });

  it('is starting for a steer admitted after the session went idle', () => {
    const t = run([
      enqueued('m1', 'a'),
      ev('session.execution.started'),
      delivered('m1'),
      ev('session.execution.succeeded'),
      enqueued('m2', 'b'),
    ]);
    expect(pendingStatus(t, t.pending[0]!)).toBe('starting');
  });
});

describe('timelineFromSnapshot', () => {
  const user = (id: string, text: string, created: number) => ({ id, type: 'user', text, time: { created } });
  const assistant = (id: string, text: string, created: number) => ({
    id,
    type: 'assistant',
    content: [
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text },
      { type: 'tool', id: 'call_1', name: 'read' },
    ],
    time: { created },
  });
  const idle = (id: string, outcome: string, created: number, error?: unknown) => ({
    id,
    type: 'idle',
    outcome,
    error,
    time: { created },
  });

  it('restores model switches between turns and at the end', () => {
    const model = { id: 'new', providerID: 'p' };
    const t = timelineFromSnapshot(SESSION_ID, { messages: [user('m1', 'one', 1),
      { id: 's1', type: 'model-switched', model }, user('m2', 'two', 2),
      { id: 's2', type: 'model-switched', model }], inbox: [], running: false });
    expect(t.turns[1]?.switches?.[0]?.id).toBe('s1');
    expect(t.switches[0]?.id).toBe('s2');
  });

  it('hides initial model setup when rebuilding a first-turn snapshot', () => {
    const model = { id: 'chosen', providerID: 'p' };
    const messages = [{ id: 's0', type: 'model-switched', model }, user('m1', 'hello', 1)];
    const first = timelineFromSnapshot(SESSION_ID, { messages, inbox: [], running: false });
    expect(first.turns[0]?.switches).toBeUndefined();
    const paged = timelineFromSnapshot(SESSION_ID, { messages, inbox: [], running: false, hasEarlier: true });
    expect(paged.turns[0]?.switches?.[0]?.id).toBe('s0');
  });

  it('rebuilds finished turns, their replies and outcomes in chronological order', () => {
    const t = timelineFromSnapshot(SESSION_ID, {
      messages: [
        user('m1', 'one', 1),
        assistant('a1', 'reply one', 2),
        idle('i1', 'succeeded', 3),
        user('m2', 'two', 4),
        idle('i2', 'failed', 5, PROVIDER_ERROR),
        user('m3', 'three', 6),
        idle('i3', 'interrupted', 7),
      ],
      inbox: [],
      running: false,
    });
    expect(t.turns.map((turn) => [turn.id, turn.text, turn.reply.status])).toEqual([
      ['m1', 'one', 'succeeded'],
      ['m2', 'two', 'failed'],
      ['m3', 'three', 'interrupted'],
    ]);
    expect(replyText(t.turns[0]!.reply)).toBe('reply one');
    // The parts keep the message's order: reasoning, text, then the tool call.
    expect(t.turns[0]!.reply.steps[0]!.parts.map((p) => [p.kind, p.id])).toEqual([
      ['reasoning', 'a1:reasoning:0'],
      ['text', 'a1:text:0'],
      ['tool', 'call_1'],
    ]);
    expect(t.turns[1]!.reply.error?.message).toBe(PROVIDER_ERROR.message);
    expect(t.idleAt).toBe(7);
    expect(t.working).toBe(false);
  });

  it('keeps the turn after the last idle running while the session is active', () => {
    const t = timelineFromSnapshot(SESSION_ID, {
      messages: [user('m1', 'one', 1), idle('i1', 'succeeded', 2), user('m2', 'steer a', 3), user('m3', 'steer b', 4), assistant('a3', 'partial', 5)],
      inbox: [{ id: 'm4', type: 'user', payload: { text: 'waiting' }, delivery: 'steer', time: { created: 6 } }],
      running: true,
    });
    expect(t.working).toBe(true);
    expect(t.turns.map((turn) => turn.reply.status)).toEqual(['succeeded', 'succeeded', 'running']);
    expect(replyText(t.turns[2]!.reply)).toBe('partial');
    expect(pendingStatus(t, t.pending[0]!)).toBe('steering');
  });

  it('ignores non-message entries and other message types', () => {
    const t = timelineFromSnapshot(SESSION_ID, {
      messages: [null, 'x', { type: 'user' }, { id: 's1', type: 'system', time: { created: 1 } }, user('m1', 'one', 2)],
      inbox: [],
      running: false,
    });
    expect(t.turns.map((turn) => turn.id)).toEqual(['m1']);
    expect(timelineFromSnapshot(SESSION_ID, { messages: 'nope', inbox: 5, running: false }).turns).toEqual([]);
  });
});

describe('prependHistory', () => {
  const user = (id: string, text: string) => ({ id, type: 'user', text, time: { created: 1 } });
  const assistant = (id: string, text: string) => ({ id, type: 'assistant', content: [{ type: 'text', text }], time: { created: 2 } });
  const idle = (id: string) => ({ id, type: 'idle', outcome: 'succeeded', time: { created: 3 } });

  it('holds back the messages before the first user message', () => {
    expect(leadingOrphans([assistant('a0', 'tail'), idle('i0'), user('u1', 'hi')]).map((m) => (m as { id: string }).id)).toEqual([
      'a0',
      'i0',
    ]);
    expect(leadingOrphans([assistant('a0', 'tail')])).toHaveLength(1);
  });

  it('puts older turns in front, finishing a turn split across the page boundary', () => {
    // Newest page: the tail of turn u1 (its reply), then turn u2.
    const newest = [assistant('a1', 'first reply'), idle('i1'), user('u2', 'second'), assistant('a2', 'second reply'), idle('i2')];
    const current = timelineFromSnapshot(SESSION_ID, { messages: newest, inbox: [], running: false });
    expect(current.turns.map((t) => t.id)).toEqual(['u2']);

    const older = [user('u0', 'zeroth'), assistant('a0', 'zeroth reply'), idle('i0'), user('u1', 'first')];
    const { timeline, orphans } = prependHistory(current, older, leadingOrphans(newest));
    expect(timeline.turns.map((t) => [t.id, t.text, replyText(t.reply)])).toEqual([
      ['u0', 'zeroth', 'zeroth reply'],
      ['u1', 'first', 'first reply'],
      ['u2', 'second', 'second reply'],
    ]);
    expect(orphans).toEqual([]);
  });

  it('keeps a page with no user message as orphans for the next page', () => {
    const current = timelineFromSnapshot(SESSION_ID, { messages: [user('u2', 'two')], inbox: [], running: false });
    const { timeline, orphans } = prependHistory(current, [assistant('a1b', 'more')], [assistant('a1c', 'end')]);
    expect(timeline).toBe(current);
    expect(orphans).toHaveLength(2);
  });

  it('never duplicates a turn that is already shown', () => {
    const current = timelineFromSnapshot(SESSION_ID, { messages: [user('u1', 'one')], inbox: [], running: false });
    const { timeline } = prependHistory(current, [user('u0', 'zero'), user('u1', 'one')], []);
    expect(timeline.turns.map((t) => t.id)).toEqual(['u0', 'u1']);
  });
});

describe('attachments on user prompts', () => {
  const png = { data: 'iVBORw==', mime: 'image/png', source: { type: 'inline' }, name: 'shot.png' };
  const shown = { kind: 'image', name: 'shot.png', mime: 'image/png', src: 'data:image/png;base64,iVBORw==' };

  it('carries an enqueued prompt’s files into the pending prompt and on into its turn', () => {
    const queued = run([ev('session.inbox.enqueued', { inboxID: 'm1', item: { type: 'user', payload: { text: 'look', files: [png] }, delivery: 'steer' } })]);
    expect(queued.pending[0]!.files).toEqual([shown]);
    const t = run([delivered('m1')], queued);
    expect(t.turns[0]).toMatchObject({ id: 'm1', text: 'look', files: [shown] });
  });

  it('reads a stored message’s files when the chat is opened', () => {
    const t = timelineFromSnapshot(SESSION_ID, {
      messages: [{ id: 'u1', type: 'user', text: 'what is this?', files: [png], time: { created: 1 } }],
      inbox: [{ id: 'm2', type: 'user', payload: { text: 'and this', files: [png] }, delivery: 'queue', time: { created: 2 } }],
      running: false,
    });
    expect(t.turns[0]!.files).toEqual([shown]);
    expect(t.pending[0]!.files).toEqual([shown]);
  });

  it('adds no files key to a text-only prompt', () => {
    const t = run([enqueued('m1', 'hi'), delivered('m1')]);
    expect(t.turns[0]).not.toHaveProperty('files');
  });
});

describe('background subagent completions', () => {
  const completion = (inboxID: string, childID: string, state = 'completed') =>
    ev('session.inbox.enqueued', { inboxID, item: { type: 'synthetic', delivery: 'steer', payload: {
      text: `<subagent sessionID="${childID}">done</subagent>`, description: 'Inspect code',
      metadata: { source: 'subagent', childID, agent: 'explore', state },
    } } });
  const firstTurn = () => run([enqueued('m1', 'hello'), ev('session.execution.started'), delivered('m1'), ...say('launched', 'a1'), ev('session.execution.succeeded')]);

  it('marks the child finished on admission, then reopens the turn while the main agent replies again', () => {
    const admitted = run([completion('syn1', 'ses_child')], firstTurn());
    expect(admitted.finished).toEqual({ ses_child: 'completed' });
    expect(admitted.turns[0]!.reply.status).toBe('succeeded');

    const resumed = run([ev('session.execution.started'), delivered('syn1')], admitted);
    expect(resumed.turns).toHaveLength(1);
    expect(resumed.turns[0]!.reply.status).toBe('running');
    expect(resumed.turns[0]!.reply.notices).toEqual([
      { id: 'syn1', afterStep: 1 },
    ]);

    const settled = run([...say('it found two files', 'a2'), ev('session.execution.succeeded')], resumed);
    expect(settled.turns[0]!.reply.status).toBe('succeeded');
    expect(replyText(settled.turns[0]!.reply)).toBe('launched\n\nit found two files');
  });

  it('lands in the newer turn when the reader sent another message meanwhile', () => {
    const second = run([enqueued('m2', 'next'), ev('session.execution.started'), delivered('m2'), ...say('working', 'a2')], firstTurn());
    const t = run([completion('syn1', 'ses_child', 'error'), delivered('syn1')], second);
    expect(t.turns[0]!.reply.notices).toBeUndefined();
    expect(t.turns[1]!.reply.status).toBe('running');
    expect(t.turns[1]!.reply.notices?.[0]).toEqual({ id: 'syn1', afterStep: 1 });
    expect(t.finished).toEqual({ ses_child: 'error' });
  });

  it('ignores synthetic items that are not subagent completions', () => {
    const t = run([ev('session.inbox.enqueued', { inboxID: 'syn9', item: { type: 'synthetic', delivery: 'steer', payload: { text: 'restart' } } }), delivered('syn9')], firstTurn());
    expect(t.finished).toBeUndefined();
    expect(t.turns[0]!.reply).toMatchObject({ status: 'succeeded' });
    expect(t.turns[0]!.reply.notices).toBeUndefined();
  });

  it('rebuilds the note and the reopened run from a snapshot', () => {
    const synthetic = { id: 'syn1', type: 'synthetic', description: 'Inspect code', metadata: { source: 'subagent', childID: 'ses_child', agent: 'explore', state: 'completed' } };
    const messages = [
      { id: 'm1', type: 'user', text: 'hello', time: { created: 1 } },
      { id: 'a1', type: 'assistant', content: [{ type: 'text', text: 'launched' }], time: { created: 2 } },
      { id: 'i1', type: 'idle', outcome: 'succeeded', time: { created: 3 } },
      synthetic,
      { id: 'a2', type: 'assistant', content: [{ type: 'text', text: 'found it' }], time: { created: 4 } },
    ];
    const running = timelineFromSnapshot(SESSION_ID, { messages, inbox: [], running: true });
    expect(running.finished).toEqual({ ses_child: 'completed' });
    expect(running.turns[0]!.reply.status).toBe('running');
    expect(running.turns[0]!.reply.notices?.[0]).toMatchObject({ id: 'syn1', afterStep: 1 });
    const done = timelineFromSnapshot(SESSION_ID, { messages: [...messages, { id: 'i2', type: 'idle', outcome: 'succeeded', time: { created: 5 } }], inbox: [], running: false });
    expect(done.turns[0]!.reply.status).toBe('succeeded');
  });
});
