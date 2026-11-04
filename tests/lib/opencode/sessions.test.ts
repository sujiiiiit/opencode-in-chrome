import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@/lib/opencode/sse';
import {
  displayTitle,
  groupByDay,
  isExtensionSession,
  isUntitled,
  reduceSessions,
  relativeTime,
  toSummary,
  type ChatSummary,
} from '@/lib/opencode/sessions';
import { WORKSPACE_WIN } from '@/tests/support/testkit';

const ours = { location: { directory: WORKSPACE_WIN }, metadata: { source: 'chrome-extension' } };
const row = (id: string, updated: number, title: string | null = id): ChatSummary => ({
  id,
  title,
  created: updated,
  updated,
});
const ev = (type: string, data: Record<string, unknown>, created = 5000): ServerEvent => ({ type, created, data });

describe('isExtensionSession', () => {
  it('accepts a session in the workspace with the extension metadata', () => {
    expect(isExtensionSession({ id: 's', ...ours }, WORKSPACE_WIN)).toBe(true);
  });

  it('rejects a CLI session in another folder', () => {
    expect(isExtensionSession({ ...ours, location: { directory: 'D:\\repo' } }, WORKSPACE_WIN)).toBe(false);
  });

  it('rejects a CLI session started inside the workspace folder (no metadata)', () => {
    expect(isExtensionSession({ location: { directory: WORKSPACE_WIN } }, WORKSPACE_WIN)).toBe(false);
  });

  it('accepts an untagged chat from before the tag by its old fixed title', () => {
    const legacy = { title: 'Chrome chat', location: { directory: WORKSPACE_WIN } };
    expect(isExtensionSession(legacy, WORKSPACE_WIN)).toBe(true);
    expect(isExtensionSession({ ...legacy, title: 'Refactor auth' }, WORKSPACE_WIN)).toBe(false);
    expect(isExtensionSession({ ...legacy, metadata: { source: 'other-tool' } }, WORKSPACE_WIN)).toBe(false);
    expect(isExtensionSession({ ...legacy, location: { directory: 'D:\repo' } }, WORKSPACE_WIN)).toBe(false);
  });

  it('rejects a subagent child session', () => {
    expect(isExtensionSession({ ...ours, parentID: 'ses_parent' }, WORKSPACE_WIN)).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isExtensionSession(null, WORKSPACE_WIN)).toBe(false);
    expect(isExtensionSession('ses', WORKSPACE_WIN)).toBe(false);
  });
});

describe('toSummary', () => {
  it('reads id, title and times', () => {
    expect(toSummary({ id: 's1', title: 'Hi', time: { created: 1, updated: 2 } })).toEqual({
      id: 's1',
      title: 'Hi',
      created: 1,
      updated: 2,
    });
  });

  it('treats a missing or empty title as untitled and skips rows without an id', () => {
    expect(toSummary({ id: 's1', title: '', time: { created: 1 } })).toMatchObject({ title: null, updated: 1 });
    expect(toSummary({ title: 'x' })).toBeNull();
  });
});

describe('reduceSessions', () => {
  const list = [row('a', 300), row('b', 200)];

  it('adds a session the extension created, newest first', () => {
    const next = reduceSessions(
      list,
      ev('session.created', { sessionID: 'c', title: undefined, ...ours }),
      WORKSPACE_WIN,
    );
    expect(next.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(next[0]).toMatchObject({ title: null, updated: 5000 });
  });

  it('ignores sessions created anywhere else (CLI, other folders, children)', () => {
    const cli = ev('session.created', { sessionID: 'x', location: { directory: 'D:\\repo' } });
    const inside = ev('session.created', { sessionID: 'y', location: { directory: WORKSPACE_WIN } });
    const child = ev('session.created', { sessionID: 'z', parentID: 'a', ...ours });
    for (const event of [cli, inside, child]) expect(reduceSessions(list, event, WORKSPACE_WIN)).toBe(list);
  });

  it('renames a listed session, moving it to the top, and ignores renames of others', () => {
    // opencode advances time.updated on a rename, including its generated title.
    expect(reduceSessions(list, ev('session.renamed', { sessionID: 'b', title: 'New' }), WORKSPACE_WIN)).toMatchObject([
      { id: 'b', title: 'New', updated: 5000 },
      { id: 'a' },
    ]);
    expect(reduceSessions(list, ev('session.renamed', { sessionID: 'cli', title: 'x' }), WORKSPACE_WIN)).toBe(list);
  });

  it('removes a deleted or archived session', () => {
    expect(reduceSessions(list, ev('session.deleted', { sessionID: 'a' }), WORKSPACE_WIN).map((r) => r.id)).toEqual([
      'b',
    ]);
    expect(reduceSessions(list, ev('session.archived', { sessionID: 'b' }), WORKSPACE_WIN).map((r) => r.id)).toEqual([
      'a',
    ]);
    expect(reduceSessions(list, ev('session.deleted', { sessionID: 'cli' }), WORKSPACE_WIN)).toBe(list);
  });

  it('moves a session to the top when it starts working', () => {
    const next = reduceSessions(list, ev('session.execution.started', { sessionID: 'b' }), WORKSPACE_WIN);
    expect(next.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('ignores unrelated events', () => {
    expect(reduceSessions(list, ev('session.text.delta', { sessionID: 'a' }), WORKSPACE_WIN)).toBe(list);
    expect(reduceSessions(list, ev('server.connected', {}), WORKSPACE_WIN)).toBe(list);
  });
});

describe('groupByDay', () => {
  const now = new Date(2026, 10, 10, 15, 0).getTime();
  const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).getTime();

  it('groups by local calendar day and leaves empty groups out', () => {
    const groups = groupByDay([row('t', at(10)), row('y', at(9, 23)), row('w', at(4)), row('o', at(3, 23))], now);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Today', ['t']],
      ['Yesterday', ['y']],
      ['Last 7 days', ['w']],
      ['Older', ['o']],
    ]);
    expect(groupByDay([row('t', at(10))], now).map((g) => g.label)).toEqual(['Today']);
  });
});

describe('display helpers', () => {
  it('names an untitled chat', () => {
    expect(displayTitle(null)).toBe('New chat');
    expect(displayTitle('')).toBe('New chat');
    expect(displayTitle('Fix login')).toBe('Fix login');
  });

  it('treats the timestamped placeholder of older opencode releases as untitled', () => {
    expect(isUntitled('New session - 2026-03-01T10:20:30.400Z')).toBe(true);
    expect(isUntitled('Child session - 2026-03-01T10:20:30.400Z')).toBe(true);
    expect(displayTitle('New session - 2026-03-01T10:20:30.400Z')).toBe('New chat');
    expect(isUntitled('New session about login')).toBe(false);
  });

  it('shortens relative times', () => {
    const now = 10 * 86_400_000;
    expect(relativeTime(now - 10_000, now)).toBe('now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h');
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d');
    expect(relativeTime(now - 9 * 86_400_000, now)).not.toMatch(/d$/);
  });
});
