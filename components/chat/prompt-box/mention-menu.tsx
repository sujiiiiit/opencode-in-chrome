import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { cn } from 'cn';
import { itemCn, labelCn } from '@/components/ui/dropdown-menu';
import { Doodle, DOODLE_NAMES, type DoodleName } from '@/components/ui/doodle';
import { Icon, type IconName } from '@/components/ui/icon';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTextColor } from '@/components/ui/use-text-color';
import { filterItems, type MentionCatalog, type MentionItem, type MentionKind } from '@/lib/opencode/mentions';
import { caretWord, insertChip } from './editor-dom';

/** Where the composer's mention lists come from (the panel's MentionStore). */
export type MentionSource = {
  catalog: MentionCatalog;
  /** The catalog is still loading: an open list says so instead of closing. */
  loading: boolean;
  /** Loads the catalog; called the first time a list opens. */
  load: () => void;
  findFiles: (query: string, signal: AbortSignal) => Promise<MentionItem[]>;
};

type TriggerChar = '@' | '/';

/** Positions the list: a live Range over the trigger character, measured only when the popover asks. */
type Anchor = { getBoundingClientRect: () => DOMRect };

/** A typed `@query` or leading `/query` right before the caret, and where it sits. */
type Trigger = { char: TriggerChar; query: string; node: Text; start: number; end: number; anchor: Anchor };

type Group = { key: string; label: string; items: MentionItem[]; agentOrder?: MentionItem[] };

const GROUP_LIMIT = 8;
const FILE_DEBOUNCE_MS = 150;

const MENTION_ICONS: Record<MentionKind, IconName> = {
  command: 'slash',
  skill: 'skill',
  agent: 'agent',
  reference: 'folder',
  file: 'file',
};

/**
 * The trigger at the caret, if any (without its anchor): `@` starting a word (so an email address
 * does not open it) or `/` as the very first character of the draft. Reads only the caret's word.
 */
function readTrigger(editor: HTMLElement): Omit<Trigger, 'anchor'> | null {
  const at = caretWord(editor);
  const char = at?.word[0];
  if (!at || (char !== '@' && char !== '/')) return null;
  const query = at.word.slice(1);
  if (char === '@' ? !at.afterBreak || query.includes('@') : !at.atStart) return null;
  return { char, query, node: at.node, start: at.start, end: at.end };
}

/** A Range over the trigger character; the browser keeps it in place as the text around it changes. */
function anchorAt(node: Text, start: number): Anchor {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + 1);
  return { getBoundingClientRect: () => range.getBoundingClientRect() };
}

const sameSpot = (a: Omit<Trigger, 'anchor'>, b: Omit<Trigger, 'anchor'>) => a.node === b.node && a.start === b.start && a.char === b.char;

/**
 * The next trigger state: the same object when nothing changed (so nothing re-renders), and the same
 * anchor while only the query grows (so the list never jumps or re-measures as you type).
 */
function nextTrigger(current: Trigger | null, next: Omit<Trigger, 'anchor'> | null): Trigger | null {
  if (!next) return null;
  if (!current || !sameSpot(current, next)) return { ...next, anchor: anchorAt(next.node, next.start) };
  return current.query === next.query && current.end === next.end ? current : { ...next, anchor: current.anchor };
}

function groupsFor(trigger: Trigger, catalog: MentionCatalog, files: MentionItem[]): Group[] {
  const pick = (items: MentionItem[]) => filterItems(items, trigger.query, GROUP_LIMIT);
  const groups: Group[] =
    trigger.char === '/'
      ? [
          { key: 'commands', label: 'Commands', items: pick(catalog.commands) },
          { key: 'skills', label: 'Skills', items: pick(catalog.skills) },
        ]
      : [
          { key: 'agents', label: 'Agents', items: pick(catalog.agents), agentOrder: catalog.agents },
          { key: 'skills', label: 'Skills', items: pick(catalog.skills) },
          { key: 'references', label: 'References', items: pick(catalog.references) },
          { key: 'files', label: 'Files', items: files },
        ];
  return groups.filter((group) => group.items.length > 0);
}

