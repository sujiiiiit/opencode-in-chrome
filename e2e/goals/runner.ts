// Runs one goal task through a live session the way the side panel would. The start page is
// the user's own tab, shared into the session, and the goal is the user's only message. A
// scripted user answers approval cards. Returns the run's facts for the task's grader.
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { createSession, sessionMessages, turnOf, waitForIdle, type LiveMessage, type LiveServer } from '../../tests/live/opencode-serve';
import type { PageServer } from '../support/page-server';
import { resolveTask, type Approval, type BrowserCall, type GoalTask, type RunFacts } from './tasks';

export type GoalModel = { providerID: string; id: string };

/** Agent-side hooks the product adds to a side-panel session (guidance, end-of-turn note). */
export type SessionHooks = {
  /** After the session is created, before the user's message. */
  prepare?: (server: LiveServer, sessionID: string) => Promise<void>;
  /** After each turn goes idle; returns true when it resumed the run (one more turn to wait for). */
  afterTurn?: (server: LiveServer, sessionID: string, items: LiveMessage[]) => Promise<boolean>;
};

export type RunEnv = {
  server: LiveServer;
  workspace: string;
  context: BrowserContext;
  sw: Worker;
  pages: PageServer;
  extensionId: string;
  model: GoalModel;
  hooks?: SessionHooks;
  timeoutMs?: number;
};

export type RunRecord = RunFacts & {
  /** Approval cards declined plus tool results that refused at a gate. */
  gated: number;
  /** Loop-guard refusals and nudges seen in tool results. */
  guardNotes: number;
  /** Notes the extension injected into the session. */
  extensionNotes: number;
  error?: string;
};

type ToolCallMeta = { tool: string; status?: string; input?: Record<string, unknown> };

export async function runGoal(task: GoalTask, env: RunEnv): Promise<RunRecord> {
  const { server, context, pages } = env;
  const { url, goal } = resolveTask(task, pages.origin);
  pages.clearSubmissions();
  const sessionID = await createSession(server, env.workspace, env.model);
  await env.hooks?.prepare?.(server, sessionID);
  const user = await context.newPage();
  await user.goto(url).catch(() => undefined);
  await shareTab(env, sessionID, user);
  const approvals: Approval[] = [];
  const answering = answerApprovals(server, sessionID, task, approvals);
  let items: LiveMessage[] = [];
  let error: string | undefined;
  try {
    await server.client.session.prompt({ sessionID, text: goal });
    let idles = 1;
    for (;;) {
      items = await waitForIdle(server, sessionID, idles, env.timeoutMs ?? 240_000);
      if (!(await env.hooks?.afterTurn?.(server, sessionID, items))) break;
      idles++;
    }
  } catch (e) {
    error = String(e).slice(0, 300);
    items = await sessionMessages(server, sessionID).catch(() => items);
  } finally {
    answering.stop();
  }
  // A turn that ended in a server or provider error (a quota, an outage) is not the agent's failure: say so.
  error ??= turnError(items);
  const facts = collectFacts(items);
  const state = task.probe ? await probe(context, task, url) : '';
  await closeRunPages(context);
  const outputs = facts.outputs.join('\n');
  return {
    answer: facts.answer,
    calls: facts.calls,
    submissions: pages.submissions().map((s) => ({ path: s.path, body: s.body })),
    state,
    outcome: facts.outcome,
    approvals,
    gated: approvals.filter((a) => !a.allowed).length + (outputs.match(/\b(NEEDS_APPROVAL|DENIED|BLOCKED_SITE):/g)?.length ?? 0),
    guardNotes: outputs.match(/\bNO_EFFECT:|had no effect \d+ times|already failed twice/g)?.length ?? 0,
    extensionNotes: items.filter((m) => m.type === 'synthetic').length,
    error,
  };
}

/** The error a failed turn ended with (`provider.quota: Rate limit exceeded`), if any. */
export function turnError(items: LiveMessage[]): string | undefined {
  const failed = items.find((m) => m.type === 'idle' && (m as { outcome?: string }).outcome === 'failed') as { error?: { type?: string; message?: string } } | undefined;
  return failed?.error ? `${failed.error.type ?? 'error'}: ${failed.error.message ?? ''}`.trim() : undefined;
}

/** Errors that make every later run fail the same way: the suite stops instead of recording noise. */
export const isFatalRunError = (error: string | undefined) => !!error && /^provider\.(quota|auth)|Unauthorized/i.test(error);

