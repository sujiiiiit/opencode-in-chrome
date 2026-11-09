// wait_for (W3 in docs/browser-automation-coverage.md): waits until the page shows what the
// model expects (text, an element, a URL, or a quiet page) instead of guessing a number of
// seconds. Polls the page from the service worker, so it covers every frame and survives
// navigations; on success it reports what changed since the session's last look.
import { pageChangeText } from '../actions';
import { Dialogs } from '../dialogs';
import type { ProbeArgs, ProbeResult } from '../page/wait-page';
import type { PageReader } from '../snapshot/reader';
import { isRestrictedUrl, type Tab, type TabScope } from '../tabs';
import { ToolError, type ToolDef, type ToolOutput } from './registry';
import { tabIdProperty } from './tabs';

const IDLE_MS = 500;
const POLL_MS = 250;
const DEFAULT_TIMEOUT_S = 10;
const MAX_TIMEOUT_S = 30;

export type WaitDeps = {
  scope: TabScope;
  reader: PageReader;
  dialogs: Pick<Dialogs, 'get'>;
  tab: (tabId: number) => Promise<Tab>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

type Conditions = { text?: string; textGone?: string; selector?: string; selectorGone?: string; url?: string; idle: boolean };

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function conditionsOf(args: Record<string, unknown>): Conditions {
  const c: Conditions = {
    text: str(args.text),
    textGone: str(args.text_gone),
    selector: str(args.selector),
    selectorGone: str(args.selector_gone),
    url: str(args.url),
    idle: args.idle === true,
  };
  if (!c.text && !c.textGone && !c.selector && !c.selectorGone && !c.url && !c.idle) {
    throw new ToolError('INVALID_INPUT', 'Give at least one condition: text, text_gone, selector, selector_gone, url or idle.');
  }
  return c;
}

const needsPage = (c: Conditions) => !!(c.text || c.textGone || c.selector || c.selectorGone || c.idle);

function probeArgs(c: Conditions): ProbeArgs {
  const texts = [c.text, c.textGone].filter((t): t is string => !!t);
  const selectors = [c.selector, c.selectorGone].filter((s): s is string => !!s);
  return { texts, selectors, ...(c.idle ? { idleMs: IDLE_MS } : {}) };
}

type Check = { met: string[]; unmet: string[] };

/** Which conditions hold now; throws INVALID_INPUT for a selector no frame accepts. */
function evaluate(c: Conditions, probe: ProbeResult | undefined, url: string): Check {
  const met: string[] = [];
  const unmet: string[] = [];
  const add = (ok: boolean, what: string) => (ok ? met : unmet).push(what);
  if (c.url) add(url.includes(c.url), `URL contains ${JSON.stringify(c.url)}`);
  if (!needsPage(c)) return { met, unmet };
  if (!probe) {
    unmet.push('the page could be read (it may still be loading)');
    return { met, unmet };
  }
  let t = 0;
  let s = 0;
  if (c.text) add(probe.texts[t++] === true, `text ${JSON.stringify(c.text)} is on the page`);
  if (c.textGone) add(probe.texts[t++] === false, `text ${JSON.stringify(c.textGone)} is gone`);
  if (c.selector) add(selectorState(probe.selectors[s++], c.selector) === true, `an element matching ${JSON.stringify(c.selector)} is visible`);
  if (c.selectorGone) add(selectorState(probe.selectors[s++], c.selectorGone) === false, `nothing visible matches ${JSON.stringify(c.selectorGone)}`);
  if (c.idle) add(probe.idle === true, `the page is idle (loaded, no changes for ${IDLE_MS} ms)`);
  return { met, unmet };
}

function selectorState(state: boolean | null | undefined, selector: string): boolean | undefined {
  if (state === null) throw new ToolError('INVALID_INPUT', `${JSON.stringify(selector)} is not a valid CSS selector.`);
  return state;
}

export function waitTool(deps: WaitDeps): ToolDef {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  return {
    name: 'wait_for',
    description:
      'Wait until the page is ready instead of waiting a fixed time: until text appears or disappears, a CSS selector matches ' +
      'a visible element or stops matching, the URL contains a string, or the page is idle (loaded, no DOM changes or finished ' +
      'requests for 500 ms). All given conditions must hold. Checks every frame. Returns what changed on the page; fails with ' +
      `TIMEOUT and the conditions still unmet after timeout seconds (default ${DEFAULT_TIMEOUT_S}, at most ${MAX_TIMEOUT_S}).`,
    inputSchema: {
      type: 'object',
      properties: {
        tabId: tabIdProperty,
        text: { type: 'string', description: 'Wait until this text is visible (case-insensitive), e.g. "Order placed".' },
        text_gone: { type: 'string', description: 'Wait until this text is no longer visible, e.g. "Loading".' },
        selector: { type: 'string', description: 'Wait until a visible element matches this CSS selector.' },
        selector_gone: { type: 'string', description: 'Wait until no visible element matches this CSS selector, e.g. ".spinner".' },
        url: { type: 'string', description: 'Wait until the tab URL contains this, e.g. "/checkout/done".' },
        idle: { type: 'boolean', description: 'Wait until the page has loaded and stopped changing.' },
        timeout: { type: 'number', minimum: 1, maximum: MAX_TIMEOUT_S, description: `Seconds before giving up (default ${DEFAULT_TIMEOUT_S}).` },
      },
    },
    async handler(args, { sessionID }): Promise<ToolOutput> {
      const c = conditionsOf(args);
      const tab = await deps.scope.resolve(sessionID, typeof args.tabId === 'number' ? args.tabId : undefined);
      if (needsPage(c) && isRestrictedUrl(tab.url) && !c.url) {
        throw new ToolError('RESTRICTED_PAGE', `Can't read ${tab.url || 'this tab'} (a browser-internal or blank page). Navigate to a web page first.`);
      }
      const timeoutS = typeof args.timeout === 'number' ? args.timeout : DEFAULT_TIMEOUT_S;
      return waitUntil({ deps, sleep, now }, sessionID, tab.id, c, timeoutS * 1000);
    },
  };
}

type Clock = { deps: WaitDeps; sleep: (ms: number) => Promise<void>; now: () => number };

/** Polls until every condition holds, a dialog opens, or the time is up (TIMEOUT). */
async function waitUntil({ deps, sleep, now }: Clock, sessionID: string, tabId: number, c: Conditions, timeoutMs: number): Promise<ToolOutput> {
  const started = now();
  for (;;) {
    const dialog = deps.dialogs.get(tabId);
    if (dialog) return { text: [`Stopped waiting: ${Dialogs.describe(dialog)}. Answer it with computer action "dialog".`], tabId };
    const check = await checkOnce(deps, tabId, c);
    const seconds = ((now() - started) / 1000).toFixed(1);
    if (!check.unmet.length) return success(deps, sessionID, tabId, seconds, check.met);
    if (now() - started >= timeoutMs) throw timedOut(seconds, check);
    await sleep(POLL_MS);
  }
}

function timedOut(seconds: string, check: Check): ToolError {
  const met = check.met.length ? ` Already true: ${check.met.join('; ')}.` : '';
  return new ToolError('TIMEOUT', `Still waiting after ${seconds} s for: ${check.unmet.join('; ')}.${met} Read the page to see its state.`);
}

async function checkOnce(deps: WaitDeps, tabId: number, c: Conditions): Promise<Check> {
  const [tab, probe] = await Promise.all([
    deps.tab(tabId).catch(() => undefined),
    needsPage(c) ? deps.reader.probe(tabId, probeArgs(c)).catch((e: unknown) => rethrowInput(e)) : Promise.resolve(undefined),
  ]);
  return evaluate(c, probe, tab?.url ?? '');
}

/** A page mid-navigation fails to answer: that is "not yet". Only bad input ends the wait. */
function rethrowInput(error: unknown): undefined {
  if (error instanceof ToolError && error.code === 'INVALID_INPUT') throw error;
  return undefined;
}

async function success(deps: WaitDeps, sessionID: string, tabId: number, seconds: string, met: string[]): Promise<ToolOutput> {
  const text = [`Waited ${seconds} s: ${met.join('; ')}.`];
  const page = await deps.reader.change(sessionID, tabId).catch(() => undefined);
  const changed = page && pageChangeText(page);
  if (changed) text.push(changed);
  return { text, tabId };
}
