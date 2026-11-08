import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import SquiggleLoader from '@/components/ui/squiggle-loader';
import { useTextColor } from '@/components/ui/use-text-color';
import { formatDuration, groupSpan, groupTools, reasoningHeading, type WorkGroup as Group } from '@/lib/opencode/flow';
import type { ReplyPart } from '@/lib/opencode/reply';
import { toolLabel, toolPending, toolStopped, toolSummary } from '@/lib/opencode/tool-info';
import { useLingering, useNow } from './live';
import { MorphText } from './morph-text';
import { Markdown } from './markdown';
import { ToolRow } from './tool-row';

/**
 * Open/closed choices the reader made, by group key, so a group keeps them when it remounts (a
 * resync, older history paged in). Capped: only recent groups are worth remembering.
 */
const chosen = new Map<string, boolean>();
const CHOSEN_LIMIT = 200;

function choose(key: string, open: boolean) {
  chosen.delete(key);
  chosen.set(key, open);
  if (chosen.size > CHOSEN_LIMIT) chosen.delete(chosen.keys().next().value!);
}

/** "Worked for 2m 5s", "Thought for 4s", or "Stopped after 12s" when the reply was cut off mid-call. */
function completedLabel(thinking: boolean, stopped: boolean, started?: number, ended?: number): string {
  const word = stopped ? 'Stopped' : thinking ? 'Thought' : 'Worked';
  if (started === undefined || ended === undefined || ended < started) return word;
  const elapsed = ended - started;
  return `${word} ${stopped ? 'after' : 'for'} ${elapsed < 1_000 ? 'a second' : formatDuration(elapsed)}`;
}

/** Spacing inside the morphing pieces, not a flex gap, so a piece that empties takes no room at all. */
const GAP = ' ';

/**
 * The header's words: what the work is doing (shimmering) while it runs, then what it took. Every
 * piece swaps only its changed words and eases its width, so the timer, the summary and the
 * chevron slide instead of jumping. The one-second clock lives here so the group's parts do not
 * re-render on each tick.
 */
const WorkLabel = memo(function WorkLabel({ thinking, stopped, started, ended, active, activity }: {
  thinking: boolean;
  stopped: boolean;
  started?: number;
  ended?: number;
  active: boolean;
  activity: { key: string; text: string };
}) {
  const now = useNow(active && started !== undefined);
  const label = active ? activity : { key: 'done', text: completedLabel(thinking, stopped, started, ended) };
  const elapsed = active && started !== undefined ? `${GAP}· ${formatDuration(now - started)}` : '';
  return <>
    {/* The shimmer paints the text with background-clip, which only covers the text's line box, so a
        tight line height clipped ascenders and descenders. A roomier line keeps every glyph inside it. */}
    <MorphText
      id={label.key}
      text={label.text}
      shimmer={active}
      steady
      textSlot="work-activity"
      className={cn('leading-[1.6]', !active && 'shrink-0')}
      textClassName="font-normal"
      shimmerDuration={1.2}
    />
    {/* The ticking clock stays out of the button's accessible name. */}
    <MorphText id="elapsed" text={elapsed} slot="elapsed-time" aria-hidden className="shrink-0 tabular-nums text-text-tertiary" />
  </>;
});

const SPINNER_MS = 300;

/**
 * The squiggle beside the header's words while the work runs. It eases open and fades in, and on
 * finishing eases shut and fades out, taking no room at rest. The canvas draws with a literal
 * colour, so the text colour is read once from the element and the loader mounts after that.
 */
function WorkSpinner({ active }: { active: boolean }) {
  const shown = useLingering(active, SPINNER_MS);
  const [box, color] = useTextColor<HTMLSpanElement>();
  return (
    <span
      ref={box}
      aria-hidden="true"
      data-slot="work-spinner"
      className={cn(
        'flex shrink-0 items-center overflow-hidden text-text-secondary transition-[width,opacity] duration-300 ease-(--ease-calm) motion-reduce:transition-none',
        active ? 'w-7.5 opacity-100' : 'w-0 opacity-0',
      )}
    >
      {shown && color && <SquiggleLoader width={22} height={14} strokeColor={color} />}
    </span>
  );
}

