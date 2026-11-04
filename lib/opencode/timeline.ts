// Pure session model: the conversation's turns plus the server inbox (prompts admitted but not
// yet delivered). One server execution can run several turns: a steer is delivered at the next
// step boundary and starts a new turn mid-execution, and a queued prompt is delivered (one at a
// time) once every steer has drained. Assistant output always belongs to the latest delivered turn.
import { initialReply, isRecord, parseError, reduceReply, snapshotStep, type ReplyState } from './reply';
import type { ServerEvent } from './sse';

export type Delivery = 'steer' | 'queue';
/** A user prompt in the inbox, in the server's admission order. */
export type PendingPrompt = { id: string; text: string; delivery: Delivery; created: number };
/** A non-prompt inbox item (compaction, move). A queued one blocks reordering the queue. */
export type ControlItem = { id: string; delivery: Delivery };
/** `created`: server time (ms) the prompt was sent, when known. */
export type Turn = { id: string; text: string; reply: ReplyState; created?: number };
/**
 * Where a pending prompt stands, as in opencode's data layer: `starting` is promoted at the next
 * idle boundary, `steering` waits for the next step boundary of an execution that already
 * delivered input, `stranded` outlived an execution that ended without delivering it, and
 * `queued` waits for every steer to drain.
 */
export type PendingStatus = 'starting' | 'steering' | 'stranded' | 'queued';

export type Timeline = {
  sessionID: string;
  working: boolean;
  turns: Turn[];
  pending: PendingPrompt[];
  controls: ControlItem[];
  /** Server time of the last idle boundary (an execution ending). */
  idleAt: number | null;
  /** The running execution has delivered at least one prompt. */
  deliveredSinceIdle: boolean;
  /** A revert is staged; re-admitting queued prompts would commit it. */
  reverted: boolean;
};

export const emptyTimeline = (sessionID: string): Timeline => ({
  sessionID,
  working: false,
  turns: [],
  pending: [],
  controls: [],
  idleAt: null,
  deliveredSinceIdle: false,
  reverted: false,
});

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const delivery = (v: unknown): Delivery | undefined => (v === 'steer' || v === 'queue' ? v : undefined);
const hasTurn = (t: Timeline, id: string) => t.turns.some((turn) => turn.id === id);

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  return index === -1 ? [...list, item] : list.map((entry, i) => (i === index ? item : entry));
}

function replaceLastTurn(t: Timeline, update: (turn: Turn) => Turn): Timeline {
  const last = t.turns.at(-1);
  if (!last) return t;
  const next = update(last);
  return next === last ? t : { ...t, turns: [...t.turns.slice(0, -1), next] };
}

/** Parses one inbox item (from an event or GET .../inbox) into a prompt or a control item. */
function parseInboxItem(
  id: unknown,
  item: unknown,
  created: number,
): { prompt: PendingPrompt } | { control: ControlItem } | null {
  if (typeof id !== 'string' || !isRecord(item) || typeof item.type !== 'string') return null;
  const mode = delivery(item.delivery);
  if (!mode) return null;
  if (item.type !== 'user') return { control: { id, delivery: mode } };
  const payload = isRecord(item.payload) ? item.payload : {};
  return { prompt: { id, text: str(payload.text) ?? '', delivery: mode, created } };
}

function enqueue(t: Timeline, d: Record<string, unknown>, created: number): Timeline {
  const parsed = parseInboxItem(d.inboxID, d.item, created);
  if (!parsed) return t;
  if ('control' in parsed) return { ...t, controls: upsert(t.controls, parsed.control) };
  if (hasTurn(t, parsed.prompt.id)) return t;
  return { ...t, pending: upsert(t.pending, parsed.prompt) };
}

function withoutInbox(t: Timeline, id: string): Timeline {
  return {
    ...t,
    pending: t.pending.filter((p) => p.id !== id),
    controls: t.controls.filter((c) => c.id !== id),
  };
}

function deliver(t: Timeline, id: string, at: number | undefined): Timeline {
  if (t.controls.some((c) => c.id === id)) return withoutInbox(t, id);
  const prompt = t.pending.find((p) => p.id === id);
  const rest = withoutInbox(t, id);
  if (hasTurn(t, id)) return rest;
  // The previous turn ends where the new prompt enters the conversation.
  const closed = replaceLastTurn(rest, (turn) =>
    turn.reply.status === 'running' ? { ...turn, reply: { ...turn.reply, status: 'succeeded' } } : turn,
  );
  const reply: ReplyState = { ...initialReply(t.sessionID), status: t.working ? 'running' : 'idle' };
  const created = prompt?.created ?? at;
  const turn: Turn = { id, text: prompt?.text ?? '', reply, ...(created !== undefined ? { created } : {}) };
  return {
    ...closed,
    turns: [...closed.turns, turn],
    deliveredSinceIdle: true,
  };
}

