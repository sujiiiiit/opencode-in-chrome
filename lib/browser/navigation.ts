// navigate (spec browser/page-actions): load a URL or go back/forward, then wait until the
// page has loaded and its DOM has been quiet for 500 ms, capped at 15 s overall. Single-page
// app route changes (history.pushState) count as navigations.

export type NavEvents = {
  /**
   * Subscribes to top-frame navigation events for a tab; returns an unsubscribe.
   * `committed` marks a new document starting; `loaded` its load finishing.
   */
  watch(tabId: number, cb: (outcome: { kind: 'committed' | 'loaded' | 'history' | 'error'; url: string; error?: string }) => void): () => void;
};

export type NavResult = {
  status: 'loaded' | 'timeout' | 'error';
  error?: string;
  /** What a loaded navigation waited for: a document load then DOM quiet, a load whose DOM kept changing, or a route change. */
  waited?: 'quiet' | 'busy' | 'history';
};

const BLANK = 'about:blank';

const NAV_TIMEOUT_MS = 15_000;
const QUIET_MS = 500;
const SETTLE_CAP_MS = 5_000;

/**
 * Starts a navigation and waits for the top frame to finish it. `settle` waits for DOM
 * quiet within the time left (it gets the remaining budget in ms).
 */
export async function navigateAndWait(options: {
  tabId: number;
  events: NavEvents;
  start: () => Promise<void>;
  settle: (budgetMs: number) => Promise<void>;
  /** The URL asked for; a commit of `about:blank` does not count for any other URL. */
  url?: string;
  timeoutMs?: number;
  now?: () => number;
}): Promise<NavResult> {
  const timeoutMs = options.timeoutMs ?? NAV_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const started = now();
  let unsubscribe: () => void = () => undefined;
  // A load only counts once this navigation has committed. A fresh tab may still be
  // committing and loading its own about:blank when we start, so that commit is not ours.
  const ignoreBlank = options.url !== undefined && options.url !== BLANK;
  const ours = (url: string) => !(ignoreBlank && url.startsWith(BLANK));
  let committed = false;
  const outcome = new Promise<NavResult>((resolve) => {
    unsubscribe = options.events.watch(options.tabId, (o) => {
      if (o.kind === 'committed') committed ||= ours(o.url);
      else if (o.kind === 'error') resolve({ status: 'error', error: o.error });
      else if (o.kind === 'history' && ours(o.url)) resolve({ status: 'loaded', waited: 'history' });
      else if (o.kind === 'loaded' && committed && ours(o.url)) resolve({ status: 'loaded' });
    });
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<NavResult>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
  });
  try {
    await options.start();
    const result = await Promise.race([outcome, timeout]);
    if (result.status !== 'loaded') return result;
    const left = timeoutMs - (now() - started);
    if (left <= 0) return { status: 'timeout' };
    if (result.waited === 'history') return result;
    const budget = Math.min(left, SETTLE_CAP_MS);
    const settleStart = now();
    const settled = await Promise.race([options.settle(budget).then(() => 'ok' as const), timeout.then(() => 'late' as const)]);
    if (settled === 'late') return { status: 'timeout' };
    // settle returns at quiet or when its budget runs out; using the whole budget means the DOM never went quiet.
    return { ...result, waited: now() - settleStart >= budget ? 'busy' : 'quiet' };
  } finally {
    clearTimeout(timer);
    unsubscribe();
  }
}

export function navigationText(result: NavResult, tab: { url: string; title: string }, requested?: string): string {
  const where = `${tab.url || requested || ''} — ${JSON.stringify(tab.title)}`;
  if (result.status === 'error') {
    return `Could not load ${requested ?? tab.url}: ${result.error ?? 'the navigation failed'}. The tab shows: ${where}`;
  }
  if (result.status === 'timeout') {
    return `Still loading after ${NAV_TIMEOUT_MS / 1000} s: ${where}. The page may still be loading; read it, or wait and read again.`;
  }
  return `Navigated to ${where}${WAITED[result.waited ?? 'quiet']}`;
}

const WAITED: Record<NonNullable<NavResult['waited']>, string> = {
  quiet: ` (waited for the load and ${QUIET_MS} ms without DOM changes)`,
  busy: ` (loaded; the page was still changing after ${SETTLE_CAP_MS / 1000} s)`,
  history: ' (same-document route change)',
};

export const DOM_QUIET_MS = QUIET_MS;