type Intent = 1 | -1 | 'pick' | 'close';

const KEY_INTENTS: Partial<Record<string, Intent>> = { ArrowDown: 1, ArrowUp: -1, Enter: 'pick', Tab: 'pick', Escape: 'close' };
/** Emacs-style keys, as in opencode: Ctrl+N / Ctrl+P move, Ctrl+G closes. */
const CTRL_INTENTS: Partial<Record<string, Intent>> = { n: 1, p: -1, g: 'close' };

/** What a key does in an open list: move (+1 / -1), pick, close, or nothing (null). Shift+Enter stays a line break. */
function keyIntent({ key, ctrlKey, shiftKey }: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey'>): Intent | null {
  const intent = (ctrlKey ? CTRL_INTENTS[key.toLowerCase()] : undefined) ?? KEY_INTENTS[key] ?? null;
  return intent === 'pick' && shiftKey ? null : intent;
}

/** The highlighted row: the first one until the user moves, then theirs while it is still listed. */
function useActiveRow(items: MentionItem[], key: string | null) {
  const [activeID, setActiveID] = useState<string | null>(null);
  useEffect(() => setActiveID(null), [key]);
  const active = items.find((item) => item.id === activeID) ?? items[0] ?? null;
  const move = (step: 1 | -1) => {
    if (!items.length) return;
    const index = active ? items.indexOf(active) : -1;
    setActiveID(items[(index + step + items.length) % items.length]!.id);
  };
  return { active, setActiveID, move };
}

/** Swaps the typed trigger (`@que`) for the picked item's chip. */
function replaceTrigger(editor: HTMLElement, trigger: Trigger, item: MentionItem) {
  const range = document.createRange();
  range.setStart(trigger.node, trigger.start);
  range.setEnd(trigger.node, Math.min(trigger.end, trigger.node.length));
  insertChip(editor, { kind: item.kind, name: item.name, label: item.label, path: item.path }, range);
}

/**
 * The trigger at the caret, read again whenever the caret moves: `selectionchange` sees typing,
 * clicks and arrow keys alike; `refresh` covers engines that skip it while typing. Each read
 * looks at one word, and an unchanged trigger keeps its object, so idle typing costs no render.
 */
function useCaretTrigger(editor: RefObject<HTMLDivElement | null>) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const refresh = useCallback(() => {
    const el = editor.current;
    const next = el && document.activeElement === el ? readTrigger(el) : null;
    setTrigger((current) => nextTrigger(current, next));
  }, [editor]);
  useEffect(() => {
    document.addEventListener('selectionchange', refresh);
    return () => document.removeEventListener('selectionchange', refresh);
  }, [refresh]);
  const clear = useCallback(() => setTrigger(null), []);
  return { trigger, refresh, clear };
}

const NO_ITEMS: MentionItem[] = [];
const NO_GROUPS: Group[] = [];
const hintAnchor = (trigger: Trigger | null, open: boolean) => open && trigger?.query === '' ? trigger.anchor : null;

/** Workspace files for an `@` query, searched after a short pause; they belong to `query`. */
function useFileSearch(trigger: Trigger | null, source: MentionSource | undefined) {
  const [found, setFound] = useState<{ query: string; items: MentionItem[] }>({ query: '', items: NO_ITEMS });
  const query = trigger?.char === '@' ? trigger.query : '';
  const findFiles = source?.findFiles;
  useEffect(() => {
    if (!query || !findFiles) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void findFiles(query, controller.signal).then((items) => {
        if (!controller.signal.aborted) setFound({ query, items });
      });
    }, FILE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, findFiles]);
  return found.query === query ? found.items : NO_ITEMS;
}

/** What the list shows; a new object only when one of these changes. */
type MenuView = { open: boolean; char: TriggerChar | null; groups: Group[]; loading: boolean; activeID: string | null; anchor: Anchor | null };

/** The list's callbacks: stable for the editor's whole life, so the rows never re-render for them. */
type MenuActions = { select: (item: MentionItem) => void; setActiveID: (id: string) => void; dismiss: () => void };

