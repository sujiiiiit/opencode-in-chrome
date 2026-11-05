import { createClient, describeError, isUnauthorized, type OpenCodeClient } from '../client';
import type { Connection } from '../connection';
import type { EventHub } from '../events';
import type { ServerEvent } from '../sse';
import { Store } from '../store';
import { ensureWorkspace } from '../workspace';
import {
  isValidModel,
  parseAgents,
  parseCatalog,
  parseConfiguredModel,
  resolveAgent,
  sameModel,
  type AgentOption,
  type Catalog,
  type ConfiguredModel,
  type ModelKey,
} from './catalog';
import { loadCachedCatalog, saveCachedCatalog } from './catalog-cache';
import {
  EMPTY_PREFERENCES,
  loadPreferences,
  pushRecent,
  savePreferences,
  setVisibility,
  toggleFavorite,
  watchPreferences,
  type ModelPreferences,
} from './preferences';
import {
  fromDurable,
  loadSavedSelections,
  resolveSelection,
  sameSelection,
  saveSelections,
  type Choice,
  type DurableSelection,
  type ResolveInput,
  type Resolved,
  type Selection,
  type SelectionState,
} from './selection';
import { cycleVariant } from './variant';

export type ModelPhase = 'idle' | 'loading' | 'ready' | 'failed';

export type ModelState = {
  /** `loading` fetches the catalog, agents and config; sends are held meanwhile. */
  phase: ModelPhase;
  /** Why loading failed. */
  error: string | null;
  /** The live catalog; null until loaded. */
  catalog: Catalog | null;
  /** The catalog loaded last time from this server: names the chips while the live one loads. */
  cached: Catalog | null;
  agents: AgentOption[];
  /** The config file's `model`, if any. */
  configured: ConfiguredModel | undefined;
  prefs: ModelPreferences;
  /** The chat on screen; null for a new chat. */
  sessionID: string | null;
  /** Each session's local selection (persisted). */
  saved: Record<string, SelectionState>;
  /** The new chat's selection, until its first send creates the session. */
  draft: SelectionState | undefined;
  /** The server's agent and model for the chat on screen. */
  durable: DurableSelection | undefined;
  notice: string | null;
};

export const INITIAL_MODEL_STATE: ModelState = {
  phase: 'idle',
  error: null,
  catalog: null,
  cached: null,
  agents: [],
  configured: undefined,
  prefs: EMPTY_PREFERENCES,
  sessionID: null,
  saved: {},
  draft: undefined,
  durable: undefined,
  notice: null,
};

export type ModelStoreOptions = {
  connection: Connection;
  /**
   * The panel's event stream: reloads the catalog after a reconnect or a provider/config change,
   * forgets deleted sessions.
   */
  events?: EventHub;
  fetch?: typeof globalThis.fetch;
  onUnauthorized?: () => void;
  /**
   * Only these agents are offered (all primary agents when omitted). A server without any of them
   * keeps its first agent, so a send always has one.
   */
  agents?: readonly string[];
};

/**
 * Server events after which the providers, models, agents or config may differ: connecting or
 * removing a provider, switching its account, or editing the config.
 */
const CATALOG_EVENTS = new Set([
  'provider.updated',
  'model.updated',
  'integration.updated',
  'credential.updated',
  'credential.switched',
  'agent.updated',
  'config.updated',
]);

const CATALOG_RELOAD_MS = 150;

const plain = (model: ModelKey): ModelKey => ({ providerID: model.providerID, modelID: model.modelID });

/** The resolver's input for a state (the live catalog, else the cached one while loading). */
export function resolveInput(state: ModelState): ResolveInput {
  const scope = state.sessionID ? state.saved[state.sessionID] : state.draft;
  return {
    catalog: state.catalog ?? state.cached,
    agents: state.agents,
    configured: state.configured,
    prefs: state.prefs,
    scope,
    durable: state.durable,
  };
}

/**
 * The model, variant and agent selection for the side panel, as an external store. It loads the
 * catalog (providers, models), agents and config for the extension's workspace, keeps the user's
 * preferences and each chat's selection, and follows the server's confirmations: a selection the
 * server has committed hands over to the session's own (durable) model.
 */
