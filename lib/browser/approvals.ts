// Approvals as opencode session forms (design D9): the worker creates a form in the calling
// session, the side panel renders it with the other forms, and the worker polls until it is
// answered, cancelled, or 5 minutes pass. The kill switch settles every pending approval as
// a denial.
import type { ApprovalAnswer, ApprovalRequest } from './policy';
import type { ServerAccess } from './server';
import type { OpenCodeClient } from '../opencode/client';

const APPROVAL_TIMEOUT_MS = 5 * 60_000;
export const APPROVAL_KIND = 'browser-approval';

export type ApprovalOptions = { pollMs?: number; timeoutMs?: number; onStop?: (cb: () => void) => () => void };

/** The form an approval request becomes (title, metadata the panel uses, one choice field). */
export function approvalForm(request: ApprovalRequest) {
  const site = request.site || 'this page';
  const isSite = request.kind === 'site';
  const options = isSite
    ? [
        { value: 'once', label: 'Allow for this chat' },
        { value: 'always', label: `Always allow ${site}` },
        { value: 'deny', label: 'Deny' },
      ]
    : [
        { value: 'once', label: 'Allow' },
        { value: 'deny', label: 'Deny' },
      ];
  return {
    title: isSite ? `Let the agent use ${site}?` : `Allow this action on ${site}?`,
    metadata: { kind: APPROVAL_KIND, approval: request.kind, site, tool: request.tool, summary: request.summary, tier: request.tier },
    fields: [
      {
        key: 'choice',
        type: 'string' as const,
        title: isSite ? `The agent wants to read and act on ${site}.` : request.summary,
        description: isSite ? 'Sites you allow can be changed in Settings → Browser.' : `${request.tool} on ${site}`,
        required: true,
        custom: false,
        options,
      },
    ],
  };
}

export function formApprovals(server: ServerAccess, options: ApprovalOptions = {}): (request: ApprovalRequest) => Promise<ApprovalAnswer> {
  const pollMs = options.pollMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? APPROVAL_TIMEOUT_MS;
  return async (request) => {
    const client = await server();
    if (!client) return 'deny';
    let stopped = false;
    const off = options.onStop?.(() => (stopped = true)) ?? (() => undefined);
    try {
      const form = (await client.session.form.create({ sessionID: request.sessionID, ...approvalForm(request) } as never)) as unknown as { id: string };
      return await waitForAnswer(client, request.sessionID, form.id, pollMs, timeoutMs, () => stopped);
    } finally {
      off();
    }
  };
}

async function waitForAnswer(client: OpenCodeClient, sessionID: string, formID: string, pollMs: number, timeoutMs: number, stopped: () => boolean): Promise<ApprovalAnswer> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (stopped()) {
      await client.session.form.cancel({ sessionID, formID, message: 'Browser activity was stopped.' }).catch(() => undefined);
      return 'deny';
    }
    // A failed poll (server busy, a blip) is not an answer: keep waiting.
    const detail = (await client.session.form.get({ sessionID, formID }).catch(() => undefined)) as
      | { state?: { status: string; answer?: Record<string, unknown> } }
      | undefined;
    const state = detail?.state;
    if (state?.status === 'answered') return answerChoice(state.answer?.choice);
    if (state?.status === 'cancelled') return 'deny';
    await new Promise((r) => setTimeout(r, pollMs));
  }
  await client.session.form.cancel({ sessionID, formID, message: 'No answer in 5 minutes.' }).catch(() => undefined);
  return 'timeout';
}

function answerChoice(choice: unknown): ApprovalAnswer {
  if (choice === 'always' || choice === 'once') return choice;
  return 'deny';
}
