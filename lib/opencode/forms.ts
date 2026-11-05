// Forms are how the server asks the user something mid-turn: a tool (web search's first-use
// consent, a question, an MCP elicitation) creates one and waits until it is answered or
// cancelled. Without a client that answers them, that tool call hangs and then fails.
import { isRecord } from './reply';
import type { ServerEvent } from './sse';

export type FormValue = string | number | boolean | string[];
export type FormAnswer = Record<string, FormValue>;

export type FormOption = { value: string; label: string; description?: string };

export type FormField = {
  key: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'multiselect' | 'external';
  title?: string;
  description?: string;
  required: boolean;
  /** Skip the prompt and use the default unless an answer is supplied. */
  hidden: boolean;
  placeholder?: string;
  options: FormOption[];
  /** A string field with options accepts free text too, unless this is false. */
  custom: boolean;
  default?: FormValue;
  /** `external` fields: the page the user completes the step on. */
  url?: string;
  /** Conditions on earlier answers that must all hold for the field to apply. */
  when: Array<{ key: string; op: 'eq' | 'neq'; value: string | number | boolean }>;
};

/** A browser-agent approval (lib/browser/approvals.ts) as the card shows it, from the form's metadata. */
export type BrowserApproval = { approval: 'site' | 'action'; site: string; summary: string; tool: string };

export function browserApprovalOf(form: PendingForm): BrowserApproval | null {
  const m = form.metadata;
  if (m.kind !== 'browser-approval') return null;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return { approval: m.approval === 'site' ? 'site' : 'action', site: text(m.site), summary: text(m.summary), tool: text(m.tool) };
}

export type PendingForm = {
  id: string;
  sessionID: string;
  title: string;
  metadata: Record<string, unknown>;
  fields: FormField[];
};

const FIELD_TYPES = new Set<FormField['type']>(['string', 'number', 'integer', 'boolean', 'multiselect', 'external']);

const text = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

function parseOption(value: unknown): FormOption | null {
  if (!isRecord(value) || typeof value.value !== 'string') return null;
  return { value: value.value, label: text(value.label) ?? value.value, description: text(value.description) };
}

function parseDefault(value: unknown): FormValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : undefined;
}

function parseWhen(value: unknown): FormField['when'] {
  return (Array.isArray(value) ? value : []).flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== 'string') return [];
    if (item.op !== 'eq' && item.op !== 'neq') return [];
    const v = item.value;
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      ? [{ key: item.key, op: item.op, value: v }]
      : [];
  });
}

function parseField(value: unknown): FormField | null {
  if (!isRecord(value) || typeof value.key !== 'string') return null;
  const type = value.type as FormField['type'];
  if (!FIELD_TYPES.has(type)) return null;
  return {
    key: value.key,
    type,
    title: text(value.title),
    description: text(value.description),
    required: value.required === true,
    hidden: value.hidden === true,
    placeholder: text(value.placeholder),
    options: (Array.isArray(value.options) ? value.options : []).flatMap((o) => parseOption(o) ?? []),
    custom: value.custom !== false,
    default: parseDefault(value.default),
    url: text(value.url),
    when: parseWhen(value.when),
  };
}

/** A form as the server sends it (`form.created`, the list endpoints), or null when malformed. */
export function parseForm(value: unknown): PendingForm | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.sessionID !== 'string') return null;
  const fields = (Array.isArray(value.fields) ? value.fields : []).flatMap((f) => parseField(f) ?? []);
  if (fields.length === 0) return null;
  return {
    id: value.id,
    sessionID: value.sessionID,
    title: text(value.title) ?? 'opencode needs an answer',
    metadata: isRecord(value.metadata) ? value.metadata : {},
    fields,
  };
}

export const parseForms = (value: unknown): PendingForm[] =>
  (Array.isArray(value) ? value : []).flatMap((item) => parseForm(item) ?? []);

/** The form a `form.created` event carries for `sessionID`, or null. */
export function createdForm(event: ServerEvent, sessionID: string): PendingForm | null {
  if (event.type !== 'form.created') return null;
  const form = parseForm(event.data.form);
  return form && form.sessionID === sessionID ? form : null;
}

