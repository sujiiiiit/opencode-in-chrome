// The actor: resolves refs to points for real input (through every ancestor iframe), sends
// CDP input that never hangs on a dialog, and builds the change report every action result
// ends with (design D6, D7; the page part is the outline diff of add-autonomous-browsing D4).
import type { TargetInfo } from './page/actions-page';
import type { DebuggerSessions } from './debugger';
import { DOM_QUIET_MS, type NavEvents } from './navigation';
import { Dialogs } from './dialogs';
import type { CdpSend } from './input';
import { staleRef, type PageChange, type PageReader } from './snapshot/reader';
import type { Tab, TabScope } from './tabs';
import { ToolError, type ErrorCode } from './tools/registry';

type PageError = { error: ErrorCode; message: string };
const isError = (v: unknown): v is PageError => typeof v === 'object' && v !== null && 'error' in v;

/** How long an action waits for a page load it started (W4). */
const NAV_WAIT_MS = 10_000;

export type Point ={ x: number; y: number; info: TargetInfo };

export type Fingerprint = { url: string; title: string; tabIds: number[] };

/** Whether an action visibly changed anything (unknown: the page could not be read afterwards). */
export type Effect = 'changed' | 'none' | 'unknown';
export type ActResult = { text: string; effect: Effect };

export class Actor {
  constructor(
    private readonly deps: {
      reader: PageReader;
      debuggers: DebuggerSessions;
      dialogs: Dialogs;
      scope: TabScope;
      tab: (tabId: number) => Promise<Tab>;
      sleep?: (ms: number) => Promise<void>;
      /** After each action settles (the GIF recorder adds a frame). */
      afterAction?: (tabId: number, sessionID: string, label: string, point?: [number, number]) => Promise<void>;
      /** Top-frame navigation events: an action that starts a page load waits for it (W4). */
      events?: NavEvents;
      /** Downloads created while the action ran become the session's (D2); returns result lines. */
      downloads?: { claimSince(sessionID: string, since: number): Promise<string[]> };
    },
  ) {}

  /**
   * Watches a tab for a full page load that an action starts. `finish` waits for that load
   * (at most NAV_WAIT_MS, or until a dialog opens), lets the new DOM settle, and returns a note
   * for the result; undefined when no load started.
   */
  private watchNavigation(tabId: number): { finish: () => Promise<string | undefined>; stop: () => void } {
    let started = false;
    let resolveEnd: (end: { kind: 'loaded' | 'error' | 'aborted'; error?: string }) => void = () => undefined;
    const ended = new Promise<{ kind: 'loaded' | 'error' | 'aborted'; error?: string }>((r) => (resolveEnd = r));
    const stop = this.deps.events?.watch(tabId, (o) => {
      if (o.kind === 'started' || o.kind === 'committed') started = true;
      else if (started && (o.kind === 'loaded' || o.kind === 'error' || o.kind === 'aborted')) resolveEnd({ kind: o.kind, error: o.error });
    }) ?? (() => undefined);
    const finish = async () => {
      if (!started) return undefined;
      const end = await Promise.race([
        ended,
        this.sleep(NAV_WAIT_MS).then(() => ({ kind: 'timeout' as const })),
        this.deps.dialogs.opened(tabId).then(() => ({ kind: 'dialog' as const })),
      ]);
      if (end.kind === 'loaded') {
        await this.deps.reader.callTop(tabId, 'settle', [DOM_QUIET_MS, 3000]).catch(() => undefined);
        return 'Waited for the new page to load.';
      }
      if (end.kind === 'timeout') return `The new page was still loading after ${NAV_WAIT_MS / 1000} s; use wait_for before relying on it.`;
      if (end.kind === 'error') return `The page load failed: ${end.error ?? 'unknown error'}.`;
      return undefined;
    };
    return { finish, stop };
  }

  private sleep(ms: number): Promise<void> {
    return (this.deps.sleep ?? ((t) => new Promise((r) => setTimeout(r, t))))(ms);
  }

  /** Turns a page-side failure into the tool error the model sees. */
  private fail(ref: string, error: PageError): never {
    if (error.error === 'STALE_REF') throw staleRef(ref);
    throw new ToolError(error.error, error.message);
  }

  /**
   * Where to put the mouse for a ref, in CSS pixels of the top viewport: each ancestor
   * iframe is scrolled into view and its content offset added, then the element itself is
   * scrolled into view and checked (visible, enabled, not covered).
   */
  async point(tabId: number, ref: string, checkCover = true): Promise<Point> {
    this.deps.dialogs.assertClear(tabId);
    const target = this.deps.reader.refs.lookup(tabId, ref);
    if (!target) throw staleRef(ref);
    const chain = [];
    let frameId = target.frameId;
    while (frameId !== 0) {
      const parent = this.deps.reader.parentOf(tabId, frameId);
      if (!parent) throw staleRef(ref);
      chain.unshift(parent);
      frameId = parent.frameId;
    }
    let dx = 0;
    let dy = 0;
    for (const host of chain) {
      const box = await this.deps.reader.call<TargetInfo | PageError>(tabId, host.documentId, 'locate', [host.n, false]);
      if (isError(box)) this.fail(ref, box);
      dx += box.contentLeft;
      dy += box.contentTop;
    }
    const info = await this.deps.reader.call<TargetInfo | PageError>(tabId, target.documentId, 'locate', [target.n, checkCover]);
    if (isError(info)) this.fail(ref, info);
    return { x: dx + info.x, y: dy + info.y, info };
  }

