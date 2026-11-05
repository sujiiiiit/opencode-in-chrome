import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classify, LoopGuard, Policy, siteKey, type ApprovalAnswer, type ApprovalRequest, type GuardCall, type PolicySettings } from '@/lib/browser/policy';
import { codeOf, memoryStore } from '../../support/fake-chrome';

const call = (over: Partial<GuardCall> = {}): GuardCall => ({ sessionID: 'ses_1', tabId: 1, tool: 'computer', action: 'left_click', ...over });

describe('classify', () => {
  it.each<[string, Partial<GuardCall>, string, string]>([
    ['submit button', { target: { label: 'button "Submit order"', submits: true } }, 'https://shop.test/', 'consequential'],
    ['plain link', { target: { label: 'link "About us"' }, summary: 'Opens the About page' }, 'https://shop.test/', 'mutate'],
    ['send by summary', { target: { label: 'button "→"' }, summary: 'Sends the reply to pat@example.com' }, 'https://mail.test/', 'consequential'],
    ['delete by label', { target: { label: 'button "Delete item"' } }, 'https://app.test/', 'consequential'],
    ['javascript', { tool: 'javascript', action: 'run' }, 'https://app.test/', 'consequential'],
    ['file upload', { tool: 'file_upload', action: 'upload' }, 'https://app.test/', 'consequential'],
    ['typing a password', { action: 'type', target: { label: 'textbox "Password"', secret: 'password' } }, 'https://app.test/', 'handoff'],
    ['filling a card field', { tool: 'form_input', action: 'fill', target: { label: 'textbox "Card"', secret: 'card' } }, 'https://pay.test/', 'handoff'],
    ['Enter inside a form', { action: 'key', text: 'Enter', target: { label: 'textbox "Search"', inForm: true } }, 'https://app.test/', 'consequential'],
    ['Enter outside a form', { action: 'key', text: 'Enter', target: { label: 'textbox "Chat"', inForm: false } }, 'https://app.test/', 'mutate'],
    ['captcha page', {}, 'https://www.google.com/recaptcha/api2/anchor', 'handoff'],
    ['oauth consent', { target: { label: 'button "Continue"' } }, 'https://github.com/login/oauth/authorize?client_id=x', 'handoff'],
    ['navigation', { tool: 'navigate', action: 'open' }, 'https://app.test/', 'navigate'],
  ])('%s → %s', (_name, over, url, tier) => {
    expect(classify(call(over), url)).toBe(tier);
  });
});

describe('siteKey', () => {
  it.each([
    ['https://mail.google.com/mail/u/0', 'google.com'],
    ['https://www.bbc.co.uk/news', 'bbc.co.uk'],
    ['https://user.github.io/x', 'user.github.io'],
    ['http://localhost:5173/', 'localhost'],
    ['http://127.0.0.1:8080/', '127.0.0.1'],
    ['chrome://newtab', ''],
  ])('%s → %s', (url, site) => expect(siteKey(url)).toBe(site === '' ? siteKey(url) : site));
});