function changeDelivery(t: Timeline, id: string, mode: Delivery): Timeline {
  return {
    ...t,
    pending: t.pending.map((p) => (p.id === id ? { ...p, delivery: mode } : p)),
    controls: t.controls.map((c) => (c.id === id ? { ...c, delivery: mode } : c)),
  };
}

const OUTCOMES: Record<string, (reply: ReplyState, d: Record<string, unknown>) => ReplyState> = {
  'session.execution.succeeded': (reply) => ({ ...reply, status: 'succeeded' }),
  'session.execution.failed': (reply, d) => ({ ...reply, status: 'failed', error: parseError(d.error) }),
  'session.execution.interrupted': (reply, d) => ({ ...reply, status: 'interrupted', interruptReason: str(d.reason) }),
};

function settle(t: Timeline, event: ServerEvent, d: Record<string, unknown>): Timeline {
  const outcome = OUTCOMES[event.type];
  if (!outcome) return t;
  const ended = replaceLastTurn(t, (turn) =>
    turn.reply.status === 'running' || turn.reply.status === 'idle' ? { ...turn, reply: outcome(turn.reply, d) } : turn,
  );
  return { ...ended, working: false, idleAt: event.created ?? Date.now(), deliveredSinceIdle: false };
}

export function reduceTimeline(t: Timeline, event: ServerEvent): Timeline {
  const d = event.data ?? {};
  if (d.sessionID !== t.sessionID) return t;
  const inboxID = str(d.inboxID);
  switch (event.type) {
    case 'session.inbox.enqueued':
      return enqueue(t, d, event.created ?? Date.now());
    case 'session.inbox.delivered':
      return inboxID ? deliver(t, inboxID, event.created) : t;
    case 'session.inbox.cancelled':
      return inboxID ? withoutInbox(t, inboxID) : t;
    case 'session.inbox.delivery.changed': {
      const mode = delivery(d.delivery);
      return inboxID && mode ? changeDelivery(t, inboxID, mode) : t;
    }
    case 'session.execution.started':
      return { ...t, working: true, deliveredSinceIdle: false };
    case 'session.execution.succeeded':
    case 'session.execution.failed':
    case 'session.execution.interrupted':
      return settle(t, event, d);
    case 'session.revert.staged':
      return { ...t, reverted: true };
    case 'session.revert.cleared':
    case 'session.revert.committed':
      return { ...t, reverted: false };
    default:
      // Step, text, reasoning and tool events stream into the latest turn.
      return replaceLastTurn(t, (turn) => {
        const reply = reduceReply(turn.reply, event);
        return reply === turn.reply ? turn : { ...turn, reply };
      });
  }
}

/** Adds a prompt the server just admitted (its POST answered) unless the stream already reported it. */
export function admitPrompt(t: Timeline, prompt: PendingPrompt): Timeline {
  if (hasTurn(t, prompt.id) || t.pending.some((p) => p.id === prompt.id)) return t;
  return { ...t, pending: [...t.pending, prompt] };
}

/** Replaces the inbox with the server's list (GET .../inbox), keeping its order. */
export function syncInbox(t: Timeline, items: unknown): Timeline {
  if (!Array.isArray(items)) return t;
  const pending: PendingPrompt[] = [];
  const controls: ControlItem[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const created = isRecord(item.time) && typeof item.time.created === 'number' ? item.time.created : 0;
    const parsed = parseInboxItem(item.id, item, created);
    if (!parsed) continue;
    if ('control' in parsed) controls.push(parsed.control);
    else if (!hasTurn(t, parsed.prompt.id)) pending.push(parsed.prompt);
  }
  return { ...t, pending, controls };
}

export function pendingStatus(t: Timeline, prompt: Pick<PendingPrompt, 'delivery' | 'created'>): PendingStatus {
  if (prompt.delivery === 'queue') return 'queued';
  if (!t.working) return t.idleAt !== null && prompt.created <= t.idleAt ? 'stranded' : 'starting';
  return t.deliveredSinceIdle ? 'steering' : 'starting';
}

const createdAt = (m: Record<string, unknown>) =>
  isRecord(m.time) && typeof m.time.created === 'number' ? m.time.created : 0;

