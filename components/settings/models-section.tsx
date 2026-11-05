import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { ProviderLogo } from '@/components/chat/model/provider-logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon, type IconName } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { Connection } from '@/lib/opencode/connection';
import {
  allModels,
  findProvider,
  modelKey,
  type Catalog,
  type CatalogModel,
  type CatalogProvider,
} from '@/lib/opencode/models/catalog';
import { manageGroups, type ManageGroup } from '@/lib/opencode/models/controls';
import { INITIAL_MODEL_STATE, ModelStore, type ModelState } from '@/lib/opencode/models/model-store';
import { ModelCardPopover, ModelCardTrigger, createModelCardHandle, type ModelCardHandle } from './model-card-popover';
import { ModelsSkeleton } from './models-skeleton';
import { VirtualList } from './virtual-list';

type Capability = { id: string; label: string; has: (model: CatalogModel) => boolean };

/** Every label a model can carry: what it accepts as input, and tool use. */
const CAPABILITIES: Capability[] = [
  ...(['text', 'image', 'pdf', 'audio', 'video'] as const).map((input) => ({
    id: input,
    label: input[0]!.toUpperCase() + input.slice(1),
    has: (model: CatalogModel) => model.inputs.includes(input),
  })),
  { id: 'tools', label: 'Tools', has: (model) => model.tools },
];

/** The icon beside each filter choice. */
const FILTER_ICONS: Partial<Record<string, IconName>> = {
  image: 'image',
  text: 'ai-search-lines',
  pdf: 'pdf',
  audio: 'audio',
  video: 'video',
  tools: 'tools',
};

/** A message from the store, such as a failed save. */
function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {text}
    </p>
  );
}

type FilterMenuProps = {
  offered: Capability[];
  /** The chosen label's id; undefined shows every model. */
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
  /** Nothing to filter yet (the catalog is loading). */
  disabled?: boolean;
};

