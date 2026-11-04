import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { DurableSelection } from '@/lib/opencode/models/selection';
import type { Connection } from '@/lib/opencode/connection';
import type { EventHub } from '@/lib/opencode/events';
import { buildControls } from '@/lib/opencode/models/controls';
import { INITIAL_MODEL_STATE, ModelStore } from '@/lib/opencode/models/model-store';
import { useLatest } from '../use-chat';

const noopSubscribe = () => () => undefined;

/**
 * The panel runs in build mode only for now: the agent picker is hidden and every send uses
 * "build". The store keeps its agent logic; drop this allowlist to offer every agent again.
 */
const PANEL_AGENTS = ['build'];

/** The panel's ModelStore (catalog, preferences, each chat's selection), loaded on mount. */
export function useModelStore(connection: Connection, hub: EventHub | null, onUnauthorized: () => void) {
  const [store, setStore] = useState<ModelStore | null>(null);
  const unauthorized = useLatest(onUnauthorized);
  useEffect(() => {
    if (!hub) return;
    const models = new ModelStore({
      connection,
      events: hub,
      agents: PANEL_AGENTS,
      onUnauthorized: () => unauthorized.current(),
    });
    setStore(models);
    void models.load();
    return () => models.dispose();
  }, [connection, hub, unauthorized]);
  const state = useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getState ?? (() => INITIAL_MODEL_STATE));
  const controls = useMemo(() => buildControls(state), [state]);
  return { store, state, controls };
}

/** Points the ModelStore at the chat on screen and feeds it the server's agent and model. */
export function useModelSync(store: ModelStore | null, activeID: string | null, durable: DurableSelection | null) {
  useEffect(() => store?.focus(activeID), [store, activeID]);
  useEffect(() => {
    if (store && activeID) store.setDurable(activeID, durable ?? undefined);
  }, [store, activeID, durable]);
}

type ShortcutHandlers = {
  /** Mod+' */
  openPicker: () => void;
  /** Shift+Mod+D */
  cycleVariant: () => void;
  /** Mod+. forward, Shift+Mod+. back; without it those keys are left to the browser. */
  moveAgent?: (direction: 1 | -1) => void;
};

/** Ctrl on Windows and Linux, Cmd on macOS; never both, and never with Alt. */
const isMod = (event: KeyboardEvent) => (event.ctrlKey !== event.metaKey) && !event.altKey;

/** Which model shortcut a keydown is, by physical key (layout and Shift do not change it). */
export function modelShortcut(event: KeyboardEvent): 'picker' | 'variant' | 'agent' | 'agent-back' | null {
  if (!isMod(event) || event.repeat) return null;
  if (event.code === 'Quote' && !event.shiftKey) return 'picker';
  if (event.code === 'KeyD' && event.shiftKey) return 'variant';
  if (event.code === 'Period') return event.shiftKey ? 'agent-back' : 'agent';
  return null;
}

/** The model shortcuts, anywhere in the panel while `enabled` (off while the picker is open). */
export function useModelShortcuts(enabled: boolean, handlers: ShortcutHandlers) {
  const latest = useLatest(handlers);
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = modelShortcut(event);
      const run = latest.current;
      if (!shortcut || (shortcut.startsWith('agent') && !run.moveAgent)) return;
      event.preventDefault();
      if (shortcut === 'picker') run.openPicker();
      else if (shortcut === 'variant') run.cycleVariant();
      else run.moveAgent?.(shortcut === 'agent' ? 1 : -1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, latest]);
}
