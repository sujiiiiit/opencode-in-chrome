// The user's model preferences, shared by every chat and every server (opencode's web app keeps
// them in Persist.global("model")): picker visibility overrides, and recent and favorite models.
// Efforts are not remembered per model: each chat chooses its own from the prompt box.
import { browser } from 'wxt/browser';
import { isRecord } from '../reply';
import { modelKey, sameModel, type ModelKey } from './catalog';

export const PREFERENCES_KEY = 'opencode.modelPreferences';

/** How many recently used models the picker remembers. */
export const RECENT_LIMIT = 5;

export type Visibility = 'show' | 'hide';

export type ModelPreferences = {
  /** Overrides of the picker's default visibility, per model. */
  user: Array<ModelKey & { visibility: Visibility }>;
  /** Most recent first; at most RECENT_LIMIT. */
  recent: ModelKey[];
  /** Newest favorite first. */
  favorite: ModelKey[];
};

export const EMPTY_PREFERENCES: ModelPreferences = { user: [], recent: [], favorite: [] };

function parseKey(value: unknown): ModelKey | null {
  if (!isRecord(value) || typeof value.providerID !== 'string' || typeof value.modelID !== 'string') return null;
  if (!value.providerID || !value.modelID) return null;
  return { providerID: value.providerID, modelID: value.modelID };
}

const keys = (value: unknown): ModelKey[] =>
  (Array.isArray(value) ? value : []).flatMap((item) => {
    const key = parseKey(item);
    return key ? [key] : [];
  });

/** Reads stored preferences, dropping anything malformed. */
export function parsePreferences(value: unknown): ModelPreferences {
  if (!isRecord(value)) return EMPTY_PREFERENCES;
  const user = (Array.isArray(value.user) ? value.user : []).flatMap((item) => {
    const key = parseKey(item);
    const visibility = isRecord(item) ? item.visibility : undefined;
    if (!key || (visibility !== 'show' && visibility !== 'hide')) return [];
    return [{ ...key, visibility: visibility as Visibility }];
  });
  return {
    user,
    recent: uniqueModels(keys(value.recent)).slice(0, RECENT_LIMIT),
    favorite: uniqueModels(keys(value.favorite)),
  };
}

function uniqueModels(models: ModelKey[]): ModelKey[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = modelKey(model);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const plain = (model: ModelKey): ModelKey => ({ providerID: model.providerID, modelID: model.modelID });

/** Moves a model to the front of the recent list. */
export function pushRecent(prefs: ModelPreferences, model: ModelKey): ModelPreferences {
  return { ...prefs, recent: uniqueModels([plain(model), ...prefs.recent]).slice(0, RECENT_LIMIT) };
}

/** Adds a favorite at the front, or removes it. */
export function toggleFavorite(prefs: ModelPreferences, model: ModelKey): ModelPreferences {
  const rest = prefs.favorite.filter((item) => !sameModel(item, model));
  return { ...prefs, favorite: rest.length === prefs.favorite.length ? [plain(model), ...rest] : rest };
}

export const isFavorite = (prefs: ModelPreferences, model: ModelKey) =>
  prefs.favorite.some((item) => sameModel(item, model));

export function setVisibility(prefs: ModelPreferences, models: ModelKey[], visible: boolean): ModelPreferences {
  const visibility: Visibility = visible ? 'show' : 'hide';
  const user = [...prefs.user];
  for (const model of models) {
    const index = user.findIndex((item) => sameModel(item, model));
    if (index >= 0) user[index] = { ...user[index]!, visibility };
    else user.push({ ...plain(model), visibility });
  }
  return { ...prefs, user };
}

/** Shown in the picker: the user's override, else the catalog default. */
export function isVisible(prefs: ModelPreferences, defaults: Set<string>, model: ModelKey): boolean {
  const override = prefs.user.find((item) => sameModel(item, model))?.visibility;
  if (override) return override === 'show';
  return defaults.has(modelKey(model));
}

export async function loadPreferences(): Promise<ModelPreferences> {
  const stored = await browser.storage.local.get(PREFERENCES_KEY);
  return parsePreferences(stored[PREFERENCES_KEY]);
}

export async function savePreferences(prefs: ModelPreferences): Promise<void> {
  await browser.storage.local.set({ [PREFERENCES_KEY]: prefs });
}

/** Calls back when another panel (another window) changes the preferences. */
export function watchPreferences(listener: (prefs: ModelPreferences) => void): () => void {
  const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && PREFERENCES_KEY in changes) listener(parsePreferences(changes[PREFERENCES_KEY]!.newValue));
  };
  browser.storage.onChanged.addListener(onChanged);
  return () => browser.storage.onChanged.removeListener(onChanged);
}
