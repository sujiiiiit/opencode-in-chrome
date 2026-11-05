import { useCallback, useEffect, useMemo, useState } from 'react';
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

/** The search backend for the extension's chats, chosen from what the server offers. */
export function useWebSearch(connection: Connection) {
  const client = useMemo(
    () => createClient({ baseUrl: connection.baseUrl, token: connection.token }),
    [connection.baseUrl, connection.token],
  );
  const [choice, setChoice] = useState<WebSearchChoice>('server');
  const [providers, setProviders] = useState<SearchProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadChoice().then(setChoice, () => undefined);
    void (async () => {
      try {
        const directory = await ensureWorkspace(client, connection.baseUrl);
        setProviders(await listProviders(client, directory));
      } catch (failure) {
        setError(describeError(failure));
      }
    })();
  }, [client, connection.baseUrl]);

  const choose = useCallback(
    async (next: WebSearchChoice) => {
      try {
        const directory = await ensureWorkspace(client, connection.baseUrl);
        await applyChoice(client, directory, next);
        setChoice(next);
        setError(null);
      } catch (failure) {
        setError(describeError(failure));
      }
    },
    [client, connection.baseUrl],
  );

  return { choice, providers, error, choose };
}