function closeWithIdle(turn: Turn, idle: Record<string, unknown>): Turn {
  const outcome = idle.outcome;
  if (outcome === 'failed') return { ...turn, reply: { ...turn.reply, status: 'failed', error: parseError(idle.error) } };
  return { ...turn, reply: { ...turn.reply, status: outcome === 'interrupted' ? 'interrupted' : 'succeeded' } };
}

/**
 * Rebuilds the timeline from the server (after a dropped stream, or to open an existing session).
 * `messages` is chronological. An `idle` marker closes the turn before it: every step since the
 * previous marker belongs to that turn, including prompts steered in while it was busy.
 */
export function timelineFromSnapshot(
  sessionID: string,
  snapshot: { messages: unknown; inbox: unknown; running: boolean },
): Timeline {
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const { turns, idleAt, sinceIdle } = messages.reduce(
    (acc: SnapshotAcc, m: unknown) => readSnapshotMessage(acc, m, sessionID),
    { turns: [], idleAt: null, sinceIdle: false },
  );
  const last = turns.at(-1);
  const running = snapshot.running && sinceIdle;
  if (running && last) turns[turns.length - 1] = { ...last, reply: { ...last.reply, status: 'running' } };

  const base: Timeline = { ...emptyTimeline(sessionID), working: snapshot.running, turns, idleAt, deliveredSinceIdle: running };
  return syncInbox(base, snapshot.inbox);
}

type SnapshotAcc = { turns: Turn[]; idleAt: number | null; sinceIdle: boolean };

type SnapshotMessage = Record<string, unknown> & { id: string; type: string };

/** One reader per message type; each mutates only the accumulator's own `turns` array. */
const SNAPSHOT_READERS: Record<string, (acc: SnapshotAcc, m: SnapshotMessage, sessionID: string) => SnapshotAcc> = {
  user: (acc, m, sessionID) => {
    const created = isRecord(m.time) && typeof m.time.created === 'number' ? m.time.created : undefined;
    acc.turns.push({
      id: m.id,
      text: str(m.text) ?? '',
      reply: { ...initialReply(sessionID), status: 'succeeded' },
      ...(created !== undefined ? { created } : {}),
    });
    return { ...acc, sinceIdle: true };
  },
  assistant: (acc, m) => {
    const last = acc.turns.at(-1);
    if (last) acc.turns[acc.turns.length - 1] = { ...last, reply: { ...last.reply, steps: [...last.reply.steps, snapshotStep(m)] } };
    return acc;
  },
  idle: (acc, m) => {
    const last = acc.turns.at(-1);
    if (last && acc.sinceIdle) acc.turns[acc.turns.length - 1] = closeWithIdle(last, m);
    return { ...acc, idleAt: createdAt(m), sinceIdle: false };
  },
};

/** Folds one snapshot message into the turns being rebuilt. */
function readSnapshotMessage(acc: SnapshotAcc, m: unknown, sessionID: string): SnapshotAcc {
  if (!isRecord(m) || typeof m.id !== 'string' || typeof m.type !== 'string') return acc;
  const reader = Object.hasOwn(SNAPSHOT_READERS, m.type) ? SNAPSHOT_READERS[m.type] : undefined;
  return reader ? reader(acc, m as SnapshotMessage, sessionID) : acc;
}

const isUserMessage = (m: unknown) => isRecord(m) && m.type === 'user';

/**
 * The messages before the first user message in a chronological page: the tail of a turn that
 * began on an older page. They are held back until that page loads, so the turn stays whole.
 */
export function leadingOrphans(messages: unknown[]): unknown[] {
  const first = messages.findIndex(isUserMessage);
  return first === -1 ? [...messages] : messages.slice(0, first);
}

/**
 * Puts an older page of messages (chronological) in front of the timeline. `orphans` are the
 * newer page's leading messages, which finish the older page's last turn. Returns the timeline
 * and the older page's own leading orphans, to pass to the next call.
 */
export function prependHistory(
  t: Timeline,
  older: unknown[],
  orphans: unknown[],
): { timeline: Timeline; orphans: unknown[] } {
  const messages = [...older, ...orphans];
  const { turns } = messages.reduce(
    (acc: SnapshotAcc, m: unknown) => readSnapshotMessage(acc, m, t.sessionID),
    { turns: [], idleAt: null, sinceIdle: false },
  );
  const known = new Set(t.turns.map((turn) => turn.id));
  const earlier = turns.filter((turn) => !known.has(turn.id));
  return {
    timeline: earlier.length ? { ...t, turns: [...earlier, ...t.turns] } : t,
    // A page with no user message is all tail: keep it with the orphans it extends.
    orphans: leadingOrphans(messages),
  };
}