  /** CDP input for a tab; stops waiting when a dialog opens (the page is blocked until answered). */
  input(tabId: number): CdpSend {
    return async (method, params) => {
      await Promise.race([this.deps.debuggers.send(tabId, method, params), this.deps.dialogs.opened(tabId)]);
    };
  }

  /** URL, title and the session's tabs before an action; the page itself is compared by the reader (design D4). */
  async observe(tabId: number, sessionID: string): Promise<Fingerprint> {
    const tab = await this.deps.tab(tabId);
    return { url: tab.url ?? '', title: tab.title ?? '', tabIds: await this.deps.scope.tabIdsOf(sessionID) };
  }

  /** Waits briefly for the page to react (DOM quiet 300 ms, at most 1 s, or a dialog). */
  async settle(tabId: number): Promise<void> {
    await this.sleep(120);
    if (this.deps.dialogs.get(tabId)) return;
    await Promise.race([
      this.deps.reader.callTop(tabId, 'settle', [300, 1000]).catch(() => undefined),
      this.deps.dialogs.opened(tabId),
      this.sleep(1500),
    ]);
  }

  /**
   * What the action did: a dialog, URL/title/tab changes, then the page as a diff against the
   * outline this session last saw (or the whole windowed outline, and why), else "No visible change".
   */
  async report(tabId: number, sessionID: string, before: Fingerprint): Promise<ActResult> {
    const dialog = this.deps.dialogs.get(tabId);
    const after = await this.observe(tabId, sessionID).catch(() => undefined);
    const out: string[] = [];
    if (dialog) out.push(Dialogs.describe(dialog));
    if (after) out.push(...fingerprintChanges(before, after));
    // A dialog blocks the page's scripts: the page is read again once it is answered.
    let page: PageChange | undefined;
    if (!dialog) page = await this.deps.reader.change(sessionID, tabId).catch(() => undefined);
    const pageText = page && pageChangeText(page);
    if (pageText) out.push(pageText);
    const effect: Effect = out.length ? 'changed' : page ? 'none' : 'unknown';
    if (!out.length) out.push(page ? 'No visible change' : 'Could not read the page after the action; read it to see what happened.');
    return { text: out.join('\n'), effect };
  }

  /**
   * Runs one action with a before/after report (`<what was done>`, then the changes or
   * "No visible change") and whether the page visibly changed.
   */
  async act(tabId: number, sessionID: string, run: () => Promise<string>, point?: [number, number]): Promise<ActResult> {
    this.deps.dialogs.assertClear(tabId);
    const before = await this.observe(tabId, sessionID);
    const nav = this.watchNavigation(tabId);
    const started = Date.now();
    let loadNote: string | undefined;
    let done: string;
    try {
      done = await run();
      await this.settle(tabId);
      loadNote = await nav.finish();
    } finally {
      nav.stop();
    }
    const report = await this.report(tabId, sessionID, before);
    const downloads = (await this.deps.downloads?.claimSince(sessionID, started).catch(() => [])) ?? [];
    if (!this.deps.dialogs.get(tabId)) await this.deps.afterAction?.(tabId, sessionID, done, point).catch(() => undefined);
    // A download is the action's effect even when the page itself did not change.
    const effect = downloads.length ? 'changed' : report.effect;
    const text = downloads.length && report.effect === 'none' ? downloads : [report.text, ...downloads];
    return { text: [done, loadNote, ...text].filter(Boolean).join('\n'), effect };
  }
}

/** The page part of a result: the diff since the session's last look, or the whole outline and why. */
export function pageChangeText(page: PageChange): string | undefined {
  if (page.kind === 'diff') return `Page changes since your last look (+ added, - removed):\n${page.text}`;
  if (page.kind === 'outline') return `The page now (${page.reason}):\n${page.text}`;
  return undefined;
}

function fingerprintChanges(before: Fingerprint, after: Fingerprint): string[] {
  const out: string[] = [];
  if (after.url !== before.url) out.push(`URL changed to ${after.url}`);
  if (after.title !== before.title) out.push(`Title is now ${JSON.stringify(after.title)}`);
  for (const id of after.tabIds) if (!before.tabIds.includes(id)) out.push(`New tab ${id} opened and joined this session; it is now the current tab (pass tabId to use another)`);
  for (const id of before.tabIds) if (!after.tabIds.includes(id)) out.push(`Tab ${id} closed`);
  return out;
}
