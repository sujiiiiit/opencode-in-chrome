import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { cn } from 'cn';
import { TextShimmer } from '@/components/ui/text-shimmer';

/**
 * The changing words blur and fade out, then the new ones blur and fade in; the width eases over
 * both (see `.morph` in global.css). A new label first has to last SETTLE_MS (a call that ends in
 * a blink is never shown), and a label that just appeared stays at least HOLD_MS, so quick
 * Thinking / call / Thinking runs read as one steady label instead of flashing.
 */
const OUT_MS = 160;
const IN_MS = 240;
const SETTLE_MS = 180;
const HOLD_MS = 600;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * How many leading characters two labels share, cut back to a word boundary so a word is never
 * split: "Reading a.ts" and "Reading b.ts" share "Reading ", "Thinking" and "Reading a.ts" nothing.
 */
export function sharedPrefix(a: string, b: string): number {
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  const atBoundary = (s: string) => k === s.length || s[k] === ' ';
  return atBoundary(a) && atBoundary(b) ? k : a.lastIndexOf(' ', k - 1) + 1;
}

/** The width of the text's first `count` characters, or 0 where layout is unavailable. */
function prefixWidth(element: HTMLElement | null, count: number): number {
  if (!element || count <= 0) return 0;
  // The text may sit inside the shimmer's element, so take the first text node at any depth.
  const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode();
  if (!node) return 0;
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, Math.min(count, node.textContent?.length ?? 0));
  return typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect().width : 0;
}

type Shown = { id: string; text: string; shimmer: boolean };
/** idle: at rest; wait: a new label is settling (nothing moves yet); out / in: the swap's two fades. */
type Phase = 'idle' | 'wait' | 'out' | 'in';

/** The swap's class and `data-phase` for each phase (idle and wait: none). */
const PHASE_CLASS: Record<Phase, string | undefined> = { idle: undefined, wait: undefined, out: 'morph-out', in: 'morph-in' };

/** Two labels that look the same on screen: switching between them needs no motion at all. */
const sameLook = (a: Shown, b: Shown) => a.text === b.text && a.shimmer === b.shimmer;

/** How long a new label waits before its swap starts: it must settle, and the shown one must have held. */
const waitDelay = (settledAt: number) => Math.max(SETTLE_MS, settledAt + HOLD_MS - Date.now());

type Props = {
  /** What the text stands for. A new id swaps the words that changed (fade out, then in); new text under the same id just eases the width. */
  id: string;
  text: string;
  shimmer?: boolean;
  className?: string;
  /** `data-slot` of the outer element. */
  slot?: string;
  /** `data-slot` of the current text, for tests and styles. */
  textSlot?: string;
  /** Classes for the shimmering text's own box (only while `shimmer` is on). */
  textClassName?: string;
  /** Seconds for one shimmer sweep (only while `shimmer` is on). */
  shimmerDuration?: number;
  /** A live status that can flip fast: a new label must settle and a shown one holds (SETTLE_MS, HOLD_MS). */
  steady?: boolean;
  'aria-hidden'?: boolean;
};

/** What the swap does when the label changes: the text to show now, the phase to enter, the words to keep. */
type Step = { show?: Shown; phase?: Phase; kept?: number };

/**
 * The same label, or one that looks the same ("Thinking" again after a call that ended in a
 * blink): no motion. It cancels a swap still settling or fading out (the fade eases back).
 */
function sameLabelStep(shown: Shown, target: Shown, phase: Phase): Step {
  const unchanged = shown.id === target.id && sameLook(shown, target);
  return { show: unchanged ? undefined : target, phase: phase === 'wait' || phase === 'out' ? 'idle' : undefined };
}

function labelStep(shown: Shown, target: Shown, phase: Phase, steady: boolean | undefined): Step {
  if (shown.id === target.id || sameLook(shown, target)) return sameLabelStep(shown, target, phase);
  // A swap in flight finishes first; the newest label follows after.
  if (phase !== 'idle') return {};
  if (reducedMotion()) return { show: target };
  return steady ? { phase: 'wait' } : { phase: 'out', kept: sharedPrefix(shown.text, target.text) };
}

/**
 * The text on screen through a swap. Same id: it follows the text at once. New id: it waits for
 * the label to settle, then the old words fade out, the text swaps, the new words fade in. A label
 * that comes back to what is on screen before the swap lands cancels it (an out fade eases back,
 * see the transition in global.css), and a swap in flight is never cut short: the newest label
 * follows after. Only `steady` text settles and holds; other text starts its swap at once.
 */
