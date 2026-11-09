import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

// Keeps a streaming card (Thinking, a compaction's summary) scrolled to its newest content.

function pinBottom(viewport: HTMLElement, lastSet: RefObject<number | null>) {
  const bottom = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  lastSet.current = bottom;
  if (Math.abs(viewport.scrollTop - bottom) >= 1) viewport.scrollTop = bottom;
}

function observeScroll(
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
    pinBottom(viewport, lastSet);
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

/**
 * Keeps an open card scrolled to its newest content while `active` streams into it, until the
 * reader scrolls up; a finished card opens at its top. `changed` is what grows (re-pins on change).
 */
export function useFollowBottom(content: RefObject<HTMLElement | null>, open: boolean, active: boolean, changed: unknown) {
  const wasOpen = useRef(false);
  const following = useRef(true);
  const lastSet = useRef<number | null>(null);

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
    pinBottom(viewport, lastSet);
  }, [content, open, active, changed]);

  useEffect(() => {
    const element = content.current;
    const viewport = element?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!open || !active || !element || !viewport) return;
    return observeScroll(viewport, element, active, following, lastSet);
  }, [content, open, active]);
}
