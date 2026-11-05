import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** Before the list has been measured (or where nothing has a size, as in tests): the first rows. */
const UNMEASURED_ROWS = 60;

type VirtualListProps<T> = {
  items: readonly T[];
  /** The item's height in px. Fixed per kind of item: the list never measures its rows. */
  heightOf: (item: T) => number;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Extra rows kept mounted above and below the visible ones, so a fast scroll never shows a gap. */
  overscan?: number;
};

type Range = { start: number; end: number };

/** The index of the item that covers `y`, given the items' cumulative offsets. */
function indexAt(offsets: readonly number[], y: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid]! <= y) low = mid;
    else high = mid - 1;
  }
  return low;
}

/**
 * A long list that mounts only the rows in (or near) view, so its cost does not grow with its
 * length: ten thousand rows cost the same as thirty. Rows have known heights, which lets it place
 * the visible slice with two spacers instead of measuring anything. It scrolls with the nearest
 * ScrollArea around it (the page), so it adds no scroll bar of its own.
 */
export function VirtualList<T>({ items, heightOf, keyOf, renderItem, overscan = 8 }: VirtualListProps<T>) {
  const root = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>({ start: 0, end: Math.min(items.length, UNMEASURED_ROWS) });

  // offsets[i] is where item i starts; the last entry is the list's total height.
  const offsets = useMemo(() => {
    const result = [0];
    for (const item of items) result.push(result[result.length - 1]! + heightOf(item));
    return result;
  }, [items, heightOf]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const viewport = element.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    let frame = 0;

    const measure = () => {
      frame = 0;
      const height = viewport?.clientHeight ?? 0;
      if (!viewport || height === 0) {
        setRange({ start: 0, end: Math.min(items.length, UNMEASURED_ROWS) });
        return;
      }
      // How far the list's top sits above the viewport's top: the part scrolled out of view.
      const hidden = Math.max(0, viewport.getBoundingClientRect().top - element.getBoundingClientRect().top);
      const start = Math.max(0, indexAt(offsets, hidden) - overscan);
      const end = Math.min(items.length, indexAt(offsets, hidden + height) + 1 + overscan);
      setRange((current) => (current.start === start && current.end === end ? current : { start, end }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    viewport?.addEventListener('scroll', schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    if (viewport) resize.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('scroll', schedule);
      resize.disconnect();
    };
  }, [offsets, items.length, overscan]);

  // The list can shrink faster than the range follows (a filter): never slice past the end.
  const end = Math.min(range.end, items.length);
  const start = Math.min(range.start, end);
  return (
    <div ref={root} style={{ paddingTop: offsets[start], paddingBottom: offsets[items.length]! - offsets[end]! }}>
      {items.slice(start, end).map((item) => (
        <Fragment key={keyOf(item)}>{renderItem(item)}</Fragment>
      ))}
    </div>
  );
}
