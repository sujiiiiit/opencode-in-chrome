import { useEffect, useRef } from 'react';
import { replyErrorText } from '@/lib/opencode/chat';
import { replyReasoning, replyText, type ReplyState } from '@/lib/opencode/reply';

export type Turn = {
  id: number;
  user: string;
  reply: ReplyState | null;
  /** A transport-level error (offline, timeout) rather than a model error. */
  error: string | null;
  pending: boolean;
};

// Everything below renders as React text nodes: no HTML or markdown from the server.
function Reasoning({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Reasoning</summary>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </details>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
      {text}
    </p>
  );
}

function ToolList({ tools }: { tools: { id: string; name: string }[] }) {
  return tools.map((tool) => (
    <p key={tool.id} className="text-xs text-muted-foreground">
      Used tool: {tool.name}
    </p>
  ));
}

const turnError = (turn: Turn) => turn.error ?? (turn.reply ? replyErrorText(turn.reply) : null);

function AssistantBubble({ turn }: { turn: Turn }) {
  const reply = turn.reply;
  const text = reply ? replyText(reply) : '';
  const error = turnError(turn);
  const thinking = turn.pending && !text && !error;

  return (
    <div className="flex max-w-full flex-col gap-2 text-sm">
      <Reasoning text={reply ? replyReasoning(reply) : ''} />
      <ToolList tools={reply ? reply.steps.flatMap((s) => s.tools) : []} />
      {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
      {thinking && <p className="animate-pulse text-muted-foreground">Thinking…</p>}
      <ErrorLine text={error} />
    </div>
  );
}

export function MessageList({ turns }: { turns: Turn[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  return (
    <div ref={ref} className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      {turns.length === 0 && <p className="m-auto text-sm text-muted-foreground">Ask opencode anything.</p>}
      {turns.map((turn) => (
        <div key={turn.id} className="flex flex-col gap-3">
          <p className="max-w-5/6 self-end whitespace-pre-wrap break-words rounded-2xl bg-secondary px-3 py-2 text-sm">
            {turn.user}
          </p>
          <AssistantBubble turn={turn} />
        </div>
      ))}
    </div>
  );
}