/** The list's stable callbacks; they read the latest trigger through a ref. */
function useMenuActions(
  editor: RefObject<HTMLDivElement | null>,
  current: { trigger: Trigger | null; spot: string | null },
  clear: () => void,
  setActiveID: (id: string) => void,
) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  // Escape keeps the list shut while the same trigger is typed on (its query may grow). The trigger
  // going away (its character deleted, the caret moved off it) clears the dismissal.
  useEffect(() => {
    setDismissed((previous) => (previous === current.spot ? previous : null));
  }, [current.spot]);
  const latest = useRef(current);
  latest.current = current;
  const actions = useMemo<MenuActions>(
    () => ({
      select: (item) => {
        const trigger = latest.current.trigger;
        if (!editor.current || !trigger?.node.isConnected) return;
        replaceTrigger(editor.current, trigger, item);
        clear();
      },
      setActiveID,
      dismiss: () => setDismissed(latest.current.spot),
    }),
    [editor, clear, setActiveID],
  );
  return { actions, dismissed };
}

/** The editor's key handler for an open list; true when the key was used (the editor must ignore it). */
function menuKeyHandler(open: boolean, active: MentionItem | null, actions: MenuActions, move: (step: 1 | -1) => void) {
  return (event: KeyboardEvent<HTMLDivElement>): boolean => {
    const intent = open && !event.nativeEvent.isComposing ? keyIntent(event) : null;
    if (intent === null || (intent === 'pick' && !active)) return false;
    event.preventDefault();
    if (intent === 'close') actions.dismiss();
    else if (intent === 'pick') actions.select(active!);
    else move(intent);
    return true;
  };
}

/** A trigger's identity: `spot` is where it was typed (Escape holds for it), `key` adds its query. */
function triggerKeys(trigger: Trigger | null): { key: string | null; spot: string | null } {
  if (!trigger) return { key: null, spot: null };
  const spot = `${trigger.char}${trigger.start}`;
  return { key: `${spot}:${trigger.query}`, spot };
}

/** What the list shows, as one object rebuilt only when a part of it changes. */
function useMenuView(trigger: Trigger | null, groups: Group[], open: boolean, loading: boolean, activeID: string | null): MenuView {
  const anchor = trigger?.anchor ?? null;
  const char = trigger?.char ?? null;
  return useMemo(() => ({ open, char, groups, loading, activeID, anchor }), [open, char, groups, loading, activeID, anchor]);
}

/** The catalog loads the first time a list opens. */
function useLoadOnOpen(opened: boolean, load: (() => void) | undefined) {
  useEffect(() => {
    if (opened) load?.();
  }, [opened, load]);
}

/**
 * The `@` / `/` list, as in opencode's composer: typing `@` (after a space) or a leading `/` opens
 * a list at that spot that filters as you type. Arrow keys move, Enter or Tab picks, Escape closes;
 * a pick swaps the typed trigger for a chip. The editor keeps focus throughout.
 */
export function useMentionMenu(editor: RefObject<HTMLDivElement | null>, source: MentionSource | undefined) {
  const { trigger, refresh, clear } = useCaretTrigger(editor);
  const files = useFileSearch(trigger, source);
  const { key, spot } = triggerKeys(trigger);
  useLoadOnOpen(!!trigger, source?.load);

  const catalog = source?.catalog;
  const groups = useMemo(() => (trigger && catalog ? groupsFor(trigger, catalog, files) : NO_GROUPS), [trigger, catalog, files]);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const { active, setActiveID, move } = useActiveRow(items, key);
  const { actions, dismissed } = useMenuActions(editor, { trigger, spot }, clear, setActiveID);
  const loading = !!source?.loading && items.length === 0;
  // No match closes the list (it stays closed until the query matches something again).
  const open = !!source && !!trigger && spot !== dismissed && (items.length > 0 || loading);

  const view = useMenuView(trigger, groups, open, loading, active?.id ?? null);

  return {
    view,
    actions,
    hintAnchor: hintAnchor(trigger, open),
    onKeyDown: menuKeyHandler(open, active, actions, move),
    /** Re-reads the trigger at the caret (also run on input, for engines without `selectionchange` on typing). */
    refresh,
  };
}