/** The ID of the form a `form.replied` / `form.cancelled` event settles for `sessionID`, or null. */
export function settledFormID(event: ServerEvent, sessionID: string): string | null {
  if (event.type !== 'form.replied' && event.type !== 'form.cancelled') return null;
  return event.data.sessionID === sessionID && typeof event.data.id === 'string' ? event.data.id : null;
}

export const addForm = (forms: PendingForm[], form: PendingForm): PendingForm[] =>
  forms.some((item) => item.id === form.id) ? forms : [...forms, form];

export const removeForm = (forms: PendingForm[], id: string): PendingForm[] =>
  forms.some((item) => item.id === id) ? forms.filter((item) => item.id !== id) : forms;

function holds(answer: FormAnswer, condition: FormField['when'][number]): boolean {
  const value = answer[condition.key];
  if (value === undefined) return false;
  const equal = Array.isArray(value) ? value.includes(String(condition.value)) : value === condition.value;
  return condition.op === 'eq' ? equal : !equal;
}

/** Inactive fields are neither shown nor required. */
const isActive = (field: FormField, answer: FormAnswer): boolean =>
  field.when.every((condition) => holds(answer, condition));

/** The fields to ask for given the answers so far (external steps are links, not answers). */
export const askedFields = (form: PendingForm, answer: FormAnswer): FormField[] =>
  form.fields.filter((field) => !field.hidden && isActive(field, answer));

/** Starting answers: each field's default, and a boolean starts unchecked. */
export function initialAnswer(form: PendingForm): FormAnswer {
  const answer: FormAnswer = {};
  for (const field of form.fields) {
    if (field.default !== undefined) answer[field.key] = field.default;
    else if (field.type === 'boolean') answer[field.key] = false;
  }
  return answer;
}

const blank = (value: FormValue | undefined) =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** Whether every active required field has an answer. */
export function isComplete(form: PendingForm, answer: FormAnswer): boolean {
  return form.fields.every(
    (field) =>
      field.type === 'external' || !isActive(field, answer) || !field.required || !blank(answer[field.key]),
  );
}

/** The answer to send: only active fields with a value, in the types the server expects. */
export function answerFor(form: PendingForm, answer: FormAnswer): FormAnswer {
  const out: FormAnswer = {};
  for (const field of form.fields) {
    const value = answer[field.key];
    if (field.type === 'external' || !isActive(field, answer) || blank(value)) continue;
    out[field.key] = (field.type === 'number' || field.type === 'integer') && typeof value === 'string' ? Number(value) : value!;
  }
  return out;
}

// Drafts: answering by choosing ------------------------------------------------------------
// A field with options is answered by choosing: one option (radios) or any number (checkboxes).
// Where the field allows free text, a last "own answer" row takes typed text under the same
// rule: for one answer it replaces the option, for several it is added after them.

/** Whether a field is answered with one choice (radios), several (checkboxes), or by typing. */
export function choiceMode(field: FormField): 'single' | 'multiple' | null {
  if (field.type === 'multiselect') return 'multiple';
  if (field.type === 'boolean') return 'single';
  return field.type === 'string' && field.options.length > 0 ? 'single' : null;
}

const YES_NO: FormOption[] = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

/** The options to choose from; a yes-or-no question offers Yes and No. */
export const choiceOptions = (field: FormField): FormOption[] => (field.type === 'boolean' ? YES_NO : field.options);

/** Whether a choice field ends with an own-answer row (a typed answer). */
export const allowsCustom = (field: FormField): boolean =>
  choiceMode(field) !== null && field.type !== 'boolean' && field.custom;

/** The own-answer row: whether it is chosen, and its text (kept while another option is). */
export type CustomDraft = { on: boolean; text: string };

/**
 * What the user has chosen so far. `answer` holds the chosen options (and typed fields' values);
 * `custom` the own-answer rows, folded into the answer by `draftAnswer`.
 */
