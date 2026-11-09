// V4 in docs/browser-automation-coverage.md (openspec add-autonomous-browsing task 6.4): a
// turn that acted on a page but ended without `done` gets one queued note that resumes the
// agent, so it verifies and reports instead of stopping mid-task. Once per user message, never
// after the user pressed Stop, never inside a goal (the goal loop resumes work itself).
import { browser } from 'wxt/browser';
import { isPageAction } from '../browser/completion';
import { browserCalls } from './browser-steps';
import type { OpenCodeClient } from './client';
import type { Turn } from './timeline';

export const TURN_END_TEXT =
  'The browser task is not finished: you acted on a page but did not call browser_done. ' +
  'Check the page if you have not seen the result of your last action, then call browser_done with outcome ' +
  '"success", "partial" or "failed" and give the summary as your final reply.';

const SENT_KEY = 'opencode.browser.turnEnd';

/** Whether this finished turn acted on a page and never completed `done`. */
export function needsDone(turn: Turn): boolean {
  if (turn.reply.status !== 'succeeded' || turn.goal) return false;
  const calls = turn.reply.steps.flatMap((s) => s.parts.flatMap((p) => (p.kind === 'tool' ? browserCalls(p) : [])));
  const acted = calls.some((c) => c.status !== 'error' && isPageAction(c.tool, c.input));
  return acted && !calls.some((c) => c.tool === 'done' && c.status === 'completed');
}

type SentStore = { get(): Promise<string[]>; set(ids: string[]): Promise<void> };

/** Turn ids already nudged, kept for the browser session so a reopened panel does not nudge again. */
const sessionStore: SentStore = {
  get: async () => ((await browser.storage.session.get(SENT_KEY))[SENT_KEY] as string[] | undefined) ?? [],
  set: (ids) => browser.storage.session.set({ [SENT_KEY]: ids.slice(-200) }),
};

export async function nudgeUnfinishedTurn(client: Pick<OpenCodeClient, 'session'>, sessionID: string, turn: Turn, store: SentStore = sessionStore): Promise<boolean> {
  if (!needsDone(turn)) return false;
  const sent = await store.get().catch(() => [] as string[]);
  if (sent.includes(turn.id)) return false;
  await store.set([...sent, turn.id]).catch(() => undefined);
  await client.session.synthetic({
    sessionID,
    text: TURN_END_TEXT,
    description: 'Browser task not finished',
    delivery: 'queue',
    resume: true,
    metadata: { kind: 'browser.turn-end' },
  });
  return true;
}
