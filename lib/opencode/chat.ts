import { createClient, isTransportError, isUnauthorized, NO_MODEL_MESSAGE, type OpenCodeClient } from './client';
import type { Connection } from './connection';
import { initialReply, reduceReply, replyFromSnapshot, type ReplyState } from './reply';
import { SseIdleError, streamEvents, type ServerEvent } from './sse';
import { ensureWorkspace } from './workspace';

const MAX_RECOVERIES = 3;

class StreamEndedError extends Error {
  override readonly name = 'StreamEndedError';
}

const isTerminal = (s: ReplyState) => s.status === 'succeeded' || s.status === 'failed' || s.status === 'interrupted';

export type SendOptions = {
  onUpdate: (state: ReplyState) => void;
  signal?: AbortSignal;
};

export type ChatSessionOptions = {
  connection: Connection;
  fetch?: typeof globalThis.fetch;
  idleMs?: number;
};

/** Reads events into box.state until the turn ends; throws if the stream drops first. */
async function drain(
  events: AsyncGenerator<ServerEvent>,
  box: { state: ReplyState },
  onUpdate: SendOptions['onUpdate'],
): Promise<ReplyState> {
  for (;;) {
    const next = await events.next();
    if (next.done) throw new StreamEndedError();
    box.state = reduceReply(box.state, next.value);
    onUpdate(box.state);
    if (isTerminal(box.state)) return box.state;
  }
}

/** Rethrows anything that is not a recoverable stream drop (or when retries ran out). */
function assertRecoverable(error: unknown, signal: AbortSignal, recoveries: number): void {
  if (signal.aborted) throw abortError();
  const dropped = error instanceof SseIdleError || error instanceof StreamEndedError || isTransportError(error);
  if (isUnauthorized(error) || !dropped || recoveries > MAX_RECOVERIES) throw error;
}

/** Text to show when a finished reply did not succeed; null otherwise. */
export function replyErrorText(state: ReplyState): string | null {
  if (state.status === 'failed') {
    const { type = '', message = '' } = state.error ?? {};
    if (/model.*not.*selected/i.test(type)) return NO_MODEL_MESSAGE;
    return `Model error: ${message}`;
  }
  if (state.status === 'interrupted') return 'Stopped before the reply finished.';
  return null;
}

/** One opencode session in the extension's workspace; each send() streams one reply. */
export class ChatSession {
  private sessionID: string | null = null;
  private readonly client: OpenCodeClient;

  constructor(private readonly options: ChatSessionOptions) {
    const { connection, fetch } = options;
    this.client = createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch });
  }

  async send(text: string, { onUpdate, signal }: SendOptions): Promise<ReplyState> {
    const controller = new AbortController();
    const forward = () => controller.abort(signal?.reason);
    if (signal?.aborted) controller.abort(signal.reason);
    else signal?.addEventListener('abort', forward, { once: true });
    try {
      return await this.run(text, onUpdate, controller.signal);
    } finally {
      signal?.removeEventListener('abort', forward);
      controller.abort(); // closes the SSE stream
    }
  }

  private async run(text: string, onUpdate: SendOptions['onUpdate'], signal: AbortSignal): Promise<ReplyState> {
    // The event stream is volatile: connect before prompting.
    let events = await this.connectStream(signal);
    const sessionID = await this.ensureSession(signal);
    const ack = await this.client.session.prompt({ sessionID, text }, { signal });

    const box = { state: initialReply(sessionID) };
    onUpdate(box.state);
    for (let recoveries = 1; ; recoveries++) {
      try {
        return await drain(events, box, onUpdate);
      } catch (error) {
        assertRecoverable(error, signal, recoveries);
        // Reconnect first, then resync from the snapshot so no event falls in the gap.
        events = await this.connectStream(signal);
        const snapshot = await this.snapshot(sessionID, ack.id, signal);
        if (snapshot) {
          onUpdate(snapshot);
          return snapshot;
        }
      }
    }
  }

  private async connectStream(signal: AbortSignal): Promise<AsyncGenerator<ServerEvent>> {
    const { connection, fetch, idleMs } = this.options;
    const events = streamEvents({ baseUrl: connection.baseUrl, token: connection.token, fetch, idleMs, signal });
    for (;;) {
      const next = await events.next();
      if (next.done) throw new StreamEndedError();
      if (next.value.type === 'server.connected') return events;
    }
  }

  private async ensureSession(signal: AbortSignal): Promise<string> {
    if (this.sessionID) return this.sessionID;
    const directory = await ensureWorkspace(this.client, this.options.connection.baseUrl);
    // Always send an explicit model: the agent's own default can be one the provider rejects.
    const fallback = await this.client.model.default({ location: { directory } }, { signal });
    const model = fallback.data;
    if (!model || typeof model.id !== 'string' || typeof model.providerID !== 'string') {
      throw { _tag: 'ModelNotSelectedError', message: NO_MODEL_MESSAGE };
    }
    const session = await this.client.session.create(
      { title: 'Chrome chat', location: { directory }, model: { providerID: model.providerID, id: model.id } },
      { signal },
    );
    this.sessionID = session.id;
    return session.id;
  }

  private async snapshot(sessionID: string, userMessageID: string, signal: AbortSignal): Promise<ReplyState | null> {
    try {
      const page = await this.client.message.list({ sessionID, order: 'desc', limit: 50 }, { signal });
      return replyFromSnapshot(sessionID, userMessageID, page.data);
    } catch (error) {
      if (isUnauthorized(error)) throw error;
      return null;
    }
  }
}

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}
