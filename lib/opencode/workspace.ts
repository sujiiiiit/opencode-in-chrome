import { browser } from 'wxt/browser';
import type { OpenCodeClient } from './client';

export const WORKSPACE_KEY = 'opencode.workspace';

// Static content only: nothing from the server or the user is interpolated.
export const AGENTS_MD = `# Opencode in Chrome workspace

This folder is the working directory for chats started from the Opencode Chrome extension.
Keep answers concise. Ask before running destructive commands.
`;

/** Built only from the server-reported home plus a fixed suffix. */
export function workspacePath(home: string): string {
  const sep = home.includes('\\') || /^[A-Za-z]:/.test(home) ? '\\' : '/';
  const trimmed = home.replace(/[\\/]+$/, '');
  return [trimmed, '.opencode-chrome', 'workspace'].join(sep);
}

function isStoredWorkspace(value: unknown, baseUrl: string): value is { baseUrl: string; directory: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.baseUrl === baseUrl && typeof v.directory === 'string' && v.directory !== '';
}

/**
 * Makes sure the extension's own workspace folder exists on the server's machine
 * (POST /api/session does not create it) and returns its path.
 */
export async function ensureWorkspace(client: OpenCodeClient, baseUrl: string): Promise<string> {
  const stored = (await browser.storage.local.get(WORKSPACE_KEY))[WORKSPACE_KEY];
  if (isStoredWorkspace(stored, baseUrl)) return stored.directory;

  const location = await client.location.get();
  const home: unknown = location.directory;
  if (typeof home !== 'string' || home === '') throw new Error('The server did not report its home directory.');

  const directory = workspacePath(home);
  const sep = directory.includes('\\') ? '\\' : '/';
  await client.experimental.file.write({
    path: directory + sep + 'AGENTS.md',
    payload: new TextEncoder().encode(AGENTS_MD),
  });
  await browser.storage.local.set({ [WORKSPACE_KEY]: { baseUrl, directory } });
  return directory;
}
