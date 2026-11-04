import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PendingMessage } from '@/lib/opencode/chat';
import { replyParts } from '@/lib/opencode/reply';
import type { Turn } from '@/lib/opencode/timeline';
import { turnStats } from '@/lib/opencode/turn-stats';
import { CollapsibleText } from './collapsible-text';
import { AssistantReply } from './flow/assistant-reply';
import { UserMessageFooter } from './message-footer';
import { useInFlight } from './send-flight';

// User prompts render as plain text. Replies render as markdown (flow/markdown.tsx), where no
// HTML from the server is ever parsed as markup.
function UserBubble({ id, text, pending }: { id: string; text: string; pending?: boolean }) {
  // Just sent: hidden (keeping its place) while its text flies in from the prompt box.
  const inFlight = useInFlight(id);
  return (
    <div
      data-message-id={id}
      className={cn(
        // wrap-anywhere (not break-words) also lowers the bubble's minimum width, so a long URL
        // or word wraps inside the bubble instead of widening it.
        'flex max-w-5/6 min-w-0 flex-col self-end rounded-2xl bg-background-intermediate-transparent px-3 py-2 type-body',
        pending && 'text-text-secondary',
        inFlight && 'invisible',
      )}
    >
      <CollapsibleText text={text} testId="user-text" />
    </div>
  );
}

/**
 * A prompt the server has not delivered yet. It reads as waiting (dimmed) while it sits behind
 * delivered work (`steering`), was left by an execution that ended (`stranded`) or is queued.
 */
function PendingBubble({ message }: { message: PendingMessage }) {
  const waiting = message.status !== 'starting';
  return (
    <div data-slot="user-message" data-pending={waiting || undefined} className="flex flex-col items-end">
      <UserBubble id={message.id} text={message.text} pending={waiting} />
    </div>
  );
}

/**
 * One prompt and its reply. Memoized: the timeline keeps every finished turn as the same object,
 * so a streamed update re-renders only the turn it changes, however long the chat is.
 */
const TurnView = memo(function TurnView({ turn, latest }: { turn: Turn; latest: boolean }) {
  const stats = useMemo(() => turnStats(turn), [turn]);
  // A follow-up is admitted (and its reply starts "Thinking") before its text has flown into the
  // bubble; the reply waits for the landing, as a first message's does behind session creation.
  const inFlight = useInFlight(turn.id);
  return (
    // claude.ai's rhythm: bubble, its 24px action row and the reply sit 8px apart.
    <div className="flex flex-col gap-2">
      <div data-slot="user-message" data-footer-host className="flex flex-col items-end gap-2">
        <UserBubble id={turn.id} text={turn.text} />
        <UserMessageFooter text={turn.text} created={turn.created} />
      </div>
      {!inFlight && <AssistantReply reply={turn.reply} stats={stats} latest={latest} />}
    </div>
  );
});

/** Arm at 90%, confirm continuation past 95%, and reset the growing tail to 25%. */
const STICK_PX = 48;
const ARM_AT = 0.9;
const CONFIRM_AT = 0.95;
const EDGE_AT = 0.98;
const RESET_TO = 0.25;
const FOLLOW_SPACE = 1 - RESET_TO;
const SCROLL_MS = 200;
const PAGE_TURN_MS = 650;

type Motion = { id: number; target: number; from: number; start: number; end: number; lastNow: number };
type Gate = { id: string; phase: 'armed' | 'ready'; length: number };

function shouldTurn(gate: Gate | null, current: { id: string; length: number }, position: number): boolean {
  if (position >= EDGE_AT) return true;
  return gate?.id === current.id && gate.phase === 'ready' && current.length > gate.length;
}