type RowProps = { item: MentionItem; active: boolean; id: string; actions: MenuActions; doodle?: DoodleName };

/** One row. Memoized: moving the highlight re-renders only the row it leaves and the row it enters. */
const MentionRow = memo(function MentionRow({ item, active, id, actions, doodle }: RowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [iconRef, color] = useTextColor<HTMLSpanElement>();
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <div
      ref={ref}
      id={id}
      role="option"
      aria-selected={active}
      data-active={active ? '' : undefined}
      data-slot="mention-item"
      className={cn(itemCn, 'gap-2.5 data-active:bg-accent')}
      // The editor keeps focus (and its caret) while a row is clicked.
      onMouseDown={(event) => event.preventDefault()}
      onPointerMove={(event) => {
        if (!active && (event.movementX || event.movementY)) actions.setActiveID(item.id);
      }}
      onClick={() => actions.select(item)}
    >
      <span ref={iconRef} aria-hidden="true" className="flex size-[15px] shrink-0 items-center justify-center text-text-secondary">
        {doodle ? color && <Doodle name={doodle} size={18} weight={0.2} color={color} /> : <Icon name={MENTION_ICONS[item.kind]} className={cn('size-[15px]', item.kind === 'command' && '-rotate-12')} />}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="max-w-full shrink-0 truncate">{item.name}</span>
        {item.description && <span className="min-w-0 truncate text-xs text-muted-foreground">{item.description}</span>}
      </span>
    </div>
  );
});

/**
 * The list itself: a popover anchored where the trigger was typed, opening above it. It never takes
 * focus, so typing goes on in the editor; rows use the dropdown menu's item styles. Memoized on
 * `view`, so typing that does not change the list never renders it. While it closes it keeps the
 * rows it last showed, so the fade-out does not collapse to an empty box.
 */
export const MentionMenu = memo(function MentionMenu({ view, actions, listID, editor }: { view: MenuView; actions: MenuActions; listID: string; editor: RefObject<HTMLDivElement | null> }) {
  const last = useRef(view);
  if (view.open) last.current = view;
  const shown = view.open ? view : last.current;
  // A press inside the editor only moves the caret: the trigger is read again from there, so it is
  // not a dismissal (that would keep the list shut while the same trigger is typed on).
  const onOpenChange = (next: boolean, details: { event?: Event }) => {
    const target = details.event?.target;
    if (!next && !(target instanceof Node && editor.current?.contains(target))) actions.dismiss();
  };
  return (
    <Popover open={view.open} onOpenChange={onOpenChange}>
      <PopoverContent
        anchor={shown.anchor}
        side="top"
        align="start"
        sideOffset={8}
        alignOffset={-10}
        initialFocus={false}
        finalFocus={false}
        data-slot="mention-menu"
        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <ScrollArea fade className="[--fade-top-max:1.5rem] [--fade-bottom-max:1.5rem]" viewportClassName="max-h-72 overscroll-contain">
          <div id={listID} role="listbox" aria-label={shown.char === '/' ? 'Commands' : 'Mentions'} className="flex flex-col gap-px p-1.5">
            {shown.loading && <div className={labelCn}>Loading…</div>}
            {shown.groups.map((group) => (
              <div key={group.key} role="group" aria-label={group.label} className="flex flex-col gap-px">
                <div className={labelCn} aria-hidden>{group.label}</div>
                {group.items.map((item) => (
                  <MentionRow key={item.id} id={`${listID}-${item.id}`} item={item} active={item.id === shown.activeID} actions={actions}
                    doodle={group.agentOrder && DOODLE_NAMES[group.agentOrder.indexOf(item) % DOODLE_NAMES.length]} />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});

/** ARIA for the editor while its list is open (pointing at the active row). */
export function useMentionAria(view: MenuView) {
  const listID = useId();
  return {
    listID,
    editorProps: {
      'aria-autocomplete': 'list' as const,
      'aria-controls': view.open ? listID : undefined,
      'aria-activedescendant': view.open && view.activeID ? `${listID}-${view.activeID}` : undefined,
    },
  };
}
