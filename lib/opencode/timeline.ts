// Pure session model: the conversation's turns plus the server inbox (prompts admitted but not
// yet delivered). One server execution can run several turns: a steer is delivered at the next
// step boundary and starts a new turn mid-execution, and a queued prompt is delivered (one at a
// time) once every steer has drained. Assistant output always belongs to the latest delivered turn.
import { subagentNotice, type BackgroundNotice, type NoticeState } from './background';
import { dropQueued, isCompactionEvent, queueCompaction, reduceCompaction, snapshotCompaction } from './compaction';
import { goalMarker, type GoalMarker } from './goal-marker';
import { initialReply, isRecord, parseError, reduceReply, snapshotStep, upsert, type ReplyState, type StepModel } from './reply';
import { parseSentFiles, withFiles, type SentFile } from './sent-files';
import { eventMessageID, type ServerEvent } from './sse';

export type Delivery = 'steer' | 'queue';
/** A user prompt in the inbox, in the server's admission order. `files`: its attachments. */
export type PendingPrompt = { id: string; text: string; delivery: Delivery; created: number; files?: SentFile[]; goal?: GoalStart };
/** A turn a `/goal` started (its kickoff), in place of a prompt the reader wrote. */
export type GoalStart = { id: string; objective: string };
/**
 * A non-prompt inbox item (compaction, move, a synthetic note). A queued one blocks reordering the
 * queue. `notice`: the item reports a background subagent's completion; `compaction`: it compacts
 * the conversation (shown as queued in the latest turn until it starts).
 */
export type ControlItem = { id: string; delivery: Delivery; notice?: BackgroundNotice; goal?: GoalMarker; compaction?: true };
/** `created`: server time (ms) the prompt was sent, when known. `files`: its attachments. */
export type ModelSwitch = { id: string; model: StepModel; previous?: StepModel };
export type Turn = { id: string; text: string; reply: ReplyState; created?: number; files?: SentFile[]; switches?: ModelSwitch[]; goal?: GoalStart };
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
  switches: ModelSwitch[];
  pending: PendingPrompt[];
  controls: ControlItem[];
  /** Server time of the last idle boundary (an execution ending). */
  idleAt: number | null;
  /** The running execution has delivered at least one prompt. */
  deliveredSinceIdle: boolean;
  /** A revert is staged; re-admitting queued prompts would commit it. */
  reverted: boolean;
  /** Background subagents whose completion reached this chat, by child session id. */
  finished?: Record<string, NoticeState>;
};

export const emptyTimeline = (sessionID: string): Timeline => ({
  sessionID,
  working: false,
  turns: [],
  switches: [],
  pending: [],
  controls: [],
  idleAt: null,
  deliveredSinceIdle: false,
  reverted: false,
});

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
function switchModel(value: unknown): StepModel | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.providerID !== 'string') return undefined;
  return { modelID: value.id, providerID: value.providerID, ...(typeof value.variant === 'string' ? { variant: value.variant } : {}) };
}
function modelSwitch(id: string, data: Record<string, unknown>): ModelSwitch | undefined {
  const model = switchModel(data.model);
  const previous = switchModel(data.previous);
  return model ? { id, model, ...(previous ? { previous } : {}) } : undefined;
}
const delivery = (v: unknown): Delivery | undefined => (v === 'steer' || v === 'queue' ? v : undefined);
const hasTurn = (t: Timeline, id: string) => t.turns.some((turn) => turn.id === id);


/** The latest turn's reply, updated. */
const withReply = (t: Timeline, update: (reply: ReplyState) => ReplyState): Timeline =>
  replaceLastTurn(t, (turn) => {
    const reply = update(turn.reply);
    return reply === turn.reply ? turn : { ...turn, reply };
  });

function replaceLastTurn(t: Timeline, update: (turn: Turn) => Turn): Timeline {
  const last = t.turns.at(-1);
  if (!last) return t;
  const next = update(last);
  return next === last ? t : { ...t, turns: [...t.turns.slice(0, -1), next] };
}

/** A non-prompt inbox item; a synthetic one may carry a background subagent's completion or a goal's work. */
function parseControl(id: string, item: Record<string, unknown>, mode: Delivery): ControlItem {
  const notice = item.type === 'synthetic' ? subagentNotice(id, item.payload) : null;
  const goal = item.type === 'synthetic' ? goalMarker(id, item.payload) : null;
  return { id, delivery: mode, ...(notice && { notice }), ...(goal && { goal }), ...(item.type === 'compaction' && { compaction: true as const }) };
}

/** The goal a kickoff starts (a `start` marker), as its turn carries it. */
const goalStart = (marker: GoalMarker | null): GoalStart | undefined =>
  marker?.kind === 'start' ? { id: marker.goalID, objective: marker.objective } : undefined;

