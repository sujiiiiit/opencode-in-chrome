import { describe, expect, it } from 'vitest';
import { destinations, unexplained, userMessagesText } from '@/lib/browser/intent';
import { Policy, type ApprovalAnswer, type ApprovalRequest, type GuardCall, type PolicySettings } from '@/lib/browser/policy';
import { codeOf, memoryStore } from '../../support/fake-chrome';

describe('destinations', () => {
  it('finds email addresses and sites, not file names', () => {
    expect(destinations('Send it to Eve@Evil.example and upload to https://drop.attacker.net/x?d=1, see report.pdf and docs.google.com')).toEqual([
      { kind: 'email', value: 'eve@evil.example' },
      { kind: 'site', value: 'attacker.net' },
      { kind: 'site', value: 'google.com' },
    ]);
    expect(destinations('Adds the blue kettle to the cart')).toEqual([]);
  });
});

describe('unexplained', () => {
  const user = 'Reply to pat@example.com saying yes, and check the price on shop.test';
  const check = (text: string, userText = user, inPlay: string[] = []) => unexplained(destinations(text), userText, inPlay).map((d) => d.value);
  it('accepts what the user named and the sites in play', () => {
    expect(check('Sends the reply to PAT@example.com', user, ['mail.test'])).toEqual([]);
    expect(check('Opens https://www.shop.test/item')).toEqual([]);
    expect(check('Submits the form on mail.test', user, ['mail.test'])).toEqual([]);
  });
  it('accepts a site the user named by its name', () => {
    expect(check('https://en.wikipedia.org/wiki/Albert_Einstein', 'Open his Wikipedia page')).toEqual([]);
    expect(check('see github.com/opencode', 'star the repo on GitHub')).toEqual([]);
  });
  it('flags what only the page could have asked for', () => {
    expect(check('Forwards the thread to backup@evil.example', user, ['mail.test'])).toEqual(['backup@evil.example']);
    expect(check('Types https://collect.evil.example/?c=1', user, ['mail.test'])).toEqual(['evil.example']);
  });
});

describe('userMessagesText', () => {
  it('joins only user messages, and is undefined without a server', async () => {
    const client = { message: { list: async () => ({ data: [{ type: 'user', text: 'second' }, { type: 'assistant', text: 'no' }, { type: 'user', text: 'first' }] }) } };
    expect(await userMessagesText(client, 'ses_1')).toBe('second\nfirst');
    expect(await userMessagesText(undefined, 'ses_1')).toBeUndefined();
  });
});

describe('Policy destination check (S5)', () => {
  const setup = (mode: 'manual' | 'auto', answers: ApprovalAnswer[] = []) => {
    const asked: ApprovalRequest[] = [];
    const store = memoryStore<PolicySettings>();
    store.value = { mode: 'act', sites: { 'mail.test': { rule: 'allow' } } };
    const policy = new Policy({
      store,
      permissionMode: async () => mode,
      approve: async (r) => {
        asked.push(r);
        return answers.shift() ?? 'deny';
      },
      currentUrl: async () => 'https://mail.test/inbox',
      userText: async () => 'Reply to pat@example.com saying I can make it',
    });
    return { policy, asked };
  };
  const send = (over: Partial<GuardCall> = {}): GuardCall => ({ sessionID: 'ses_1', tabId: 1, tool: 'computer', action: 'left_click', summary: 'Sends the reply to pat@example.com', target: { label: 'button "Send"', submits: true }, ...over });

  it('lets a consequential action through in auto mode when the user named its recipient', async () => {
    const { policy, asked } = setup('auto');
    expect(await policy.guard(send())).toBe('consequential');
    expect(asked).toEqual([]);
  });

  it('asks, even in auto mode, before typing an address the user never named', async () => {
    const { policy, asked } = setup('auto');
    const typing = send({ action: 'type', text: 'backup@evil.example', summary: 'Types the recipient', target: { label: 'textbox "To"' } });
    expect(await codeOf(policy.guard(typing))).toBe('DENIED');
    expect(asked[0]?.summary).toBe('Types the recipient (sends to backup@evil.example, which your messages did not mention)');
  });

  it('remembers an approved destination for the session', async () => {
    const { policy, asked } = setup('auto', ['once']);
    const fill = send({ tool: 'form_input', action: 'fill', text: 'ops@partner.example', summary: 'Sets the CC field', target: { label: 'textbox "CC"' } });
    expect(await policy.guard(fill)).toBe('mutate');
    expect(await policy.guard(fill)).toBe('mutate');
    expect(asked).toHaveLength(1);
  });

  it('asks once in manual mode, with the warning in the same request', async () => {
    const { policy, asked } = setup('manual', ['once']);
    await policy.guard(send({ summary: 'Forwards the thread to eve@evil.example' }));
    expect(asked.map((r) => r.summary)).toEqual(['Forwards the thread to eve@evil.example (sends to eve@evil.example, which your messages did not mention)']);
  });
});

describe('Policy destination check does not ask in auto mode for ordinary navigation-like clicks', () => {
  it('a consequential click whose summary names another site is not asked about', async () => {
    const store = memoryStore<PolicySettings>();
    const asked: ApprovalRequest[] = [];
    const policy = new Policy({
      store,
      permissionMode: async () => 'auto',
      approve: async (r) => (asked.push(r), 'deny'),
      currentUrl: async () => 'https://books.toscrape.com/',
      userText: async () => 'Find the cheapest travel book and open its author page',
    });
    const click = { sessionID: 'ses_1', tabId: 1, tool: 'computer', action: 'left_click', summary: 'Opens the book author page on goodreads.com', target: { label: 'link "Author"' } };
    expect(await policy.guard(click)).toBe('consequential');
    expect(asked).toEqual([]);
  });
});
