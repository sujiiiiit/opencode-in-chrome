import { browser } from 'wxt/browser';

export const ACTIVE_CHAT_KEY = 'opencode.activeChat';

function isStoredChat(value: unknown, baseUrl: string): value is { baseUrl: string; sessionID: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.baseUrl === baseUrl && typeof v.sessionID === 'string' && v.sessionID !== '';
}

/** The chat the panel showed last for this server, so reopening the panel resumes it. */
export async function loadActiveChat(baseUrl: string): Promise<string | null> {
  const stored = (await browser.storage.local.get(ACTIVE_CHAT_KEY))[ACTIVE_CHAT_KEY];
  return isStoredChat(stored, baseUrl) ? stored.sessionID : null;
}

/** Remembers the open chat; null forgets it (a new chat, or the chat was deleted). */
export async function saveActiveChat(baseUrl: string, sessionID: string | null): Promise<void> {
  if (sessionID) await browser.storage.local.set({ [ACTIVE_CHAT_KEY]: { baseUrl, sessionID } });
  else await browser.storage.local.remove(ACTIVE_CHAT_KEY);
}
