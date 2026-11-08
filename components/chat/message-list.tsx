import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PendingMessage } from '@/lib/opencode/chat';
import { replyParts } from '@/lib/opencode/reply';
import type { ModelSwitch, Turn } from '@/lib/opencode/timeline';
import type { Goal } from '@/lib/opencode/goal';
import { turnStats } from '@/lib/opencode/turn-stats';
import { CollapsibleText } from './collapsible-text';
import { AssistantReply } from './flow/assistant-reply';
import { UserMessageFooter } from './message-footer';
import { NoticeDivider } from './notice-divider';
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
  return <NoticeDivider slot="model-switch" label={label} />;
}

/** The reader's prompt opens its turn: the bubble, and (once delivered) its footer. */
function UserOpening({ id, text, files, pending, turn }: { id: string; text: string; files?: SentFile[]; pending: boolean; turn?: Turn }) {
  return (
    <div data-slot="user-message" data-footer-host={turn ? '' : undefined} data-pending={pending || undefined} className="flex flex-col items-end gap-2">
      <UserContent id={id} text={text} files={files} pending={pending} />
      {turn && <UserMessageFooter text={turn.text} created={turn.created} />}
    </div>
  );
}

/** A `/goal` kickoff opens its turn with the objective: the plugin's prompt, not the reader's words. */
function GoalOpening({ id, objective, files, pending }: { id: string; objective: string; files?: SentFile[]; pending: boolean }) {
  return (
    <div data-slot="goal-start" className="mb-2">
      <NoticeDivider slot="goal-start-label" icon="goal" label={`Goal · ${objective}`} />
      {!!files?.length && <UserContent id={id} text="" files={files} pending={pending} />}
    </div>
  );
}

/** One stable component per message ID, from local send through admission and delivery. */
const MessageEntry = memo(function MessageEntry({ turn, pending, latest, files, outcome }: {
  turn?: Turn;
  pending?: PendingMessage;
  latest: boolean;
  files?: SentFile[];
  /** How the goal this turn started ended (met, or paused and why); shown after its reply. */
  outcome?: string;
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
      <TurnSwitches switches={turn?.switches} />
      {message.goal ? (
        <GoalOpening id={id} objective={message.goal.objective} files={files} pending={waiting} />
      ) : (
        <UserOpening id={id} text={message.text} files={files} pending={waiting} turn={turn} />
      )}
      {turn && !inFlight && <AssistantReply reply={turn.reply} stats={stats!} latest={latest} />}
      {outcome && <GoalOutcome label={outcome} />}
    </div>
  );
});

/** The model switches made before a turn's prompt, above it. */
function TurnSwitches({ switches }: { switches?: ModelSwitch[] }) {
  if (!switches?.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {switches.map((notice) => <SwitchNotice key={notice.id} notice={notice} />)}
    </div>
  );
}

/** How the goal a turn started ended, closing that turn. */
function GoalOutcome({ label }: { label: string }) {
  return (
    <div className="mt-3">
      <NoticeDivider slot="goal-outcome" label={label} />
    </div>
  );
}

/** Turn the page when streamed content reaches the viewport's bottom, leaving room below it. */
const STICK_PX = 48;
/** A scroll this soon after a wheel, key or released drag is the reader's (smooth wheel scrolling runs on). */
const INTENT_MS = 600;
const EDGE_AT = 1;
/** Room kept below the content for page turns; a short viewport keeps at least 25% of it for text. */
const FOLLOW_SPACE_PX = 300;
const MAX_FOLLOW_SHARE = 0.75;
/** The list's bottom padding, part of the follow space; the spacer element supplies the rest. */
const LIST_PAD_PX = 12;
const SCROLL_MS = 200;
/** Unread content below the viewport before the scroll-to-bottom button appears... */
const SHOW_BUTTON_PX = 120;
/** ...and how close to the end the reader gets before it goes away (a gap, so it never flickers at the edge). */
const HIDE_BUTTON_PX = 24;
const PAGE_TURN_MS = 650;

