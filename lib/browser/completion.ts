// Verification debt (spec browser/task-completion, design D3), after Nanobrowser's
// completion.ts: a page action whose result does not show its effect stays unverified until a
// later observation of that tab, or a later action there with a visible change. `done` refuses
// "success" while any is open.
import type { KeyValue } from './tabs';
import type { ToolOutput } from './tools/registry';

/** Tools that change a page. `computer` counts only for its acting actions. */
const MUTATING = new Set(['form_input', 'file_upload', 'upload_image']);
const ACTING = new Set(['left_click', 'right_click', 'double_click', 'triple_click', 'type', 'key', 'scroll', 'hover', 'left_click_drag']);
/** Reads that show the page as it is now. */
const OBSERVING = new Set(['read_page', 'find', 'get_page_text', 'wait_for', 'extract']);
const LOOKING = new Set(['screenshot', 'zoom']);
/** Failures after which the input may still have reached the page. */
const DELIVERY_UNKNOWN = new Set(['TIMEOUT', 'DEBUGGER_DETACHED', 'INTERNAL']);

export function isPageAction(tool: string, args: Record<string, unknown>): boolean {
  return MUTATING.has(tool) || (tool === 'computer' && ACTING.has(String(args.action)));
}

export function isObservation(tool: string, args: Record<string, unknown>): boolean {
  return OBSERVING.has(tool) || (tool === 'computer' && LOOKING.has(String(args.action)));
}

/** What an action was aimed at: its ref, or its coordinate rounded to 8 px. */
export function actionTarget(args: Record<string, unknown>): string {
  if (typeof args.ref === 'string') return `[${args.ref}]`;
  const c = args.coordinate;
  if (Array.isArray(c) && c.length === 2) return `(${Math.round(Number(c[0]) / 8) * 8}, ${Math.round(Number(c[1]) / 8) * 8})`;
  return 'the focused element';
}

/** "left_click [e12] "Adds the blue kettle" on tab 412" */
export function actionLabel(tool: string, args: Record<string, unknown>, tabId: number): string {
  const what = tool === 'computer' ? String(args.action) : tool;
  const summary = typeof args.action_summary === 'string' && args.action_summary.trim() ? ` ${JSON.stringify(args.action_summary.trim())}` : '';
  return `${what} ${actionTarget(args)}${summary} on tab ${tabId}`;
}

type Debt = { tabId: number; label: string };

export class Completion {
  private readonly open = new Map<string, Debt[]>();

  /** `store` keeps unverified actions across worker restarts (V5), so `done` cannot forget them. */
  constructor(private readonly store?: KeyValue<Record<string, Debt[]>>) {
    void store?.get().then(
      (saved) => {
        for (const [sessionID, debts] of Object.entries(saved ?? {})) {
          const current = this.open.get(sessionID) ?? [];
          this.open.set(sessionID, [...debts.filter((d) => !current.some((c) => c.label === d.label)), ...current]);
        }
      },
      () => undefined,
    );
  }

  private save(): void {
    void this.store?.set(Object.fromEntries(this.open)).catch(() => undefined);
  }
  /** Actions whose tab closed before they were verified; reported once by `done`. */
  private readonly lost = new Map<string, string[]>();
  private readonly refusals = new Map<string, number>();

  /** After a call that succeeded: record or clear debt. */
  recordResult(sessionID: string, tool: string, args: Record<string, unknown>, out: ToolOutput): void {
    const tabId = out.tabId;
    if (tabId === undefined) return;
    if (isObservation(tool, args)) return this.clear(sessionID, tabId);
    if (!isPageAction(tool, args)) return;
    if (out.effect === 'changed') return this.clear(sessionID, tabId);
    if (out.effect === 'none' || out.effect === 'unknown') this.add(sessionID, { tabId, label: actionLabel(tool, args, tabId) });
  }

  /** After a call that failed: an action whose input may have been delivered is unverified. */
  recordFailure(sessionID: string, tool: string, args: Record<string, unknown>, code: string | undefined, tabId: number | undefined): void {
    if (tabId === undefined || !isPageAction(tool, args) || !code || !DELIVERY_UNKNOWN.has(code)) return;
    this.add(sessionID, { tabId, label: `${actionLabel(tool, args, tabId)} (failed with ${code}; it may have reached the page)` });
  }

  /** Labels of the session's unverified actions, oldest first. */
  labels(sessionID: string): string[] {
    return (this.open.get(sessionID) ?? []).map((d) => d.label);
  }

  /** A closed tab's actions can never be verified: they move to the list `done` reports. */
  dropTab(tabId: number): void {
    for (const [sessionID, debts] of this.open) {
      const gone = debts.filter((d) => d.tabId === tabId);
      if (!gone.length) continue;
      this.open.set(sessionID, debts.filter((d) => d.tabId !== tabId));
      this.lost.set(sessionID, [...(this.lost.get(sessionID) ?? []), ...gone.map((d) => `${d.label}: not verified, the tab closed`)]);
      this.save();
    }
  }

  /**
   * `done`: refuses "success" while debt is open, twice in a row at most; the third such call is
   * recorded as "partial". Accepting clears the session's debt.
   */
  finish(sessionID: string, outcome: 'success' | 'partial' | 'failed'): { accepted: false; open: string[] } | { accepted: true; outcome: 'success' | 'partial' | 'failed'; unverified: string[] } {
    const open = this.labels(sessionID);
    const refusals = this.refusals.get(sessionID) ?? 0;
    if (outcome === 'success' && open.length && refusals < 2) {
      this.refusals.set(sessionID, refusals + 1);
      return { accepted: false, open };
    }
    const unverified = [...open, ...(this.lost.get(sessionID) ?? [])];
    this.open.delete(sessionID);
    this.lost.delete(sessionID);
    this.refusals.delete(sessionID);
    this.save();
    return { accepted: true, outcome: outcome === 'success' && open.length ? 'partial' : outcome, unverified };
  }

  private add(sessionID: string, debt: Debt): void {
    this.open.set(sessionID, [...(this.open.get(sessionID) ?? []).filter((d) => d.label !== debt.label), debt]);
    this.save();
  }

  private clear(sessionID: string, tabId: number): void {
    const left = (this.open.get(sessionID) ?? []).filter((d) => d.tabId !== tabId);
    if (left.length) this.open.set(sessionID, left);
    else this.open.delete(sessionID);
    this.save();
  }
}
