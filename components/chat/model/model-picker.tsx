import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { modelKey, sameModel, type CatalogModel, type ModelLabel } from '@/lib/opencode/models/catalog';
import { manageGroups, pickerGroups, type PickerGroup, type PickerItem } from '@/lib/opencode/models/controls';
import type { ModelState, ModelStore } from '@/lib/opencode/models/model-store';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: ModelStore;
  state: ModelState;
};

/**
 * The model picker, after opencode's model dialog. Pick view: search, Favorites and Recent, then
 * providers (collapsible). Effort is not chosen here: the prompt box offers the chosen model's
 * efforts. Manage view: show or hide models in the picker, per model or per provider.
 */
export function ModelPicker({ open, onOpenChange, store, state }: Props) {
  const [view, setView] = useState<'pick' | 'manage'>('pick');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setView('pick');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="model-picker" initialFocus={search}>
        <DialogDescription>Search models and choose one.</DialogDescription>
        {view === 'pick' ? (
          <PickView
            store={store}
            state={state}
            searchRef={search}
            onManage={() => setView('manage')}
            onChosen={() => onOpenChange(false)}
          />
        ) : (
          <ManageView store={store} state={state} searchRef={search} onBack={() => setView('pick')} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-4 pt-3 pb-2">
      <DialogTitle className="min-w-0 flex-1 truncate">{title}</DialogTitle>
      {children}
      <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="Close" />}>
        <Icon name="close" />
      </DialogClose>
    </div>
  );
}

