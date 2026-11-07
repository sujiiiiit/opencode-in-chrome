import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, Tick2Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsContentWrapper } from '@/components/ui/tabs';
import { matchesSearch, modelKey } from '@/lib/opencode/models/catalog';
import { pickerGroups, type PickerItem } from '@/lib/opencode/models/controls';
import { defaultVisible } from '@/lib/opencode/models/catalog';
import { isVisible } from '@/lib/opencode/models/preferences';
import { buildControls } from '@/lib/opencode/models/controls';
import { DEFAULT_VARIANT } from '@/lib/opencode/models/variant';
import type { ModelState, ModelStore } from '@/lib/opencode/models/model-store';
import { MorphText } from '../flow/morph-text';
import { hasLogo, ProviderLogo } from './provider-logo';

type Props = {
  store: ModelStore;
  state: ModelState;
  onClose: () => void;
};

export function ModelPicker({ store, state, onClose }: Props) {
  return (
      <DropdownMenuContent side="top" align="start"
        data-slot="model-picker" aria-label="Choose model" style={{ animation: 'none' }} className="w-[min(22rem,calc(100vw-1rem))] max-w-none select-none overflow-hidden rounded-xl p-0 transition-[opacity,transform] duration-200 ease-out data-starting-style:opacity-0 data-starting-style:[transform:scale(0.96)] data-ending-style:opacity-0 data-ending-style:[transform:scale(0.96)] motion-reduce:transition-none">
        <PickerContent store={store} state={state} onClose={onClose} />
      </DropdownMenuContent>
  );
}

function PickerContent({ store, state, onClose }: { store: ModelStore; state: ModelState; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('');
  const baseGroups = useMemo(() => {
    const defaults = defaultVisible(state.catalog);
    const all = pickerGroups(state, '').flatMap((group) => group.items)
      .filter((item) => isVisible(state.prefs, defaults, item.model));
    const unique = new Map(all.map((item) => [modelKey(item.model), item]));
    const providers = new Map<string, PickerItem[]>();
    for (const item of unique.values()) {
      const rows = providers.get(item.model.providerID) ?? [];
      rows.push(item);
      providers.set(item.model.providerID, rows);
    }
    const keyed = (keys: typeof state.prefs.favorite) => keys.flatMap((key) => {
      const item = unique.get(modelKey(key));
      return item ? [item] : [];
    });
    return [
      { id: 'recent', title: 'Recent', items: keyed(state.prefs.recent) },
      { id: 'favorite', title: 'Favorites', items: keyed(state.prefs.favorite) },
      ...(state.catalog?.providers ?? []).flatMap((provider) => {
        const rows = providers.get(provider.id) ?? [];
        return rows.length ? [{ id: provider.id, title: provider.name, items: rows }] : [];
      }),
    ];
  }, [state]);
  const groups = useMemo(() => {
    const text = query.trim();
    if (!text) return baseGroups;
    const items = baseGroups.filter((group) => group.id !== 'favorite' && group.id !== 'recent')
      .flatMap((group) => group.items.filter((item) => matchesSearch(text, [item.model.name, item.model.modelID, item.label.provider ?? ''])));
    return [...baseGroups, { id: 'search', title: 'Search results', items }];
  }, [baseGroups, query]);
  const initial = groups.find((group) => group.id !== 'favorite' && group.id !== 'recent' && group.items.some((item) => item.current))?.id ?? 'favorite';
  const active = query.trim() ? 'search' : groups.some((group) => group.id === tab) ? tab : initial;

  return (
    <Tabs defaultValue="favorite" value={active} onValueChange={setTab} className="gap-0">
      <div className="flex h-80 max-h-[min(20rem,calc(100vh-5rem))] min-h-0">
        <ScrollArea className="h-full w-12 shrink-0 border-r border-border">
        <nav aria-label="Model categories" className="flex flex-col items-center gap-1 py-2">
          {groups.filter((group) => group.id !== 'search').map((group) => {
            const provider = state.catalog?.providers.find((entry) => entry.id === group.id);
            return <Button key={group.id} type="button" variant="ghost" size="icon-lg" aria-label={group.title} title={group.title}
              aria-pressed={active === group.id} onClick={() => { setQuery(''); setTab(group.id); }}
              className={active === group.id ? 'bg-background-tertiary-transparent text-text-primary transition-none' : 'text-text-secondary transition-none'}>
              {group.id === 'favorite' ? <Icon name="star" /> : group.id === 'recent' ? <Icon name="history" /> : provider && hasLogo(provider) ? <ProviderLogo provider={provider} /> : <span className="text-xs font-medium">{group.title.slice(0, 2).toUpperCase()}</span>}
            </Button>;
          })}
        </nav>
        </ScrollArea>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="p-2">
            <Input autoFocus aria-label="Search models" placeholder="Search models" className="h-8 select-text px-2.5 text-sm placeholder:text-sm" value={query} onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation(); }} />
          </div>
          <TabsContentWrapper fillHeight direction="vertical" className="min-h-0 flex-1 overflow-hidden">
            {groups.map((group) => <TabsContent key={group.id} value={group.id}>
              {group.id === active && (group.items.length === 0 ? (
                <EmptyState icon={group.id === 'recent' ? 'history' : group.id === 'favorite' ? 'star' : 'search'}
                  title={group.id === 'search' ? 'No matching models' : group.id === 'recent' ? 'No recent models' : 'No favorite models'}
                  className={`h-full justify-center gap-2 px-4 py-4 [&>span]:bg-transparent [&>span]:text-text-tertiary [&>span_svg]:size-7 [&_h3]:text-xs ${group.id === 'favorite' ? '[&>span_svg_path]:fill-current' : ''}`} />
              ) : <ScrollArea fade className="h-full" viewportClassName="overscroll-contain" viewportProps={{ 'aria-label': group.title }}>
                <div className="p-1.5">
                {group.items.map((item) => <ModelRow key={modelKey(item.model)} item={item} store={store} onClose={onClose} />)}
                </div>
              </ScrollArea>)}
            </TabsContent>)}
          </TabsContentWrapper>
          <EffortSlider state={state} store={store} />
        </div>
      </div>
    </Tabs>
  );
}

