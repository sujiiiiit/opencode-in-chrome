// Which agent, model and variant a chat uses, ported from opencode's web app
// (providers/models/selection.tsx). Pure: the ModelStore holds the state and persists it.
import { browser } from 'wxt/browser';
import { isRecord } from '../reply';
import {
  findModel,
  firstModel,
  isValidModel,
  resolveAgent,
  sameModel,
  type AgentOption,
  type Catalog,
  type CatalogModel,
  type ConfiguredModel,
  type ModelKey,
} from './catalog';
import type { ModelPreferences } from './preferences';
import { configuredVariant, resolveVariant } from './variant';

const SELECTION_KEY = 'opencode.modelSelection';

/** A model and its variant (null: "default" chosen explicitly; undefined: never chosen). */
export type Choice = { model?: ModelKey; variant?: string | null };

/**
 * A chat's local selection: a draft for a new chat, or what the user picked in a chat that the
 * server has not confirmed yet. `choices` remembers each agent's last model and variant.
 */
export type SelectionState = Choice & { agent?: string; choices?: Record<string, Choice> };

/** The agent and model the server has for a session (its read model). */
export type DurableSelection = { agent?: string; model?: ModelKey & { variant?: string } };

/** What a send uses: `variant` undefined means the model's default. */
export type Selection = { agent: string; model: ModelKey; variant?: string };

export type ResolveInput = {
  catalog: Catalog | null;
  agents: AgentOption[];
  configured: ConfiguredModel | undefined;
  prefs: ModelPreferences;
  /** The local draft or the session's saved selection. */
  scope: SelectionState | undefined;
  durable: DurableSelection | undefined;
};

export type Resolved = {
  agent: AgentOption | undefined;
  /** The chosen model, kept even when the catalog no longer offers it. */
  key: ModelKey | undefined;
  /** The chosen model when the catalog offers it. */
  model: CatalogModel | undefined;
  /** The variant to send (undefined: the model's default). */
  variant: string | undefined;
  /** The chosen variant: null for an explicit default, undefined when never chosen. */
  selected: string | null | undefined;
};

const keyOf = (model: ModelKey): ModelKey => ({ providerID: model.providerID, modelID: model.modelID });

function resolveAgentOption(input: ResolveInput): AgentOption | undefined {
  return resolveAgent(input.agents, input.scope?.agent ?? input.durable?.agent);
}

/**
 * The model: the local choice, else the session's model (when it belongs to the current agent),
 * else the agent's model, the configured model, a recent model, then the catalog's first model.
 * A choice the catalog no longer offers is kept, so availability never silently swaps it.
 */
function resolveModelKey(input: ResolveInput, agent: AgentOption | undefined): ModelKey | undefined {
  const { scope, durable, catalog } = input;
  if (scope?.model) return keyOf(scope.model);
  if (durable?.model && (!durable.agent || durable.agent === agent?.name)) return keyOf(durable.model);
  return [agent?.model, input.configured, ...input.prefs.recent, firstModel(catalog)]
    .filter((item): item is ModelKey => !!item)
    .map(keyOf)
    .find((item) => isValidModel(catalog, item));
}

/** The chosen variant for the current model (see Choice), or undefined when nothing applies. */
function resolveSelected(input: ResolveInput, agent: AgentOption | undefined): string | null | undefined {
  const { scope, durable, catalog } = input;
  if (scope?.model && isValidModel(catalog, scope.model)) return scope.variant;
  return durable ? durableVariant(durable, agent, catalog) : undefined;
}

/** The session's variant (null: it records none) while its agent is current and its model offered. */
function durableVariant(durable: DurableSelection, agent: AgentOption | undefined, catalog: Catalog | null) {
  if (durable.agent && durable.agent !== agent?.name) return undefined;
  const model = durable.model;
  return model && isValidModel(catalog, model) ? (model.variant ?? null) : undefined;
}

/** The agent's configured variant for this model, else the config file's. */
function resolveConfigured(
  input: ResolveInput,
  agent: AgentOption | undefined,
  model: CatalogModel | undefined,
): string | undefined {
  if (!agent || !model) return undefined;
  return (
    configuredVariant({ config: agent, model }) ??
    configuredVariant({ config: input.configured && { model: input.configured, variant: input.configured.variant }, model })
  );
}

/** The current model's variant: the chat's chosen one, else the configured one. */
function variantFor(input: ResolveInput, agent: AgentOption | undefined, model: CatalogModel | undefined) {
  if (!model) return undefined;
  return resolveVariant({
    variants: model.variants,
    selected: resolveSelected(input, agent),
    configured: resolveConfigured(input, agent, model),
  });
}

export function resolveSelection(input: ResolveInput): Resolved {
  const agent = resolveAgentOption(input);
  const key = resolveModelKey(input, agent);
  const model = findModel(input.catalog, key);
  return {
    agent,
    key,
    model,
    variant: variantFor(input, agent, model),
    selected: resolveSelected(input, agent),
  };
}

/** What a send uses, or undefined when no agent or model resolves. */
export function sendSelection(resolved: Resolved): Selection | undefined {
  if (!resolved.agent || !resolved.model) return undefined;
  return { agent: resolved.agent.name, model: keyOf(resolved.model), variant: resolved.variant };
}

/** The server's selection in the local shape. */
export function fromDurable(durable: DurableSelection): SelectionState {
  return { agent: durable.agent, model: durable.model && keyOf(durable.model), variant: durable.model?.variant };
}

/** Same agent, model and variant ("default" and none are the same). */
export function sameSelection(a: SelectionState, b: SelectionState): boolean {
  return (
    a.agent === b.agent &&
    (a.model === b.model || sameModel(a.model, b.model)) &&
    (a.variant ?? 'default') === (b.variant ?? 'default')
  );
}

// ─── Persistence ────────────────────────────────────────────────────────────

function parseChoice(value: unknown): Choice | undefined {
  if (!isRecord(value)) return undefined;
  const model = isRecord(value.model) &&
    typeof value.model.providerID === 'string' &&
    typeof value.model.modelID === 'string'
    ? { providerID: value.model.providerID, modelID: value.model.modelID }
    : undefined;
  const variant = typeof value.variant === 'string' || value.variant === null ? value.variant : undefined;
  return { model, variant };
}

function parseSelectionState(value: unknown): SelectionState | undefined {
  const choice = parseChoice(value);
  if (!choice || !isRecord(value)) return undefined;
  const choices = isRecord(value.choices)
    ? Object.fromEntries(
        Object.entries(value.choices).flatMap(([name, item]) => {
          const parsed = parseChoice(item);
          return parsed ? [[name, parsed]] : [];
        }),
      )
    : undefined;
  return { ...choice, agent: typeof value.agent === 'string' ? value.agent : undefined, choices };
}

/** Each session's saved selection on this server. */
export async function loadSavedSelections(baseUrl: string): Promise<Record<string, SelectionState>> {
  const stored = (await browser.storage.local.get(SELECTION_KEY))[SELECTION_KEY];
  if (!isRecord(stored) || stored.baseUrl !== baseUrl || !isRecord(stored.session)) return {};
  return Object.fromEntries(
    Object.entries(stored.session).flatMap(([id, value]) => {
      const state = parseSelectionState(value);
      return state ? [[id, state]] : [];
    }),
  );
}

export async function saveSelections(baseUrl: string, session: Record<string, SelectionState>): Promise<void> {
  await browser.storage.local.set({ [SELECTION_KEY]: { baseUrl, session } });
}
