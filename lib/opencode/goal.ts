import { createClient, isUnauthorized, type OpenCodeClient } from './client';
import type { Connection } from './connection';
import type { EventHub } from './events';
import type { ServerEvent } from './sse';
import { Store } from './store';
import { ensureWorkspace } from './workspace';

/**
 * A session's `/goal`, as opencode's goal plugin keeps it (`@opencode/schema/goal` `Goal.State`):
 * the objective the agent works on across turns until a reviewer finds it met.
 */
export type Goal = {
  id: string;
  objective: string;
  status: 'active' | 'paused' | 'complete';
  /** Why it last changed: the reviewer's verdict, or what paused it. */
  reason?: string;
  rounds: number;
  maxRounds: number;
};

export type GoalAction = 'pause' | 'resume' | 'clear';

export type GoalState = { goal: Goal | null; notice: string | null };

/** The goal plugin's RPC (`opencode.goal`): `get({ sessionID })`, and `changed` on every write. */
const RPC_ID = 'opencode.goal';
const CHANGED = `rpc.${RPC_ID}.changed`;
const STATUSES = new Set<Goal['status']>(['active', 'paused', 'complete']);

/** The plugin's goal, or null for anything else (no goal, or a shape this build does not know). */
export function parseGoal(value: unknown): Goal | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.objective !== 'string' || !STATUSES.has(v.status as Goal['status'])) return null;
  return {
    id: v.id,
    objective: v.objective,
    status: v.status as Goal['status'],
    reason: typeof v.reason === 'string' && v.reason ? v.reason : undefined,
    rounds: typeof v.rounds === 'number' ? v.rounds : 0,
    maxRounds: typeof v.maxRounds === 'number' ? v.maxRounds : 0,
  };
}

export type GoalStoreOptions = {
  connection: Connection;
  events?: EventHub;
  fetch?: typeof globalThis.fetch;
  onUnauthorized?: () => void;
};

/**
 * The open session's goal: read once when the session changes (and after a reconnect, since
 * changes published meanwhile were missed), then kept current from the plugin's `changed` events.
 * A server without the goal plugin answers the read with an error, and the session shows no goal.
 */
export class GoalStore extends Store<GoalState> {
  private readonly client: OpenCodeClient;
  private sessionID: string | null = null;
  /** Bumped per read: a slower, older read never overwrites a newer one or a later event. */
  private generation = 0;

  constructor(private readonly options: GoalStoreOptions) {
    super({ goal: null, notice: null });
    const { connection, fetch, events } = options;
    this.client = createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch });
    this.follow(events, this.onEvent, () => this.read());
  }

  /** Follows `sessionID`'s goal (none for a new chat). */
  watch(sessionID: string | null): void {
    if (sessionID === this.sessionID) return;
    this.sessionID = sessionID;
    this.set({ goal: null });
    void this.read();
  }

  /** Runs `/goal pause|resume|clear` on the session; the plugin's `changed` event updates the goal. */
  async run(action: GoalAction): Promise<void> {
    const sessionID = this.sessionID;
    if (!sessionID) return;
    this.set({ notice: null });
    try {
      await this.client.session.command({ sessionID, name: 'goal', text: action }, { signal: this.lifetime.signal });
    } catch (error) {
      if (this.disposed) return;
      if (isUnauthorized(error)) return this.options.onUnauthorized?.();
      this.set({ notice: error instanceof Error && error.message ? error.message : `Could not ${action} the goal.` });
    }
  }

  private async read(): Promise<void> {
    const sessionID = this.sessionID;
    const generation = ++this.generation;
    if (!sessionID) return;
    try {
      const directory = await ensureWorkspace(this.client, this.options.connection.baseUrl);
      const result = await this.client.rpc.call(
        { rpcID: RPC_ID, method: 'get', location: { directory }, input: { sessionID } },
        { signal: this.lifetime.signal },
      );
      if (generation === this.generation && sessionID === this.sessionID) this.set({ goal: parseGoal(result.output) });
    } catch (error) {
      if (!this.disposed && isUnauthorized(error)) this.options.onUnauthorized?.();
    }
  }

  private onEvent = (event: ServerEvent): void => {
    if (event.type !== CHANGED || event.data.sessionID !== this.sessionID) return;
    // An event is newer than any read still in flight.
    this.generation++;
    this.set({ goal: parseGoal(event.data.goal) });
  };
}

