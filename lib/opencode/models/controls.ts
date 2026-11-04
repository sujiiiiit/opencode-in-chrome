// What the composer's model controls and the model picker show, derived from the ModelStore state.
import {
  allModels,
  compareModels,
  compareProviders,
  defaultVisible,
  findModel,
  findProvider,
  matchesSearch,
  modelKey,
  modelLabels,
  providerName,
  sameModel,
  type CatalogModel,
  type ModelKey,
  type ModelLabel,
} from './catalog';
import { resolveInput, type ModelState } from './model-store';
import { isFavorite, isVisible } from './preferences';
import { resolveSelection, sendSelection, type Selection } from './selection';
import { DEFAULT_VARIANT } from './variant';

export type ModelControls = {
  /** The catalog has not loaded (or failed): the chips are inert. */
  loading: boolean;
  /** Loading, but the chips name the model from the catalog cached last time. */
  preview: boolean;
  /** The catalog loaded and offers no model at all. */
  empty: boolean;
  agent: {
    /** More than one agent to choose from. */
    visible: boolean;
    options: string[];
    current: string | undefined;
  };
  model: {
    current: CatalogModel | undefined;
    label: ModelLabel | undefined;
    /** The current model's provider, for its logo. */
    provider: { id: string; canonical?: string } | undefined;
  };
  variant: {
    /** "default", then the model's variants. */
    options: string[];
    /** "default" or a variant ID. */
    current: string;
  };
  /** What a send uses, or undefined while loading or when nothing resolves. */
  selection: Selection | undefined;
};

export function buildControls(state: ModelState): ModelControls {
  const input = resolveInput(state);
  const resolved = resolveSelection(input);
  const loading = state.phase !== 'ready';
  const model = resolved.model;
  return {
    loading,
    preview: loading && !!model,
    empty: !loading && allModels(state.catalog).length === 0,
    agent: {
      visible: state.agents.length > 1,
      options: state.agents.map((agent) => agent.name),
      current: resolved.agent?.name,
    },
    model: {
      current: model,
      label: model && modelLabels(input.catalog).get(modelKey(model)),
      provider: model && (findProvider(input.catalog, model.providerID) ?? { id: model.providerID }),
    },
    variant: {
      options: [DEFAULT_VARIANT, ...(model?.variants ?? [])],
      current: resolved.variant ?? DEFAULT_VARIANT,
    },
    selection: loading ? undefined : sendSelection(resolved),
  };
}

// ─── The picker ─────────────────────────────────────────────────────────────

export type PickerItem = {
  model: CatalogModel;
  label: ModelLabel;
  favorite: boolean;
  current: boolean;
};

export type PickerGroup = {
  /** "favorite", "recent", or a provider ID. */
  id: string;
  title: string;
  /** A provider group (it can collapse); Favorites and Recent cannot. */
  provider: boolean;
  items: PickerItem[];
};

/**
 * The picker's sections: Favorites and Recent lead until a search narrows the list, and leave
 * their provider's group meanwhile; then each provider, popular ones first. Only visible models
 * are listed (see Manage models).
 */
export function pickerGroups(state: ModelState, search: string): PickerGroup[] {
  const input = resolveInput(state);
  const catalog = state.catalog;
  const labels = modelLabels(catalog);
  const defaults = defaultVisible(catalog);
  const current = resolveSelection(input).model;
  const item = (model: CatalogModel): PickerItem => ({
    model,
    label: labels.get(modelKey(model)) ?? { model: model.name },
    favorite: isFavorite(state.prefs, model),
    current: sameModel(model, current),
  });
  const query = search.trim();
  const visible = (model: CatalogModel) => isVisible(state.prefs, defaults, model);
  const matches = (model: CatalogModel) =>
    matchesSearch(query, [model.name, model.modelID, labels.get(modelKey(model))?.provider ?? '']);
  const keyed = (keys: ModelKey[]) =>
    keys.flatMap((key) => {
      const model = findModel(catalog, key);
      return model ? [model] : [];
    });

  const favorites = query ? [] : keyed(state.prefs.favorite);
  const favoriteKeys = new Set(favorites.map(modelKey));
  const recent = query ? [] : keyed(state.prefs.recent).filter((model) => !favoriteKeys.has(modelKey(model)));
  const listed = new Set([...favoriteKeys, ...recent.map(modelKey)]);

  const providers = [...(catalog?.providers ?? [])]
    .map((provider) => ({
      provider,
      models: provider.models
        .filter((model) => visible(model) && matches(model) && !listed.has(modelKey(model)))
        .sort(compareModels),
    }))
    .filter((group) => group.models.length > 0)
    .sort((a, b) => compareProviders(a.provider, b.provider));

  return [
    ...(favorites.length ? [{ id: 'favorite', title: 'Favorites', provider: false, items: favorites.map(item) }] : []),
    ...(recent.length ? [{ id: 'recent', title: 'Recent', provider: false, items: recent.map(item) }] : []),
    ...providers.map(({ provider, models }) => ({
      id: provider.id,
      title: providerName(catalog, provider.id) ?? provider.name,
      provider: true,
      items: models.map(item),
    })),
  ];
}

export type ManageGroup = {
  id: string;
  title: string;
  /** Every model of the provider is visible. */
  visible: boolean;
  items: Array<{ model: CatalogModel; label: ModelLabel; visible: boolean }>;
};

/** Every model, by provider, with its picker visibility (the Manage models view). */
export function manageGroups(state: ModelState, search: string): ManageGroup[] {
  const catalog = state.catalog;
  const labels = modelLabels(catalog);
  const defaults = defaultVisible(catalog);
  return [...(catalog?.providers ?? [])]
    .sort(compareProviders)
    .flatMap((provider) => {
      const items = provider.models
        .filter((model) => matchesSearch(search, [model.name, model.modelID, provider.name]))
        .sort(compareModels)
        .map((model) => ({
          model,
          label: labels.get(modelKey(model)) ?? { model: model.name },
          visible: isVisible(state.prefs, defaults, model),
        }));
      if (items.length === 0) return [];
      const all = provider.models.every((model) => isVisible(state.prefs, defaults, model));
      return [{ id: provider.id, title: providerName(catalog, provider.id) ?? provider.name, visible: all, items }];
    });
}