type Motion = { id: number; target: number; from: number; start: number; end: number; lastNow: number };
/** Where the content ends: the spacer's top, measured within the list so scrolling cannot move it. */
const contentBottom = (spacer: HTMLElement | null) => spacer?.offsetTop ?? 0;

/**
 * Size the spacer so content grown past the anchor fills the follow space instead of adding to it:
 * the true bottom stays where a send or page turn put it. Returns the room left, padding included.
 */
function fitSpacer(spacer: HTMLElement, anchor: number | null, space: number): number {
  const grown = anchor === null ? 0 : Math.max(0, spacer.offsetTop - anchor);
  const height = Math.max(0, space - LIST_PAD_PX - grown);
  spacer.style.height = `${height}px`;
  return Math.min(space, height + LIST_PAD_PX);
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
  /** The session's goal: the turn its kickoff started closes with how it ended. */
  goal?: Goal | null;
  /** Older messages exist beyond the loaded ones. */
  hasEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
};

/**
 * The spacer that keeps the follow space below the content. Its full height is laid out at an
 * anchor (a send or a page turn); content that grows after that fills it rather than adding to it.
 */
function useFollowRoom(spaceRef: { current: number }) {
  const spacer = useRef<HTMLDivElement>(null);
  /** Where the content ended (the spacer's top) when the follow space was last laid out in full. */
  const anchor = useRef<number | null>(null);
  /** The follow space actually left below the content, padding included. */
  const roomRef = useRef(0);
  const fitRoom = () => {
    if (spacer.current) roomRef.current = fitSpacer(spacer.current, anchor.current, spaceRef.current);
  };
  /** Lay out the full follow space below the content as it is now. */
  const anchorRoom = () => {
    anchor.current = contentBottom(spacer.current);
    fitRoom();
  };
  /** Turns added above moved the content's end from `before` without the reply growing into the space. */
  const keepRoom = (before: number) => {
    if (anchor.current !== null) anchor.current += contentBottom(spacer.current) - before;
    fitRoom();
  };
  return { spacer, roomRef, fitRoom, anchorRoom, keepRoom };
}

