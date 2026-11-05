// The built extension's MCP tool creates an opencode form and resumes after the person answers.
import { expect, test, SESSION } from './fixtures';

test('ask_user waits for a person and returns their answer', async ({ tool, fake }) => {
  const pending = tool('ask_user', { kind: 'input', message: 'Which city should I use?' }, SESSION);
  const form = await fake.waitForForm();
  expect(form).toMatchObject({ sessionID: SESSION, metadata: { kind: 'browser-ask-user', request: 'input' } });
  fake.answerForm(form.id, { answer: 'Pune' });
  expect((await pending).text).toContain('The user answered: Pune');
});
