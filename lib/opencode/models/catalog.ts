// The model catalog the picker shows: GET /api/provider + GET /api/model, normalized the way
// opencode's web app does it (runtime/server/global-sync/utils.ts normalizeProviderList,
// providers/models/models.tsx, composer/model-label.ts, providers/models/search.ts).
import { isRecord } from '../reply';

export type ModelKey = { providerID: string; modelID: string };

export type ModelInput = 'text' | 'image' | 'pdf' | 'audio' | 'video';

export type CatalogModel = ModelKey & {
  /** Display name, without opencode's "(latest)" marker. */
  name: string;
  /** The catalog marked this model "(latest)". */
  latest: boolean;
  family?: string;
  /** Release time in ms; NaN when unknown. */
  released: number;
  /** One of OpenCode's own free models. */
  free: boolean;
  /** Effort variant IDs, in catalog order. */
  variants: string[];
  context: number;
  inputs: ModelInput[];
  tools: boolean;
};

export type CatalogProvider = {
  id: string;
  name: string;
  canonical?: string;
  integrationID?: string;
  models: CatalogModel[];
};

export type Catalog = { providers: CatalogProvider[] };

const INPUTS: ModelInput[] = ['text', 'image', 'pdf', 'audio', 'video'];

/** Providers listed first in the picker, in this order (opencode's catalog/order.ts). */
const POPULAR_PROVIDERS = [
  'opencode-go',
  'opencode',
  'anthropic',
  'github-copilot',
  'openai',
  'google',
  'openrouter',
  'vercel',
];

export const modelKey = (model: ModelKey) => `${model.providerID}:${model.modelID}`;

export const sameModel = (a: ModelKey | undefined, b: ModelKey | undefined) =>
  !!a && !!b && a.providerID === b.providerID && a.modelID === b.modelID;

const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The unwrapped `data` of a location response (`{location, data}`), or the value itself. */
function responseData(value: unknown): unknown {
  return isRecord(value) && 'data' in value ? value.data : value;
}

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
const positive = (value: unknown) => (typeof value === 'number' && value > 0 ? value : NaN);

/** OpenCode's own models that cost nothing (the base tier, else the first). */
function isFree(raw: Record<string, unknown>, providerID: string): boolean {
  const costs = list(raw.cost).filter(isRecord);
  const cost = costs.find((item) => item.tier === undefined) ?? costs[0];
  return providerID === 'opencode' && (!cost || cost.input === 0);
}

const variantIDs = (value: unknown): string[] =>
  list(value).flatMap((variant) => {
    const id = isRecord(variant) ? str(variant.id) : str(variant);
    return id ? [id] : [];
  });

function parseModel(raw: Record<string, unknown>, providerID: string): CatalogModel | null {
  const id = str(raw.id);
  const name = str(raw.name) ?? id;
  if (!id || !name || raw.status === 'deprecated') return null;
  const capabilities = record(raw.capabilities);
  const input = list(capabilities.input);
  return {
    providerID,
    modelID: id,
    name: name.replace('(latest)', '').trim(),
    latest: name.includes('(latest)'),
    family: str(raw.family),
    released: positive(record(raw.time).released),
    free: isFree(raw, providerID),
    variants: variantIDs(raw.variants),
    context: positive(record(raw.limit).context) || 0,
    // The server matches by prefix ("image" also covers an "image/png" entry), so the catalog does too.
    inputs: INPUTS.filter((type) => input.some((item) => typeof item === 'string' && item.startsWith(type))),
    tools: capabilities.tools === true,
  };
}

/**
 * Builds the catalog from the provider and model lists. Every listed provider is connected
 * (2.2.5 lists only usable ones); deprecated models and models of unlisted providers are dropped.
 */
export function parseCatalog(providers: unknown, models: unknown): Catalog {
  const byID = new Map<string, CatalogProvider>();
  for (const provider of list(responseData(providers)).map(parseProvider)) {
    if (provider && !byID.has(provider.id)) byID.set(provider.id, provider);
  }
  for (const raw of list(responseData(models)).filter(isRecord)) {
    const provider = byID.get(str(raw.providerID) ?? '');
    const model = provider && parseModel(raw, provider.id);
    if (model && !provider.models.some((m) => m.modelID === model.modelID)) provider.models.push(model);
  }
  return { providers: [...byID.values()] };
}

