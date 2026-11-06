// A simple browser question, matching Nanobrowser's ask_user flow. The side panel already
// renders opencode forms and sends answers, so the agent can wait here for the person's step.
import type { ServerAccess } from '../server';
import type { OpenCodeClient } from '../../opencode/client';
import { ToolError, type ToolDef } from './registry';

const TIMEOUT_MS = 5 * 60_000;

export function askUserTool(server: ServerAccess, pollMs = 500, timeoutMs = TIMEOUT_MS, onStop?: (cb: () => void) => () => void): ToolDef {
  return {
    name: 'ask_user',
    description: 'Ask one non-secret text question, or hand the browser to the user for sign-in or CAPTCHA. Never request passwords, card details, or one-time codes as text. For payment, tell the user in your final answer that they must complete checkout themselves. Do not use the built-in question tool for browser handoffs.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['input', 'takeover'] },
        message: { type: 'string', description: 'One short sentence telling the user exactly what to answer or do.' },
      },
      required: ['kind', 'message'],
    },
    async handler(args, { sessionID }) {
      const kind = args.kind as 'input' | 'takeover';
      const message = String(args.message).trim();
      if (!message) throw new ToolError('INVALID_INPUT', '`message` must say what the user should do.');
      if (kind === 'input' && /(?:card (?:number|details|information|digits)|cvc|cvv|expir(?:y|ation)|password|passcode|one.time code|otp|security code)/i.test(message)) {
        throw new ToolError('DENIED', 'Do not request payment details or secrets in a text answer. Tell the user to complete payment themselves, or use takeover for sign-in and similar browser steps.');
      }
      return askUser(server, sessionID, kind, message, pollMs, timeoutMs, onStop);
    },
  };
}

async function askUser(server: ServerAccess, sessionID: string, kind: 'input' | 'takeover', message: string, pollMs: number, timeoutMs: number, onStop?: (cb: () => void) => () => void) {
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