export class ModelStore extends Store<ModelState> {
  private readonly client: OpenCodeClient;
  /** Selections a send committed, until the session reports them (keyed by session). */
  private readonly pending = new Map<string, SelectionState>();
  private resolvedFor: ModelState | null = null;
  private resolvedCache: Resolved | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;
  /** The preference writes, one after another. */
  private saving: Promise<void> = Promise.resolve();

  constructor(private readonly options: ModelStoreOptions) {
    super(INITIAL_MODEL_STATE);
    const { connection, fetch } = options;
    this.client = createClient({ baseUrl: connection.baseUrl, token: connection.token, fetch });
    const events = options.events;
    if (events) {
      this.cleanups.push(
        events.subscribe(this.onEvent),
        () => clearTimeout(this.reloadTimer),
        events.onReconnect(() => (this.state.phase === 'ready' ? this.fetchCatalog().catch(() => undefined) : Promise.resolve())),
      );
    }
    this.cleanups.push(
      watchPreferences((prefs) => {
        if (JSON.stringify(prefs) !== JSON.stringify(this.state.prefs)) this.set({ prefs });
      }),
    );
  }

  private get baseUrl() {
    return this.options.connection.baseUrl;
  }

  // ─── Loading ───────────────────────────────────────────────────────────

  /** Loads preferences, saved selections and the catalog. Safe to call again after a failure. */
  load(): Promise<void> {
    if (this.state.phase === 'ready') return Promise.resolve();
    return this.once(() => this.loadAll());
  }

  private async loadAll(): Promise<void> {
    if (this.disposed) return;
    this.set({ error: null, phase: 'loading' });
    try {
      const [prefs, saved, cached] = await Promise.all([
        loadPreferences().catch(() => EMPTY_PREFERENCES),
        loadSavedSelections(this.baseUrl).catch(() => ({})),
        this.state.cached ? Promise.resolve(this.state.cached) : loadCachedCatalog(this.baseUrl).catch(() => null),
      ]);
      // Selections made before storage answered win over the stored ones.
      this.set((state) => ({ prefs, saved: { ...saved, ...state.saved }, cached }));
      await this.fetchCatalog();
      this.set({ phase: 'ready', error: null });
    } catch (error) {
      if (this.disposed) return;
      if (isUnauthorized(error)) this.options.onUnauthorized?.();
      this.set({ phase: 'failed', error: describeError(error) });
    }
  }

  private async fetchCatalog(): Promise<void> {
    const signal = this.lifetime.signal;
    const directory = await ensureWorkspace(this.client, this.baseUrl);
    const location = { directory };
    const [providers, models, agents, config] = await Promise.all([
      this.client.provider.list({ location }, { signal }),
      this.client.model.list({ location }, { signal }),
      this.client.agent.list({ location }, { signal }),
      this.client.config.get({ location }, { signal }),
    ]);
    const catalog = parseCatalog(providers, models);
    this.set({ catalog, agents: this.allowedAgents(parseAgents(agents)), configured: parseConfiguredModel(config) });
    void saveCachedCatalog(this.baseUrl, catalog).catch(() => undefined);
  }

  private allowedAgents(agents: AgentOption[]): AgentOption[] {
    const allowed = this.options.agents;
    if (!allowed) return agents;
    const kept = agents.filter((agent) => allowed.includes(agent.name));
    return kept.length > 0 ? kept : agents.slice(0, 1);
  }

