import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Connection } from '@/lib/opencode/connection';
import type { EventHub } from '@/lib/opencode/events';
import { GoalStore, type GoalAction, type GoalState } from '@/lib/opencode/goal';
import { useLatest } from './use-chat';

const noopSubscribe = () => () => undefined;
const NONE: GoalState = { goal: null, notice: null };

/** The open session's `/goal` (null while it has none), and its pause / resume / clear. */
export function useGoal(connection: Connection, hub: EventHub | null, sessionID: string | null, onUnauthorized: () => void) {
  const [store, setStore] = useState<GoalStore | null>(null);
  const unauthorized = useLatest(onUnauthorized);
  useEffect(() => {
    if (!hub) return;
    const next = new GoalStore({ connection, events: hub, onUnauthorized: () => unauthorized.current() });
    setStore(next);
    return () => next.dispose();
  }, [connection, hub, unauthorized]);
  useEffect(() => store?.watch(sessionID), [store, sessionID]);
  const state = useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getState ?? (() => NONE));
  const run = useCallback((action: GoalAction) => void store?.run(action), [store]);
  const dismiss = useCallback(() => store?.dismissNotice(), [store]);
  return { goal: state.goal, notice: state.notice, run, dismiss };
}
