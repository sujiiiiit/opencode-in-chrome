import { useLayoutEffect, useRef, useState } from "react";

/**
 * A canvas draws with a literal colour, so a CSS text colour cannot reach it. Put the returned ref
 * on an element whose `color` the drawing should take; the colour is read on mount, and the
 * drawing should mount only once it is known. Pass a changing `key` (such as the colour class in
 * use) to read it again.
 */
export function useTextColor<T extends HTMLElement>(key?: unknown) {
  const ref = useRef<T>(null);
  const [color, setColor] = useState<string>();
  useLayoutEffect(() => {
    if (ref.current) setColor(getComputedStyle(ref.current).color);
  }, [key]);
  return [ref, color] as const;
}