  /** Reloads the catalog once a burst of catalog events settles (connecting fires several). */
  private scheduleCatalogReload(): void {
    if (this.state.phase !== 'ready') return;
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      if (!this.disposed) this.fetchCatalog().catch(() => undefined);
    }, CATALOG_RELOAD_MS);
  }

  private onEvent = (event: ServerEvent): void => {
    if (CATALOG_EVENTS.has(event.type)) return this.scheduleCatalogReload();
    if (event.type !== 'session.deleted') return;
    const sessionID = event.data.sessionID;
    if (typeof sessionID !== 'string') return;
    this.pending.delete(sessionID);
    if (sessionID in this.state.saved) {
      const { [sessionID]: _, ...rest } = this.state.saved;
      this.writeSaved(rest);
    }
  };

  // ─── The chat on screen ────────────────────────────────────────────────

  /** Switches to a chat (null: a new chat, which starts from a fresh draft). */
  focus(sessionID: string | null): void {
    if (sessionID === this.state.sessionID) return;
    this.set({ sessionID, durable: undefined, draft: sessionID === null ? undefined : this.state.draft });
  }

  /** The server's agent and model for a chat, from the chat's own store. */
  setDurable(sessionID: string, durable: DurableSelection | undefined): void {
    if (sessionID !== this.state.sessionID) return;
    if (durable !== this.state.durable) this.set({ durable });
    this.reconcile(sessionID);
  }

  /**
   * The new chat's first send created its session: its draft becomes the session's selection
   * until the server reports the same agent and model.
   */
  promote(sessionID: string, selection: Selection): void {
    const state: SelectionState = {
      agent: selection.agent,
      model: plain(selection.model),
      variant: selection.variant ?? null,
      choices: this.state.draft?.choices,
    };
    this.pending.set(sessionID, state);
    this.writeSaved({ ...this.state.saved, [sessionID]: state });
    // Follow the new session now, so the chips never show a fallback in between.
    this.set({ draft: undefined, sessionID, durable: undefined });
  }

  /** A transient message to show (cleared by `dismissNotice`). */
  notify(notice: string): void {
    this.set({ notice });
  }

  /** A send is switching the session to `selection`; returns a cancel for a failed send. */
  trackCommit(sessionID: string, selection: Selection): () => void {
    const expected: SelectionState = { agent: selection.agent, model: plain(selection.model), variant: selection.variant };
    this.pending.set(sessionID, expected);
    this.reconcile(sessionID);
    return () => {
      if (this.pending.get(sessionID) === expected) this.pending.delete(sessionID);
    };
  }

  /**
   * Once the session reports the committed selection, the local copy is dropped (each agent's
   * remembered choice stays), so the session's own model shows from then on.
   */
  private reconcile(sessionID: string): void {
    const expected = this.pending.get(sessionID);
    const durable = this.state.sessionID === sessionID ? this.state.durable : undefined;
    if (!expected || !durable?.model || !sameSelection(expected, fromDurable(durable))) return;
    this.pending.delete(sessionID);
    const saved = this.state.saved[sessionID];
    if (!saved || !sameSelection(saved, expected)) return;
    this.writeSaved({ ...this.state.saved, [sessionID]: { choices: saved.choices } });
  }

  // ─── Reading ───────────────────────────────────────────────────────────

  /** The resolved agent, model and variant for the chat on screen (cached per state). */
  resolved(): Resolved {
    if (this.resolvedFor !== this.state || !this.resolvedCache) {
      this.resolvedFor = this.state;
      this.resolvedCache = resolveSelection(resolveInput(this.state));
    }
    return this.resolvedCache;
  }

  // ─── Changing the selection ────────────────────────────────────────────

  private scope(): SelectionState | undefined {
    return this.state.sessionID ? this.state.saved[this.state.sessionID] : this.state.draft;
  }

  private write(next: Partial<SelectionState>): void {
    const state: SelectionState = { ...this.scope(), agent: this.resolved().agent?.name, ...next };
    const sessionID = this.state.sessionID;
    if (sessionID) this.writeSaved({ ...this.state.saved, [sessionID]: state });
    else this.set({ draft: state });
  }

  private writeSaved(saved: Record<string, SelectionState>): void {
    this.set({ saved });
    void saveSelections(this.baseUrl, saved).catch(() => undefined);
  }

  /**
   * Applies a change to the preferences: on screen at once, and into storage, where it lasts. The
   * same change is applied to what storage holds (one write at a time), so a change another panel
   * saved a moment ago is kept, not overwritten. A failed save is reported, not swallowed.
   */
  private updatePrefs(change: (prefs: ModelPreferences) => ModelPreferences): void {
    this.set({ prefs: change(this.state.prefs) });
    this.saving = this.saving
      .then(async () => savePreferences(change(await loadPreferences().catch(() => this.state.prefs))))
      .catch(() => this.notify("Couldn't save your model choices. They will reset when the browser restarts."));
  }

  /**
   * Chooses a model. The same model keeps its variant; another model starts from its configured
   * variant, else its default. `recent`: picked from the picker, so it joins the recent list.
   */
  setModel(model: ModelKey | undefined, options: { recent?: boolean } = {}): void {
    if (model && !isValidModel(this.state.catalog, model)) return;
    const previous = this.resolved();
    const same = sameModel(previous.model, model);
    this.write({ model: model && plain(model), variant: same ? (previous.variant ?? null) : undefined });
    if (model) this.chosen(model, same, options.recent);
  }

  /** After choosing a model: pin a session's variant, show the model in the picker, list it as recent. */
  private chosen(model: ModelKey, same: boolean, recent = false): void {
    // A session owns its variant even when the configured one changes later.
    if (this.state.sessionID && !same) this.write({ variant: this.resolved().variant ?? null });
    this.updatePrefs((prefs) => {
      const shown = setVisibility(prefs, [model], true);
      return recent ? pushRecent(shown, model) : shown;
    });
  }

  /** Chooses the current model's variant for this chat (undefined: its default). */
  setVariant(value: string | undefined): void {
    const model = this.resolved().model;
    if (!model || this.state.phase !== 'ready') return;
    this.write({ model: plain(model), variant: value ?? null });
  }

  /** default → first variant → … → last → default. */
  cycleVariant(): void {
    const { model, variant } = this.resolved();
    if (!model || model.variants.length === 0) return;
    this.setVariant(cycleVariant({ variants: model.variants, selected: variant ?? null, configured: undefined }));
  }

  /** Steps through the recent models. */
  cycleModel(direction: 1 | -1): void {
    const catalog = this.state.catalog;
    const items = this.state.prefs.recent.filter((item) => isValidModel(catalog, item));
    const current = this.resolved().model;
    if (!current || items.length === 0) return;
    const index = items.findIndex((item) => sameModel(item, current));
    const next =
      index === -1 ? (direction === 1 ? 0 : items.length - 1) : (index + direction + items.length) % items.length;
    this.setModel(items[next]);
  }

  /** Switches agent: the current agent's model is remembered, the new agent's is restored. */
  setAgent(name: string): void {
    const item = resolveAgent(this.state.agents, name);
    const previous = this.resolved();
    if (!item || previous.agent?.name === item.name) return;
    const choices = this.rememberChoice(previous);
    const next = choices[item.name];
    this.write({ agent: item.name, model: next?.model, variant: next?.variant, choices });
    // Pin both choices while the agent and model confirmations arrive separately.
    const selected = this.resolved().model;
    if (selected) this.setModel(selected);
  }

  /** Each agent's remembered choice, with the current agent's model and variant saved. */
  private rememberChoice(previous: Resolved): Record<string, Choice> {
    const choices = { ...this.scope()?.choices };
    if (!previous.agent) return choices;
    choices[previous.agent.name] = previous.model ? { model: plain(previous.model), variant: previous.variant ?? null } : {};
    return choices;
  }

  moveAgent(direction: 1 | -1): void {
    const agents = this.state.agents;
    if (agents.length === 0) return;
    const index = agents.findIndex((agent) => agent.name === this.resolved().agent?.name);
    const next = (index + direction + agents.length) % agents.length;
    this.setAgent(agents[next]!.name);
  }

  // ─── Preferences ───────────────────────────────────────────────────────

  toggleFavorite(model: ModelKey): void {
    this.updatePrefs((prefs) => toggleFavorite(prefs, model));
  }

  setVisibility(models: ModelKey[], visible: boolean): void {
    this.updatePrefs((prefs) => setVisibility(prefs, models, visible));
  }
}
