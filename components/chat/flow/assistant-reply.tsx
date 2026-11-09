import { memo, useMemo } from 'react';
import { replyErrorText } from '@/lib/opencode/chat';
import { awaitingPickup, pickupKey, replyFlow, type AnswerText, type FlowItem, type WorkGroup as Group } from '@/lib/opencode/flow';
import type { ReplyState } from '@/lib/opencode/reply';
import type { TurnStats } from '@/lib/opencode/turn-stats';
import { AnswerFooter } from '../message-footer';
import { NoticeDivider } from '../notice-divider';
import { Markdown, ReplyLive } from './markdown';
import { AgentRow } from './agent-rows';
import { CompactionRow } from './compaction-row';
import { WorkGroup } from './work-group';

/** Each subagent call's place among the reply's subagents, in the order they were made. */
function agentOrder(flow: FlowItem[]): Map<string, number> {
  const order = new Map<string, number>();
  for (const item of flow) if (item.type === 'agents') for (const part of item.parts) order.set(part.id, order.size);
  return order;
}

const PENDING: Group = { type: 'work', key: 'work:pending', parts: [] };
const FIRST_WORK = 'work:first';

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div data-slot="assistant-error" className="italic">
      <ReplyLive value>
        <Markdown text={text} animate className="text-text-secondary" />
      </ReplyLive>
    </div>
  );
}

type EntryProps = {
  item: FlowItem;
  live: boolean;
  /** The reply's last item: where a live reply is working now. */
  last: boolean;
  /** The item before it is a work group (an answer then sits a little lower). */
  afterWork: boolean;
  agentIndex: Map<string, number>;
};

/** One item of the reply's flow. */
function FlowEntry({ item, live, last, afterWork, agentIndex }: EntryProps) {
  switch (item.type) {
    case 'agents':
      return (
        <div data-slot="agent-rows" className="flex flex-col">
          {item.parts.map((part) => <AgentRow key={part.id} part={part} index={agentIndex.get(part.id) ?? 0} live={live} />)}
        </div>
      );
    case 'work':
      return <WorkGroup group={item} live={live} active={live && last} />;
    case 'compaction':
      return <CompactionRow item={item.compaction} />;
    case 'round':
      return (
        <div className="my-3">
          <NoticeDivider slot="goal-round" label={item.label} />
        </div>
      );
    default:
      return (
        <div data-slot="assistant-answer" className={afterWork ? 'mt-1' : undefined}>
          {/* An answer keeps its streamed words' wrappers until the whole reply finishes (markdown.tsx). */}
          <ReplyLive value={live}>
            <Markdown text={item.part.text} animate={live && last} />
          </ReplyLive>
        </div>
      );
  }
}

/**
 * What the reply shows, in order (`items`), and what comes after its footer (`tail`).
 * Before anything arrives, an empty work group stands in ("Thinking"). The first real group takes
 * over its React key, so the header stays in place and its label morphs, not remounts. The same
 * stands in after a background completion, under the key the work it picks up with gets. A
 * compaction after a finished reply's last step reads after its footer, as the next thing that
 * happened; while the reply runs it stays in place, so the work before it is not taken as current.
 */
function layout(reply: ReplyState, flow: FlowItem[], live: boolean): { items: FlowItem[]; tail: FlowItem[] } {
  const pickup = live ? awaitingPickup(reply) : undefined;
  const pending = pickup ? { ...PENDING, key: pickupKey(pickup) } : live && flow.length === 0 ? PENDING : undefined;
  const all = pending ? [...flow, pending] : flow;
  const cut = live ? all.length : all.findLastIndex((item) => item.type !== 'compaction') + 1;
  return cut === all.length ? { items: all, tail: [] } : { items: all.slice(0, cut), tail: all.slice(cut) };
}

/**
 * An assistant reply in the order it happened: work groups (thinking, tool calls, commentary)
 * fold under their headers, and the answer reads as markdown between and after them, its words
 * fading in as they stream. Once the turn finishes, the footer (Copy the last answer text, model,
 * duration, speed) closes the reply. opencode hangs it under the last answer text instead, which
 * puts it above any work that came after, as when the reader interrupts mid-call.
 */
export const AssistantReply = memo(function AssistantReply({
  reply,
  stats,
  latest = false,
}: {
  reply: ReplyState;
  stats?: TurnStats;
  /** The newest reply in the chat: its footer stays visible instead of waiting for hover. */
  latest?: boolean;
}) {
  // Each subagent's place among the reply's subagents picks its doodle (agent-rows.tsx).
  const { flow, agentIndex } = useMemo(() => {
    const items = replyFlow(reply);
    return { flow: items, agentIndex: agentOrder(items) };
  }, [reply]);
  const live = reply.status === 'running';
  const { items, tail } = useMemo(() => layout(reply, flow, live), [reply, flow, live]);
  const reactKey = (item: FlowItem, index: number) => (item.type === 'work' && index === 0 ? FIRST_WORK : item.key);
  const footerText = live ? undefined : flow.findLast((item): item is AnswerText => item.type === 'answer' && item.part.text.trim() !== '')?.part.text;
  const errorText = replyErrorText(reply);
  const interrupted = reply.status === 'interrupted';

  return (
    <div
      data-slot="assistant-reply"
      data-footer-host={footerText !== undefined || undefined}
      data-footer-latest={(footerText !== undefined && latest) || undefined}
      className="flex min-w-0 max-w-full flex-col gap-2 type-body"
    >
      {items.map((item, index) => (
        <FlowEntry
          key={reactKey(item, index)}
          item={item}
          live={live}
          last={index === items.length - 1}
          afterWork={index > 0 && flow[index - 1]?.type === 'work'}
          agentIndex={agentIndex}
        />
      ))}
      {!interrupted && <ErrorLine text={errorText} />}
      {footerText !== undefined && <AnswerFooter text={footerText} stats={stats} />}
      {interrupted && errorText && <NoticeDivider slot="reply-interrupted" label={errorText} />}
      {tail.map((item) => <FlowEntry key={item.key} item={item} live={live} last={false} afterWork={false} agentIndex={agentIndex} />)}
    </div>
  );
});