function advanceGate(gate: Gate | null, current: { id: string; length: number }, position: number): { gate: Gate | null; turn: boolean } {
  if (position < ARM_AT) return { gate: null, turn: false };
  if (shouldTurn(gate, current, position)) return { gate: null, turn: true };
  if (position >= CONFIRM_AT) {
    return { gate: gate?.id === current.id && gate.phase === 'ready' ? gate : { ...current, phase: 'ready' }, turn: false };
  }
  return { gate: { ...current, phase: 'armed' }, turn: false };
}

const bottom = (element: HTMLElement) => Math.max(0, element.scrollHeight - element.clientHeight);
const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

function retargetMotion(motion: Motion, element: HTMLElement) {
  const target = bottom(element);
  if (target === motion.target) return;
  motion.from = element.scrollTop;
  motion.start = motion.lastNow;
  motion.target = target;
}

/** The first and newest message shown, as the last scroll update saw them. */
type Edges = { first?: string; last?: string };

function edgesOf(turns: Turn[], pending: PendingMessage[]): Edges {
  return { first: turns[0]?.id, last: pending.at(-1)?.id ?? turns.at(-1)?.id };
}

/** Older turns were added on top: the old first turn is still there, no longer first. */
function prepended(before: Edges, now: Edges, turns: Turn[]): boolean {
  if (before.first === undefined || before.first === now.first) return false;
  return turns.some((turn) => turn.id === before.first);
}

type Props = {
  turns: Turn[];
  pending: PendingMessage[];
  /** Older messages exist beyond the loaded ones. */
  hasEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
};

function usePageTurn(turns: Turn[], pending: PendingMessage[]) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<Edges & { height: number }>({ height: 0 });
  /** The reader is at (or near) the bottom, so new content should stay in view. */
  const stick = useRef(true);
  const motion = useRef<Motion | null>(null);
  const lastSet = useRef<number | null>(null);
  const [space, setSpace] = useState(0);
  const spaceRef = useRef(0);
  const gate = useRef<Gate | null>(null);
  const stream = useRef<{ id: string; length: number } | null>(null);
  const activeTurn = turns.at(-1);
  stream.current = activeTurn?.reply.status === 'running'
    ? {
        id: activeTurn.id,
        length: replyParts(activeTurn.reply).reduce((length, part) => length + (part.kind === 'tool' ? part.inputText.length : part.text.length), 0),
      }
    : null;
  const empty = turns.length === 0 && pending.length === 0;

  // The element that scrolls is the ScrollArea's viewport.
  const viewport = () => ref.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null;

  const syncSpace = (element: HTMLElement) => {
    const next = Math.round(element.clientHeight * FOLLOW_SPACE);
    if (spaceRef.current === next) return;
    spaceRef.current = next;
    setSpace(next);
  };

  const cancelMotion = () => {
    if (motion.current) cancelAnimationFrame(motion.current.id);
    motion.current = null;
  };

  const follow = (element: HTMLElement, duration = SCROLL_MS) => {
    if (element.clientHeight <= 0) return;
    const target = bottom(element);
    if (motion.current && Math.abs(motion.current.target - target) < 1) return;
    cancelMotion();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || Math.abs(target - element.scrollTop) < 1) {
      lastSet.current = target;
      element.scrollTop = target;
      return;
    }
    const start = performance.now();
    const moving: Motion = { id: 0, target, from: element.scrollTop, start, end: start + duration, lastNow: start };
    const tick = (now: number) => {
      const active = motion.current;
      if (!active) return;
      const progress = Math.min(1, Math.max(0, (now - active.start) / (active.end - active.start)));
      const top = active.from + (active.target - active.from) * easeOutCubic(progress);
      lastSet.current = top;
      element.scrollTop = top;
      active.lastNow = now;
      if (progress < 1) active.id = requestAnimationFrame(tick);
      else motion.current = null;
    };
    moving.id = requestAnimationFrame(tick);
    motion.current = moving;
  };

  const considerTurn = (element: HTMLElement) => {
    const current = stream.current;
    if (motion.current && stick.current) {
      retargetMotion(motion.current, element);
      return;
    }
    if (!stick.current || !current || element.clientHeight <= 0) {
      if (!current || !stick.current) gate.current = null;
      return;
    }
    const position = (element.scrollHeight - spaceRef.current - element.scrollTop) / element.clientHeight;
    const next = advanceGate(gate.current, current, position);
    gate.current = next.gate;
    if (next.turn) follow(element, PAGE_TURN_MS);
  };

  // Follow the reader: scrolling up to read stops the list from pulling them back down.
  useEffect(() => {
    const element = viewport();
    if (!element) return;
    const onScroll = () => {
      if (motion.current && lastSet.current !== null && Math.abs(element.scrollTop - lastSet.current) < 1) return;
      cancelMotion();
      stick.current = bottom(element) - element.scrollTop <= STICK_PX;
    };
    const onIntent = () => {
      cancelMotion();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp', 'Home', 'ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) onIntent();
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    element.addEventListener('wheel', onIntent, { passive: true });
    element.addEventListener('touchstart', onIntent, { passive: true });
    element.addEventListener('pointerdown', onIntent, { passive: true });
    element.addEventListener('keydown', onKeyDown);

    // Content and viewport resizing can cross the turn threshold without a new timeline event.
    const content = ref.current;
    const observer = content && new ResizeObserver(() => {
      syncSpace(element);
      considerTurn(element);
      previous.current.height = element.scrollHeight;
    });
    if (content) observer?.observe(content);
    observer?.observe(element);
    return () => {
      cancelMotion();
      element.removeEventListener('scroll', onScroll);
      element.removeEventListener('wheel', onIntent);
      element.removeEventListener('touchstart', onIntent);
      element.removeEventListener('pointerdown', onIntent);
      element.removeEventListener('keydown', onKeyDown);
      observer?.disconnect();
    };
  }, [empty]);

  // Let a growing reply stay still until continued text confirms a page turn.
  // Older turns added above preserve the reader's position.
  useLayoutEffect(() => {
    const element = viewport();
    if (!element) return;
    syncSpace(element);
    const edges = edgesOf(turns, pending);
    if (prepended(previous.current, edges, turns)) {
      cancelMotion();
      element.scrollTop += element.scrollHeight - previous.current.height;
    } else if (edges.last !== previous.current.last) {
      gate.current = null;
      follow(element);
      stick.current = true;
    } else if (stick.current) {
      considerTurn(element);
    }
    previous.current = { ...edges, height: element.scrollHeight };
  }, [turns, pending, space]);

  return { ref, space };
}