/** The reply ended while a call in the group was still working: the reader stopped it. */
const stoppedMidCall = (group: Group, live: boolean) => !live && groupTools(group).some((part) => toolStopped(part, live));

/** What finished work did ("2 files edited · 3 commands"), easing in once the work is done. */
function WorkSummary({ group, active }: { group: Group; active: boolean }) {
  const summary = active ? '' : toolSummary(groupTools(group));
  return <MorphText id={summary ? 'summary' : 'none'} text={summary && `${GAP}${summary}`} className="text-text-tertiary" />;
}

/** A commentary line as plain text: its first line, without markdown marks. */
const plainLine = (text: string) => text.trim().split('\n', 1)[0]!.replace(/[*_`#>]/g, '').trim();

/**
 * What the work is doing now, keyed by the part it comes from so a growing input does not replay
 * motion. A question waiting on the reader wins; then the newest call still working (and how many
 * more run beside it); else the model is between calls: its reasoning heading, its last
 * commentary line, or "Thinking".
 */
function currentActivity(group: Group, live: boolean): { key: string; text: string } {
  return toolActivity(group, live) ?? idleActivity(group);
}

function toolActivity(group: Group, live: boolean): { key: string; text: string } | undefined {
  const pending = groupTools(group).filter((part) => toolPending(part, live));
  const question = pending.find((part) => part.name === 'question');
  if (question) return { key: `tool:${question.id}`, text: 'Waiting for your answer' };
  const current = pending.at(-1);
  if (!current) return undefined;
  const more = pending.length - 1;
  return { key: `tool:${current.id}`, text: `${toolLabel(current, live)}${more ? ` +${more} more` : ''}` };
}

/** Between calls: the reasoning heading, the finished commentary line, or nothing to name. */
function idleText(part: ReplyPart | undefined): string | undefined {
  if (part?.kind === 'reasoning') return reasoningHeading(part.text);
  return part?.kind === 'text' && part.done ? plainLine(part.text) : undefined;
}

function idleActivity(group: Group): { key: string; text: string } {
  const part = group.parts.at(-1);
  return { key: `thinking:${part?.id ?? group.key}`, text: idleText(part) || 'Thinking' };
}

/** One part inside the group: reasoning (quiet), commentary text, or a tool call. */
function GroupPart({ part, live, animate }: { part: ReplyPart; live: boolean; animate: boolean }) {
  if (part.kind === 'tool') return <ToolRow part={part} live={live} />;
  if (part.kind === 'reasoning') {
    return <Markdown text={part.text} animate={animate} size="work" className="text-text-secondary" />;
  }
  return <Markdown text={part.text} animate={animate} size="work" className="text-text-secondary" />;
}

function pinWorkBottom(viewport: HTMLElement, lastSet: RefObject<number | null>) {
  const bottom = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  lastSet.current = bottom;
  if (Math.abs(viewport.scrollTop - bottom) >= 1) viewport.scrollTop = bottom;
}

function observeWorkScroll(
  viewport: HTMLElement,
  element: HTMLElement,
  active: boolean,
  following: RefObject<boolean>,
  lastSet: RefObject<number | null>,
) {
  const onScroll = () => {
    if (following.current && lastSet.current !== null && Math.abs(viewport.scrollTop - lastSet.current) < 1) return;
    following.current = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 24;
  };
  const onWheel = (event: WheelEvent) => {
    if (event.deltaY < 0) following.current = false;
  };
  const observer = new ResizeObserver(() => {
    if (!active || !following.current) return;
    pinWorkBottom(viewport, lastSet);
  });
  viewport.addEventListener('scroll', onScroll, { passive: true });
  viewport.addEventListener('wheel', onWheel, { passive: true });
  observer.observe(element);
  observer.observe(viewport);
  return () => {
    viewport.removeEventListener('scroll', onScroll);
    viewport.removeEventListener('wheel', onWheel);
    observer.disconnect();
  };
}

type Props = {
  group: Group;
  /** The reply is still running. */
  live: boolean;
  /** This is where the reply is working now (its last item while it runs). */
  active: boolean;
};

/**
 * The work behind an answer stays folded until the reader opens it, with a summary of what it did.
 */
export const WorkGroup = memo(function WorkGroup({ group, live, active }: Props) {
  const [choice, setChoice] = useState<boolean | undefined>(() => chosen.get(group.key));
  const [revealed, setRevealed] = useState(() => chosen.get(group.key) === true);
  const wasActive = useRef(active);
  const wasOpen = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const lastSet = useRef<number | null>(null);
  const open = choice ?? false;
  const thinking = group.parts.every((part) => part.kind === 'reasoning');
  const { started, ended } = groupSpan(group);
  const stopped = stoppedMidCall(group, live);
  /** The reply's placeholder before its first part: the same header, so the first part morphs in. */
  const empty = group.parts.length === 0;
  const activity = currentActivity(group, live);

  // Fold before paint when work gives way to an answer or the reply finishes.
  useLayoutEffect(() => {
    if (wasActive.current && !active) {
      choose(group.key, false);
      setChoice(false);
    }
    wasActive.current = active;
  }, [active, group.key]);

  useLayoutEffect(() => {
    const viewport = content.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (!wasOpen.current) {
      following.current = true;
      lastSet.current = null;
    }
    wasOpen.current = true;
    if (!viewport) return;
    if (!active) {
      if (lastSet.current === null) viewport.scrollTop = 0;
      return;
    }
    if (!following.current) return;
    pinWorkBottom(viewport, lastSet);
  }, [open, active, group]);

  useEffect(() => {
    const element = content.current;
    const viewport = element?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!open || !active || !element || !viewport) return;
    return observeWorkScroll(viewport, element, active, following, lastSet);
  }, [open, active]);

  const onOpenChange = (next: boolean) => {
    if (next) setRevealed(true);
    choose(group.key, next);
    setChoice(next);
  };

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} disabled={empty} data-slot="work-group" data-active={active || undefined}>
      {/* The label's shimmer takes its colour from this variable, so it follows the button's own
          colour (secondary, primary on hover or when open), as the finished label's text does. */}
      <CollapsibleTrigger
        render={
          <Button
            variant="quiet"
            size="disclosure"
            className="-ml-1.5 w-auto max-w-full gap-0 [--shimmer-text-highlight-color:var(--text-secondary)] hover:[--shimmer-text-highlight-color:var(--text-primary)] aria-expanded:[--shimmer-text-highlight-color:var(--text-primary)]"
          />
        }
      >
        <WorkSpinner active={active} />
        <WorkLabel thinking={thinking} stopped={stopped} started={started} ended={ended} active={active} activity={activity} />
        {/* Counts (files edited, commands, searches) are hidden for now:
        <WorkSummary group={group} active={active} /> */}
        {/* Faded in, not mounted, once there is something to open: the label never shifts for it. */}
        <Icon
          name="chevron-down"
          className={cn('ml-1.5 shrink-0 transition-[rotate,translate,opacity] duration-200', !open && '-rotate-90', empty && 'opacity-0')}
        />
      </CollapsibleTrigger>
      {/* Mount on first open, then keep tool rows and their disclosure state while folded. */}
      <CollapsibleContent keepMounted>
        {revealed && (
          // One bordered card; each thinking note, comment or call is a row under a hairline.
          <div className="mt-1 mb-1 overflow-hidden rounded-xl border border-border-strong-transparent">
            <ScrollArea fade className="[--fade-top-max:1.5rem] [--fade-bottom-max:1.5rem]" viewportClassName="max-h-72 overscroll-contain">
              <div ref={content} className="flex flex-col divide-y divide-border-primary-transparent">
                {group.parts.map((part) => (
                  <div key={part.id} className="px-3 py-2">
                    <GroupPart part={part} live={live} animate={active && part === group.parts.at(-1) && part.kind !== 'tool'} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
});
