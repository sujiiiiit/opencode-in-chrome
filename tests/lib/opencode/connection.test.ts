import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CONNECTION_KEY,
  authHeader,
  clearConnection,
  isValidToken,
  loadConnection,
  saveConnection,
  tokenExpiry,
  type Connection,
} from '@/lib/opencode/connection';

const TOKEN = '1796106971.abc_DEF-123';
const conn: Connection = {
  baseUrl: 'http://127.0.0.1:28894',
  token: TOKEN,
  expiresAt: 1796106971000,
  serverVersion: '2.2.5',
  pairedAt: 1,
};

describe('token helpers', () => {
  it('validates the token shape', () => {
    expect(isValidToken(TOKEN)).toBe(true);
    for (const bad of ['', 'abc', '123.', '.abc', '12.a b', '12.a.b', 'x1.abc', '12.abc\n']) {
      expect(isValidToken(bad)).toBe(false);
    }
  });

  it('extracts the expiry in ms', () => {
    expect(tokenExpiry(TOKEN)).toBe(1796106971000);
  });
});

describe('authHeader', () => {
  it('is Basic base64("opencode:" + token)', () => {
    expect(authHeader(TOKEN)).toBe('Basic ' + btoa('opencode:' + TOKEN));
    expect(atob(authHeader(TOKEN).slice(6))).toBe('opencode:' + TOKEN);
  });
});

describe('connection storage', () => {
  it('returns null when nothing is saved', async () => {
    expect(await loadConnection()).toBeNull();
  });

  it('saves and loads, only in storage.local', async () => {
    await saveConnection(conn);
    expect(await loadConnection()).toEqual(conn);
    const local = await fakeBrowser.storage.local.get(CONNECTION_KEY);
    expect(local[CONNECTION_KEY]).toEqual(conn);
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
    expect(await fakeBrowser.storage.session.get(null)).toEqual({});
  });

  it('clears', async () => {
    await saveConnection(conn);
    await clearConnection();
    expect(await loadConnection()).toBeNull();
  });

  it('ignores malformed stored data', async () => {
    await fakeBrowser.storage.local.set({ [CONNECTION_KEY]: { baseUrl: 'http://evil.example', token: 'x' } });
    expect(await loadConnection()).toBeNull();
    await fakeBrowser.storage.local.set({ [CONNECTION_KEY]: { ...conn, baseUrl: 'http://evil.example' } });
    expect(await loadConnection()).toBeNull();
  });
});
