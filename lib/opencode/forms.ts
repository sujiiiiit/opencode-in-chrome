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
