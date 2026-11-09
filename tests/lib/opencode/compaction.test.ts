import { describe, expect, it } from 'vitest';
import { replyFlow } from '@/lib/opencode/flow';
import { EMPTY_CATALOG, parseCommands, slashCommand, withBuiltins } from '@/lib/opencode/mentions';
import type { ServerEvent } from '@/lib/opencode/sse';
import { emptyTimeline, reduceTimeline, syncInbox, timelineFromSnapshot, type Timeline } from '@/lib/opencode/timeline';
import { SESSION_ID } from '@/tests/support/testkit';

let time = 1000;
const ev = (type: string, data: Record<string, unknown> = {}, id?: string): ServerEvent => ({
  type,
  created: (time += 10),
  ...(id ? { id } : {}),
  data: { sessionID: SESSION_ID, ...data },
});
const run = (events: ServerEvent[], start: Timeline = emptyTimeline(SESSION_ID)) => events.reduce(reduceTimeline, start);
const say = (text: string, assistantMessageID: string) => [
  ev('session.step.started', { assistantMessageID }),
  ev('session.text.started', { assistantMessageID, ordinal: 0 }),
  ev('session.text.ended', { assistantMessageID, ordinal: 0, text }),
  ev('session.step.ended', { assistantMessageID }),
];
const TOKENS = { input: 30_000, output: 1_200, reasoning: 0, cache: { read: 8_000, write: 0 } };
/** A chat with one answered turn. */
const answered = () =>
  run([
    ev('session.inbox.enqueued', { inboxID: 'u1', item: { type: 'user', payload: { text: 'hi' }, delivery: 'steer' } }),
    ev('session.inbox.delivered', { inboxID: 'u1' }),
    ev('session.execution.started'),
    ...say('hello', 'a1'),
    ev('session.execution.succeeded'),
  ]);
const compactions = (t: Timeline) => t.turns.at(-1)?.reply.compactions ?? [];

describe('compaction in the timeline', () => {
  it('follows a /compact from queued through its streamed summary to done', () => {
    const queued = run([ev('session.inbox.enqueued', { inboxID: 'c1', item: { type: 'compaction', payload: {}, delivery: 'queue' } })], answered());
    expect(compactions(queued)).toEqual([{ id: 'c1', afterStep: 1, status: 'queued', summary: '' }]);
    expect(queued.controls).toEqual([{ id: 'c1', delivery: 'queue', compaction: true }]);

    const running = run([
      ev('session.inbox.delivered', { inboxID: 'c1' }),
      ev('session.execution.started'),
      ev('session.compaction.started', { reason: 'manual', inputID: 'c1' }),
      ev('session.compaction.delta', { text: 'Summary of ' }),
      ev('session.compaction.delta', { text: 'the chat' }),
    ], queued);
    expect(compactions(running)).toEqual([{ id: 'c1', afterStep: 1, status: 'running', summary: 'Summary of the chat' }]);
    expect(running.controls).toEqual([]);

    const done = run([ev('session.compaction.ended', { reason: 'manual', text: 'Final summary', tokens: TOKENS }), ev('session.execution.succeeded')], running);
    expect(compactions(done)[0]).toEqual({ id: 'c1', afterStep: 1, status: 'completed', summary: 'Final summary' });
    expect(done.turns.at(-1)?.reply.status).toBe('succeeded');
  });

  it('places an automatic compaction mid-turn, where the reply picked up again', () => {
    const t = run([
      ev('session.inbox.enqueued', { inboxID: 'u1', item: { type: 'user', payload: { text: 'hi' }, delivery: 'steer' } }),
      ev('session.inbox.delivered', { inboxID: 'u1' }),
      ev('session.execution.started'),
      ...say('one', 'a1'),
      ev('session.compaction.started', { reason: 'auto' }, 'evt_c1'),
      ev('session.compaction.ended', { reason: 'auto', text: 'S' }),
      ...say('two', 'a2'),
    ]);
    expect(compactions(t)).toMatchObject([{ id: 'msg_c1', afterStep: 1, status: 'completed' }]);
    const shape = replyFlow(t.turns[0]!.reply).map((item) => item.type === 'answer' ? `answer:${item.part.text}` : item.key);
    expect(shape).toEqual(['answer:one', 'compaction:msg_c1', 'answer:two']);
  });

  it('fails a compaction the reader stopped, dropping the half summary', () => {
    const t = run([
      ev('session.compaction.started', { reason: 'manual', inputID: 'c1' }),
      ev('session.compaction.delta', { text: 'half' }),
      ev('session.compaction.failed', { reason: 'manual', inputID: 'c1', error: { type: 'aborted', message: 'Aborted' } }),
    ], answered());
    expect(compactions(t)).toEqual([{ id: 'c1', afterStep: 1, status: 'failed', summary: '', error: { type: 'aborted', message: 'Aborted' } }]);
  });

  it('records an outcome whose start it missed', () => {
    const t = run([ev('session.compaction.ended', { reason: 'auto', text: 'S' }, 'evt_x')], answered());
    expect(compactions(t)).toMatchObject([{ id: 'msg_x', status: 'completed', summary: 'S' }]);
  });

  it('drops a queued compaction that was cancelled, or is gone from the inbox after a resync', () => {
    const queued = run([ev('session.inbox.enqueued', { inboxID: 'c1', item: { type: 'compaction', payload: {}, delivery: 'queue' } })], answered());
    expect(compactions(run([ev('session.inbox.cancelled', { inboxID: 'c1' })], queued))).toEqual([]);
    expect(compactions(syncInbox(queued, []))).toEqual([]);
    expect(compactions(syncInbox(answered(), [{ id: 'c2', type: 'compaction', payload: {}, delivery: 'queue', time: { created: 1 } }])))
      .toMatchObject([{ id: 'c2', status: 'queued' }]);
  });

  it('rebuilds compactions from a snapshot, after the steps before them', () => {
    const t = timelineFromSnapshot(SESSION_ID, {
      messages: [
        { id: 'u1', type: 'user', text: 'hi', time: { created: 1 } },
        { id: 'a1', type: 'assistant', content: [{ type: 'text', text: 'hello' }], time: { created: 2 } },
        { id: 'c1', type: 'compaction', status: 'completed', summary: 'S', tokens: TOKENS, time: { created: 3 } },
        { id: 'c2', type: 'compaction', status: 'failed', reason: 'manual', error: { type: 'compaction.interrupted', message: 'x' }, time: { created: 4 } },
      ],
      inbox: [],
      running: false,
    });
    expect(compactions(t)).toMatchObject([
      { id: 'c1', afterStep: 1, status: 'completed', summary: 'S' },
      { id: 'c2', afterStep: 1, status: 'failed', summary: '', error: { type: 'compaction.interrupted' } },
    ]);
  });
});

describe('/compact', () => {
  it('is in the catalog from the start, and joins the server commands', () => {
    expect(slashCommand('/compact', [], EMPTY_CATALOG.commands)).toEqual({ name: 'compact', args: '' });
    expect(withBuiltins(parseCommands([{ name: 'review' }])).map((c) => c.label)).toEqual(['/compact', '/review']);
  });

  it('gives way to a server command of the same name', () => {
    const own = parseCommands([{ name: 'compact', description: 'Mine' }]);
    expect(withBuiltins(own)).toEqual(own);
  });
});
