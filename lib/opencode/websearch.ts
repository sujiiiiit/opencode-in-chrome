// Which search backend the extension's chats use. The server picks one by itself: a Console
// workspace with hosted search enabled pins its paid "opencode" provider, which answers HTTP 402
// when the workspace has no balance. A `websearch` entry in the extension workspace's own
// opencode.jsonc is read after that default, so the user's choice wins.
import { browser } from 'wxt/browser';
import type { OpenCodeClient } from './client';
import { isRecord } from './reply';

export const WEBSEARCH_KEY = 'opencode.websearch';

/** `server`: leave the server's own default alone. */
export type WebSearchChoice = 'server' | 'random' | 'off' | { provider: string };

export type SearchProvider = { id: string; name: string };

const CONFIG_FILE = 'opencode.jsonc';

export function parseChoice(value: unknown): WebSearchChoice {
  if (value === 'random' || value === 'off') return value;
  if (isRecord(value) && typeof value.provider === 'string' && value.provider) return { provider: value.provider };
  return 'server';
}

/** The workspace config that expresses a choice; `server` writes nothing but an empty config. */
export function configFor(choice: WebSearchChoice): string {
  const websearch =
    choice === 'off' ? false : choice === 'random' ? { provider: 'random' } : choice === 'server' ? undefined : choice;
  return JSON.stringify({ $schema: 'https://opencode.ai/config.json', ...(websearch === undefined ? {} : { websearch }) }, null, 2) + '\n';
}

export async function loadChoice(): Promise<WebSearchChoice> {
  const stored = await browser.storage.local.get(WEBSEARCH_KEY);
  return parseChoice(stored[WEBSEARCH_KEY]);
}

/** The search providers this server offers for the workspace, by name. */
export async function listProviders(client: OpenCodeClient, directory: string, signal?: AbortSignal): Promise<SearchProvider[]> {
  const result: unknown = await client.websearch.providers({ location: { directory } }, { signal });
  const data = isRecord(result) && Array.isArray(result.data) ? result.data : [];
  return data.flatMap((item) =>
    isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string' ? [{ id: item.id, name: item.name }] : [],
  );
}

/** Saves the choice and writes it into the workspace config, where the server picks it up. */
export async function applyChoice(client: OpenCodeClient, directory: string, choice: WebSearchChoice): Promise<void> {
  const sep = directory.includes('\\') ? '\\' : '/';
  await client.experimental.file.write({
    path: directory + sep + CONFIG_FILE,
    payload: new TextEncoder().encode(configFor(choice)),
  });
  await browser.storage.local.set({ [WEBSEARCH_KEY]: choice });
}