/** Parses one inbox item (from an event or GET .../inbox) into a prompt or a control item. */
function parseInboxItem(
  id: unknown,
  item: unknown,
  created: number,
): { prompt: PendingPrompt } | { control: ControlItem } | null {
  if (typeof id !== 'string' || !isRecord(item) || typeof item.type !== 'string') return null;
  const mode = delivery(item.delivery);
  if (!mode) return null;
  if (item.type !== 'user') return { control: parseControl(id, item, mode) };
  return { prompt: parsePrompt(id, isRecord(item.payload) ? item.payload : {}, mode, created) };
}

/** A user inbox item's prompt. A `/goal` with attachments kicks off as one: its text is the kickoff, not the reader's. */
function parsePrompt(id: string, payload: Record<string, unknown>, mode: Delivery, created: number): PendingPrompt {
  const goal = goalStart(goalMarker(id, payload));
  const text = goal ? '' : (str(payload.text) ?? '');
  return { id, text, delivery: mode, created, ...withFiles(parseSentFiles(payload.files)), ...(goal && { goal }) };
}

/** Marks a background subagent finished: its completion was admitted, so it runs no more. */
function markFinished(t: Timeline, notice: BackgroundNotice | undefined): Timeline {
  if (!notice || t.finished?.[notice.childID] === notice.state) return t;
  return { ...t, finished: { ...t.finished, [notice.childID]: notice.state } };
}

