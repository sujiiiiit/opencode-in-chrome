import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { cn } from 'cn';
import { TextShimmer } from '@/components/ui/text-shimmer';

/** The changing words fade out, then the new ones fade in; the width eases over both (see `.morph` in global.css). */
const OUT_MS = 120;
const IN_MS = 200;
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
type Phase = 'idle' | 'out' | 'in';

/** The swap's class and `data-phase` for each phase (idle: none). */
const PHASE_CLASS: Record<Phase, string | undefined> = { idle: undefined, out: 'morph-out', in: 'morph-in' };

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
  'aria-hidden'?: boolean;
};

/**
 * The text on screen through a swap. Same id: it follows the text at once. New id: the old
 * words fade out, the text swaps, the new words fade in; a swap waits for the one in flight, so
 * a label that changes again mid-swap never cuts a fade short (the newest id follows after).
 */
function useSwap(next: Shown) {
  const [shown, setShown] = useState<Shown>(next);
  const [phase, setPhase] = useState<Phase>('idle');
  /** Leading characters that stay still through the swap. */
  const [kept, setKept] = useState(0);
  const latest = useRef(next);
  const { id, text, shimmer } = next;

  useLayoutEffect(() => {
    latest.current = { id, text, shimmer };
  });

  useLayoutEffect(() => {
    if (shown.id === id) {
      if (shown.text !== text || shown.shimmer !== shimmer) setShown({ id, text, shimmer });
    } else if (phase === 'idle' && reducedMotion()) {
      setShown({ id, text, shimmer });
    } else if (phase === 'idle') {
      setKept(sharedPrefix(shown.text, text));
      setPhase('out');
    }
  }, [id, text, shimmer, shown, phase]);

  useEffect(() => {
    if (phase === 'idle') return;
    const timer = setTimeout(() => {
      if (phase === 'in') return setPhase('idle');
      const target = latest.current;
      // The id may have moved on again mid-fade: keep still only what the new text shares too.
      setKept((count) => Math.min(count, sharedPrefix(shown.text, target.text)));
      setShown(target);
      setPhase('in');
    }, phase === 'out' ? OUT_MS : IN_MS);
    return () => clearTimeout(timer);
  }, [phase, shown.text]);

  return { view: shown.id === id ? next : shown, phase, kept };
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
export function MorphText({ id, text, shimmer = false, className, slot, textSlot, 'aria-hidden': hidden }: Props) {
  const box = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLSpanElement>(null);
  const { view, phase, kept } = useSwap({ id, text, shimmer });
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
      <span ref={measure} aria-hidden="true" className="morph-measure" data-text={text} />
      {/* The swap masks this element and the shimmer animates the inner one (both use `animation`). */}
      <span
        ref={line}
        data-slot={textSlot}
        data-phase={swap && phase}
        className={cn('morph-text', swap)}
      >
        <span ref={words} className="block">
          {view.shimmer ? (
            <TextShimmer as="span" className="block max-w-full truncate">
              {view.text}
            </TextShimmer>
          ) : (
            view.text
          )}
        </span>
      </span>
    </span>
  );
}
