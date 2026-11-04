/**
 * An external store for React's `useSyncExternalStore`: immutable state, change listeners, an
 * abort signal for in-flight requests, and cleanups that run once on dispose.
 */
export abstract class Store<S extends { notice: string | null }> {
  protected state: S;
  private readonly listeners = new Set<() => void>();
  protected readonly lifetime = new AbortController();
  /** Unsubscribe functions and other teardown, run by `dispose`. */
  protected readonly cleanups: Array<() => void> = [];
  protected disposed = false;
  private running: Promise<void> | null = null;

  protected constructor(initial: S) {
    this.state = initial;
  }

  getState = (): S => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  protected set(patch: Partial<S> | ((state: S) => Partial<S>)): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...(typeof patch === 'function' ? patch(this.state) : patch) };
    for (const listener of this.listeners) listener();
  }

  /** Runs `task` unless a run is in flight, in which case callers share that run. */
  protected once(task: () => Promise<void>): Promise<void> {
    this.running ??= task().finally(() => (this.running = null));
    return this.running;
  }

  dismissNotice(): void {
    this.set({ notice: null } as Partial<S>);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lifetime.abort();
    for (const cleanup of this.cleanups) cleanup();
    this.listeners.clear();
  }
}
