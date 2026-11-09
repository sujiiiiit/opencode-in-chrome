// The page side of `wait_for` (W3 in docs/browser-automation-coverage.md): one cheap check of
// a document, called repeatedly by the service worker. Idle tracking starts on the first
// probe that asks for it and keeps the time of the last DOM change or finished request.

export type ProbeArgs = { texts?: string[]; selectors?: string[]; idleMs?: number };

export type ProbeResult = {
  /** Per text: whether it appears in the visible text (case and whitespace ignored). */
  texts: boolean[];
  /** Per selector: whether a visible element matches it; null when the selector is invalid. */
  selectors: Array<boolean | null>;
  /** Whether the document has loaded and nothing changed or finished loading for `idleMs`. */
  idle?: boolean;
};

type Activity = { lastChange: number };

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function visible(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  if (typeof check === 'function') return check.call(el);
  return el.getClientRects().length > 0;
}

function matchesSelector(doc: Document, selector: string): boolean | null {
  try {
    return Array.from(doc.querySelectorAll(selector)).some(visible);
  } catch {
    return null;
  }
}

function visibleText(doc: Document): string {
  const body = doc.body;
  return body ? normalize(body.innerText ?? body.textContent ?? '') : '';
}

/** Starts tracking DOM changes and finished requests in a document (once per document). */
function track(doc: Document, now: () => number): Activity {
  const activity: Activity = { lastChange: now() };
  const touch = () => {
    activity.lastChange = now();
  };
  new MutationObserver(touch).observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
  const PO = doc.defaultView?.PerformanceObserver;
  try {
    if (PO) new PO(touch).observe({ type: 'resource' });
  } catch {
    // No resource timing in this frame: DOM quiet alone decides.
  }
  return activity;
}

export function createProbe(doc: Document, now: () => number = () => Date.now()) {
  let activity: Activity | undefined;
  return (args: ProbeArgs): ProbeResult => {
    const texts = args.texts ?? [];
    const page = texts.length ? visibleText(doc) : '';
    const out: ProbeResult = {
      texts: texts.map((t) => page.includes(normalize(t))),
      selectors: (args.selectors ?? []).map((s) => matchesSelector(doc, s)),
    };
    if (args.idleMs !== undefined) {
      activity ??= track(doc, now);
      out.idle = doc.readyState === 'complete' && now() - activity.lastChange >= args.idleMs;
    }
    return out;
  };
}
