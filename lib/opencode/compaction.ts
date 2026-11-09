// Compaction, as opencode's clients follow it (client/solid/data.ts, core session/message-updater.ts):
// an inbox item waits (queued), `session.compaction.started` opens it, `.delta` streams its summary,
// and `.ended` or `.failed` settles it. A reloaded chat lists each as a `compaction` message.
import { isRecord, parseError, str, upsert, type ReplyCompaction, type ReplyState } from './reply';
import { eventMessageID, type ServerEvent } from './sse';

const STATUSES = new Set<unknown>(['queued', 'running', 'completed', 'failed']);

const list = (reply: ReplyState) => reply.compactions ?? [];
/** The reply with `item` in place (by id), or added after its steps so far. */
const put = (reply: ReplyState, item: ReplyCompaction): ReplyState => ({ ...reply, compactions: upsert(list(reply), item) });
/** A new entry where the reply stands now. */
const at = (reply: ReplyState, id: string, status: ReplyCompaction['status'], summary = ''): ReplyCompaction =>
  ({ id, afterStep: reply.steps.length, status, summary });

/** The compaction being written now: the last one running. */
const running = (reply: ReplyState) => list(reply).findLast((item) => item.status === 'running');

/** A compaction the inbox admitted: shown as queued where the reply stands now, until it starts. */
export const queueCompaction = (reply: ReplyState, id: string): ReplyState =>
  list(reply).some((item) => item.id === id) ? reply : put(reply, at(reply, id, 'queued'));

/** Queued compactions that left the inbox without running (cancelled, or gone after a resync). */
export function dropQueued(reply: ReplyState, keep: (id: string) => boolean): ReplyState {
  const next = list(reply).filter((item) => item.status !== 'queued' || keep(item.id));
  return next.length === list(reply).length ? reply : { ...reply, compactions: next };
}

/** Whether `event` is a compaction event (they apply to the latest turn's reply). */
export const isCompactionEvent = (event: ServerEvent) => event.type.startsWith('session.compaction.');

export function reduceCompaction(reply: ReplyState, event: ServerEvent): ReplyState {
  const d = event.data ?? {};
  const id = str(d.inputID) || eventMessageID(event, 'compaction');
  const current = running(reply);
  switch (event.type) {
    // It starts where the reply stands now, even when it was queued earlier in the turn.
    case 'session.compaction.started':
      return put(reply, at(reply, id, 'running'));
    case 'session.compaction.delta':
      return current && d.text ? put(reply, { ...current, summary: current.summary + str(d.text) }) : reply;
    // An outcome settles the running one, or is added on its own when its start was missed.
    case 'session.compaction.ended':
      return put(reply, { ...(current ?? at(reply, id, 'running')), status: 'completed', summary: str(d.text) ?? current?.summary ?? '' });
    case 'session.compaction.failed':
      return put(reply, { ...(current ?? at(reply, id, 'running')), status: 'failed', summary: '', error: parseError(d.error) });
    default:
      return reply;
  }
}

/** A `compaction` message from a snapshot, placed after the reply's steps so far. */
export function snapshotCompaction(reply: ReplyState, message: Record<string, unknown> & { id: string }): ReplyState {
  const status = STATUSES.has(message.status) ? (message.status as ReplyCompaction['status']) : 'completed';
  if (status !== 'failed') return put(reply, at(reply, message.id, status, str(message.summary) ?? ''));
  return put(reply, { ...at(reply, message.id, status), ...(isRecord(message.error) && { error: parseError(message.error) }) });
}
