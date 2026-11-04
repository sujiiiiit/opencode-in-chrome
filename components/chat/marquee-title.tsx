import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from 'cn';

/** Scroll speed in px per second, so a longer title takes proportionally longer. */
const SPEED = 45;

/**
 * A one-line title that fades out on the right when it does not fit, and slides to reveal the
 * hidden text while hovered or focused. The slide is a CSS transform transition (compositor
 * only); JS just measures the overflow when the box or text resizes, and writes it to two
 * custom properties, so nothing re-renders and nothing runs per frame (see `.marquee` in global.css).
 */
export function MarqueeTitle({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  const box = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    // The morph's text box eases its width, so observe it as well as the outer box.
    const text = element.querySelector<HTMLElement>('.morph-text');
    const measure = () => {
      // The morph box clips its own overflow, so the hidden width shows on the text box inside it.
      const distance = text ? Math.max(0, Math.ceil(text.scrollWidth - text.clientWidth)) : 0;
      if (distance === 0) return element.removeAttribute('data-overflow');
      element.style.setProperty('--marquee-distance', `${distance}px`);
      element.style.setProperty('--marquee-ms', `${Math.round((distance / SPEED) * 1000)}ms`);
      element.setAttribute('data-overflow', '');
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (text) observer.observe(text);
    return () => observer.disconnect();
  }, [title]);

  return (
    <h1 ref={box} className={cn('marquee', className)} title={title}>
      {children}
    </h1>
  );
}
