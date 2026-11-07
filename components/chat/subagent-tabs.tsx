import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsContentWrapper, useTabPanelActive } from '@/components/ui/tabs';

const NavigationContext = createContext<((id: string, title: string) => void) | null>(null);
export const useSubagentNavigation = () => useContext(NavigationContext);

type Child = { id: string; title: string };
type Props = {
  rootID: string;
  renderChild: (sessionID: string) => ReactNode;
  pendingSessionIDs?: readonly string[];
  children: ReactNode;
};

function PendingDot({ pending, current }: { pending: readonly string[]; current: string }) {
  if (!pending.some((id) => id !== current)) return null;
  return <span role="status" aria-label="Another chat needs approval" className="size-2 shrink-0 rounded-full bg-primary" />;
}

/** Tool rows open child sessions; only the current transcript is visible. */
function SubagentSessions({ rootID, renderChild, children, pendingSessionIDs = [] }: Props) {
  const [path, setPath] = useState<Child[]>([]);
  const active = useTabPanelActive();
  const leaf = path.at(-1)?.id ?? rootID;
  const parent = path.at(-2)?.title ?? 'main chat';
  const openChild = useCallback((id: string, title: string) => {
    setPath((current) => {
      if (!id || id === rootID || current.some((child) => child.id === id)) return current;
      return [...current, { id, title }];
    });
  }, [rootID]);
  const back = useCallback(() => setPath((current) => current.slice(0, -1)), []);
  useEffect(() => {
    if (!active || leaf === rootID) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      event.preventDefault();
      back();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, leaf, rootID, back]);

  return (
    <NavigationContext.Provider value={openChild}>
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

export function SubagentTabs(props: Props) {
  return <SubagentSessions key={props.rootID} {...props} />;
}