function enqueue(t: Timeline, d: Record<string, unknown>, created: number): Timeline {
  const parsed = parseInboxItem(d.inboxID, d.item, created);
  if (!parsed) return t;
  if ('control' in parsed) {
    const next = markFinished({ ...t, controls: upsert(t.controls, parsed.control) }, parsed.control.notice);
    return parsed.control.compaction ? withReply(next, (reply) => queueCompaction(reply, parsed.control.id)) : next;
  }
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

/**
 * A background subagent's completion entered the conversation: it wakes the main agent, which
 * replies again within the latest turn. The note goes where the reply picks up, and the turn runs
 * again, so its footer hides while the reply streams and returns once the run settles.
 */
function resumeWithNotice(t: Timeline, notice: BackgroundNotice): Timeline {
  return replaceLastTurn(markFinished(t, notice), (turn) => {
    if (turn.reply.notices?.some((item) => item.id === notice.id)) return turn;
    const next = withNotice(turn, notice);
    return { ...next, reply: { ...next.reply, status: 'running' } };
  });
}

type GoalRound = Extract<GoalMarker, { kind: 'round' }>;

/**
 * The reviewer sent the goal back for another round: the continuation enters the latest turn (the
 * goal's), where its reply picks up again, with a divider naming the round and the reason.
 */
function resumeWithRound(t: Timeline, marker: GoalRound): Timeline {
  return replaceLastTurn(t, (turn) => {
    if (turn.reply.notices?.some((item) => item.id === marker.id)) return turn;
    const next = withRound(turn, marker);
    return { ...next, reply: { ...next.reply, status: 'running' } };
  });
}

function withRound(turn: Turn, marker: GoalRound): Turn {
  const { error: _error, interruptReason: _reason, ...reply } = turn.reply;
  const goal = { resumed: marker.resumed, ...(marker.reason ? { reason: marker.reason } : {}) };
  return { ...turn, reply: { ...reply, notices: [...(reply.notices ?? []), { id: marker.id, afterStep: reply.steps.length, goal }] } };
}

/** The turn with a completion note where its reply picks up; the earlier run's error no longer stands. */
function withNotice(turn: Turn, notice: BackgroundNotice): Turn {
  const { error: _error, interruptReason: _reason, ...reply } = turn.reply;
  return { ...turn, reply: { ...reply, notices: [...(reply.notices ?? []), { id: notice.id, afterStep: reply.steps.length }] } };
}

function deliver(t: Timeline, id: string, at: number | undefined): Timeline {
  const control = t.controls.find((c) => c.id === id);
  if (control) return deliverControl(t, control, at);
  return openTurn(t, id, t.pending.find((p) => p.id === id), at);
}

/** A delivered control item: a background completion or a goal round resumes the latest turn; a goal kickoff starts one. */
function deliverControl(t: Timeline, control: ControlItem, at: number | undefined): Timeline {
  if (control.notice) return resumeWithNotice(withoutInbox(t, control.id), control.notice);
  if (control.goal?.kind === 'round') return resumeWithRound(withoutInbox(t, control.id), control.goal);
  const goal = goalStart(control.goal ?? null);
  return goal ? openTurn(t, control.id, undefined, at, goal) : withoutInbox(t, control.id);
}

/** A delivered prompt (or goal kickoff) starts a turn, closing the one before. */
function openTurn(t: Timeline, id: string, prompt: PendingPrompt | undefined, at: number | undefined, goal?: GoalStart): Timeline {
  const rest = withoutInbox(t, id);
  if (hasTurn(t, id)) return rest;
  // The previous turn ends where the new prompt enters the conversation.
  const closed = replaceLastTurn(rest, (turn) =>
    turn.reply.status === 'running' ? { ...turn, reply: { ...turn.reply, status: 'succeeded' } } : turn,
  );
  return {
    ...closed,
    turns: [...closed.turns, deliveredTurn(t, id, prompt, at, goal)],
    switches: [],
    deliveredSinceIdle: true,
  };
}

/** The turn a delivered prompt starts: its text and files, from when it was sent (else delivered). */
function deliveredTurn(t: Timeline, id: string, prompt: PendingPrompt | undefined, at: number | undefined, start?: GoalStart): Turn {
  const reply: ReplyState = { ...initialReply(t.sessionID), status: t.working ? 'running' : 'idle' };
  const turn: Turn = { id, text: prompt?.text ?? '', reply, ...withFiles(prompt?.files), ...switchesBefore(t) };
  return withOptional(turn, prompt?.created ?? at, start ?? prompt?.goal);
}

/** The model switches made since the last turn, which go with the next one. */
const switchesBefore = (t: Timeline): Pick<Turn, 'switches'> => (t.switches.length ? { switches: t.switches } : {});

/** The turn with its send time and the goal it starts, when known. */
function withOptional(turn: Turn, created: number | undefined, goal: GoalStart | undefined): Turn {
  if (created !== undefined) turn.created = created;
  if (goal) turn.goal = goal;
  return turn;
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

function addModelSwitch(t: Timeline, event: ServerEvent): Timeline {
  // Choosing the first prompt's model is setup, not a change between user turns.
  if (t.turns.length === 0 && t.pending.length === 0) return t;
  const id = eventMessageID(event, 'model');
  const notice = modelSwitch(id, event.data);
  if (!notice || t.switches.some((item) => item.id === id) || t.turns.some((turn) => turn.switches?.some((item) => item.id === id))) return t;
  return { ...t, switches: [...t.switches, notice] };
}

export function reduceTimeline(t: Timeline, event: ServerEvent): Timeline {
  const d = event.data ?? {};
  if (d.sessionID !== t.sessionID) return t;
  if (event.type === 'session.model.selected') return addModelSwitch(t, event);
  if (Object.hasOwn(OUTCOMES, event.type)) return settle(t, event, d);
  if (isCompactionEvent(event)) return withReply(t, (reply) => reduceCompaction(reply, event));
  const inboxID = str(d.inboxID);
  switch (event.type) {
    case 'session.inbox.enqueued':
      return enqueue(t, d, event.created ?? Date.now());
    case 'session.inbox.delivered':
      return inboxID ? deliver(t, inboxID, event.created) : t;
    case 'session.inbox.cancelled':
      return inboxID ? withReply(withoutInbox(t, inboxID), (reply) => dropQueued(reply, (id) => id !== inboxID)) : t;
    case 'session.inbox.delivery.changed': {
      const mode = delivery(d.delivery);
      return inboxID && mode ? changeDelivery(t, inboxID, mode) : t;
    }
    case 'session.execution.started':
      return { ...t, working: true, deliveredSinceIdle: false };
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
  const marked = controls.reduce((next, control) => markFinished(next, control.notice), { ...t, pending, controls });
  // Queued compactions follow the inbox: the ones in it show, the ones gone from it no longer do.
  const queued = controls.filter((control) => control.compaction).map((control) => control.id);
  return withReply(marked, (reply) =>
    queued.reduce(queueCompaction, dropQueued(reply, (id) => queued.includes(id))),
  );
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
  snapshot: { messages: unknown; inbox: unknown; running: boolean; hasEarlier?: boolean },
): Timeline {
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const { turns, idleAt, sinceIdle, switches, finished } = messages.reduce(
    (acc: SnapshotAcc, m: unknown) => readSnapshotMessage(acc, m, sessionID),
    { turns: [], switches: [], idleAt: null, sinceIdle: false, showLeadingSwitches: snapshot.hasEarlier === true },
  );
  const last = turns.at(-1);
  const running = snapshot.running && sinceIdle;
  if (running && last) turns[turns.length - 1] = { ...last, reply: { ...last.reply, status: 'running' } };

  const base: Timeline = { ...emptyTimeline(sessionID), working: snapshot.running, turns, switches, idleAt, deliveredSinceIdle: running, ...(finished ? { finished } : {}) };
  return syncInbox(base, snapshot.inbox);
}

type SnapshotAcc = {
  turns: Turn[];
  switches: ModelSwitch[];
  idleAt: number | null;
  sinceIdle: boolean;
  showLeadingSwitches: boolean;
  finished?: Record<string, NoticeState>;
};

type SnapshotMessage = Record<string, unknown> & { id: string; type: string };

/** One reader per message type; each mutates only the accumulator's own `turns` array. */
const SNAPSHOT_READERS: Record<string, (acc: SnapshotAcc, m: SnapshotMessage, sessionID: string) => SnapshotAcc> = {
  user: (acc, m, sessionID) => {
    const created = isRecord(m.time) && typeof m.time.created === 'number' ? m.time.created : undefined;
    const goal = goalStart(goalMarker(m.id, m));
    acc.turns.push({
      id: m.id,
      text: goal ? '' : (str(m.text) ?? ''),
      ...(goal && { goal }),
      reply: { ...initialReply(sessionID), status: 'succeeded' },
      ...(created !== undefined ? { created } : {}),
      ...withFiles(parseSentFiles(m.files)),
      ...(acc.switches.length ? { switches: acc.switches } : {}),
    });
    return { ...acc, switches: [], sinceIdle: true };
  },
  'model-switched': (acc, m) => {
    if (!acc.showLeadingSwitches && acc.turns.length === 0) return acc;
    const notice = modelSwitch(m.id, m);
    return notice ? { ...acc, switches: [...acc.switches, notice] } : acc;
  },
  assistant: (acc, m) => {
    const last = acc.turns.at(-1);
    if (last) acc.turns[acc.turns.length - 1] = { ...last, reply: { ...last.reply, steps: [...last.reply.steps, snapshotStep(m)] } };
    return acc;
  },
  // A background subagent's completion: the main agent picked up again in the same turn, so the
  // run after it belongs to that turn until the next idle marker closes it.
  synthetic: (acc, m, sessionID) => {
    const marker = goalMarker(m.id, m);
    if (marker) return readGoalMarker(acc, marker, m, sessionID);
    const notice = subagentNotice(m.id, m);
    if (!notice) return acc;
    const last = acc.turns.at(-1);
    if (last) acc.turns[acc.turns.length - 1] = withNotice(last, notice);
    return { ...acc, sinceIdle: true, finished: { ...acc.finished, [notice.childID]: notice.state } };
  },
  compaction: (acc, m) => {
    const last = acc.turns.at(-1);
    if (last) acc.turns[acc.turns.length - 1] = { ...last, reply: snapshotCompaction(last.reply, m) };
    return acc;
  },
  idle: (acc, m) => {
    const last = acc.turns.at(-1);
    if (last && acc.sinceIdle) acc.turns[acc.turns.length - 1] = closeWithIdle(last, m);
    return { ...acc, idleAt: createdAt(m), sinceIdle: false };
  },
};

/** A goal's kickoff starts a turn of its own; a round puts its divider in the latest turn. */
function readGoalMarker(acc: SnapshotAcc, marker: GoalMarker, m: SnapshotMessage, sessionID: string): SnapshotAcc {
  if (marker.kind === 'round') {
    const last = acc.turns.at(-1);
    if (last) acc.turns[acc.turns.length - 1] = withRound(last, marker);
    return { ...acc, sinceIdle: true };
  }
  const created = isRecord(m.time) && typeof m.time.created === 'number' ? m.time.created : undefined;
  acc.turns.push({
    id: m.id,
    text: '',
    goal: { id: marker.goalID, objective: marker.objective },
    reply: { ...initialReply(sessionID), status: 'succeeded' },
    ...(created !== undefined ? { created } : {}),
    ...(acc.switches.length ? { switches: acc.switches } : {}),
  });
  return { ...acc, switches: [], sinceIdle: true };
}

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
  hasEarlier = false,
): { timeline: Timeline; orphans: unknown[] } {
  const messages = [...older, ...orphans];
  const { turns, switches } = messages.reduce(
    (acc: SnapshotAcc, m: unknown) => readSnapshotMessage(acc, m, t.sessionID),
    { turns: [], switches: [], idleAt: null, sinceIdle: false, showLeadingSwitches: hasEarlier },
  );
  const known = new Set(t.turns.map((turn) => turn.id));
  const earlier = turns.filter((turn) => !known.has(turn.id));
  const first = t.turns[0];
  const remaining = switches.length && first
    ? [{ ...first, switches: [...switches, ...(first.switches ?? []).filter((item) => !switches.some((notice) => notice.id === item.id))] }, ...t.turns.slice(1)]
    : t.turns;
  return {
    timeline: earlier.length ? { ...t, turns: [...earlier, ...remaining] } : t,
    // A page with no user message is all tail: keep it with the orphans it extends.
    orphans: leadingOrphans(messages),
  };
}
