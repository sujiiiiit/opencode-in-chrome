// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { askUserTool } from '@/lib/browser/tools/ask-user';
import { runTool } from '@/lib/browser/tools/registry';
import { serverAccess } from '@/lib/browser/server';
import { startFakeOpencode, type FakeOpencode } from '../../support/fake-opencode';

let fake: FakeOpencode;
beforeEach(async () => { fake = await startFakeOpencode(); });
afterEach(async () => fake.close());

const access = () => serverAccess(async () => ({
  baseUrl: fake.baseUrl, token: fake.token, expiresAt: 1999999999000, serverVersion: '2.2.5', pairedAt: 0,
}));

describe('ask_user', () => {
  it('asks one text question and returns the answer to the agent', async () => {
    const pending = runTool(askUserTool(access(), 20), { kind: 'input', message: 'Which city?' }, 'ses_1');
    const form = await fake.waitForForm();
    expect(form.metadata).toMatchObject({ kind: 'browser-ask-user', request: 'input' });
    expect(form.fields[0]).toMatchObject({ key: 'answer', title: 'Which city?', custom: true });
    fake.answerForm(form.id, { answer: 'Pune' });
    expect((await pending).content[0]).toMatchObject({ text: 'The user answered: Pune' });
  });

  it('hands over a browser step and reports cancellation without bypassing it', async () => {
    const pending = runTool(askUserTool(access(), 20), { kind: 'takeover', message: 'Sign in, then press Done.' }, 'ses_2');
    const form = await fake.waitForForm();
    expect(form.fields[0]).toMatchObject({ options: [{ value: 'done', label: 'Done' }, { value: 'cancel', label: 'Cancel' }] });
    fake.answerForm(form.id, { choice: 'cancel' });
    expect((await pending).content[0]).toMatchObject({ text: 'DENIED: The user cancelled the step.' });
  });

  it('cancels a pending form when browser activity stops', async () => {
    let stop: () => void = () => undefined;
    const pending = runTool(askUserTool(access(), 20, 1000, (cb) => ((stop = cb), () => undefined)), { kind: 'input', message: 'Which city?' }, 'ses_3');
    const form = await fake.waitForForm();
    stop();
    expect((await pending).content[0]).toMatchObject({ text: 'DENIED: Browser activity was stopped.' });
    expect(fake.forms.get(form.id)?.state).toMatchObject({ status: 'cancelled' });
  });
});
