import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Connection } from '@/lib/opencode/connection';
import type { EventHub } from '@/lib/opencode/events';
import { EMPTY_CATALOG, MentionStore, type MentionState } from '@/lib/opencode/mentions';
import type { MentionSource } from './prompt-box/prompt-box';
import { useLatest } from './use-chat';

const noopSubscribe = () => () => undefined;
const IDLE: MentionState = { phase: 'idle', catalog: EMPTY_CATALOG, directory: null, notice: null };

type Bound = { store: MentionStore; actions: Pick<MentionSource, 'load' | 'findFiles'> };

/**
 * The panel's mention catalog (commands, skills, subagents, references) for the composer's `@` / `/`
 * lists and the + menu's skills. It loads the first time a list or the menu opens.
 */
export function useMentions(connection: Connection, hub: EventHub | null, onUnauthorized: () => void) {
  const [bound, setBound] = useState<Bound | null>(null);
  const unauthorized = useLatest(onUnauthorized);
  useEffect(() => {
    if (!hub) return;
    const store = new MentionStore({ connection, events: hub, onUnauthorized: () => unauthorized.current() });
    setBound({
      store,
      actions: { load: () => void store.load(), findFiles: (query, signal) => store.findFiles(query, signal) },
    });
    return () => store.dispose();
  }, [connection, hub, unauthorized]);
  const store = bound?.store;
  const state = useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getState ?? (() => IDLE));
  const actions = bound?.actions;
  const source = useMemo<MentionSource | undefined>(
    () => actions && { ...actions, catalog: state.catalog, loading: state.phase === 'idle' || state.phase === 'loading' },
    [actions, state.catalog, state.phase],
  );
  return { source, catalog: state.catalog };
}
