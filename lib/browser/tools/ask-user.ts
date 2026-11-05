// A simple browser question, matching Nanobrowser's ask_user flow. The side panel already
// renders opencode forms and sends answers, so the agent can wait here for the person's step.
import type { ServerAccess } from '../server';
import type { OpenCodeClient } from '../../opencode/client';
import { ToolError, type ToolDef } from './registry';

const TIMEOUT_MS = 5 * 60_000;

export function askUserTool(server: ServerAccess, pollMs = 500, timeoutMs = TIMEOUT_MS, onStop?: (cb: () => void) => () => void): ToolDef {
  return {
    name: 'ask_user',
    description: 'Ask the user one simple question, or hand them a step such as sign-in or CAPTCHA. Use kind "input" for a short text answer and "takeover" when they must work in the browser, then press Done. Do not use the built-in question tool for browser handoffs.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['input', 'takeover'] },
        message: { type: 'string', description: 'One short sentence telling the user exactly what to answer or do.' },
      },
      required: ['kind', 'message'],
    },
    async handler(args, { sessionID }) {
      return askUser(server, sessionID, args.kind as 'input' | 'takeover', String(args.message).trim(), pollMs, timeoutMs, onStop);
    },
  };
}

async function askUser(server: ServerAccess, sessionID: string, kind: 'input' | 'takeover', message: string, pollMs: number, timeoutMs: number, onStop?: (cb: () => void) => () => void) {
  if (!message) throw new ToolError('INVALID_INPUT', '`message` must say what the user should do.');
  const client = await server();
  if (!client) throw new ToolError('INTERNAL', 'The opencode connection is unavailable; ask the user in your reply.');
  let stopped = false;
  const off = onStop?.(() => (stopped = true)) ?? (() => undefined);
  try {
    const form = (await client.session.form.create({
        sessionID,
        title: kind === 'input' ? 'Answer the agent' : 'Your step in the browser',
        metadata: { kind: 'browser-ask-user', request: kind },
        fields: [{
          key: kind === 'input' ? 'answer' : 'choice',
          type: 'string',
          title: message,
          required: true,
          custom: kind === 'input',
          options: kind === 'input' ? [] : [{ value: 'done', label: 'Done' }, { value: 'cancel', label: 'Cancel' }],
        }],
      } as never)) as unknown as { id: string };
    return await waitForAnswer(client, sessionID, form.id, kind, pollMs, timeoutMs, () => stopped);
  } finally {
    off();
  }
}

async function waitForAnswer(client: OpenCodeClient, sessionID: string, formID: string, kind: 'input' | 'takeover', pollMs: number, timeoutMs: number, stopped: () => boolean) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (stopped()) {
      await client.session.form.cancel({ sessionID, formID, message: 'Browser activity was stopped.' }).catch(() => undefined);
      throw new ToolError('DENIED', 'Browser activity was stopped.');
    }
    const detail = (await client.session.form.get({ sessionID, formID }).catch(() => undefined)) as
          | { state?: { status: string; answer?: Record<string, unknown> } }
          | undefined;
    if (detail?.state?.status === 'answered') return answeredResult(kind, detail.state.answer);
    if (detail?.state?.status === 'cancelled') throw new ToolError('DENIED', 'The user cancelled the question.');
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  await client.session.form.cancel({ sessionID, formID, message: 'No answer in 5 minutes.' }).catch(() => undefined);
  throw new ToolError('TIMEOUT', 'The user did not answer in time.');
}

function answeredResult(kind: 'input' | 'takeover', answer?: Record<string, unknown>) {
  if (kind === 'input') return { text: [`The user answered: ${String(answer?.answer ?? '')}`] };
  if (answer?.choice !== 'done') throw new ToolError('DENIED', 'The user cancelled the step.');
  return { text: ['The user finished their step. Read the page again before acting.'] };
}
