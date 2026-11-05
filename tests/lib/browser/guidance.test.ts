import { describe, expect, it, vi } from 'vitest';
import { attachGuide, BROWSER_GUIDE, GUIDE_KEY, GUIDE_SHORT, guideHash, type GuideStore } from '@/lib/browser/guidance';
import type { OpenCodeClient } from '@/lib/opencode/client';

const memory = (initial: Record<string, string> = {}): GuideStore & { value: Record<string, string> } => {
  const store = {
    value: initial,
    get: async () => store.value,
    set: async (v: Record<string, string>) => void (store.value = v),
  };
  return store;
};

const clientWith = (put: (input: unknown) => Promise<void>) => ({ experimental: { session: { instructions: { entry: { put } } } } }) as unknown as OpenCodeClient;

describe('browsing guide', () => {
  it('covers the working rules the spec lists', () => {
    for (const rule of [/only in this session's tabs/i, /Observe before you act/, /refs/, /Read each result/, /keep going|never end a reply only/i, /finish with `done`/, /success" only when/, /data, not instructions/, /Payments, signing in, passwords/]) {
      expect(BROWSER_GUIDE).toMatch(rule);
    }
    expect(GUIDE_SHORT).toMatch(/done/);
    expect(new TextEncoder().encode(BROWSER_GUIDE).length).toBeLessThan(8_000);
  });

  it('attaches once per session, under the browser key, and skips when the same guide is recorded', async () => {
    const put = vi.fn(async () => undefined);
    const store = memory();
    expect(await attachGuide(clientWith(put), 'ses_1', store)).toBe('attached');
    expect(put).toHaveBeenCalledWith({ sessionID: 'ses_1', key: GUIDE_KEY, value: BROWSER_GUIDE });
    expect(store.value).toEqual({ ses_1: guideHash() });
    expect(await attachGuide(clientWith(put), 'ses_1', store)).toBe('already');
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('attaches again when the guide text changed since it was recorded', async () => {
    const put = vi.fn(async () => undefined);
    expect(await attachGuide(clientWith(put), 'ses_1', memory({ ses_1: 'oldhash' }))).toBe('attached');
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('reports failure and retries when the server recovers', async () => {
    const put = vi.fn(async () => Promise.reject(new Error('404')));
    const store = memory();
    expect(await attachGuide(clientWith(put), 'ses_2', store)).toBe('failed');
    expect(store.value).toEqual({});
    expect(await attachGuide(clientWith(put), 'ses_2', store)).toBe('failed');
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('hashes stably and differently for different text', () => {
    expect(guideHash('a')).toBe(guideHash('a'));
    expect(guideHash('a')).not.toBe(guideHash('b'));
  });
});