/** Shares the user's start tab into the session from an extension page (the side panel's share control). */
async function shareTab(env: RunEnv, sessionID: string, user: Page): Promise<void> {
  const href = user.url();
  const tabId = await env.sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t: { url?: string }) => t.url === u)?.id, href);
  if (tabId === undefined) return;
  const panel = await env.context.newPage();
  try {
    await panel.goto(`chrome-extension://${env.extensionId}/sidepanel.html`);
    await panel.evaluate(({ id, session }) => chrome.runtime.sendMessage({ type: 'opencode.browser.share', sessionID: session, tabId: id }), { id: tabId, session: sessionID });
  } finally {
    await panel.close();
  }
}

/**
 * The scripted user: allows an action card whose summary matches the task's `allow`, and
 * declines every other card, site cards included (the sites a task needs are allowed up front).
 */
function answerApprovals(server: LiveServer, sessionID: string, task: GoalTask, out: Approval[]): { stop(): void } {
  const seen = new Set<string>();
  let running = true;
  void (async () => {
    while (running) {
      const forms = ((await server.client.session.form.list({ sessionID }).catch(() => [])) ?? []) as Array<{ id: string; metadata?: Record<string, unknown> }>;
      for (const form of forms) {
        if (seen.has(form.id) || form.metadata?.kind !== 'browser-approval') continue;
        seen.add(form.id);
        const summary = String(form.metadata.summary ?? '');
        const allowed = form.metadata.approval !== 'site' && !!task.allow?.test(summary);
        out.push({ summary, tool: String(form.metadata.tool ?? ''), allowed });
        await server.client.session.form.reply({ sessionID, formID: form.id, answer: { choice: allowed ? 'once' : 'deny' } }).catch(() => undefined);
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  })();
  return { stop: () => (running = false) };
}

function innerCalls(part: { name: string; state: Record<string, unknown> }): ToolCallMeta[] {
  const meta = (part.state.metadata ?? {}) as { toolCalls?: ToolCallMeta[] };
  if (meta.toolCalls) return meta.toolCalls;
  // A server that exposes the tools directly: one part per call.
  if (!part.name.startsWith('browser_')) return [];
  return [{ tool: part.name.replace('browser_', 'browser.'), status: String(part.state.status ?? ''), input: part.state.input as Record<string, unknown> }];
}

/** Answer text, browser calls, the accepted `done` outcome and tool output text from a session's messages. */
export function collectFacts(items: LiveMessage[]): { answer: string; calls: BrowserCall[]; outcome?: RunFacts['outcome']; outputs: string[] } {
  const turn = turnOf(items);
  // The answer is what the agent said: assistant text only, never the user's message or a note.
  const said = turnOf(items.filter((m) => m.type === 'assistant')).text;
  const calls: BrowserCall[] = [];
  let outcome: RunFacts['outcome'];
  let summary = '';
  for (const call of turn.toolParts.flatMap(innerCalls)) {
    if (!call.tool.startsWith('browser.')) continue;
    calls.push({ tool: call.tool, input: call.input ?? {} });
    if (call.tool === 'browser.done' && call.status !== 'error') {
      outcome = call.input?.outcome as RunFacts['outcome'];
      summary = String(call.input?.summary ?? '');
    }
  }
  const outputs = turn.toolParts.flatMap((p) => ((p.state.content as Array<{ type: string; text?: string }> | undefined) ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? ''));
  return { answer: [said, summary].filter(Boolean).join('\n'), calls, outcome, outputs };
}

/** Reads the task's probe from the page (or frame) whose URL contains the probe's path. */
async function probe(context: BrowserContext, task: GoalTask, startUrl: string): Promise<string> {
  const where = task.probe!.page ?? new URL(startUrl).pathname;
  const open = context.pages().filter((p) => !p.url().startsWith('chrome-extension://'));
  const target = task.probe!.frame ? open.flatMap((p) => p.frames()).find((f) => f.url().includes(where)) : open.find((p) => p.url().includes(where));
  if (!target) return '';
  return String(await target.evaluate((expr) => (0, eval)(expr) as unknown, task.probe!.expr).catch(() => ''));
}

/** Closes every web page the run opened, so the next run starts clean. */
async function closeRunPages(context: BrowserContext): Promise<void> {
  for (const page of context.pages()) {
    if (!page.url().startsWith('chrome-extension://') && !page.isClosed()) await page.close().catch(() => undefined);
  }
}
