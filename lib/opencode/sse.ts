// Minimal SSE reader for GET /api/event. It uses fetch (not EventSource) so the
// Authorization header can be sent, and enforces the official client's 45s idle rule.
import { isRecord } from './reply';

const IDLE_TIMEOUT_MS = 45_000;

export type ServerEvent = {
  id?: string;
  type: string;
  /** Server time (ms) the event was created; orders pending prompts against idle boundaries. */
  created?: number;
  data: Record<string, unknown>;
  location?: unknown;
};

export class SseIdleError extends Error {
  override readonly name = 'SseIdleError';
  constructor() {
    super('The event stream went silent.');
  }
}

class HttpStatusError extends Error {
  override readonly name = 'HttpStatusError';
  constructor(readonly status: number) {
    super(`Unexpected status ${status}`);
  }
}

const optional = <T>(value: unknown, type: 'string' | 'number'): T | undefined =>
  typeof value === type ? (value as T) : undefined;

function toEvent(raw: unknown): ServerEvent | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  return {
    id: optional<string>(raw.id, 'string'),
    type: raw.type,
    created: optional<number>(raw.created, 'number'),
    data: isRecord(raw.data) ? raw.data : {},
    location: raw.location,
  };
}

/** Incremental parser: feed text chunks, get complete events back. */
export class SseParser {
  private parts: string[] = [];
  private pendingCR = '';

  feed(chunk: string): ServerEvent[] {
    let input = this.pendingCR + chunk;
    this.pendingCR = input.endsWith('\r') ? '\r' : '';
    if (this.pendingCR) input = input.slice(0, -1);
    input = input.replace(/\r\n/g, '\n');
    const events: ServerEvent[] = [];
    const finish = () => {
      const block = this.parts.join('');
      this.parts = [];
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) {
        try {
          const event = toEvent(JSON.parse(data));
          if (event) events.push(event);
        } catch {
          // Malformed frame from an untrusted source: skip it.
        }
      }
    };
    let start = 0;
    if (this.parts.at(-1)?.endsWith('\n') && input.startsWith('\n')) {
      const last = this.parts.pop()!;
      this.parts.push(last.slice(0, -1));
      finish();
      start = 1;
    }
    let boundary = input.indexOf('\n\n', start);
    while (boundary >= 0) {
      this.parts.push(input.slice(start, boundary));
      finish();
      start = boundary + 2;
      boundary = input.indexOf('\n\n', start);
    }
    if (start < input.length) this.parts.push(input.slice(start));
    return events;
  }
}

export type StreamOptions = {
  baseUrl: string;
  token: string;
  signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
  idleMs?: number;
};

export async function* streamEvents(options: StreamOptions): AsyncGenerator<ServerEvent> {
  const { baseUrl, token, signal, idleMs = IDLE_TIMEOUT_MS } = options;
  const run = options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', forwardAbort, { once: true });

  let idle = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      idle = true;
      controller.abort();
    }, idleMs);
  };

  try {
    arm();
    const response = await run(new URL('/api/event', baseUrl), {
      headers: { authorization: 'Basic ' + btoa('opencode:' + token), accept: 'text/event-stream' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      throw new HttpStatusError(response.status);
    }
    if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('The server did not return an event stream.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        arm();
        const events = parser.feed(decoder.decode(value, { stream: true }));
        // Don't count time spent in the consumer as silence.
        clearTimeout(timer);
        for (const event of events) yield event;
        arm();
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  } catch (error) {
    if (idle) throw new SseIdleError();
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
