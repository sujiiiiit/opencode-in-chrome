import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { filterByTitle, normalizeSearch, type HistoryState, type HistoryStore } from '@/lib/opencode/history';
import { groupByDay, type ChatSummary } from '@/lib/opencode/sessions';
import { Notice } from '../notice';
import { HistoryRow } from './history-row';

const SEARCH_DEBOUNCE_MS = 250;
/** The list trails the panel's slide by a couple of steps; the header and search arrive with it. */
const LIST_WAVE = 2;
/** Later groups never wait longer than this many steps (~350ms), so the list is quick to settle. */
const MAX_WAVE = 10;
/** The longest entrance: the last step's delay plus the rise (see `animate-wave-in`). */
const WAVE_SETTLE_MS = MAX_WAVE * 35 + 460;
/** Placeholder rows wait this many steps (~250ms), so a quick first load never flashes them. */
const SKELETON_WAVE = 7;
/** Row times are a minute apart at the finest, so rows re-render once a minute for them. */
const CLOCK_MS = 60_000;

/** Places an element in History's entrance wave (see `animate-wave-in` in global.css). */
const wave = (step: number) => ({ '--wave': Math.min(step, MAX_WAVE) }) as CSSProperties;

/** Each day's label, then its chats one by one, continuing the wave from group to group. */
function groupWaves(sizes: number[]): number[] {
  let step = LIST_WAVE;
  return sizes.map((size) => {
    const start = step;
    step += Math.min(size, 6) + 1;
    return start;
  });
}

type Props = {
  store: HistoryStore | null;
  state: HistoryState;
  activeID: string | null;
  onBack: () => void;
  onOpen: (sessionID: string) => void;
  onNewChat: () => void;
  /** Runs before the chat is deleted (the panel leaves it if it is open). */
  onDelete: (sessionID: string) => void;
};

function Message({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div
      className="flex animate-wave-in flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground"
      style={wave(LIST_WAVE)}
    >
      <p>{children}</p>
      {action}
    </div>
  );
}

function Skeleton() {
  return (
    <ul aria-label="Loading chats" className="flex wave-children flex-col gap-2 px-3 py-2" style={wave(SKELETON_WAVE)}>
      {[0, 1, 2, 3].map((n) => (
        <li key={n} className="h-8 animate-pulse rounded-2xl bg-muted" />
      ))}
    </ul>
  );
}

/** The time, refreshed once a minute, so rows keep the same props between ticks. */
function useMinuteClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

type ListProps = {
  items: ChatSummary[];
  hasMore: boolean;
  loadingMore: boolean;
  activeID: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMore: () => void;
};