function parseProvider(raw: unknown): CatalogProvider | null {
  const id = isRecord(raw) ? str(raw.id) : undefined;
  if (!id || !isRecord(raw)) return null;
  return { id, name: str(raw.name) ?? id, canonical: str(raw.canonical), integrationID: str(raw.integrationID), models: [] };
}

export const allModels = (catalog: Catalog | null): CatalogModel[] =>
  catalog?.providers.flatMap((provider) => provider.models) ?? [];

export function findProvider(catalog: Catalog | null, providerID: string): CatalogProvider | undefined {
  return catalog?.providers.find((provider) => provider.id === providerID);
}

export function findModel(catalog: Catalog | null, key: ModelKey | undefined): CatalogModel | undefined {
  if (!key) return undefined;
  return findProvider(catalog, key.providerID)?.models.find((model) => model.modelID === key.modelID);
}

/** A model the catalog offers now (its provider is connected and lists it). */
export const isValidModel = (catalog: Catalog | null, key: ModelKey | undefined) => !!findModel(catalog, key);

/** The first model of the first provider: the last-resort default. */
export function firstModel(catalog: Catalog | null): ModelKey | undefined {
  for (const provider of catalog?.providers ?? []) {
    const model = provider.models[0];
    if (model) return { providerID: model.providerID, modelID: model.modelID };
  }
  return undefined;
}

// ─── Default visibility ─────────────────────────────────────────────────────

/** luxon's diffNow().as("months") used an average month; opencode keeps the same window. */
const SIX_MONTHS = 6 * 30.436875 * 24 * 60 * 60 * 1000;

/**
 * The newest release of each family per provider. A free model shares its family and release
 * date with its paid twin, so the two are grouped apart. A tie keeps the first model listed.
 */
export function latestModels(models: CatalogModel[]): CatalogModel[] {
  const groups = new Map<string, CatalogModel>();
  for (const model of models) {
    const group = `${model.providerID}\u0000${model.family}\u0000${model.free}`;
    const best = groups.get(group);
    if (!best || model.released > best.released) groups.set(group, model);
  }
  return [...groups.values()];
}

/**
 * Models the picker shows when the user has not said otherwise: the newest of each family released
 * in the last six months, OpenCode's free models (whatever their age), and models with no known
 * release date.
 */
export function defaultVisible(catalog: Catalog | null, now = Date.now()): Set<string> {
  const models = allModels(catalog);
  const recent = models.filter((model) => Math.abs(now - model.released) < SIX_MONTHS);
  return new Set(
    [
      ...latestModels(recent),
      ...models.filter((model) => model.free || !Number.isFinite(model.released)),
    ].map(modelKey),
  );
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export type ModelLabel = { provider?: string; model: string };

/** OpenCode's own provider: its models need no provider name. */
const isNative = (provider: CatalogProvider) =>
  provider.id === 'opencode' && (!provider.integrationID || provider.integrationID === 'opencode');

/**
 * The provider name to show next to a model, or undefined for OpenCode's own models. A provider
 * routed through OpenCode says so when the same provider is also connected directly.
 */
export function providerName(catalog: Catalog | null, providerID: string): string | undefined {
  const provider = findProvider(catalog, providerID);
  if (!provider) return providerID;
  if (isNative(provider)) return undefined;
  if (provider.integrationID !== 'opencode' || !provider.canonical) return provider.name;
  const direct = catalog!.providers.some(
    (item) =>
      !isNative(item) &&
      item.integrationID !== 'opencode' &&
      (item.integrationID ?? item.id) === provider.canonical,
  );
  return direct ? `OpenCode / ${provider.name}` : provider.name;
}

/**
 * The part of the IDs they all share, cut back to a separator, so "v1" and "v2" share nothing
 * while "gemini-4-argon" and "gemini-4-argon-eap" share "gemini-4-argon".
 */
function sharedPrefix(ids: string[]): number {
  const first = ids[0] ?? '';
  const separator = (char: string | undefined) => !!char && /[-_./:]/.test(char);
  const boundary = (n: number) =>
    n === 0 || ids.every((id) => n === id.length || separator(id[n]) || separator(id[n - 1]));
  const differs = first.split('').findIndex((char, index) => ids.some((id) => id[index] !== char));
  const common = differs === -1 ? first.length : differs;
  for (let n = common; n >= 0; n--) if (boundary(n)) return n;
  return 0;
}

/**
 * A distinct label for every model: two providers with the same name show their IDs, and two
 * models of one provider with the same name show the part of their IDs that differs.
 */
export function modelLabels(catalog: Catalog | null): Map<string, ModelLabel> {
  const rows = allModels(catalog).map((model) => {
    const provider = providerName(catalog, model.providerID);
    return { model, provider, text: provider ? `${provider} / ${model.name}` : model.name };
  });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) groups.set(row.text, [...(groups.get(row.text) ?? []), row]);
  return new Map(
    rows.map((row) => {
      const peers = groups.get(row.text) ?? [];
      const provider = peers.some((other) => other.model.providerID !== row.model.providerID)
        ? row.model.providerID
        : row.provider;
      const same = peers.filter((other) => other.model.providerID === row.model.providerID).map((o) => o.model.modelID);
      const suffix =
        same.length > 1 ? row.model.modelID.slice(sharedPrefix(same)).replace(/^[-_./:]+/, '') : '';
      return [modelKey(row.model), { provider, model: suffix ? `${row.model.name} (${suffix})` : row.model.name }];
    }),
  );
}