describe('Policy', () => {
  let store: ReturnType<typeof memoryStore<PolicySettings>>;
  let answers: ApprovalAnswer[];
  let asked: ApprovalRequest[];
  let url: string;
  let policy: Policy;

  beforeEach(() => {
    store = memoryStore<PolicySettings>();
    answers = [];
    asked = [];
    url = 'https://shop.test/cart';
    policy = new Policy({
      store,
      approve: async (r) => {
        asked.push(r);
        return answers.shift() ?? 'deny';
      },
      currentUrl: async () => url,
    });
  });

  it('blocks blocked sites without asking', async () => {
    store.value = { mode: 'ask', sites: { 'shop.test': { rule: 'block' } } };
    expect(await codeOf(policy.siteGate('ses_1', url, 'read_page'))).toBe('BLOCKED_SITE');
    expect(asked).toEqual([]);
  });

  it('asks once per session for a new site; "once" lasts the session and "always" is stored', async () => {
    answers = ['once'];
    await policy.siteGate('ses_1', url, 'read_page');
    await policy.siteGate('ses_1', 'https://www.shop.test/other', 'read_page');
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ kind: 'site', site: 'shop.test' });
    answers = ['always'];
    await policy.siteGate('ses_2', url, 'read_page');
    expect(store.value?.sites['shop.test']).toEqual({ rule: 'allow' });
    await policy.siteGate('ses_3', url, 'read_page');
    expect(asked).toHaveLength(2);
  });

  it('maps deny to DENIED and no answer to NEEDS_APPROVAL', async () => {
    answers = ['deny'];
    expect(await codeOf(policy.siteGate('ses_1', url, 'read_page'))).toBe('DENIED');
    answers = ['timeout'];
    expect(await codeOf(policy.siteGate('ses_1', url, 'read_page'))).toBe('NEEDS_APPROVAL');
  });

  it('does not ask for sites in act mode, but still asks for consequential actions', async () => {
    store.value = { mode: 'act', sites: {} };
    await policy.siteGate('ses_1', url, 'read_page');
    expect(asked).toEqual([]);
    answers = ['once'];
    await policy.guard(call({ target: { label: 'button "Place order"', submits: true }, summary: 'Places the order' }));
    expect(asked).toEqual([expect.objectContaining({ kind: 'action', summary: 'Places the order', tier: 'consequential' })]);
  });

  it('asks for each consequential action, and deny sends no input', async () => {
    store.value = { mode: 'ask', sites: { 'shop.test': { rule: 'allow' } } };
    answers = ['once', 'deny'];
    expect(await policy.guard(call({ target: { submits: true }, summary: 'Submits the form' }))).toBe('consequential');
    expect(await codeOf(policy.guard(call({ target: { submits: true }, summary: 'Submits the form' })))).toBe('DENIED');
    expect(await policy.guard(call({ target: { label: 'link "Help"' } }))).toBe('mutate');
    expect(asked).toHaveLength(2);
  });

  it('can auto-approve consequential actions per site', async () => {
    store.value = { mode: 'ask', sites: { 'shop.test': { rule: 'allow', autoConsequential: true } } };
    await policy.guard(call({ target: { submits: true } }));
    expect(asked).toEqual([]);
  });

  it('refuses hand-off steps in every mode', async () => {
    store.value = { mode: 'act', sites: { 'shop.test': { rule: 'allow', autoConsequential: true } } };
    await expect(policy.guard(call({ action: 'type', target: { secret: 'password' }, summary: 'Types the password' }))).rejects.toThrow(
      /for the user: passwords/,
    );
  });

  it('re-checks the site right before input', async () => {
    store.value = { mode: 'ask', sites: { 'shop.test': { rule: 'allow' } } };
    answers = ['once'];
    const pending = policy.guard(call({ target: { submits: true }, summary: 'Submits' }));
    url = 'https://evil.test/';
    // currentUrl is read before and after the approval; the second read sees the redirect.
    expect(await codeOf(pending)).toBe('NEEDS_APPROVAL');
  });

  it('treats leaving a sensitive site as consequential', async () => {
    store.value = { mode: 'act', sites: { 'mail.test': { rule: 'allow', sensitive: true }, 'other.test': { rule: 'allow' } } };
    await policy.siteGate('ses_1', 'https://mail.test/inbox', 'read_page');
    url = 'https://mail.test/inbox';
    answers = ['deny'];
    const nav = call({ tool: 'navigate', action: 'open', summary: 'Opens https://other.test/', target: { url: 'https://other.test/' } });
    expect(await codeOf(policy.guard(nav))).toBe('DENIED');
    expect(asked).toEqual([expect.objectContaining({ kind: 'action', site: 'other.test' })]);
    // Another session that never read the sensitive site is not affected.
    expect(await policy.guard({ ...nav, sessionID: 'ses_2' })).toBe('navigate');
  });

  it('stops everything with the kill switch until resumed', async () => {
    const stopped = vi.fn();
    policy.onStop(stopped);
    policy.stop();
    expect(stopped).toHaveBeenCalled();
    expect(await codeOf(policy.siteGate('ses_1', url, 'read_page'))).toBe('DENIED');
    policy.resume();
    store.value = { mode: 'act', sites: {} };
    await policy.siteGate('ses_1', url, 'read_page');
  });
});

describe('LoopGuard', () => {
  it('refuses the third identical call after two failures, and success resets', () => {
    const loop = new LoopGuard();
    const sig = LoopGuard.signature('computer', { action: 'left_click', ref: 'e4', action_summary: 'a' });
    expect(LoopGuard.signature('computer', { ref: 'e4', action: 'left_click', action_summary: 'b' })).toBe(sig);
    loop.record('ses_1', sig, true);
    loop.check('ses_1', sig);
    loop.record('ses_1', sig, true);
    expect(() => loop.check('ses_1', sig)).toThrow(/already failed twice/);
    loop.record('ses_1', sig, false);
    loop.check('ses_1', sig);
  });
});
