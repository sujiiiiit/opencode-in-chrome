import { describe, expect, it, vi } from 'vitest';
import { createMessageID } from '@/lib/opencode/ids';

describe('createMessageID', () => {
  it('has the server message-ID shape: msg_ + 12 hex time chars + 14 base62 chars', () => {
    expect(createMessageID()).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/);
  });

  it('sorts ascending, also for IDs minted in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const ids = Array.from({ length: 5 }, () => createMessageID());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(5);
  });

  it('sorts IDs from a later millisecond after earlier ones', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_700_000_000_000);
    const first = createMessageID();
    now.mockReturnValue(1_700_000_000_001);
    expect(createMessageID() > first).toBe(true);
  });
});