/** Provider, context window, inputs and tool use: the details opencode shows on hover. */
function details(model: CatalogModel, label: ModelLabel): string {
  const parts = [
    label.provider ?? 'OpenCode',
    model.context ? `${model.context.toLocaleString()} context` : '',
    model.inputs.join(', '),
    model.tools ? 'tools' : '',
    model.free ? 'free' : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Ctrl+F (Cmd+F on macOS) toggles the highlighted model's favorite. */
const isFavoriteKey = (event: KeyboardEvent) =>
  event.ctrlKey !== event.metaKey && !event.altKey && event.key.toLowerCase() === 'f';

// ─── Pick view ──────────────────────────────────────────────────────────────

/**
 * An always-open (inline) Base UI Combobox: it owns the keyboard (↑↓ Home End Enter), the
 * highlight and the selected check; the store does the filtering and grouping.
 */
function PickView({
  store,
  state,
  searchRef,
  onManage,
  onChosen,
}: {
  store: ModelStore;
  state: ModelState;
  searchRef: RefObject<HTMLInputElement | null>;
  onManage: () => void;
  onChosen: () => void;
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const highlighted = useRef<PickerItem | undefined>(undefined);
  const searching = query.trim().length > 0;
  const groups = useMemo(() => pickerGroups(state, query), [state, query]);
  const expanded = (group: PickerGroup) => searching || !group.provider || !collapsed[group.id];
  // Rows in display order; a collapsed provider keeps its heading but lists none.
  const shown = groups.map((group) => ({ group, items: expanded(group) ? group.items : [] }));
  const items = shown.flatMap((entry) => entry.items);
  const current = groups.flatMap((group) => group.items).find((item) => item.current) ?? null;
  // Base UI navigates rows by index; the groups are rendered here so a collapsed one stays listed.
  const offsets = shown.map((_, index) => shown.slice(0, index).reduce((sum, entry) => sum + entry.items.length, 0));

  const choose = (item: PickerItem | null) => {
    if (item) store.setModel(item.model, { recent: true });
    onChosen();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isFavoriteKey(event) || !highlighted.current) return;
    event.preventDefault();
    store.toggleFavorite(highlighted.current.model);
  };

  return (
    <Combobox.Root
      inline
      open
      autoHighlight
      items={items}
      filter={null}
      value={current}
      onValueChange={choose}
      inputValue={query}
      onInputValueChange={(value, details) => {
        if (details.reason === 'input-change' || details.reason === 'input-clear') setQuery(value);
      }}
      onItemHighlighted={(item) => (highlighted.current = item)}
      itemToStringLabel={(item: PickerItem) => item.label.model}
      isItemEqualToValue={(item: PickerItem, value: PickerItem) => sameModel(item.model, value.model)}
    >
      <Header title="Choose model">
        <Button variant="ghost" size="sm" onClick={onManage}>
          <Icon name="sliders" />
          Manage
        </Button>
      </Header>
      <div className="shrink-0 px-3 pb-2">
        <Combobox.Input
          ref={searchRef}
          aria-label="Search models"
          placeholder="Search models"
          onKeyDown={onKeyDown}
          render={<Input />}
        />
      </div>
      <Combobox.Empty className="px-3 text-center text-sm text-text-tertiary empty:hidden">
        {searching ? 'No models match your search.' : 'No models to show. Use Manage to show more.'}
      </Combobox.Empty>
      <Combobox.List aria-label="Models" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
        {shown.map(({ group, items: rows }, groupIndex) => (
          <Combobox.Group key={group.id} className="pb-1">
            <GroupLabel
              group={group}
              expanded={expanded(group)}
              disabled={searching}
              onToggle={() => setCollapsed((value) => ({ ...value, [group.id]: !value[group.id] }))}
            />
            {rows.map((item, index) => (
              <ModelRow
                key={`${group.id}:${modelKey(item.model)}`}
                index={offsets[groupIndex]! + index}
                item={item}
                showProvider={!group.provider}
                onFavorite={() => store.toggleFavorite(item.model)}
              />
            ))}
          </Combobox.Group>
        ))}
      </Combobox.List>
      <p className="shrink-0 border-t border-border-secondary-transparent px-4 py-1.5 text-xs text-text-tertiary">
        ↑↓ move · Enter choose · Ctrl+F favorite
      </p>
    </Combobox.Root>
  );
}

/**
 * The group's heading names the group (Base UI hides it from the tree and points the group at it);
 * a provider's heading has its own button to collapse its models.
 */
function GroupLabel({
  group,
  expanded,
  disabled,
  onToggle,
}: {
  group: PickerGroup;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-1 pr-1">
      <Combobox.GroupLabel className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-xs font-medium text-text-tertiary">
        {group.title}
      </Combobox.GroupLabel>
      {group.provider && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.title}`}
          aria-expanded={expanded}
          disabled={disabled}
          onClick={onToggle}
        >
          <Icon name={expanded ? 'chevron-down' : 'arrow-right'} />
        </Button>
      )}
    </div>
  );
}

function ModelRow({
  index,
  item,
  showProvider,
  onFavorite,
}: {
  index: number;
  item: PickerItem;
  showProvider: boolean;
  onFavorite: () => void;
}) {
  const { model, label } = item;
  return (
    <Combobox.Item
      index={index}
      value={item}
      aria-current={item.current || undefined}
      className="flex h-9 cursor-pointer items-center gap-1 rounded-2xl pr-1 pl-2.5 text-sm data-highlighted:bg-background-tertiary-transparent"
    >
      <Tooltip label={details(model, label)} side="bottom">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {showProvider && label.provider && <span className="truncate text-text-tertiary">{label.provider} /</span>}
          <bdi className="truncate">{label.model}</bdi>
          {model.free && <span className="text-xs text-text-tertiary">Free</span>}
        </span>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={item.favorite ? `Remove ${label.model} from favorites` : `Add ${label.model} to favorites`}
        aria-pressed={item.favorite}
        onClick={(event) => {
          // The star is not a choice of the model.
          event.stopPropagation();
          onFavorite();
        }}
      >
        <Icon name="star" className={item.favorite ? '[&_path]:fill-current' : undefined} />
      </Button>
      <Combobox.ItemIndicator render={<span className="flex size-7 items-center justify-center" />} keepMounted>
        {item.current && <Icon name="check" aria-hidden={false} aria-label="Current model" />}
      </Combobox.ItemIndicator>
    </Combobox.Item>
  );
}

// ─── Manage view ────────────────────────────────────────────────────────────

/** Each switch is labelled by its enclosing `<label>` (Base UI's switch renders a span for it). */
function ManageView({
  store,
  state,
  searchRef,
  onBack,
}: {
  store: ModelStore;
  state: ModelState;
  searchRef: RefObject<HTMLInputElement | null>;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => manageGroups(state, query), [state, query]);
  const providerModels = (id: string) => state.catalog?.providers.find((p) => p.id === id)?.models ?? [];
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 pl-2">
        <Button variant="ghost" size="icon-sm" aria-label="Back to models" onClick={onBack}>
          <Icon name="arrow-left" />
        </Button>
        <div className="min-w-0 flex-1">
          <Header title="Manage models" />
        </div>
      </div>
      <div className="shrink-0 px-3 pb-2">
        <Input
          ref={searchRef}
          type="search"
          aria-label="Search all models"
          placeholder="Search all models"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
        {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-text-tertiary">No models match your search.</p>}
        {groups.map((group) => (
          <section key={group.id} aria-label={group.title} className="pb-2">
            <label className="flex h-8 items-center gap-2 px-2.5 text-xs font-medium text-text-secondary">
              <span className="min-w-0 flex-1 truncate">{group.title}</span>
              <Switch checked={group.visible} onCheckedChange={(checked) => store.setVisibility(providerModels(group.id), checked)} />
            </label>
            {group.items.map(({ model, label, visible }) => (
              <label key={modelKey(model)} className="flex h-8 items-center gap-2 px-2.5 text-sm">
                <bdi className="min-w-0 flex-1 truncate">{label.model}</bdi>
                <Switch checked={visible} onCheckedChange={(checked) => store.setVisibility([model], checked)} />
              </label>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
