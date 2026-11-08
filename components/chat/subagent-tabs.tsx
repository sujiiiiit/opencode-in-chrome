import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsContentWrapper, useTabPanelActive } from '@/components/ui/tabs';

const NavigationContext = createContext<((id: string, title: string) => void) | null>(null);
export const useSubagentNavigation = () => useContext(NavigationContext);

type Child = { id: string; title: string };

/** The chain of child chats open over the root chat, and how to move along it. */
export type SubagentPath = {
  path: Child[];
  /** The open child chat, or null on the root chat. */
  child: string | null;
  open: (id: string, title: string) => void;
  back: () => void;
};

/**
 * Tool rows open child sessions; Escape (outside fields and menus) returns one level. The path
 * resets when the root chat changes.
 */
export function useSubagentPath(rootID: string | null): SubagentPath {
  const [state, setState] = useState<{ root: string | null; path: Child[] }>({ root: rootID, path: [] });
  const path = state.root === rootID ? state.path : [];
  const active = useTabPanelActive();
  const child = path.at(-1)?.id ?? null;
  const open = useCallback((id: string, title: string) => {
    setState((current) => {
      const currentPath = current.root === rootID ? current.path : [];
      if (!id || id === rootID || currentPath.some((item) => item.id === id)) return current;
      return { root: rootID, path: [...currentPath, { id, title }] };
    });
  }, [rootID]);
  const back = useCallback(() => setState((current) => ({ root: rootID, path: current.root === rootID ? current.path.slice(0, -1) : [] })), [rootID]);
  useEffect(() => {
    if (!active || !child) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      event.preventDefault();
      back();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, child, back]);
  return { path, child, open, back };
}

type Props = {
  rootID: string;
  renderChild: (sessionID: string) => ReactNode;
  pendingSessionIDs?: readonly string[];
  /** Controlled navigation (from useSubagentPath), so the caller can follow the open child. */
  nav?: SubagentPath;
  children: ReactNode;
};

function PendingDot({ pending, current }: { pending: readonly string[]; current: string }) {
  if (!pending.some((id) => id !== current)) return null;
  return <span role="status" aria-label="Another chat needs approval" className="size-2 shrink-0 rounded-full bg-primary" />;
}

/**
 * Only the current transcript (and its header) is visible; the child slides over the root chat.
 * Whatever sits after this in the pane (the prompt box) stays put.
 */
export function SubagentTabs({ rootID, renderChild, children, pendingSessionIDs = [], nav }: Props) {
  const own = useSubagentPath(rootID);
  const { path, child, open, back } = nav ?? own;
  const leaf = child ?? rootID;
  const parent = path.at(-2)?.title ?? 'main chat';

  return (
    <NavigationContext.Provider value={open}>
      <Tabs defaultValue={rootID} value={leaf} className="min-h-0 flex-1 gap-0">
        <TabsContentWrapper fillHeight className="min-h-0 flex-1">
          <TabsContent value={rootID}>{children}</TabsContent>
          {leaf !== rootID && <TabsContent value={leaf}>
            <div className="flex h-full min-h-0 flex-col">
              <h1 className="mx-auto w-full max-w-chat shrink-0 px-2 py-1.5">
                <Button variant="ghost" onClick={back} aria-label={`Back to ${parent}: ${path.at(-1)?.title}`}
                  title={path.at(-1)?.title} className="max-w-full justify-start gap-2 px-2 text-left">
                  <Icon name="arrow-left" />
                  <span className="min-w-0 truncate">{path.at(-1)?.title}</span>
                  <PendingDot pending={pendingSessionIDs} current={leaf} />
                </Button>
              </h1>
              {renderChild(leaf)}
            </div>
          </TabsContent>}
        </TabsContentWrapper>
      </Tabs>
    </NavigationContext.Provider>
  );
}