function ModelRow({ item, store, onClose }: { item: PickerItem; store: ModelStore; onClose: () => void }) {
  const provider = { id: item.model.providerID };
  return <div className="group relative flex items-center rounded-2xl hover:bg-background-tertiary-transparent has-[:focus-visible]:bg-background-tertiary-transparent">
    <button type="button" aria-current={item.current || undefined} className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 px-3 text-left text-sm [--actions-fade-start:5rem] [--actions-fade-end:2.25rem] group-hover:actions-fade group-has-[:focus-visible]:actions-fade [@media(hover:none)]:actions-fade"
      onClick={() => { store.setModel(item.model, { recent: true }); if (item.model.variants.length === 0) onClose(); }}>
      <ProviderLogo provider={provider} />
      <span className="min-w-0 flex-1 truncate">{item.label.model}</span>
      {item.current && <Tick2Icon className="size-4 shrink-0 text-text-secondary group-hover:invisible group-has-[:focus-visible]:invisible [@media(hover:none)]:invisible" />}
    </button>
    <Button type="button" variant="ghost" size="icon-sm" aria-label={`${item.favorite ? 'Remove' : 'Add'} ${item.label.model} ${item.favorite ? 'from' : 'to'} favorites`}
      className="invisible absolute right-1 shrink-0 text-text-secondary transition-none group-hover:visible group-has-[:focus-visible]:visible [@media(hover:none)]:visible"
      aria-pressed={item.favorite} onClick={() => store.toggleFavorite(item.model)}><Icon name="star" className={item.favorite ? 'transition-none [&_path]:fill-current' : 'transition-none'} /></Button>
  </div>;
}

function EffortSlider({ state, store }: { state: ModelState; store: ModelStore }) {
  const { variant, loading } = buildControls(state);
  const { options, current } = variant;
  const index = Math.max(0, options.indexOf(current));
  if (loading || options.length <= 1) return null;
  const position = index / (options.length - 1);
  return (
    <section className="flex shrink-0 items-center gap-3 border-t border-border px-3 py-2.5">
      <span className="flex w-16 shrink-0 justify-center text-sm font-medium capitalize text-text-primary">
        <MorphText id={current} text={current} className="[&_.morph-text]:[--morph-drift:0px]" />
      </span>
      <div className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-background-tertiary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-text-tertiary/60 transition-[width] duration-200 ease-out motion-reduce:transition-none" style={{ width: `calc(${position * 100}% + ${12 - 24 * position}px)` }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 right-3">
          {options.map((option, i) => <span key={option} className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-tertiary" style={{ left: `${i / (options.length - 1) * 100}%` }} />)}
          <span className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background shadow-sm transition-[left] duration-200 ease-out motion-reduce:transition-none" style={{ left: `${position * 100}%` }} />
        </div>
        <input type="range" min={0} max={options.length - 1} step={1} value={index} aria-label="Select effort" aria-valuetext={current}
          onChange={(event) => { const value = options[Number(event.target.value)]; if (value) store.setVariant(value === DEFAULT_VARIANT ? undefined : value); }}
          onKeyDown={(event) => { if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation(); }}
          className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </div>
    </section>
  );
}
