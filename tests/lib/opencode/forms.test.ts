import { describe, expect, it } from 'vitest';
import {
  addForm,
  answerFor,
  askedFields,
  createdForm,
  initialAnswer,
  isComplete,
  parseForm,
  removeForm,
  settledFormID,
} from '@/lib/opencode/forms';

const consent = {
  id: 'frm_1',
  sessionID: 'ses_1',
  title: 'Web Search',
  metadata: { kind: 'websearch.provider' },
  fields: [
    {
      key: 'choice',
      type: 'string',
      required: true,
      custom: false,
      options: [
        { value: 'allow', label: 'Allow search via Exa' },
        { value: 'disable', label: 'Disable web search' },
      ],
    },
  ],
};

describe('forms', () => {
  it('parses the web search consent form', () => {
    const form = parseForm(consent)!;
    expect(form.title).toBe('Web Search');
    expect(form.fields[0]).toMatchObject({ key: 'choice', required: true, custom: false });
    expect(form.fields[0]!.options.map((o) => o.value)).toEqual(['allow', 'disable']);
  });

  it('drops malformed forms and fields', () => {
    expect(parseForm({ id: 'frm_1' })).toBeNull();
    expect(parseForm({ ...consent, fields: [{ key: 'x', type: 'weird' }] })).toBeNull();
  });

  it('tracks forms from events for one session', () => {
    const created = { type: 'form.created', data: { form: consent } };
    expect(createdForm(created, 'ses_1')?.id).toBe('frm_1');
    expect(createdForm(created, 'ses_2')).toBeNull();
    const replied = { type: 'form.replied', data: { id: 'frm_1', sessionID: 'ses_1', answer: {} } };
    expect(settledFormID(replied, 'ses_1')).toBe('frm_1');
    expect(settledFormID(replied, 'ses_2')).toBeNull();
    const form = parseForm(consent)!;
    expect(addForm(addForm([], form), form)).toHaveLength(1);
    expect(removeForm([form], 'frm_1')).toEqual([]);
  });

  it('requires an answer for required fields and sends only active ones', () => {
    const form = parseForm({
      ...consent,
      fields: [
        ...consent.fields,
        { key: 'name', type: 'string', when: [{ key: 'choice', op: 'eq', value: 'allow' }] },
        { key: 'count', type: 'integer' },
      ],
    })!;
    expect(isComplete(form, initialAnswer(form))).toBe(false);
    expect(askedFields(form, {}).map((f) => f.key)).toEqual(['choice', 'count']);
    const answer = { choice: 'disable', name: 'ignored', count: '3' };
    expect(isComplete(form, answer)).toBe(true);
    expect(answerFor(form, answer)).toEqual({ choice: 'disable', count: 3 });
    expect(askedFields(form, { choice: 'allow' }).map((f) => f.key)).toEqual(['choice', 'name', 'count']);
  });
});
