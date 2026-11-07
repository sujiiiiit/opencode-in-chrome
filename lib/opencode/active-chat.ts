import { browser } from 'wxt/browser';

export const ACTIVE_CHAT_KEY = 'opencode.activeChat';
const tabChatKey = (tabId: number) => `${ACTIVE_CHAT_KEY}.tab.${tabId}`;

function isStoredChat(value: unknown, baseUrl: string): value is { baseUrl: string; sessionID: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.baseUrl === baseUrl && typeof v.sessionID === 'string' && v.sessionID !== '';
}

/** The chat the panel showed last for this server, so reopening the panel resumes it. */
export async function loadActiveChat(baseUrl: string, tabId?: number): Promise<string | null> {
  const area = tabId === undefined ? browser.storage.local : browser.storage.session;
  const key = tabId === undefined ? ACTIVE_CHAT_KEY : tabChatKey(tabId);
  const stored = (await area.get(key))[key];
  return isStoredChat(stored, baseUrl) ? stored.sessionID : null;
}

/** Remembers the open chat; null forgets it (a new chat, or the chat was deleted). */
export async function saveActiveChat(baseUrl: string, sessionID: string | null, tabId?: number): Promise<void> {
  const area = tabId === undefined ? browser.storage.local : browser.storage.session;
  const key = tabId === undefined ? ACTIVE_CHAT_KEY : tabChatKey(tabId);
  if (sessionID) await area.set({ [key]: { baseUrl, sessionID } });
  else await area.remove(key);
}
