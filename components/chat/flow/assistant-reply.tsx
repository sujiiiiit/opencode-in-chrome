import { memo, useMemo } from 'react';
import { replyErrorText } from '@/lib/opencode/chat';
import { replyFlow, type FlowItem, type WorkGroup as Group } from '@/lib/opencode/flow';
import type { ReplyState } from '@/lib/opencode/reply';
import type { TurnStats } from '@/lib/opencode/turn-stats';
import { AnswerFooter } from '../message-footer';
import { Markdown, ReplyLive } from './markdown';
import { WorkGroup } from './work-group';

const PENDING: Group = { type: 'work', key: 'work:pending', parts: [] };
const FIRST_WORK = 'work:first';

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="rounded-lg bg-destructive/10 px-3 py-2 type-work wrap-anywhere text-destructive">{text}</p>;
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
  const flow = useMemo(() => replyFlow(reply), [reply]);
  const live = reply.status === 'running';
  // Before anything arrives, an empty work group stands in ("Thinking"). The first real group
  // takes over its React key, so the header stays in place and its label morphs, not remounts.
  const items: FlowItem[] = live && flow.length === 0 ? [PENDING] : flow;
  const reactKey = (item: FlowItem, index: number) => (index === 0 && item.type === 'work' ? FIRST_WORK : item.key);
  const lastAnswer = live ? undefined : flow.findLast((item) => item.type === 'answer' && item.part.text.trim() !== '');
  const footerText = lastAnswer?.type === 'answer' ? lastAnswer.part.text : undefined;

  return (
    <div
      data-slot="assistant-reply"
      data-footer-host={footerText !== undefined || undefined}
      data-footer-latest={(footerText !== undefined && latest) || undefined}
      className="flex min-w-0 max-w-full flex-col gap-2 type-body"
    >
      {items.map((item, index) =>
        item.type === 'work' ? (
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
      <ErrorLine text={replyErrorText(reply)} />
      {footerText !== undefined && (
        <AnswerFooter text={footerText} stats={stats} interrupted={reply.status === 'interrupted'} />
      )}
    </div>
  );
});