function usePageTurn(turns: Turn[], pending: PendingMessage[]) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<Edges & { height: number; end: number }>({ height: 0, end: 0 });
  /** The reader is at (or near) the bottom, so new content should stay in view. */
  const stick = useRef(true);
  const motion = useRef<Motion | null>(null);
  const lastSet = useRef<number | null>(null);
  const [space, setSpace] = useState(0);
  const [awayFromBottom, setAwayFromBottomState] = useState(false);
  const awayRef = useRef(false);
  const setAwayFromBottom = (away: boolean) => {
    awayRef.current = away;
    setAwayFromBottomState(away);
  };
  const spaceRef = useRef(0);
  const { spacer, roomRef, fitRoom, anchorRoom, keepRoom } = useFollowRoom(spaceRef);
  const followAfterSpace = useRef(false);
  // A newly sent prompt can grow after its first layout (attachments, fonts, follow space).
  // Keep its scrollbar at the real bottom until the reply starts or the reader scrolls up.
  const settleSentPrompt = useRef(false);
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
    if (spaceRef.current === next) return false;
    spaceRef.current = next;
    setSpace(next);
    return true;
  };

  /** Bring text that reached the viewport's bottom up, with the whole follow space below it again. */
  const turnPage = (element: HTMLElement) => {
    anchorRoom();
    follow(element, PAGE_TURN_MS);
  };

  /** Snap to the true bottom with the whole follow space below, for a prompt just sent. */
  const settle = (element: HTMLElement) => {
    anchorRoom();
    follow(element, 0);
  };

  const cancelMotion = () => {
    if (motion.current) cancelAnimationFrame(motion.current.id);
    motion.current = null;
  };

  const syncAwayFromBottom = (element: HTMLElement) => {
    // A follow animation is already heading to the bottom: re-measuring mid-flight would show the
    // button again on its first frames, so it would flicker instead of hiding. The scroll event
    // after the last frame measures once it lands.
    if (motion.current && stick.current) return;
    // The follow spacer is empty breathing room, not unread conversation. Showing needs a bigger
    // gap than hiding does, so a scroll settling near the threshold cannot toggle the button.
    const unread = contentEnd(element) - element.clientHeight;
    const away = unread > (awayRef.current ? HIDE_BUTTON_PX : SHOW_BUTTON_PX);
    if (away !== awayRef.current) setAwayFromBottom(away);
  };

  const follow = (element: HTMLElement, duration = SCROLL_MS) => {
    if (element.clientHeight <= 0) return;
    const target = bottom(element);
    if (motion.current && Math.abs(motion.current.target - target) < 1) return;
    cancelMotion();
    if (duration === 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || Math.abs(target - element.scrollTop) < 1) {
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
  const contentEnd = (element: HTMLElement) => element.scrollHeight - roomRef.current - element.scrollTop;

  const considerTurn = (element: HTMLElement) => {
    const current = stream.current;
    if (motion.current && stick.current) {
      retargetMotion(motion.current, element);
      return;
    }
    if (!stick.current || !current || element.clientHeight <= 0) {
      return;
    }
    const position = contentEnd(element) / element.clientHeight;
    if (position >= EDGE_AT) turnPage(element);
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
      syncAwayFromBottom(element);
      if (motion.current && lastSet.current !== null && Math.abs(element.scrollTop - lastSet.current) < 1) return;
      // Only the reader's own scrolling changes following. Scrolls the browser makes itself (scroll
      // anchoring, clamping when content shrinks) must not switch it off mid-reply.
      if (!holding && performance.now() - intentAt > INTENT_MS) return;
      cancelMotion();
      // Scrolling up stops following; scrolling down to the end of the text resumes it.
      stick.current = moved >= 0 && contentEnd(element) <= element.clientHeight + STICK_PX;
      if (moved < 0) settleSentPrompt.current = false;
    };
    const onIntent = () => {
      intentAt = performance.now();
      const interrupted = !!motion.current;
      cancelMotion();
      // Stopped mid-way down: bring the button back if the reader is still far from the end.
      if (interrupted) syncAwayFromBottom(element);
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
      fitRoom();
      if (settleSentPrompt.current && stick.current && !stream.current) settle(element);
      else considerTurn(element);
      syncAwayFromBottom(element);
      previous.current.height = element.scrollHeight;
      previous.current.end = contentBottom(spacer.current);
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
    const spaceChanged = syncSpace(element);
    fitRoom();
    const edges = edgesOf(turns, pending);
    if (prepended(previous.current, edges, turns)) {
      keepRoom(previous.current.end);
      cancelMotion();
      element.scrollTop += element.scrollHeight - previous.current.height;
    } else if (edges.last !== previous.current.last) {
      // Sending a message takes the scrollbar to the true bottom immediately, with the whole
      // follow space below it for the reply to fill.
      settle(element);
      setAwayFromBottom(false);
      stick.current = true;
      settleSentPrompt.current = true;
      // The follow space is rendered by the state update above. Re-run the destination once it
      // exists, otherwise a just-sent message can stop short of the true bottom.
      followAfterSpace.current = spaceChanged;
    } else if (followAfterSpace.current && stick.current) {
      followAfterSpace.current = false;
      settle(element);
      setAwayFromBottom(false);
    } else if (stick.current) {
      if (stream.current) settleSentPrompt.current = false;
      considerTurn(element);
    }
    previous.current = { ...edges, height: element.scrollHeight, end: contentBottom(spacer.current) };
  }, [turns, pending, space]);

  const goToBottom = () => {
    const element = viewport();
    if (!element) return;
    stick.current = true;
    settleSentPrompt.current = true;
    setAwayFromBottom(false);
    follow(element);
  };

  return { ref, spacer, awayFromBottom, goToBottom };
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

/** How a settled goal ended, for the divider after its turn; nothing while it runs or once cleared. */
function goalOutcome(goal: Goal | null | undefined): string | undefined {
  if (!goal || goal.status === 'active') return undefined;
  const head = goal.status === 'complete' ? 'Goal met' : 'Goal paused';
  return goal.reason ? `${head} · ${goal.reason}` : head;
}

/**
 * The outcome divider for the turn a settled goal started: its latest kickoff turn (a resumed goal
 * keeps its id, so the last one is the live one), and nothing for any other turn.
 */
function useGoalOutcome(turns: Turn[], goal: Goal | null | undefined): { turnID?: string; label?: string } {
  return useMemo(() => {
    const label = goalOutcome(goal);
    if (!label || !goal) return {};
    return { turnID: turns.findLast((turn) => turn.goal?.id === goal.id)?.id, label };
  }, [turns, goal]);
}

const TurnList = memo(function TurnList({ turns, switches = [], pending, previewFiles, goal, hasEarlier = false, loadingEarlier = false, onLoadEarlier }: Props) {
  const outcome = useGoalOutcome(turns, goal);
  const { ref, spacer, awayFromBottom, goToBottom } = usePageTurn(turns, pending);
  const empty = turns.length === 0 && pending.length === 0 && switches.length === 0;
  const streaming = turns.at(-1)?.reply.status === 'running';

  if (empty) {
    return <div className="flex min-h-0 flex-1"></div>;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea fade className="h-full">
        {/* relative: the spacer's offsetTop is measured from here, unaffected by scrolling. */}
        <div ref={ref} className="relative mx-auto flex w-full max-w-chat flex-col gap-6 p-4">
          {hasEarlier && (
            <Button variant="ghost" size="sm" className="self-center" disabled={loadingEarlier} onClick={onLoadEarlier}>
              {loadingEarlier ? 'Loading…' : 'Load earlier messages'}
            </Button>
          )}
          {[
            ...turns.map((turn, index) => <MessageEntry key={turn.id} turn={turn} files={previewFiles?.(turn.id) ?? turn.files}
              latest={index === turns.length - 1 && pending.length === 0} outcome={turn.id === outcome.turnID ? outcome.label : undefined} />),
            ...switches.map((notice) => <SwitchNotice key={`switch-${notice.id}`} notice={notice} />),
            ...pending.map((message) => <MessageEntry key={message.id} pending={message}
              files={previewFiles?.(message.id) ?? message.files} latest={false} />),
          ]}
          {/* Cancel the list gap; the list padding supplies the rest. Its height is set by usePageTurn. */}
          <div ref={spacer} data-slot="stream-space" aria-hidden="true" className="-mt-6" />
        </div>
      </ScrollArea>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 overflow-hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll to bottom"
          aria-hidden={!awayFromBottom}
          tabIndex={awayFromBottom ? 0 : -1}
          data-slot="go-to-bottom"
          data-streaming={streaming || undefined}
          data-visible={awayFromBottom}
          className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-md transition-[opacity,scale,translate] duration-350 ease-[var(--ease-calm)] data-[visible=false]:pointer-events-none data-[visible=false]:translate-y-12 data-[visible=false]:scale-75 data-[visible=false]:opacity-0 data-[visible=false]:duration-200 motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:duration-150"
          onClick={goToBottom}
        >
          {streaming ? (
            <span className="flex items-center gap-0.5 text-text-secondary" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-[3px] animate-bounce rounded-full bg-current motion-reduce:animate-none"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </span>
          ) : <Icon name="chevron-down" />}
        </Button>
      </div>
    </div>
  );
});
