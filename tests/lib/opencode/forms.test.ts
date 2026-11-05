import { describe, expect, it } from 'vitest';
import {
  addForm,
  allowsCustom,
  answerFor,
  askedFields,
  chooseCustom,
  chooseOption,
  choiceMode,
  choiceOptions,
  draftAnswer,
  isAnswered,
  isChosen,
  startDraft,
  typeCustom,
  createdForm,
  initialAnswer,
  isComplete,
  parseForm,
  removeForm,
  settledFormID,
  type FormField,
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

/** The form opencode's question tool asks with: one field per question, custom text allowed. */
const questions = parseForm({
  id: 'frm_q',
  sessionID: 'ses_1',
  title: 'Questions',
  fields: [
    {
      key: 'q0',
      title: 'Video',
      description: 'What kind of video should I make?',
      type: 'string',
      custom: true,
      options: [
        { value: 'Product demo (Recommended)', label: 'Product demo (Recommended)', description: 'Polished walkthrough' },
        { value: 'Tutorial', label: 'Tutorial', description: 'Step-by-step guide' },
      ],
    },
    {
      key: 'q1',
      title: 'Formats',
      description: 'Which formats should it ship in?',
      type: 'multiselect',
      custom: true,
      options: [
        { value: '16:9', label: '16:9' },
        { value: '9:16', label: '9:16' },
      ],
    },
  ],
})!;
const [single, multiple] = questions.fields as [FormField, FormField];

describe('form drafts (choosing answers)', () => {
  it('answers a single-answer question with radios and a multiple-answer one with checkboxes', () => {
    expect(choiceMode(single)).toBe('single');
    expect(choiceMode(multiple)).toBe('multiple');
    const consentField = parseForm(consent)!.fields[0]!;
    expect(choiceMode(consentField)).toBe('single');
    expect(allowsCustom(consentField)).toBe(false);
    expect(allowsCustom(single)).toBe(true);
    expect(allowsCustom(multiple)).toBe(true);
    const yesNo = parseForm({ ...consent, fields: [{ key: 'ok', type: 'boolean' }] })!.fields[0]!;
    expect(choiceMode(yesNo)).toBe('single');
    expect(allowsCustom(yesNo)).toBe(false);
    expect(choiceOptions(yesNo).map((o) => o.label)).toEqual(['Yes', 'No']);
    const typed = parseForm({ ...consent, fields: [{ key: 'name', type: 'string' }] })!.fields[0]!;
    expect(choiceMode(typed)).toBeNull();
  });

  it('starts with nothing chosen', () => {
    const draft = startDraft(questions);
    expect(isChosen(draft, single, 'Tutorial')).toBe(false);
    expect(isAnswered(single, draftAnswer(questions, draft))).toBe(false);
    expect(isAnswered(multiple, draftAnswer(questions, draft))).toBe(false);
  });

  it('keeps one answer for a single-answer question, the option or the typed one', () => {
    let draft = chooseOption(startDraft(questions), single, 'Tutorial');
    expect(draftAnswer(questions, draft).q0).toBe('Tutorial');
    draft = chooseOption(draft, single, 'Product demo (Recommended)');
    expect(isChosen(draft, single, 'Tutorial')).toBe(false);
    expect(draftAnswer(questions, draft).q0).toBe('Product demo (Recommended)');
    // Typing your own answer picks it instead of the option.
    draft = typeCustom(draft, single, 'A launch teaser');
    expect(draft.custom.q0).toEqual({ on: true, text: 'A launch teaser' });
    expect(isChosen(draft, single, 'Product demo (Recommended)')).toBe(false);
    expect(draftAnswer(questions, draft).q0).toBe('A launch teaser');
    // Picking an option again sets the typed text aside (kept, not sent).
    draft = chooseOption(draft, single, 'Tutorial');
    expect(draft.custom.q0).toEqual({ on: false, text: 'A launch teaser' });
    expect(draftAnswer(questions, draft).q0).toBe('Tutorial');
  });

  it('counts an own-answer row as unanswered until something is typed', () => {
    let draft = chooseCustom(chooseOption(startDraft(questions), single, 'Tutorial'), single);
    expect(draft.custom.q0?.on).toBe(true);
    expect(isAnswered(single, draftAnswer(questions, draft))).toBe(false);
    draft = typeCustom(draft, single, '   ');
    expect(isAnswered(single, draftAnswer(questions, draft))).toBe(false);
    draft = typeCustom(draft, single, ' Shorts ');
    expect(draftAnswer(questions, draft).q0).toBe('Shorts');
  });

  it('adds and removes any number of answers, the typed one last', () => {
    let draft = chooseOption(startDraft(questions), multiple, '9:16');
    draft = chooseOption(draft, multiple, '16:9');
    expect(draftAnswer(questions, draft).q1).toEqual(['9:16', '16:9']);
    draft = chooseOption(draft, multiple, '9:16');
    expect(draftAnswer(questions, draft).q1).toEqual(['16:9']);
    draft = typeCustom(draft, multiple, '4:5 portrait');
    expect(isChosen(draft, multiple, '16:9')).toBe(true);
    expect(draftAnswer(questions, draft).q1).toEqual(['16:9', '4:5 portrait']);
    // A typed answer that repeats a chosen option is sent once.
    draft = typeCustom(draft, multiple, '16:9');
    expect(draftAnswer(questions, draft).q1).toEqual(['16:9']);
    // Unticking the own-answer row drops its text from the answer.
    draft = chooseCustom(typeCustom(draft, multiple, 'Square'), multiple);
    expect(draft.custom.q1).toEqual({ on: false, text: 'Square' });
    expect(draftAnswer(questions, draft).q1).toEqual(['16:9']);
  });

  it('answers yes or no questions with true or false', () => {
    const form = parseForm({ ...consent, fields: [{ key: 'ok', type: 'boolean', required: true }] })!;
    const field = form.fields[0]!;
    let draft = chooseOption(startDraft(form), field, 'true');
    expect(isChosen(draft, field, 'true')).toBe(true);
    expect(answerFor(form, draftAnswer(form, draft))).toEqual({ ok: true });
    draft = chooseOption(draft, field, 'false');
    expect(answerFor(form, draftAnswer(form, draft))).toEqual({ ok: false });
  });

  it('sends what the question tool expects, skipped questions left out', () => {
    let draft = chooseOption(startDraft(questions), multiple, '16:9');
    expect(isComplete(questions, draftAnswer(questions, draft))).toBe(true);
    expect(answerFor(questions, draftAnswer(questions, draft))).toEqual({ q1: ['16:9'] });
    draft = typeCustom(draft, single, 'Teaser');
    expect(answerFor(questions, draftAnswer(questions, draft))).toEqual({ q0: 'Teaser', q1: ['16:9'] });
  });

  it('starts from a default the options do not list as a typed answer', () => {
    const form = parseForm({ ...questions, fields: [{ ...questions.fields[0], default: 'Teaser' }] })!;
    const draft = startDraft(form);
    expect(draft.custom.q0).toEqual({ on: true, text: 'Teaser' });
    expect(draftAnswer(form, draft).q0).toBe('Teaser');
  });
});