export type FormDraft = { answer: FormAnswer; custom: Record<string, CustomDraft> };

/** A fresh draft: each field's default, a default the options do not list becoming typed text. */
export function startDraft(form: PendingForm): FormDraft {
  const answer = initialAnswer(form);
  const custom: Record<string, CustomDraft> = {};
  for (const field of form.fields) {
    const value = answer[field.key];
    if (!allowsCustom(field) || value === undefined) continue;
    const listed = new Set(field.options.map((option) => option.value));
    if (field.type === 'multiselect' && Array.isArray(value)) {
      const extra = value.filter((item) => !listed.has(item));
      if (extra.length) {
        answer[field.key] = value.filter((item) => listed.has(item));
        custom[field.key] = { on: true, text: extra.join(', ') };
      }
    } else if (typeof value === 'string' && !listed.has(value)) {
      delete answer[field.key];
      custom[field.key] = { on: true, text: value };
    }
  }
  return { answer, custom };
}

const customOf = (draft: FormDraft, field: FormField): CustomDraft => draft.custom[field.key] ?? { on: false, text: '' };

const withCustom = (draft: FormDraft, field: FormField, next: CustomDraft): FormDraft => ({
  ...draft,
  custom: { ...draft.custom, [field.key]: next },
});

const picked = (draft: FormDraft, field: FormField): string[] => {
  const value = draft.answer[field.key];
  return Array.isArray(value) ? value : [];
};

/** Whether an option (by value; a yes-or-no question's are 'true' and 'false') is chosen. */
export function isChosen(draft: FormDraft, field: FormField, value: string): boolean {
  const current = draft.answer[field.key];
  if (field.type === 'multiselect') return picked(draft, field).includes(value);
  if (field.type === 'boolean') return current !== undefined && String(current) === value;
  return !customOf(draft, field).on && current === value;
}

/** Picks an option: for one answer it replaces the choice (own answer included), for several it toggles. */
export function chooseOption(draft: FormDraft, field: FormField, value: string): FormDraft {
  if (field.type === 'multiselect') {
    const chosen = picked(draft, field);
    const next = chosen.includes(value) ? chosen.filter((item) => item !== value) : [...chosen, value];
    return { ...draft, answer: { ...draft.answer, [field.key]: next } };
  }
  const answer = { ...draft.answer, [field.key]: field.type === 'boolean' ? value === 'true' : value };
  const custom = draft.custom[field.key];
  return custom ? withCustom({ ...draft, answer }, field, { ...custom, on: false }) : { ...draft, answer };
}

/** Picks the own-answer row: for one answer it is the choice, for several it toggles. */
export function chooseCustom(draft: FormDraft, field: FormField): FormDraft {
  const custom = customOf(draft, field);
  return withCustom(draft, field, { ...custom, on: field.type === 'multiselect' ? !custom.on : true });
}

/** Types into the own-answer row, which chooses it. */
export const typeCustom = (draft: FormDraft, field: FormField, text: string): FormDraft =>
  withCustom(draft, field, { on: true, text });

/** Sets a typed field's value (free text, a number). */
export const setValue = (draft: FormDraft, field: FormField, value: FormValue): FormDraft => ({
  ...draft,
  answer: { ...draft.answer, [field.key]: value },
});

/** The draft as answers: the own-answer text (trimmed) replaces or joins the chosen options. */
export function draftAnswer(form: PendingForm, draft: FormDraft): FormAnswer {
  const answer: FormAnswer = { ...draft.answer };
  for (const field of form.fields) {
    const custom = draft.custom[field.key];
    if (!allowsCustom(field) || !custom?.on) continue;
    const text = custom.text.trim();
    if (field.type === 'multiselect') {
      const chosen = picked(draft, field);
      answer[field.key] = text && !chosen.includes(text) ? [...chosen, text] : chosen;
    } else if (text) answer[field.key] = text;
    else delete answer[field.key];
  }
  return answer;
}

/** Whether a field has an answer (a skipped one has none). */
export const isAnswered = (field: FormField, answer: FormAnswer): boolean => !blank(answer[field.key]);
