// @vitest-environment node
// Integration: approvals as real opencode session forms, against the fake server.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { approvalForm, formApprovals, APPROVAL_KIND } from '@/lib/browser/approvals';
import type { ApprovalRequest } from '@/lib/browser/policy';
import { serverAccess } from '@/lib/browser/server';
import { startFakeOpencode, type FakeOpencode } from '../../support/fake-opencode';

let fake: FakeOpencode;
beforeEach(async () => {
  fake = await startFakeOpencode();
});
afterEach(async () => fake.close());

const request: ApprovalRequest = { sessionID: 'ses_1', kind: 'action', site: 'shop.test', tool: 'computer', summary: 'Places the order', tier: 'consequential' };
const access = () =>
  serverAccess(async () => ({ baseUrl: fake.baseUrl, token: fake.token, expiresAt: 1999999999000, serverVersion: '2.2.5', pairedAt: 0 }));

describe('formApprovals', () => {
  it('creates a form in the session with browser metadata and returns the choice', async () => {
    const approve = formApprovals(access(), { pollMs: 20 });
    const pending = approve(request);
    const form = await fake.waitForForm();
    expect(form.sessionID).toBe('ses_1');
    expect(form.title).toBe('Allow this action on shop.test?');
    expect(form.metadata).toMatchObject({ kind: APPROVAL_KIND, approval: 'action', site: 'shop.test', summary: 'Places the order' });
    fake.answerForm(form.id, { choice: 'once' });
    expect(await pending).toBe('once');
  });

  it('treats a denied or cancelled form as deny', async () => {
    const approve = formApprovals(access(), { pollMs: 20 });
    const pending = approve(request);
    const form = await fake.waitForForm();
    fake.answerForm(form.id, { choice: 'deny' });
    expect(await pending).toBe('deny');
    const second = approve(request);
    const form2 = await fake.waitForForm();
    form2.state = { status: 'cancelled' };
    expect(await second).toBe('deny');
  });

  it('gives up after the timeout and cancels the form', async () => {
    const approve = formApprovals(access(), { pollMs: 20, timeoutMs: 150 });
    const pending = approve(request);
    const form = await fake.waitForForm();
    expect(await pending).toBe('timeout');
    expect(fake.forms.get(form.id)!.state).toMatchObject({ status: 'cancelled' });
  });

  it('settles as deny when the user presses stop', async () => {
    let stop: () => void = () => undefined;
    const approve = formApprovals(access(), { pollMs: 20, onStop: (cb) => ((stop = cb), () => undefined) });
    const pending = approve(request);
    await fake.waitForForm();
    stop();
    expect(await pending).toBe('deny');
  });

  it('offers allow-once, always and deny for a site prompt', () => {
    const form = approvalForm({ ...request, kind: 'site', summary: 'Use shop.test' });
    expect(form.title).toBe('Let the agent use shop.test?');
    expect(form.fields[0]!.options.map((o) => o.value)).toEqual(['once', 'always', 'deny']);
  });
});
