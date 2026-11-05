import { useLayoutEffect, useRef } from 'react';

/** A shrink larger than this (about two lines) glides; smaller ones (a deleted line) snap. */
const GLIDE_SHRINK_PX = 48;

/**
 * Lets a box glide to its content's height instead of jumping to it, but only where a glide reads
 * as smooth. `outer` gets an explicit pixel height that follows `inner`, measured with a
 * ResizeObserver (it reports after layout and before paint, so the new height lands in the same
 * frame as the change). A CSS height transition on `outer` (see `[data-slot="prompt-box"]` in
 * global.css) does the motion; `data-instant` turns it off for one frame.
 *
 * `steady` is the part whose own growth must snap: the editor. Typed text shows the moment it is
 * typed, so a glide there would leave the box's edge trailing behind the text. Every other
 * change glides: images attached or removed, a question taking the box over or its pages
 * sliding, and a big shrink (the box clearing after a send).
 *
 * A zero size means the box is hidden (History covers the chat with `display: none`): the height
 * goes back to `auto`, so showing it again starts at its size instead of growing from nothing.
 */
export function useSmoothHeight<O extends HTMLElement, I extends HTMLElement, S extends HTMLElement>() {
  const outer = useRef<O>(null);
  const inner = useRef<I>(null);
  const steady = useRef<S>(null);
  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    let last = 0;
    let lastSteady = steady.current?.offsetHeight ?? 0;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const height = content.offsetHeight;
      const steadyHeight = steady.current?.offsetHeight ?? 0;
      if (height <= 0) {
        box.style.height = '';
        last = 0;
        return;
      }
      if (height === last) return;
      const fromEditor = height - last === steadyHeight - lastSteady;
      const glide = last > 0 && (!fromEditor || last - height > GLIDE_SHRINK_PX);
      last = height;
      lastSteady = steadyHeight;
      cancelAnimationFrame(frame);
      if (glide) {
        delete box.dataset.instant;
      } else {
        // Off for this style pass only, so this change snaps and the next one may glide.
        box.dataset.instant = '';
        frame = requestAnimationFrame(() => delete box.dataset.instant);
      }
      box.style.height = `${height}px`;
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      box.style.height = '';
      delete box.dataset.instant;
    };
  }, []);
  return { outer, inner, steady };
}
