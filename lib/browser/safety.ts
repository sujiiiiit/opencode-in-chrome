// Wraps every browser tool with the safety layer's generic parts (spec browser/action-safety):
// the kill switch, the loop guard, and the site gate for tools that touch a page. The
// tier-specific checks (hand-off, consequential approval, re-check) run inside the tools
// right before input, through `Policy.guard`. It also feeds verification and the no-effect
// guard (spec browser/task-completion): every call, batch items included, passes through here.
import { actionTarget, isObservation, type Completion } from './completion';
import { LoopGuard, type Policy } from './policy';
import { isRestrictedUrl, type TabScope } from './tabs';
import { ToolError, type ToolDef, type ToolOutput } from './tools/registry';

/** Tools that read or act on a page, so the page's site must be allowed. */
const SITE_GATED = new Set(['read_page', 'find', 'get_page_text', 'wait_for', 'extract', 'console', 'network', 'computer', 'form_input', 'file_upload', 'upload_image', 'javascript']);
/** Actions the no-effect guard counts (Nanobrowser's click, set, type, press). */
const EFFECT_ACTIONS = new Set(['left_click', 'right_click', 'double_click', 'triple_click', 'type', 'key']);
/** Calls the repeated-failure guard ignores: they carry other calls, or report state. */
const NOT_LOOPED = new Set(['batch', 'tabs_context', 'done']);

type SafetyDeps = { policy: Policy; scope: TabScope; loop?: LoopGuard; completion?: Completion };

export function withSafety(defs: ToolDef[], deps: SafetyDeps): ToolDef[] {
  const loop = deps.loop ?? new LoopGuard();
  return defs.map((def) => ({
    ...def,
    handler: async (args, ctx) => {
      deps.policy.assertRunning();
      const attempt = beginAttempt(loop, def, args, ctx.sessionID);
      const effectKey = await noEffectKey(def.name, args, ctx.sessionID, deps.scope);
      try {
        if (effectKey) loop.checkEffect(ctx.sessionID, effectKey);
        await gateToolSite(def, args, ctx.sessionID, deps);
        const out = await def.handler(args, ctx);
        if (attempt.looped) loop.record(ctx.sessionID, attempt.signature, false);
        return afterSuccess(def.name, args, ctx.sessionID, out, effectKey, loop, deps.completion);
      } catch (error) {
        recordFailure(loop, attempt.looped, ctx.sessionID, attempt.signature, error);
        const tabId = numericTabId(args.tabId) ?? (await deps.scope.tabIdsOf(ctx.sessionID).catch(() => [])).at(-1);
        deps.completion?.recordFailure(ctx.sessionID, def.name, args, error instanceof ToolError ? error.code : 'INTERNAL', tabId);
        throw error;
      }
    },
  }));
}

/** The no-effect guard's key for an action on a target, or undefined for calls it does not count. */
async function noEffectKey(tool: string, args: Record<string, unknown>, sessionID: string, scope: TabScope): Promise<string | undefined> {
  const counted = tool === 'form_input' || (tool === 'computer' && EFFECT_ACTIONS.has(String(args.action)));
  if (!counted) return undefined;
  const tabId = numericTabId(args.tabId) ?? (await scope.tabIdsOf(sessionID).catch(() => [])).at(-1);
  if (tabId === undefined) return undefined;
  return LoopGuard.targetKey(tabId, tool, tool === 'computer' ? String(args.action) : undefined, actionTarget(args));
}

function afterSuccess(tool: string, args: Record<string, unknown>, sessionID: string, out: ToolOutput, effectKey: string | undefined, loop: LoopGuard, completion?: Completion): ToolOutput {
  completion?.recordResult(sessionID, tool, args, out);
  if (out.tabId !== undefined && isObservation(tool, args)) loop.observed(sessionID, out.tabId);
  const nudge = effectKey ? loop.recordEffect(sessionID, effectKey, out.effect) : undefined;
  return nudge ? { ...out, text: [...out.text, nudge] } : out;
}

function beginAttempt(loop: LoopGuard, def: ToolDef, args: Record<string, unknown>, sessionID: string) {
  const signature = LoopGuard.signature(def.name, args);
  const looped = !NOT_LOOPED.has(def.name);
  if (looped) loop.check(sessionID, signature);
  return { signature, looped };
}

async function gateToolSite(def: ToolDef, args: Record<string, unknown>, sessionID: string, deps: { policy: Policy; scope: TabScope }): Promise<void> {
  if (!needsSiteGate(def.name, args)) return;
  const tab = await deps.scope.resolve(sessionID, numericTabId(args.tabId)).catch(() => undefined);
  if (!tab || isRestrictedUrl(tab.url)) return;
  await deps.policy.siteGate(sessionID, tab.url, def.name, 'read');
}

function needsSiteGate(name: string, args: Record<string, unknown>): boolean {
  return SITE_GATED.has(name) && !(name === 'computer' && args.action === 'wait');
}

function numericTabId(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function recordFailure(loop: LoopGuard, looped: boolean, sessionID: string, signature: string, error: unknown): void {
  // Approval outcomes are the user's decision, not a failing approach; a no-effect refusal sent nothing.
  const userDecision = error instanceof ToolError && ['DENIED', 'NEEDS_APPROVAL', 'BLOCKED_SITE', 'NO_EFFECT', 'UNVERIFIED'].includes(error.code);
  if (looped && !userDecision) loop.record(sessionID, signature, true);
}
