// How one reply reads on screen, ported from opencode's timeline projection: the work (reasoning,
// tool calls and explicitly labelled commentary) folds into a collapsible group, and the
// answer (the text after the last tool call) stands outside it, in the order it all happened.
import { isAgentTool } from './background';
import type { ReplyCompaction, ReplyNotice, ReplyPart, ReplyState, ReplyTextPart, ReplyToolPart } from './reply';

export type WorkGroup = {
  type: 'work';
  /** The first part's ID: stable while the group grows. */
  key: string;
  parts: ReplyPart[];
};

export type AnswerText = { type: 'answer'; key: string; part: ReplyTextPart };

/**
 * Subagent calls made one after another (agents started together): a row each in the reply,
 * where they were made, outside the folded work. The first call's ID keys it while it grows.
 */
export type AgentsItem = { type: 'agents'; key: string; parts: ReplyToolPart[] };

/** A goal round: the reviewer sent the work back, so the reply picks up below this divider. */
export type RoundDivider = { type: 'round'; key: string; label: string };

/** A compaction of the conversation: the work before it is summarised, the work after starts anew. */
export type CompactionItem = { type: 'compaction'; key: string; compaction: ReplyCompaction };

export type FlowItem = WorkGroup | AnswerText | AgentsItem | RoundDivider | CompactionItem;

const visible = (part: ReplyPart) => part.kind === 'tool' || part.text.trim() !== '';

/**
 * Only the model's phase can identify commentary without looking into the future. A later tool
 * must not move an already visible text node into another container and remount its markdown.
 */
const commentary = (part: ReplyTextPart): boolean => part.phase === 'commentary';

/** The key of the work the reply picked up with after background completion `id`. */
export const pickupKey = (id: string) => `work:after:${id}`;

/**
 * Adds a part to the flow. `pickup` (a completion's id) is set for the first part after a
 * background subagent finished: it starts an item of its own instead of joining the one before.
 */
function addPart(items: FlowItem[], part: ReplyPart, pickup?: string) {
  if (part.kind === 'text' && !commentary(part)) items.push({ type: 'answer', key: `answer:${part.id}`, part });
  else if (part.kind === 'tool' && isAgentTool(part)) addAgent(items, part, pickup);
  else addWork(items, part, pickup);
}

function addAgent(items: FlowItem[], part: ReplyToolPart, pickup?: string) {
  const last = pickup ? undefined : items.at(-1);
  if (last?.type === 'agents') last.parts.push(part);
  else items.push({ type: 'agents', key: `agents:${part.id}`, parts: [part] });
}

function addWork(items: FlowItem[], part: ReplyPart, pickup?: string) {
  const last = pickup ? undefined : items.at(-1);
  if (last?.type === 'work') last.parts.push(part);
  else items.push({ type: 'work', key: pickup ? pickupKey(pickup) : `work:${part.id}`, parts: [part] });
}

/**
 * A round's divider label. The kickoff is round 1, so the reviewer's first send-back starts round
 * 2; a resume restarts the count, as the goal's round budget does.
 */
function roundLabels(notices: ReplyNotice[]): Map<string, string> {
  const labels = new Map<string, string>();
  let round = 1;
  for (const notice of notices) {
    if (!notice.goal) continue;
    if (notice.goal.resumed) {
      round = 1;
      labels.set(notice.id, 'Goal resumed');
      continue;
    }
    round += 1;
    labels.set(notice.id, notice.goal.reason ? `Round ${round} · ${notice.goal.reason}` : `Round ${round}`);
  }
  return labels;
}

/**
 * The reply as work groups, answer texts and subagent calls, in order. Where a background
 * subagent finished, a goal round began or the conversation was compacted and the main agent
 * picked up again, the work after starts a group of its own; a goal round also gets a divider
 * there, and a compaction its own row.
 */
export function replyFlow(reply: ReplyState): FlowItem[] {
  const notices = reply.notices ?? [];
  const labels = roundLabels(notices);
  const items: FlowItem[] = [];
  const compactions = reply.compactions ?? [];
  // What happened between steps: goal round dividers, then compactions.
  const markers = (at: (afterStep: number) => boolean) => {
    for (const notice of notices) {
      const label = labels.get(notice.id);
      if (label && at(notice.afterStep)) items.push({ type: 'round', key: `round:${notice.id}`, label });
    }
    for (const compaction of compactions) {
      if (at(compaction.afterStep)) items.push({ type: 'compaction', key: `compaction:${compaction.id}`, compaction });
    }
  };
  // A notice there names the work that picks up after it (the reply's placeholder uses its key).
  const pickups = [...compactions, ...notices];
  let pickup: string | undefined;
  reply.steps.forEach((step, index) => {
    markers((afterStep) => afterStep === index);
    pickup = pickups.findLast((marker) => marker.afterStep === index)?.id ?? pickup;
    for (const part of step.parts) {
      if (!visible(part)) continue;
      addPart(items, part, pickup);
      pickup = undefined;
    }
  });
  // Markers the reply has not picked up from yet (no step after them so far).
  markers((afterStep) => afterStep >= reply.steps.length);
  return items;
}

/** A background completion the main agent is picking up from, before its first new step arrives. */
export const awaitingPickup = (reply: ReplyState): string | undefined =>
  reply.notices?.findLast((notice) => notice.afterStep >= reply.steps.length)?.id;

export const groupTools = (group: WorkGroup) => group.parts.filter((p): p is ReplyToolPart => p.kind === 'tool');

/**
 * Server time the group's work started and (if it is over) ended, when the parts report it. A part
 * a stopped reply left without an end counts from its start, so the span does not vanish.
 */
export function groupSpan(group: WorkGroup): { started?: number; ended?: number } {
  const starts = group.parts.flatMap((p) => (p.started === undefined ? [] : [p.started]));
  const ends = group.parts.flatMap((p) => {
    const end = p.ended ?? p.started;
    return end === undefined ? [] : [end];
  });
  return {
    ...(starts.length ? { started: Math.min(...starts) } : {}),
    ...(ends.length ? { ended: Math.max(...ends) } : {}),
  };
}

const HEADING = [/^#{1,6}\s+(.+?)(?:\s+#+)?$/, /^\*\*([^*]+)\*\*:?$/, /^__([^_]+)__:?$/];

/**
 * The last heading in reasoning text (`## Planning the fix`, or a line that is all `**bold**`):
 * models title each stretch of thought, which names what they are thinking about now.
 */
export function reasoningHeading(text: string): string | undefined {
  let heading: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const title = HEADING.map((pattern) => pattern.exec(trimmed)?.[1]?.trim()).find(Boolean);
    if (title) heading = title;
  }
  return heading;
}

/** "4s", "2m 5s", "1h 3m". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${total % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
