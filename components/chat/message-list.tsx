import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PendingMessage } from '@/lib/opencode/chat';
import { replyParts } from '@/lib/opencode/reply';
import type { ModelSwitch, Turn } from '@/lib/opencode/timeline';
import { turnStats } from '@/lib/opencode/turn-stats';
import { CollapsibleText } from './collapsible-text';
import { AssistantReply } from './flow/assistant-reply';
import { UserMessageFooter } from './message-footer';
import { SentAttachments } from './sent-attachments';
import { useModelName } from './model/model-names';
import { useInFlight } from './send-flight';
import type { SentFile } from '@/lib/opencode/sent-files';

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
 * A sent prompt's attachments (above) and its text bubble. The attachments wait out the text's
 * flight with it. A message sent with files and no text (another opencode client can send one)
 * shows just the files.
 */
function UserContent({ id, text, files, pending }: { id: string; text: string; files?: SentFile[]; pending?: boolean }) {
  const inFlight = useInFlight(id);
  return (
    <>
      {files && <div className={cn('w-full', text && '-mb-2')}><SentAttachments files={files} hidden={inFlight} /></div>}
      {(text || !files) && <UserBubble id={id} text={text} pending={pending} />}
    </>
  );
}

function SwitchNotice({ notice }: { notice: ModelSwitch }) {
  const name = useModelName(notice.model);
  const variantOnly = notice.previous?.providerID === notice.model.providerID && notice.previous.modelID === notice.model.modelID;
  const label = variantOnly ? `Switched variant to ${notice.model.variant ?? 'Default'}` : `Switched to ${name}`;
  return <div data-slot="model-switch" className="flex items-center gap-3 text-xs text-text-secondary">
    <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
    <span className="min-w-0 max-w-[70%] truncate" title={label}>{label}</span>
    <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
  </div>;
}

/** One stable component per message ID, from local send through admission and delivery. */
const MessageEntry = memo(function MessageEntry({ turn, pending, latest, files }: {
  turn?: Turn;
  pending?: PendingMessage;
  latest: boolean;
  files?: SentFile[];
}) {
  const message = turn ?? pending!;
  const id = message.id;
  const waiting = pending ? pending.status !== 'starting' : false;
  const stats = useMemo(() => turn && turnStats(turn), [turn]);
  // A follow-up is admitted (and its reply starts "Thinking") before its text has flown into the
  // bubble; the reply waits for the landing, as a first message's does behind session creation.
  const inFlight = useInFlight(id);
  return (
    <div className="flex flex-col gap-2">
      {!!turn?.switches?.length && (
        <div className="mb-4 flex flex-col gap-2">
          {turn.switches.map((notice) => <SwitchNotice key={notice.id} notice={notice} />)}
        </div>
      )}
      <div data-slot="user-message" data-footer-host={turn ? '' : undefined} data-pending={waiting || undefined} className="flex flex-col items-end gap-2">
        <UserContent id={id} text={message.text} files={files} pending={waiting} />
        {turn && <UserMessageFooter text={turn.text} created={turn.created} />}
      </div>
      {turn && !inFlight && <AssistantReply reply={turn.reply} stats={stats!} latest={latest} />}
    </div>
  );
});

