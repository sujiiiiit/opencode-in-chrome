import { describe, expect, it } from 'vitest';
import { replyFromSnapshot, replyText } from '@/lib/opencode/reply';
import { SESSION_ID, USER_MSG_ID, PROVIDER_ERROR } from '@/tests/support/testkit';

const AFTER = 'msg_195d43ea3001';
const assistant = (id: string, content: unknown[]) => ({ id, type: 'assistant', content });
const idle = (id: string, outcome: string, error?: unknown) => ({ id, type: 'idle', outcome, error });
const user = { id: USER_MSG_ID, type: 'user', text: 'hello' };

describe('replyFromSnapshot', () => {
  it('rebuilds a finished reply from messages after our user message', () => {
    const state = replyFromSnapshot(SESSION_ID, USER_MSG_ID, [
      user,
      assistant(AFTER + 'a', [{ type: 'reasoning', text: 'hmm' }, { type: 'tool', id: 't', name: 'read', state: { status: 'completed' } }]),
      assistant(AFTER + 'b', [{ type: 'text', text: 'pong' }]),
      idle(AFTER + 'c', 'succeeded'),
    ]);
    expect(state).not.toBeNull();
    expect(state!.status).toBe('succeeded');
    expect(replyText(state!)).toBe('pong');
    expect(state!.steps).toHaveLength(2);
    expect(state!.steps[0]!.tools).toEqual([{ id: 't', name: 'read' }]);
  });

  it('returns null while the turn has no idle marker yet', () => {
    expect(replyFromSnapshot(SESSION_ID, USER_MSG_ID, [user, assistant(AFTER, [{ type: 'text', text: 'p' }])])).toBeNull();
  });

  it('ignores idle markers from earlier turns', () => {
    const old = idle('msg_0000000000000', 'succeeded');
    expect(replyFromSnapshot(SESSION_ID, USER_MSG_ID, [old, user])).toBeNull();
  });

  it('maps a failed idle marker to the failed status and error', () => {
    const state = replyFromSnapshot(SESSION_ID, USER_MSG_ID, [user, idle(AFTER, 'failed', PROVIDER_ERROR)]);
    expect(state).toMatchObject({ status: 'failed', error: { message: PROVIDER_ERROR.message } });
  });

  it('tolerates garbage entries', () => {
    expect(replyFromSnapshot(SESSION_ID, USER_MSG_ID, [null, 5, { type: 1 }, idle(AFTER, 'succeeded')])!.status).toBe('succeeded');
    expect(replyFromSnapshot(SESSION_ID, USER_MSG_ID, 'nope' as unknown as unknown[])).toBeNull();
  });
});
