import { useSyncExternalStore } from 'react';

/**
 * The iOS Messages "send" motion: the text leaves the prompt box and flies right and then up
 * into its bubble. It is drawn as a ghost on `document.body` (fixed position), because the
 * message list's scroll viewport would clip a bubble travelling over the prompt box. While the
 * ghost flies, the real bubble keeps its place in the layout but is invisible (`useInFlight`).
 *
 * The bubble can move or remount mid-flight (a pending prompt becomes a turn, the reply starts
 * and the list scrolls), so the ghost re-reads its target every frame instead of animating
 * toward a position measured once.
 */

/** Where the text started: the top-left corner of the first line in the prompt box. */
export type FlightOrigin = { left: number; top: number };

const DURATION_MS = 240;
/** Frames to wait for the bubble to appear before giving up on the flight. */
const FIND_FRAMES = 3;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const flying = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function land(id: string) {
  if (flying.delete(id)) notify();
}

/** The message's bubble is still hidden behind its ghost. */
export function useInFlight(id: string | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (id ? flying.has(id) : false),
    () => false,
  );
}

/** Off for reduced motion, and where the motion cannot be queried at all (tests, jsdom). */
function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function findBubble(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
}

/** The bubble's own padding, so the ghost's text (not its box) starts on the prompt's text. */
function contentOffset(el: HTMLElement): { x: number; y: number } {
  const style = getComputedStyle(el);
  return { x: parseFloat(style.paddingLeft) || 0, y: parseFloat(style.paddingTop) || 0 };
}

/**
 * A copy of the bubble's element tree: same classes, inline styles (the collapsed preview's
 * height) and collapse state, so a long prompt flies in already clamped, faded and showing its
 * "Show more" line instead of snapping to that look on landing. Every element becomes an inert
 * div (the toggle is no button), and each leaf's text is drawn by CSS from `data-text`
 * (global.css): never parsed as HTML and never a second text node on the page.
 */
function mirror(source: Element): HTMLElement {
  const copy = document.createElement('div');
  copy.className = source.getAttribute('class') ?? '';
  const style = source.getAttribute('style');
  if (style) copy.setAttribute('style', style);
  const collapsible = source.getAttribute('data-collapsible');
  if (collapsible) copy.dataset.collapsible = collapsible;
  if (source.children.length === 0) {
    copy.dataset.ghostText = '';
    copy.dataset.text = source.textContent ?? '';
  } else {
    for (const child of source.children) copy.append(mirror(child));
  }
  return copy;
}

function createGhost(target: HTMLElement): HTMLElement {
  // Same look as the bubble (copied, so the two never drift apart), sized to the bubble so the
  // text wraps exactly as it will once landed.
  const ghost = mirror(target);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.remove('invisible'); // the bubble's in-flight state, not its look
  ghost.dataset.sendGhost = '';
  // Drawn mid-transition otherwise: the preview's height and fade must not animate in.
  ghost.querySelectorAll<HTMLElement>('[data-collapsible]').forEach((el) => (el.style.transition = 'none'));
  const { width } = target.getBoundingClientRect();
  Object.assign(ghost.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    margin: '0',
    width: `${width}px`,
    maxWidth: 'none',
    zIndex: '50',
    pointerEvents: 'none',
    willChange: 'transform',
    // The bubble's fill grows in as the text leaves the box (see the transition below).
    backgroundColor: 'transparent',
    transition: 'background-color 200ms ease-out',
  } satisfies Partial<CSSStyleDeclaration>);
  return ghost;
}

/**
 * Flies the text of message `id` from `from` (the prompt box) to its bubble. Call it just before
 * the message is added, so the bubble's first frame is already hidden.
 */
export function launchSendFlight({ id, from }: { id: string; from: FlightOrigin | null }) {
  if (!from || !motionAllowed()) return;
  flying.add(id);
  notify();

  let tries = 0;
  const begin = () => {
    // Wait for React to render the bubble (and the list to scroll to it).
    const target = findBubble(id);
    if (!target) {
      if (++tries < FIND_FRAMES) requestAnimationFrame(begin);
      else land(id);
      return;
    }
    const pad = contentOffset(target);
    const start = { x: from.left - pad.x, y: from.top - pad.y };
    const ghost = createGhost(target);
    ghost.style.transform = `translate(${start.x}px, ${start.y}px)`;
    document.body.append(ghost);
    // Next frame: drop the inline transparent fill so the bubble's own colour transitions in.
    requestAnimationFrame(() => ghost.style.removeProperty('background-color'));

    const startedAt = performance.now();
    let current: HTMLElement | null = target;
    const step = (now: number) => {
      if (!current?.isConnected) current = findBubble(id);
      if (!current) {
        // The message went away (the send failed, its text is back in the box): drop the ghost.
        ghost.remove();
        land(id);
        return;
      }
      const t = clamp01((now - startedAt) / DURATION_MS);
      const end = current.getBoundingClientRect();
      // Slide right quickly, rise a beat later: the path bends out to the right first, then
      // up into the bubble, like the iOS send.
      const tx = easeOutQuint(t);
      const ty = easeOutCubic(clamp01((t - 0.06) / 0.94));
      const x = start.x + (end.left - start.x) * tx;
      const y = start.y + (end.top - start.y) * ty;
      ghost.style.transform = `translate(${x}px, ${y}px)`;
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      land(id);
      ghost.remove();
    };
    requestAnimationFrame(step);
  };
  requestAnimationFrame(begin);
}