/** Arm at 90%, confirm continuation past 95%, and turn the page so 400px of room shows below the text. */
const STICK_PX = 48;
/** A scroll this soon after a wheel, key or released drag is the reader's (smooth wheel scrolling runs on). */
const INTENT_MS = 600;
const ARM_AT = 0.9;
const CONFIRM_AT = 0.95;
const EDGE_AT = 0.98;
/** Room kept below the content for page turns; a short viewport keeps at least 25% of it for text. */
const FOLLOW_SPACE_PX = 400;
const MAX_FOLLOW_SHARE = 0.75;
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
  switches?: ModelSwitch[];
  pending: PendingMessage[];
  previewFiles?: (id: string) => SentFile[] | undefined;
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
  const streaming = useMemo(
    () =>
      activeTurn?.reply.status === 'running'
        ? {
            id: activeTurn.id,
            length: replyParts(activeTurn.reply).reduce((length, part) => length + (part.kind === 'tool' ? part.inputText.length : part.text.length), 0),
          }
        : null,
    [activeTurn],
  );
  // Published on commit, not during render: a background render React drops must not leave its
  // reply behind for the scroll and resize handlers to read.
  useLayoutEffect(() => {
    stream.current = streaming;
  }, [streaming]);
  const empty = turns.length === 0 && pending.length === 0;

  // The element that scrolls is the ScrollArea's viewport.
  const viewport = () => ref.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null;

  const syncSpace = (element: HTMLElement) => {
    const next = Math.round(Math.min(FOLLOW_SPACE_PX, element.clientHeight * MAX_FOLLOW_SHARE));
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

  /** Where the content ends, in px from the viewport's top (the follow space below is excluded). */
  const contentEnd = (element: HTMLElement) => element.scrollHeight - spaceRef.current - element.scrollTop;

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
    const position = contentEnd(element) / element.clientHeight;
    const next = advanceGate(gate.current, current, position);
    gate.current = next.gate;
    if (next.turn) follow(element, PAGE_TURN_MS);
  };

  // Follow the reader: scrolling up to read stops the list from pulling them back down.
  useEffect(() => {
    const element = viewport();
    if (!element) return;
    // Wheel, touch, keys and the scrollbar thumb (a sibling of the viewport) all live under the root.
    const root = element.closest<HTMLElement>('[data-slot="scroll-area"]') ?? element;
    let lastTop = element.scrollTop;
    let intentAt = -Infinity;
    let holding = false;
    const onScroll = () => {
      const moved = element.scrollTop - lastTop;
      lastTop = element.scrollTop;
      if (motion.current && lastSet.current !== null && Math.abs(element.scrollTop - lastSet.current) < 1) return;
      // Only the reader's own scrolling changes following. Scrolls the browser makes itself (scroll
      // anchoring, clamping when content shrinks) must not switch it off mid-reply.
      if (!holding && performance.now() - intentAt > INTENT_MS) return;
      cancelMotion();
      // Scrolling up stops following; scrolling down to the end of the text resumes it.
      stick.current = moved >= 0 && contentEnd(element) <= element.clientHeight + STICK_PX;
    };
    const onIntent = () => {
      intentAt = performance.now();
      cancelMotion();
    };
    const onHold = () => {
      holding = true;
      onIntent();
    };
    const onRelease = () => {
      if (!holding) return;
      holding = false;
      intentAt = performance.now();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp', 'Home', 'ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) onIntent();
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('wheel', onIntent, { passive: true });
    root.addEventListener('touchstart', onHold, { passive: true });
    root.addEventListener('pointerdown', onHold, { passive: true });
    window.addEventListener('touchend', onRelease, { passive: true });
    window.addEventListener('pointerup', onRelease, { passive: true });
    window.addEventListener('pointercancel', onRelease, { passive: true });
    root.addEventListener('keydown', onKeyDown);

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
      root.removeEventListener('wheel', onIntent);
      root.removeEventListener('touchstart', onHold);
      root.removeEventListener('pointerdown', onHold);
      window.removeEventListener('touchend', onRelease);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
      root.removeEventListener('keydown', onKeyDown);
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
      // A new message rises until the whole follow space shows below it. A chat short enough
      // to fit with that space has nothing to scroll, so it stays put.
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

/** Which chat, from which oldest turn, a list shows. A new key is a chat opened or older turns loaded. */
const listKey = (turns: Turn[]) => turns[0]?.id ?? '';

/**
 * The props to render: the latest while the same chat updates (a streamed delta renders at once),
 * but a newly opened chat or a loaded older page renders in the background, in slices, while the
 * current list stays on screen. Rendering a whole chat parses every reply's markdown, which would
 * otherwise freeze the panel for a long chat. The incoming list is pinned at its first snapshot,
 * so deltas streaming into it cannot restart (and starve) that background render; once it lands,
 * the latest props take over, and only the turns that changed meanwhile render again.
 */
function useStagedList(props: Props): Props {
  const key = listKey(props.turns);
  const [pinned, setPinned] = useState(props);
  if (listKey(pinned.turns) !== key) setPinned(props);
  const target = useDeferredValue(pinned);
  /** What is on screen now: it stays, unchanged, until the incoming list lands. */
  const committed = useRef(props);
  const shown = listKey(target.turns) === key ? props : committed.current;
  useLayoutEffect(() => {
    committed.current = shown;
  });
  return shown;
}

export const MessageList = memo(function MessageList(props: Props) {
  return <TurnList {...useStagedList(props)} />;
});

const TurnList = memo(function TurnList({ turns, switches = [], pending, previewFiles, hasEarlier = false, loadingEarlier = false, onLoadEarlier }: Props) {
  const { ref, space } = usePageTurn(turns, pending);
  const empty = turns.length === 0 && pending.length === 0 && switches.length === 0;

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
        {[
          ...turns.map((turn, index) => <MessageEntry key={turn.id} turn={turn} files={previewFiles?.(turn.id) ?? turn.files}
            latest={index === turns.length - 1 && pending.length === 0} />),
          ...switches.map((notice) => <SwitchNotice key={`switch-${notice.id}`} notice={notice} />),
          ...pending.map((message) => <MessageEntry key={message.id} pending={message}
            files={previewFiles?.(message.id) ?? message.files} latest={false} />),
        ]}
        {/* Cancel the list gap; p-3 already supplies 12px below this spacer. */}
        <div data-slot="stream-space" aria-hidden="true" className="-mt-6" style={{ height: Math.max(0, space - 12) }} />
      </div>
    </ScrollArea>
  );
});
