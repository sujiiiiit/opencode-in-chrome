import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { createClient, describeError } from '@/lib/opencode/client';
import type { Connection } from '@/lib/opencode/connection';
import {
  applyChoice,
  listProviders,
  loadChoice,
  type SearchProvider,
  type WebSearchChoice,
} from '@/lib/opencode/websearch';
import { ensureWorkspace } from '@/lib/opencode/workspace';

const toValue = (choice: WebSearchChoice) => (typeof choice === 'string' ? choice : `provider:${choice.provider}`);
const fromValue = (value: string): WebSearchChoice =>
  value.startsWith('provider:') ? { provider: value.slice('provider:'.length) } : (value as WebSearchChoice);

/** The search backend for this panel's chats, chosen from what the server offers. */
function useWebSearch(connection: Connection, onError: (message: string) => void) {
  const client = useMemo(
    () => createClient({ baseUrl: connection.baseUrl, token: connection.token }),
    [connection.baseUrl, connection.token],
  );
  const [choice, setChoice] = useState<WebSearchChoice>('server');
  const [providers, setProviders] = useState<SearchProvider[]>([]);

  useEffect(() => {
    void loadChoice().then(setChoice, () => undefined);
  }, []);

  /** Reads the offered providers (called when the menu opens, so the list is current). */
  const refresh = useCallback(async () => {
    try {
      const directory = await ensureWorkspace(client, connection.baseUrl);
      setProviders(await listProviders(client, directory));
    } catch (error) {
      onError(describeError(error));
    }
  }, [client, connection.baseUrl, onError]);

  const choose = useCallback(
    async (next: WebSearchChoice) => {
      try {
        const directory = await ensureWorkspace(client, connection.baseUrl);
        await applyChoice(client, directory, next);
        setChoice(next);
      } catch (error) {
        onError(describeError(error));
      }
    },
    [client, connection.baseUrl, onError],
  );

  return { choice, providers, refresh, choose };
}

export function WebSearchMenu({ connection, onError }: { connection: Connection; onError: (message: string) => void }) {
  const { choice, providers, refresh, choose } = useWebSearch(connection, onError);
  return (
    <DropdownMenu onOpenChange={(open) => open && void refresh()}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Web search" title="Web search" />}>
        <Icon name="file-search" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Web search</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={toValue(choice)} onValueChange={(value) => void choose(fromValue(value))}>
            <DropdownMenuRadioItem value="server">Server default</DropdownMenuRadioItem>
            {providers.map((provider) => (
              <DropdownMenuRadioItem key={provider.id} value={`provider:${provider.id}`}>
                {provider.name}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuRadioItem value="random">Any available</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="off">Off</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