// ─── Search and order ───────────────────────────────────────────────────────

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

/** Loose match: punctuation and spacing are ignored ("gpt5" finds "GPT-5"). */
export function matchesSearch(query: string, values: string[]): boolean {
  const search = normalizeSearch(query);
  if (!search) return true;
  const compact = search.replaceAll(' ', '');
  return values.some((value) => {
    const normalized = normalizeSearch(value);
    return normalized.includes(search) || normalized.replaceAll(' ', '').includes(compact);
  });
}

/** Popular providers first (in their order), then the rest by name. */
export function compareProviders(a: CatalogProvider, b: CatalogProvider): number {
  const ai = POPULAR_PROVIDERS.indexOf(a.id);
  const bi = POPULAR_PROVIDERS.indexOf(b.id);
  if (ai >= 0 && bi >= 0) return ai - bi;
  if (ai >= 0) return -1;
  if (bi >= 0) return 1;
  return a.name.localeCompare(b.name);
}

export const compareModels = (a: CatalogModel, b: CatalogModel) => a.name.localeCompare(b.name);

// ─── Agents and the configured model ────────────────────────────────────────

export type AgentOption = {
  name: string;
  /** The agent's own model, if it pins one. */
  model?: ModelKey;
  variant?: string;
};

function parseModelRef(value: unknown): (ModelKey & { variant?: string }) | undefined {
  if (!isRecord(value)) return undefined;
  const providerID = str(value.providerID);
  const modelID = str(value.id) ?? str(value.modelID) ?? str(value.model);
  if (!providerID || !modelID) return undefined;
  return { providerID, modelID, variant: str(value.variant) };
}

/** The agents a prompt can use: primary agents that are not hidden (subagents run inside a turn). */
export function parseAgents(value: unknown): AgentOption[] {
  return list(responseData(value)).flatMap((raw) => {
    if (!isRecord(raw) || raw.mode === 'subagent' || raw.hidden === true) return [];
    const name = str(raw.id) ?? str(raw.name);
    if (!name) return [];
    const ref = parseModelRef(raw.model);
    return [
      {
        name,
        model: ref && { providerID: ref.providerID, modelID: ref.modelID },
        variant: ref?.variant,
      },
    ];
  });
}

/** The named agent, else "build", else the first one (opencode's resolveAgent). */
export function resolveAgent(agents: AgentOption[], name: string | undefined): AgentOption | undefined {
  return agents.find((a) => a.name === name) ?? agents.find((a) => a.name === 'build') ?? agents[0];
}

export type ConfiguredModel = ModelKey & { variant?: string };

/**
 * The `model` of the highest-priority config document that sets one: `"provider/model"` or
 * `{providerID, model, variant}`.
 */
export function parseConfiguredModel(entries: unknown): ConfiguredModel | undefined {
  const documents = list(responseData(entries)).filter(
    (entry) => isRecord(entry) && entry.type === 'document' && isRecord(entry.info) && entry.info.model !== undefined,
  ) as Array<{ info: { model: unknown } }>;
  const model = documents.at(-1)?.info.model;
  if (typeof model === 'string') {
    const [providerID, ...parts] = model.split('/');
    const modelID = parts.join('/');
    return providerID && modelID ? { providerID, modelID } : undefined;
  }
  return parseModelRef(model);
}
