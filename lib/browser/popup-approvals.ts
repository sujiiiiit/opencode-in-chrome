// Approvals for MCP sessions (mcp/server.mjs): they have no opencode chat to show a form in, so
// the worker opens a small extension window (entrypoints/approval) and waits for the answer it
// writes to storage.session. Closing the window denies; 5 minutes without an answer times out.
import { browser } from 'wxt/browser';
import type { ApprovalAnswer, ApprovalRequest } from './policy';

export const APPROVAL_PREFIX = 'opencode.approval.';
const TIMEOUT_MS = 5 * 60_000;

export type StoredApproval = { request: ApprovalRequest; answer?: ApprovalAnswer };

/** The answer the approval window wrote, if this storage change carries it. */
function answerIn(changes: Record<string, { newValue?: unknown }>, area: string, key: string): ApprovalAnswer | undefined {
  if (area !== 'session') return undefined;
  return (changes[key]?.newValue as StoredApproval | undefined)?.answer;
}

export function popupApprovals(options: { onStop?: (cb: () => void) => () => void } = {}) {
  return async (request: ApprovalRequest): Promise<ApprovalAnswer> => {
    const id = crypto.randomUUID();
    const key = `${APPROVAL_PREFIX}${id}`;
    await browser.storage.session.set({ [key]: { request } satisfies StoredApproval });
    const winId = (await browser.windows.create({ url: browser.runtime.getURL(`/approval.html?id=${id}`), type: 'popup', width: 440, height: 320, focused: true }))?.id;
    try {
      return await new Promise<ApprovalAnswer>((resolve) => {
        const done = (answer: ApprovalAnswer) => {
          clearTimeout(timer);
          browser.storage.onChanged.removeListener(changed);
          browser.windows.onRemoved.removeListener(closed);
          unstop?.();
          resolve(answer);
        };
        const changed = (changes: Record<string, { newValue?: unknown }>, area: string) => {
          const answer = answerIn(changes, area, key);
          if (answer) done(answer);
        };
        const closed = (windowId: number) => windowId === winId && done('deny');
        const timer = setTimeout(() => done('timeout'), TIMEOUT_MS);
        const unstop = options.onStop?.(() => done('deny'));
        browser.storage.onChanged.addListener(changed);
        browser.windows.onRemoved.addListener(closed);
      });
    } finally {
      await browser.storage.session.remove(key).catch(() => undefined);
      if (winId !== undefined) await browser.windows.remove(winId).catch(() => undefined);
    }
  };
}
