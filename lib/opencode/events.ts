import { describeError, isUnauthorized } from './client';
import type { Connection } from './connection';
import { streamEvents, type ServerEvent } from './sse';

const MAX_RECONNECTS = 3;

class StreamEndedError extends Error {
  override readonly name = 'StreamEndedError';
}

export type HubStatus =
  | { state: 'idle' }
  | { state: 'connecting' }
  | { state: 'connected' }
  /** The stream dropped; a reconnect is in progress. */
  | { state: 'reconnecting' }
  /** Gave up (offline, rejected token). `start()` tries again. */
  | { state: 'failed'; error: string };

export type EventHubOptions = {
  connection: Connection;
  fetch?: typeof globalThis.fetch;
  idleMs?: number;
  /** Base delay between reconnect attempts. */
  retryMs?: number;
  onUnauthorized?: () => void;
};

type Listener<T> = (value: T) => void;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The panel's one event stream (GET /api/event), shared by the open chat and the history list.
 * It reconnects with a growing delay after a drop, runs every resync callback before reporting
 * `connected` again, and gives up after repeated failures. The server sends events for every
 * session on the machine: consumers filter by session or directory.
 */
export class EventHub {
  private status: HubStatus = { state: 'idle' };
  private readonly listeners = new Set<Listener<ServerEvent>>();
  private readonly statusListeners = new Set<Listener<HubStatus>>();
  private readonly resyncs = new Set<() => Promise<void>>();
  private readonly lifetime = new AbortController();
  private stream: AbortController | null = null;
  private starting: Promise<void> | null = null;
  private disposed = false;

  constructor(private readonly options: EventHubOptions) {}

  getStatus = (): HubStatus => this.status;

  /** Every event from the stream, in order. */
  subscribe(listener: Listener<ServerEvent>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: Listener<HubStatus>): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Runs after each reconnect, before `connected`; a throw counts as a failed attempt. */
  onReconnect(resync: () => Promise<void>): () => void {
    this.resyncs.add(resync);
    return () => this.resyncs.delete(resync);
  }

  /** Connects (or reuses the open stream). Rejects with the reason the first connect failed. */
  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('The event stream was closed.'));
    if (this.status.state === 'connected' || this.status.state === 'reconnecting') return Promise.resolve();
    this.starting ??= this.runStart().finally(() => (this.starting = null));
    return this.starting;
  }

  private async runStart(): Promise<void> {
    this.setStatus({ state: 'connecting' });
    try {
      const events = await this.connect();
      this.setStatus({ state: 'connected' });
      void this.pump(events);
    } catch (error) {
      this.stream?.abort();
      if (!this.disposed) {
        if (isUnauthorized(error)) this.options.onUnauthorized?.();
        this.setStatus({ state: 'failed', error: describeError(error) });
      }
      throw error;
    }
  }

  private setStatus(status: HubStatus): void {
    if (this.disposed) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  /** Opens a new stream and waits for `server.connected` (the stream is volatile: connect first). */
  private async connect(): Promise<AsyncGenerator<ServerEvent>> {
    this.stream?.abort();
    const controller = new AbortController();
    this.stream = controller;
    const { connection, fetch, idleMs } = this.options;
    const events = streamEvents({
      baseUrl: connection.baseUrl,
      token: connection.token,
      fetch,
      idleMs,
      signal: AbortSignal.any([this.lifetime.signal, controller.signal]),
    });
    for (;;) {
      const next = await events.next();
      if (next.done) throw new StreamEndedError();
      if (next.value.type === 'server.connected') return events;
    }
  }

  /** Fans events out until the stream drops, then reconnects; stops once it gave up. */
  private async pump(initial: AsyncGenerator<ServerEvent>): Promise<void> {
    let events: AsyncGenerator<ServerEvent> | null = initial;
    while (events) {
      const error = await this.drain(events);
      if (this.disposed) return;
      if (isUnauthorized(error)) {
        this.options.onUnauthorized?.();
        this.setStatus({ state: 'failed', error: describeError(error) });
        return;
      }
      this.setStatus({ state: 'reconnecting' });
      events = await this.reconnect();
    }
  }

  private async drain(events: AsyncGenerator<ServerEvent>): Promise<unknown> {
    try {
      for (;;) {
        const next = await events.next();
        if (next.done) return new StreamEndedError();
        for (const listener of this.listeners) listener(next.value);
      }
    } catch (error) {
      return error;
    }
  }

  /** Reconnects with a growing delay; null once it gave up (offline, rejected token, disposed). */
  private async reconnect(): Promise<AsyncGenerator<ServerEvent> | null> {
    for (let failures = 0; ;) {
      await delay((this.options.retryMs ?? 1000) * failures);
      if (this.disposed) return null;
      try {
        const events = await this.connect();
        await Promise.all([...this.resyncs].map((resync) => resync()));
        this.setStatus({ state: 'connected' });
        return events;
      } catch (error) {
        failures += 1;
        if (this.disposed) return null;
        if (isUnauthorized(error)) {
          this.options.onUnauthorized?.();
          this.stream?.abort();
          this.setStatus({ state: 'failed', error: describeError(error) });
          return null;
        }
        if (failures >= MAX_RECONNECTS) {
          this.stream?.abort();
          this.setStatus({ state: 'failed', error: describeError(error) });
          return null;
        }
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lifetime.abort();
    this.stream?.abort();
    this.listeners.clear();
    this.statusListeners.clear();
    this.resyncs.clear();
  }
}
