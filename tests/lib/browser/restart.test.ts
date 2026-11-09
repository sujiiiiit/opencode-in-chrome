import { describe, expect, it } from 'vitest';
import { Completion } from '@/lib/browser/completion';
import { Policy, type ApprovalRequest, type PolicySettings } from '@/lib/browser/policy';
import { SessionSets } from '@/lib/browser/session-sets';
import { memoryStore } from '../../support/fake-chrome';

// V5: what a session approved, read and left unverified survives a service-worker restart.
describe('state across a worker restart', () => {
  it('SessionSets reloads what an earlier worker stored, merged with new additions', async () => {
    const store = memoryStore<Record<string, Record<string, string[]>>>();
    const first = new SessionSets<'allowed'>(store);
    await first.ready;
    first.add('allowed', 'ses_1', ['shop.test']);
    await Promise.resolve();
    const second = new SessionSets<'allowed'>(store);
    second.add('allowed', 'ses_1', ['mail.test']);
    await second.ready;
    expect(second.values('allowed', 'ses_1')).toEqual(['mail.test', 'shop.test']);
  });

  it('a restarted policy does not ask again for a site allowed once', async () => {
    const sessionState = memoryStore<Record<string, Record<string, string[]>>>();
    const asked: ApprovalRequest[] = [];
    const make = () => new Policy({
      store: memoryStore<PolicySettings>(),
      permissionMode: async () => 'manual',
      approve: async (r) => (asked.push(r), 'once'),
      currentUrl: async () => 'https://shop.test/',
      sessionState,
    });
    await make().siteGate('ses_1', 'https://shop.test/', 'read_page');
    await make().siteGate('ses_1', 'https://shop.test/', 'read_page');
    expect(asked).toHaveLength(1);
  });

  it('a restarted completion tracker still refuses success for an unverified action', async () => {
    const store = memoryStore<Record<string, Array<{ tabId: number; label: string }>>>();
    const before = new Completion(store);
    before.recordResult('ses_1', 'computer', { action: 'left_click', ref: 'e4', action_summary: 'Places the order' }, { text: [], tabId: 3, effect: 'none' });
    await Promise.resolve();
    const after = new Completion(store);
    await Promise.resolve();
    expect(after.finish('ses_1', 'success')).toEqual({ accepted: false, open: ['left_click [e4] "Places the order" on tab 3'] });
  });
});
