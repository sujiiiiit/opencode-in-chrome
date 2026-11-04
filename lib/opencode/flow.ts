// How one reply reads on screen, ported from opencode's timeline projection: the work (reasoning,
// tool calls and explicitly labelled commentary) folds into a collapsible group, and the
// answer (the text after the last tool call) stands outside it, in the order it all happened.
import { replyParts, type ReplyPart, type ReplyState, type ReplyTextPart, type ReplyToolPart } from './reply';

export type WorkGroup = {
  type: 'work';
  /** The first part's ID: stable while the group grows. */
  key: string;
  parts: ReplyPart[];
};

export type AnswerText = { type: 'answer'; key: string; part: ReplyTextPart };

export type FlowItem = WorkGroup | AnswerText;

const visible = (part: ReplyPart) => part.kind === 'tool' || part.text.trim() !== '';

/**
 * Only the model's phase can identify commentary without looking into the future. A later tool
 * must not move an already visible text node into another container and remount its markdown.
 */
const commentary = (part: ReplyTextPart): boolean => part.phase === 'commentary';

/** The reply as work groups and answer texts, in order. */
export function replyFlow(reply: ReplyState): FlowItem[] {
  const parts = replyParts(reply).filter(visible);
  const items: FlowItem[] = [];
  for (const part of parts) {
    if (part.kind === 'text' && !commentary(part)) {
      items.push({ type: 'answer', key: `answer:${part.id}`, part });
      continue;
    }
    const last = items.at(-1);
    if (last?.type === 'work') last.parts.push(part);
    else items.push({ type: 'work', key: `work:${part.id}`, parts: [part] });
  }
  return items;
}

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
