import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsContentWrapper } from '@/components/ui/tabs';

const NavigationContext = createContext<((id: string, title: string) => void) | null>(null);
export const useSubagentNavigation = () => useContext(NavigationContext);

type Child = { id: string; title: string };
type Props = {
  rootID: string;
  renderChild: (sessionID: string) => ReactNode;
  children: ReactNode;
};

/** Tool rows open child sessions; only the current transcript is visible. */
function SubagentSessions({ rootID, renderChild, children }: Props) {
  const [path, setPath] = useState<Child[]>([]);
  const leaf = path.at(-1)?.id ?? rootID;
  const parent = path.at(-2)?.title ?? 'main chat';
  const openChild = useCallback((id: string, title: string) => {
    setPath((current) => {
      if (!id || id === rootID || current.some((child) => child.id === id)) return current;
      return [...current, { id, title }];
    });
  }, [rootID]);
  const back = useCallback(() => setPath((current) => current.slice(0, -1)), []);

  return (
    <NavigationContext.Provider value={openChild}>
      <Tabs defaultValue={rootID} value={leaf} className="min-h-0 flex-1 gap-0">
        <TabsContentWrapper fillHeight className="min-h-0 flex-1">
          <TabsContent value={rootID}>{children}</TabsContent>
          {leaf !== rootID && <TabsContent value={leaf}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="mx-auto w-full max-w-chat px-4 py-1">
                <Button variant="quiet" size="xs" onClick={back} aria-label={`Back to ${parent}`}>
                  <Icon name="arrow-left" /> Back to {parent}
                </Button>
              </div>
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