/** Rows are memoized and keyed by id: a search or a live update re-renders only the rows it changes. */
const List = memo(function List({ items, hasMore, loadingMore, activeID, onOpen, onRename, onDelete, onMore }: ListProps) {
  const now = useMinuteClock();
  const groups = useMemo(() => groupByDay(items, now), [items, now]);
  const waves = groupWaves(groups.map((group) => group.items.length));
  return (
    <div className="flex flex-col gap-3 px-3 pb-3">
      {groups.map((group, index) => (
        <section key={group.label} aria-label={group.label}>
          <h2
            className="sticky top-0 z-10 animate-wave-in bg-background px-3 py-1 text-xs font-medium text-text-tertiary select-none"
            style={wave(waves[index]!)}
          >
            {group.label}
          </h2>
          <ul className="flex wave-children flex-col gap-0.5" style={wave(waves[index]!)}>
            {group.items.map((chat) => (
              <HistoryRow
                key={chat.id}
                chat={chat}
                now={now}
                active={chat.id === activeID}
                onOpen={onOpen}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="animate-wave-in self-center"
          style={wave(MAX_WAVE)}
          disabled={loadingMore}
          onClick={onMore}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  );
});

type BodyProps = {
  store: HistoryStore | null;
  state: HistoryState;
  /** The rows to show: the store's rows, filtered by what is typed now. */
  items: ChatSummary[];
  query: string;
  activeID: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

/** The list, or why there is none: loading, failed, empty, or no search results. */
function HistoryBody({ store, state, items, query, activeID, onOpen, onDelete }: BodyProps) {
  const onRename = useCallback((id: string, title: string) => void store?.rename(id, title), [store]);
  const onMore = useCallback(() => void store?.loadMore(), [store]);
  if (state.status === 'failed') {
    const retry = (
      <Button variant="outline" size="sm" onClick={() => void store?.load(query)}>
        Retry
      </Button>
    );
    return <Message action={retry}>{state.error ?? 'Could not load your chats.'}</Message>;
  }
  if (items.length === 0) {
    // A search keeps its answer up while the next one loads; only the first load shows placeholders.
    const searching = query.trim() !== '';
    if (!searching && state.status !== 'ready') return <Skeleton />;
    return <Message>{searching ? 'No chats match your search.' : 'No chats yet.'}</Message>;
  }
  return (
    <List
      items={items}
      hasMore={state.hasMore}
      loadingMore={state.loadingMore}
      activeID={activeID}
      onOpen={onOpen}
      onRename={onRename}
      onDelete={onDelete}
      onMore={onMore}
    />
  );
}

type SearchFieldProps = {
  value: string;
  /** A server search is running: a spinner fades in if it takes a moment. */
  busy: boolean;
  onChange: (value: string) => void;
};

function SearchField({ value, busy, onChange }: SearchFieldProps) {
  return (
    <div className="mx-auto w-full max-w-chat shrink-0 px-3 pb-4">
      {/* The icons center on the input itself, not on the padded wrapper. */}
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search chats"
          placeholder="Search chats"
          className="pr-9 pl-9 text-sm [&::-webkit-search-cancel-button]:hidden"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Icon
          name="loader"
          className={cn(
            'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-muted-foreground transition-opacity',
            busy ? 'opacity-100 delay-150 duration-200' : 'opacity-0 duration-100',
          )}
        />
      </div>
    </div>
  );
}

/**
 * The rows on screen already answer `query` exactly: every chat is loaded for a search that
 * `query` only narrows, so filtering them locally gives the server's answer.
 */
function answeredLocally(loaded: Pick<HistoryState, 'status' | 'hasMore' | 'search'>, query: string): boolean {
  return loaded.status === 'ready' && !loaded.hasMore && normalizeSearch(query).includes(normalizeSearch(loaded.search));
}

/**
 * The extension's chats: search, grouped by day, open, rename and delete. Typing filters the
 * loaded rows at once; the server is asked (once typing pauses) only for chats not loaded yet.
 */
export const HistoryView = memo(function HistoryView({
  store,
  state,
  activeID,
  onBack,
  onOpen,
  onNewChat,
  onDelete,
}: Props) {
  const [query, setQuery] = useState(state.search);
  // Typing stays responsive however long the list is: the filter may trail a keystroke.
  const deferred = useDeferredValue(query);
  const items = useMemo(() => filterByTitle(state.items, deferred), [state.items, deferred]);
  // The entrance wave plays once, as the list first shows; rows a search or a page adds just appear.
  const [settled, setSettled] = useState(false);
  const shown = state.status === 'ready' || state.status === 'failed';

  // Search on the server once typing pauses, unless the loaded rows already answer it. Only these
  // fields restart the pause: live updates to the rows do not.
  const { status, hasMore, search } = state;
  useEffect(() => {
    if (!store || query.trim() === search.trim() || answeredLocally({ status, hasMore, search }, query)) return;
    const timer = setTimeout(() => void store.load(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [store, query, status, hasMore, search]);

  useEffect(() => {
    if (!shown || settled) return;
    const timer = setTimeout(() => setSettled(true), WAVE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [shown, settled]);

  // The row asked for confirmation already: leave the chat if it is open, then delete it.
  const deleteChat = useCallback(
    (id: string) => {
      onDelete(id);
      void store?.remove(id);
    },
    [onDelete, store],
  );

  return (
    <div
      data-settled={settled || undefined}
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onBack();
      }}
    >
      <header className="mx-auto flex w-full max-w-chat shrink-0 items-center gap-1 px-3 py-1.5">
        <Button variant="ghost" size="icon-lg" aria-label="Back to chat" title="Back to chat" onClick={onBack}>
          <Icon name="arrow-left" />
        </Button>
        <h1 className="flex-1 text-sm font-medium select-none">History</h1>
        <Button variant="ghost" size="icon-lg" aria-label="New chat" title="New chat" onClick={onNewChat}>
          <Icon name="new-chat" />
        </Button>
      </header>
      <SearchField value={query} busy={state.status === 'loading' && query.trim() !== ''} onChange={setQuery} />
      {state.notice && (
        <div className="mx-auto w-full max-w-chat">
          <Notice text={state.notice} onDismiss={() => store?.dismissNotice()} />
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-chat">
          <HistoryBody
            store={store}
            state={state}
            items={items}
            query={query}
            activeID={activeID}
            onOpen={onOpen}
            onDelete={deleteChat}
          />
        </div>
      </ScrollArea>
    </div>
  );
});
