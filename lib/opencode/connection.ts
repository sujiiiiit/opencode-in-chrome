import { browser } from 'wxt/browser';
import { normalizeBaseUrl } from './link';

export const CONNECTION_KEY = 'opencode.connection';

export type Connection = {
  baseUrl: string;
  /** Secret: `<expiresUnixSeconds>.<base64url sig>`. Never log or put in a URL. */
  token: string;
  expiresAt: number;
  serverVersion: string;
  pairedAt: number;
};

const TOKEN_RE = /^\d+\.[A-Za-z0-9_-]+$/;

export function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

/** Expiry in ms, taken from the number before the dot. */
export function tokenExpiry(token: string): number {
  return Number(token.split('.')[0]) * 1000;
}

export function authHeader(token: string): string {
  return 'Basic ' + btoa('opencode:' + token);
}

function isNumberPair(v: Record<string, unknown>): v is Record<string, unknown> & { expiresAt: number; pairedAt: number } {
  return typeof v.expiresAt === 'number' && typeof v.pairedAt === 'number';
}

function parseConnection(value: unknown): Connection | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.baseUrl !== 'string' || !isValidToken(v.token) || !isNumberPair(v)) return null;
  const base = normalizeBaseUrl(v.baseUrl);
  if (!base.ok || base.baseUrl !== v.baseUrl) return null;
  return {
    baseUrl: base.baseUrl,
    token: v.token,
    expiresAt: v.expiresAt,
    serverVersion: typeof v.serverVersion === 'string' ? v.serverVersion : '',
    pairedAt: v.pairedAt,
  };
}

// Always storage.local: storage.sync would upload the secret to the Google account.
export async function loadConnection(): Promise<Connection | null> {
  const stored = await browser.storage.local.get(CONNECTION_KEY);
  return parseConnection(stored[CONNECTION_KEY]);
}

export async function saveConnection(connection: Connection): Promise<void> {
  await browser.storage.local.set({ [CONNECTION_KEY]: connection });
}

export async function clearConnection(): Promise<void> {
  await browser.storage.local.remove(CONNECTION_KEY);
}
