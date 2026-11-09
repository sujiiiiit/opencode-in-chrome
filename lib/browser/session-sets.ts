// Per-session sets of strings that must survive a service-worker restart (V5 in
// docs/browser-automation-coverage.md): kept in memory, written through to storage.session.
import type { KeyValue } from './tabs';

type Stored = Record<string, Record<string, string[]>>;

export class SessionSets<Kind extends string> {
  private data: Stored = {};
  /** Resolves once the stored sets are loaded; reads before that see only this worker's additions. */
  readonly ready: Promise<void>;

  constructor(private readonly store?: KeyValue<Stored>) {
    this.ready = (store?.get() ?? Promise.resolve(undefined)).then(
      (saved) => {
        // Merge, so additions made while loading are kept.
        for (const [kind, sessions] of Object.entries(saved ?? {})) {
          for (const [sessionID, values] of Object.entries(sessions)) this.addLocal(kind, sessionID, values);
        }
      },
      () => undefined,
    );
  }

  has(kind: Kind, sessionID: string, value: string): boolean {
    return !!this.data[kind]?.[sessionID]?.includes(value);
  }

  values(kind: Kind, sessionID: string): string[] {
    return this.data[kind]?.[sessionID] ?? [];
  }

  add(kind: Kind, sessionID: string, values: string[]): void {
    if (!values.length) return;
    this.addLocal(kind, sessionID, values);
    void this.store?.set(this.data).catch(() => undefined);
  }

  private addLocal(kind: string, sessionID: string, values: string[]): void {
    const sessions = (this.data[kind] ??= {});
    const list = (sessions[sessionID] ??= []);
    for (const v of values) if (!list.includes(v)) list.push(v);
  }
}