/** The label filter: its button names the current choice, so the list's state is always visible. */
function FilterMenu({ offered, selected, onSelect, disabled }: FilterMenuProps) {
  const label = offered.find((item) => item.id === selected)?.label ?? 'All';
  const iconName = (selected && FILTER_ICONS[selected]) || 'sliders';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} render={<Button variant="outline" aria-label={`Filter by label: ${label}`} />}>
        <Icon name={iconName} />
        {label}
        <Icon name="chevron-down" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup value={selected ?? 'all'} onValueChange={(value) => onSelect(value === 'all' ? undefined : value)}>
            <DropdownMenuRadioItem value="all" icon={<Icon name="sliders" />}>
              All
            </DropdownMenuRadioItem>
            {offered.map((item) => (
              <DropdownMenuRadioItem
                key={item.id}
                value={item.id}
                icon={FILTER_ICONS[item.id] && <Icon name={FILTER_ICONS[item.id]!} />}
              >
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A ModelStore for this page: it loads the catalog and keeps the shared picker preferences. */
function useCatalogStore(connection: Connection) {
  const [store, setStore] = useState<ModelStore | null>(null);
  useEffect(() => {
    const created = new ModelStore({ connection });
    setStore(created);
    void created.load();
    return () => created.dispose();
  }, [connection]);
  const state = useSyncExternalStore(store?.subscribe ?? (() => () => undefined), store?.getState ?? (() => INITIAL_MODEL_STATE));
  return { store, state };
}

type ModelRowProps = {
  model: CatalogModel;
  name: string;
  visible: boolean;
  provider: CatalogProvider | undefined;
  handle: ModelCardHandle;
  store: ModelStore | null;
};

/**
 * One model's row. It takes only values that stay the same until this model really changes (the
 * catalog's own objects, a string, a boolean), so typing in the search or switching another model
 * leaves every other row alone.
 */
const ModelRow = memo(function ModelRow({ model, name, visible, provider, handle, store }: ModelRowProps) {
  const payload = useMemo(() => ({ model, provider }), [model, provider]);
  return (
    <ModelCardTrigger
      handle={handle}
      payload={payload}
      className="flex h-9 items-center gap-2 pr-3 pl-11 text-sm text-text-primary"
    >
      <bdi className="min-w-0 flex-1 truncate">{name}</bdi>
      <Switch checked={visible} onCheckedChange={(checked) => store?.setVisibility([model], checked)} />
    </ModelCardTrigger>
  );
});

/** A stand-in for the real list, for looking at the loading and empty states while developing. */
export type ModelsPreview = 'loading' | 'empty';

/** The list is flat and windowed, so every row has a known height: a model's, and a provider header's. */
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 44;

/** One entry of the flat list: a provider's header, or one of its models. */
type Entry =
  | { kind: 'group'; key: string; group: ManageGroup; provider: CatalogProvider | undefined; open: boolean }
  | { kind: 'model'; key: string; model: CatalogModel; name: string; visible: boolean; provider: CatalogProvider | undefined };

const heightOf = (entry: Entry) => (entry.kind === 'group' ? HEADER_HEIGHT : ROW_HEIGHT);
const keyOf = (entry: Entry) => entry.key;

/** Each provider's header, followed by its models while it is open. */
function flatten(
  groups: ManageGroup[],
  catalog: Catalog,
  opened: Record<string, boolean>,
  autoOpen: ReadonlySet<string>,
): Entry[] {
  return groups.flatMap((group) => {
    const provider = findProvider(catalog, group.id);
    const open = opened[group.id] ?? autoOpen.has(group.id);
    const header: Entry = { kind: 'group', key: `group:${group.id}`, group, provider, open };
    if (!open) return [header];
    return [
      header,
      ...group.items.map(
        ({ model, label, visible }): Entry => ({ kind: 'model', key: modelKey(model), model, name: label.model, visible, provider }),
      ),
    ];
  });
}

type GroupHeaderProps = {
  group: ManageGroup;
  provider: CatalogProvider | undefined;
  open: boolean;
  onToggle: (providerID: string, open: boolean) => void;
  store: ModelStore | null;
};

/** A provider's header: a button that opens or closes it, and a switch for all its listed models. */
const GroupHeader = memo(function GroupHeader({ group, provider, open, onToggle, store }: GroupHeaderProps) {
  return (
    <div className="flex h-11 items-end justify-between gap-1 pr-3">
      <Button
        variant="ghost"
        size="row"
        className="flex-none pr-4"
        aria-expanded={open}
        aria-label={`${group.title}, ${group.items.length} models`}
        onClick={() => onToggle(group.id, !open)}
      >
        <Icon name="chevron-down" className="transition-transform duration-150 group-aria-expanded/button:rotate-0 -rotate-90" />
        {provider && <ProviderLogo provider={provider} />}
        <span className="min-w-0 truncate font-medium">{group.title}</span>
        <span className="shrink-0 text-xs text-text-tertiary">{group.items.length}</span>
      </Button>
      <span className="flex h-9.5 items-center">
        <Switch
          aria-label={`Show all ${group.title} models`}
          checked={group.visible}
          onCheckedChange={(checked) =>
            // The switch acts on the models listed, so a filtered list changes only what it lists.
            store?.setVisibility(
              group.items.map((item) => item.model),
              checked,
            )
          }
        />
      </span>
    </div>
  );
});

type ToolbarProps = FilterMenuProps & {
  query: string;
  onQuery: (query: string) => void;
  /** Only models that are switched on show. */
  enabledOnly: boolean;
  onEnabledOnly: (enabledOnly: boolean) => void;
};

/**
 * The search box, the label filter and the "Enabled models" toggle. All stay on screen while models
 * load. The toggle keeps one label in both states; its look and `aria-pressed` carry the state.
 */
function Toolbar({ query, onQuery, enabledOnly, onEnabledOnly, ...filter }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-6">
      <Input
        type="search"
        aria-label="Search all models"
        placeholder="Search models"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        className="max-w-sm min-w-52 flex-1"
      />
      <FilterMenu {...filter} />
      <Button
        variant={enabledOnly ? 'secondary' : 'outline'}
        aria-pressed={enabledOnly}
        disabled={filter.disabled}
        onClick={() => onEnabledOnly(!enabledOnly)}
      >
        <Icon name="thinking" />
        Enabled models
      </Button>
    </div>
  );
}

type ModelsBodyProps = {
  state: ModelState;
  groups: ManageGroup[];
  /** The live catalog; null until it loads. */
  catalog: Catalog | null;
  /** Providers a search opens by itself (the user's own choice, in `opened`, wins). */
  autoOpen: ReadonlySet<string>;
  opened: Record<string, boolean>;
  onToggle: (providerID: string, open: boolean) => void;
  onClear: () => void;
  onRetry: () => void;
  store: ModelStore | null;
  handle: ModelCardHandle;
};

/** Loading, failed, nothing connected, nothing matching, or the providers. */
function ModelsBody({ state, groups, catalog, autoOpen, opened, onToggle, onClear, onRetry, store, handle }: ModelsBodyProps) {
  const entries = useMemo(() => (catalog ? flatten(groups, catalog, opened, autoOpen) : []), [groups, catalog, opened, autoOpen]);
  const renderEntry = useCallback(
    (entry: Entry) =>
      entry.kind === 'group' ? (
        <GroupHeader group={entry.group} provider={entry.provider} open={entry.open} onToggle={onToggle} store={store} />
      ) : (
        <ModelRow model={entry.model} name={entry.name} visible={entry.visible} provider={entry.provider} handle={handle} store={store} />
      ),
    [onToggle, store, handle],
  );
  if (!catalog && state.phase === 'failed') {
    return (
      <EmptyState icon="alert" title="Couldn't load models" description={state.error}>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </EmptyState>
    );
  }
  if (!catalog) return <ModelsSkeleton />;
  if (allModels(catalog).length === 0) {
    return (
      <EmptyState
        icon="thinking"
        title="No models yet"
        description="Connect a provider in opencode and its models will show up here."
      />
    );
  }
  if (groups.length === 0) {
    return (
      <EmptyState icon="search" title="No models match" description="Try a different search, or show every model again.">
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear search and filters
        </Button>
      </EmptyState>
    );
  }
  return (
    <div className="animate-fade-in">
      <VirtualList items={entries} heightOf={heightOf} keyOf={keyOf} renderItem={renderEntry} />
    </div>
  );
}

const NONE: ReadonlySet<string> = new Set();

/** A preview swaps in the loading or empty state, whatever the server has. */
function previewed(state: ModelState, preview: ModelsPreview | undefined): ModelState {
  if (preview === 'loading') return { ...state, phase: 'loading', catalog: null };
  if (preview === 'empty') return { ...state, phase: 'ready', catalog: { providers: [] } };
  return state;
}

/** Every model of every connected provider, with a switch for whether the chat's picker lists it. */
export function ModelsSection({ connection, preview }: { connection: Connection; preview?: ModelsPreview }) {
  const { store, state: live } = useCatalogStore(connection);
  const state = useMemo(() => previewed(live, preview), [live, preview]);
  const [cardHandle] = useState(createModelCardHandle);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string[]>([]);
  const [enabledOnly, setEnabledOnly] = useState(false);
  const catalog = state.catalog;
  // Typing stays instant: the long list below follows the box a beat behind, and a newer keystroke
  // abandons a list that has not finished rendering.
  const search = useDeferredValue(query);
  // The filter is deferred too: its menu closes at once, and the list follows.
  const filter = useDeferredValue(active);
  const onlyEnabled = useDeferredValue(enabledOnly);
  // Only the labels some model has right now are offered.
  const offered = useMemo(
    () => CAPABILITIES.filter((item) => allModels(catalog).some(item.has)),
    [catalog],
  );
  // A model must carry every selected label; a provider with none left is hidden.
  const groups = useMemo(() => {
    const required = offered.filter((item) => filter.includes(item.id));
    return manageGroups(state, search).flatMap((group) => {
      const items = group.items.filter(
        ({ model, visible }) => (!onlyEnabled || visible) && required.every((item) => item.has(model)),
      );
      return items.length === 0 ? [] : [{ ...group, items, visible: items.every((item) => item.visible) }];
    });
  }, [state, search, filter, onlyEnabled, offered]);
  // Providers start collapsed and stay as the user left them, whatever the filters do: only the
  // counts and rows change. A search opens every match, so its results are in view; only the rows
  // on screen are mounted, so that costs the same however many match.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const searching = search.trim() !== '';
  const autoOpen = useMemo(() => (searching ? new Set(groups.map((group) => group.id)) : NONE), [searching, groups]);
  const setOpen = useCallback((id: string, open: boolean) => setOpened((value) => ({ ...value, [id]: open })), []);

  return (
    <div className="space-y-3">
      <Notice text={state.notice} />
      <Toolbar
        query={query}
        onQuery={setQuery}
        offered={offered}
        selected={active[0]}
        onSelect={(id) => setActive(id ? [id] : [])}
        enabledOnly={enabledOnly}
        onEnabledOnly={setEnabledOnly}
        disabled={!catalog}
      />
      <ModelsBody
        state={state}
        groups={groups}
        catalog={catalog}
        autoOpen={autoOpen}
        opened={opened}
        onToggle={setOpen}
        onClear={() => {
          setQuery('');
          setActive([]);
          setEnabledOnly(false);
        }}
        onRetry={() => void store?.load()}
        store={store}
        handle={cardHandle}
      />
      <ModelCardPopover handle={cardHandle} />
    </div>
  );
}
