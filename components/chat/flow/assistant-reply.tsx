import { memo, useMemo } from 'react';
import { replyErrorText } from '@/lib/opencode/chat';
import { awaitingPickup, pickupKey, replyFlow, type FlowItem, type WorkGroup as Group } from '@/lib/opencode/flow';
import type { ReplyState } from '@/lib/opencode/reply';
import type { TurnStats } from '@/lib/opencode/turn-stats';
import { AnswerFooter } from '../message-footer';
import { NoticeDivider } from '../notice-divider';
import { Markdown, ReplyLive } from './markdown';
import { AgentRow } from './agent-rows';
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
  // Before anything arrives, an empty work group stands in ("Thinking"). The first real group
  // takes over its React key, so the header stays in place and its label morphs, not remounts.
  // The same stands in after a background completion, under the key the work it picks up with gets.
  const pickup = live ? awaitingPickup(reply) : undefined;
  const pending = pickup ? { ...PENDING, key: pickupKey(pickup) } : live && flow.length === 0 ? PENDING : undefined;
  const items: FlowItem[] = pending ? [...flow, pending] : flow;
  const reactKey = (item: FlowItem, index: number) => (item.type === 'work' && index === 0 ? FIRST_WORK : item.key);
  const lastAnswer = live ? undefined : flow.findLast((item) => item.type === 'answer' && item.part.text.trim() !== '');
  const footerText = lastAnswer?.type === 'answer' ? lastAnswer.part.text : undefined;
  const errorText = replyErrorText(reply);
  const interrupted = reply.status === 'interrupted';

  return (
    <div
      data-slot="assistant-reply"
      data-footer-host={footerText !== undefined || undefined}
      data-footer-latest={(footerText !== undefined && latest) || undefined}
      className="flex min-w-0 max-w-full flex-col gap-2 type-body"
    >
      {items.map((item, index) =>
        item.type === 'agents' ? (
          <div key={item.key} data-slot="agent-rows" className="flex flex-col">
            {item.parts.map((part) => <AgentRow key={part.id} part={part} index={agentIndex.get(part.id) ?? 0} live={live} />)}
          </div>
        ) : item.type === 'work' ? (
          <WorkGroup key={reactKey(item, index)} group={item} live={live} active={live && index === items.length - 1} />
        ) : (
          <div
            key={item.key}
            data-slot="assistant-answer"
            className={index > 0 && flow[index - 1]?.type === 'work' ? 'mt-1' : undefined}
          >
            {/* An answer keeps its streamed words' wrappers until the whole reply finishes (markdown.tsx). */}
            <ReplyLive value={live}>
              <Markdown text={item.part.text} animate={live && index === items.length - 1} />
            </ReplyLive>
          </div>
        ),
      )}
      {!interrupted && <ErrorLine text={errorText} />}
      {footerText !== undefined && <AnswerFooter text={footerText} stats={stats} />}
      {interrupted && errorText && <NoticeDivider slot="reply-interrupted" label={errorText} />}
    </div>
  );
});