export const MessageList = memo(function MessageList({
  turns,
  pending,
  hasEarlier = false,
  loadingEarlier = false,
  onLoadEarlier,
}: Props) {
  const { ref, space } = usePageTurn(turns, pending);
  const empty = turns.length === 0 && pending.length === 0;

  if (empty) {
    return <div className="flex min-h-0 flex-1"></div>;
  }

  return (
    <ScrollArea fade className="min-h-0 flex-1">
      <div ref={ref} className="mx-auto flex w-full max-w-chat flex-col gap-6 p-4">
        {hasEarlier && (
          <Button variant="ghost" size="sm" className="self-center" disabled={loadingEarlier} onClick={onLoadEarlier}>
            {loadingEarlier ? 'Loading…' : 'Load earlier messages'}
          </Button>
        )}
        {turns.map((turn, index) => (
          // A queued prompt sits below the last turn, so that turn is no longer the newest reply.
          <TurnView key={turn.id} turn={turn} latest={index === turns.length - 1 && pending.length === 0} />
        ))}
        {pending.map((message) => (
          <PendingBubble key={message.id} message={message} />
        ))}
        {/* Cancel the list gap; p-3 already supplies 12px below this spacer. */}
        <div data-slot="stream-space" aria-hidden="true" className="-mt-6" style={{ height: Math.max(0, space - 12) }} />
      </div>
    </ScrollArea>
  );
});
