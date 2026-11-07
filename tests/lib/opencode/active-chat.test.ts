import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { loadActiveChat, saveActiveChat } from '@/lib/opencode/active-chat';

beforeEach(async () => {
  await fakeBrowser.storage.local.clear();
  await fakeBrowser.storage.session.clear();
});

describe('tab-specific active chats', () => {
  it('keeps the chats opened from two tabs separate', async () => {
    await saveActiveChat('http://opencode', 'ses_one', 11);
    await saveActiveChat('http://opencode', 'ses_two', 12);
    expect(await loadActiveChat('http://opencode', 11)).toBe('ses_one');
    expect(await loadActiveChat('http://opencode', 12)).toBe('ses_two');
    expect(await loadActiveChat('http://opencode')).toBeNull();
    await saveActiveChat('http://opencode', null, 11);
    expect(await loadActiveChat('http://opencode', 11)).toBeNull();
    expect(await loadActiveChat('http://opencode', 12)).toBe('ses_two');
  });
});