function useSwap(next: Shown, steady: boolean | undefined) {
  const [shown, setShown] = useState<Shown>(next);
  const [phase, setPhase] = useState<Phase>('idle');
  /** Leading characters that stay still through the swap. */
  const [kept, setKept] = useState(0);
  const latest = useRef(next);
  /** When the shown label finished appearing, for HOLD_MS. */
  const settledAt = useRef(0);
  const { id, text, shimmer } = next;

  useLayoutEffect(() => {
    latest.current = { id, text, shimmer };
  });

  useLayoutEffect(() => {
    const step = labelStep(shown, { id, text, shimmer }, phase, steady);
    if (step.show) setShown(step.show);
    if (step.kept !== undefined) setKept(step.kept);
    if (step.phase) setPhase(step.phase);
  }, [id, text, shimmer, shown, phase, steady]);

  useEffect(() => {
    if (phase === 'idle') return;
    const delay = phase === 'wait' ? waitDelay(settledAt.current) : phase === 'out' ? OUT_MS : IN_MS;
    const timer = setTimeout(() => {
      const target = latest.current;
      if (phase === 'in') {
        settledAt.current = Date.now();
        return setPhase('idle');
      }
      if (phase === 'wait') {
        setKept(sharedPrefix(shown.text, target.text));
        return setPhase('out');
      }
      // The id may have moved on again mid-fade: keep still only what the new text shares too.
      setKept((count) => Math.min(count, sharedPrefix(shown.text, target.text)));
      setShown(target);
      setPhase('in');
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, shown.text]);

  const view = shown.id === id ? next : shown;
  return {
    view,
    phase,
    kept,
    // The width eases toward the words about to show, never toward a label still settling.
    measured: phase === 'out' ? text : view.text,
    /** No word stays still through this swap. */
    whole: (phase === 'out' || phase === 'in') && kept === 0,
  };
}

/**
 * Keeps the box at the ruler's measured width. The first width lands without a transition, so a
 * fresh box does not grow in. While the width moves the text clips instead of truncating: an
 * ellipsis would flicker at the moving edge. The flag is set with the width, not on
 * `transitionrun`, which fires a frame late and let one frame paint the ellipsis.
 */
function useMeasuredWidth(box: RefObject<HTMLSpanElement | null>, measure: RefObject<HTMLSpanElement | null>) {
  useLayoutEffect(() => {
    const element = box.current;
    const ruler = measure.current;
    if (!element || !ruler) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const width = `${Math.ceil(ruler.getBoundingClientRect().width)}px`;
      if (element.style.width === width) return;
      if (element.hasAttribute('data-ready') && !reducedMotion()) {
        element.setAttribute('data-moving', '');
        clearTimeout(settle);
        settle = setTimeout(() => element.removeAttribute('data-moving'), OUT_MS + IN_MS);
      }
      element.style.width = width;
    };
    apply();
    const frame = requestAnimationFrame(() => element.setAttribute('data-ready', ''));
    const observer = new ResizeObserver(apply);
    observer.observe(ruler);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      observer.disconnect();
    };
  }, [box, measure]);
}

/**
 * One line of text that changes without jumping and without two texts on top of each other:
 * the words the old and new text share stay put, the rest fades out, the new words fade in in
 * their place, and the box eases to the new width so whatever sits beside it slides along. A
 * hidden copy measures the natural width; the box takes that width (capped by its container),
 * and its text truncates with an ellipsis once it settles.
 */
export function MorphText({ id, text, shimmer = false, className, slot, textSlot, textClassName, shimmerDuration, steady, 'aria-hidden': hidden }: Props) {
  const box = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLSpanElement>(null);
  const { view, phase, kept, measured, whole } = useSwap({ id, text, shimmer }, steady);
  const swap = PHASE_CLASS[phase];
  useMeasuredWidth(box, measure);

  // Where the fading part starts: the mask keeps everything left of it opaque.
  useLayoutEffect(() => {
    line.current?.style.setProperty('--morph-kept', `${prefixWidth(words.current, kept)}px`);
  }, [kept, view.text]);

  return (
    <span ref={box} data-slot={slot} aria-hidden={hidden} className={cn('morph', className)}>
      {/* Measures the text being moved to, so the width eases across the whole swap. Draws
          through ::before, so the ruler adds no second copy to the DOM's text. */}
      <span ref={measure} aria-hidden="true" className="morph-measure" data-text={measured} />
      {/* The swap masks this element and the shimmer animates the inner one (both use `animation`).
          When no word stays still (data-whole) the whole line also blurs and drifts: that is what
          reads as one text turning into another rather than a blink. */}
      <span
        ref={line}
        data-slot={textSlot}
        data-phase={swap && phase}
        data-whole={whole || undefined}
        className={cn('morph-text', swap)}
      >
        <span ref={words} className="block">
          <Words view={view} className={textClassName} duration={shimmerDuration} />
        </span>
      </span>
    </span>
  );
}

/** The words themselves: shimmering while the work runs, plain otherwise. */
function Words({ view, className, duration }: { view: Shown; className?: string; duration?: number }) {
  if (!view.shimmer) return view.text;
  return (
    <TextShimmer as="span" duration={duration} className={cn('block max-w-full truncate', className)}>
      {view.text}
    </TextShimmer>
  );
}
