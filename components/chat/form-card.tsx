import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  answerFor,
  askedFields,
  initialAnswer,
  isComplete,
  type FormAnswer,
  type FormField,
  type FormValue,
  type PendingForm,
} from '@/lib/opencode/forms';

type Props = {
  form: PendingForm;
  onAnswer: (formID: string, answer: FormAnswer) => unknown;
  onCancel: (formID: string) => unknown;
};

type ChoiceProps = {
  options: Array<{ value: string; label: string }>;
  selected: (value: string) => boolean;
  onPick: (value: string) => void;
};

function Choices({ options, selected, onPick }: ChoiceProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={selected(option.value) ? 'default' : 'outline'}
          aria-pressed={selected(option.value)}
          className="h-auto justify-start py-1.5 text-left whitespace-normal"
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

type FieldProps = { field: FormField; value: FormValue | undefined; onChange: (value: FormValue) => void };

function BooleanInput({ value, onChange }: Pick<FieldProps, 'value' | 'onChange'>) {
  return (
    <Choices
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
      selected={(v) => (v === 'yes') === (value === true)}
      onPick={(v) => onChange(v === 'yes')}
    />
  );
}

function MultiselectInput({ field, value, onChange }: FieldProps) {
  const chosen = Array.isArray(value) ? value : [];
  return (
    <Choices
      options={field.options}
      selected={(v) => chosen.includes(v)}
      onPick={(v) => onChange(chosen.includes(v) ? chosen.filter((item) => item !== v) : [...chosen, v])}
    />
  );
}

function TypedInput({ field, value, onChange }: FieldProps) {
  const alongsideOptions = field.type === 'string' && field.options.length > 0;
  return (
    <Input
      type={field.type === 'string' ? 'text' : 'number'}
      value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
      placeholder={field.placeholder ?? (alongsideOptions ? 'Or type your own' : undefined)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TextInput(props: FieldProps) {
  const { field, value, onChange } = props;
  const hasOptions = field.type === 'string' && field.options.length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      {hasOptions && <Choices options={field.options} selected={(v) => value === v} onPick={onChange} />}
      {(!hasOptions || field.custom) && <TypedInput {...props} />}
    </div>
  );
}

function FieldInput(props: FieldProps) {
  const { field } = props;
  if (field.type === 'boolean') return <BooleanInput {...props} />;
  if (field.type === 'multiselect') return <MultiselectInput {...props} />;
  if (field.type !== 'external') return <TextInput {...props} />;
  return (
    <a href={field.url} target="_blank" rel="noreferrer noopener" className="text-sm text-primary underline">
      {field.title ?? field.url}
    </a>
  );
}

/** A question the server is waiting on, answered in place above the composer. */
export function FormCard({ form, onAnswer, onCancel }: Props) {
  const [answer, setAnswer] = useState<FormAnswer>(() => initialAnswer(form));
  const [busy, setBusy] = useState(false);
  const fields = askedFields(form, answer);

  const settle = async (run: () => unknown) => {
    setBusy(true);
    try {
      await run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={form.title}
      className="mx-3 mb-2 flex flex-col gap-3 rounded-2xl bg-muted px-3 py-3 text-sm text-text-primary"
    >
      <h2 className="font-medium">{form.title}</h2>
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          {(field.title ?? field.description) && field.type !== 'external' && (
            <p className="text-text-secondary">{field.title ?? field.description}</p>
          )}
          <FieldInput
            field={field}
            value={answer[field.key]}
            onChange={(value) => setAnswer((current) => ({ ...current, [field.key]: value }))}
          />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void settle(() => onCancel(form.id))}>
          Dismiss
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || !isComplete(form, answer)}
          onClick={() => void settle(() => onAnswer(form.id, answerFor(form, answer)))}
        >
          Submit
        </Button>
      </div>
    </section>
  );
}
