import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsContentWrapper } from '@/components/ui/tabs';
import {
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
  isComplete,
  setValue,
  startDraft,
  typeCustom,
  type FormDraft,
  type FormField,
  type FormOption,
  type PendingForm,
} from '@/lib/opencode/forms';

type Props = {
  form: PendingForm;
  onAnswer: (formID: string, answer: ReturnType<typeof answerFor>) => unknown;
  onCancel: (formID: string) => unknown;
};

const OWN_ANSWER = 'Or, describe your requirements';
/** The own-answer radio's value; no option of a real question is named this. */
const CUSTOM = '\u0000custom';
/** After an option is picked, the beat before the next question slides in (the pick shows first). */
const AUTO_ADVANCE_MS = 220;

type StepProps = {
  field: FormField;
  draft: FormDraft;
  onDraft: (draft: FormDraft) => void;
  /** Enter in a typed answer: what the footer button would do. */
  onEnter: () => void;
  /** An option (not the own answer) was picked for a one-answer question: that answers it. */
  onPicked: () => void;
};

/** One option row: its control, its label and, under it, its description. */
function OptionRow({ option, control }: { option: FormOption; control: (ids: { label: string; hint?: string }) => React.ReactNode }) {
  const id = useId();
  const hint = option.description ? `${id}-hint` : undefined;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 transition-colors duration-150 ease-(--ease-calm) hover:bg-background-secondary-transparent">
      <span className="flex h-[1.3125rem] items-center">{control({ label: `${id}-label`, hint })}</span>
      <span className="flex min-w-0 flex-col">
        <span id={`${id}-label`} className="type-body text-text-primary">{option.label}</span>
        {hint && <span id={hint} className="text-[0.8125rem] leading-snug text-text-tertiary">{option.description}</span>}
      </span>
    </label>
  );
}

/**
 * The last row: the own answer, typed in place. Typing (or going into it) chooses it; Enter goes on. It is a radio
 * for a one-answer question and a checkbox for a many-answer one, like the options above it.
 */
function OwnAnswerRow({ field, draft, onDraft, onEnter, control }: StepProps & { control: React.ReactNode }) {
  const custom = draft.custom[field.key];
  // Going into the row chooses it: always for one answer, for several once it has text to add.
  const onFocus = () => {
    if (custom?.on || (choiceMode(field) === 'multiple' && !custom?.text)) return;
    onDraft(typeCustom(draft, field, custom?.text ?? ''));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <div
      data-chosen={custom?.on || undefined}
      className="flex items-center gap-3 rounded-xl px-3 py-1 transition-colors duration-150 ease-(--ease-calm) data-chosen:bg-background-secondary-transparent"
    >
      {control}
      <input
        type="text"
        aria-label="Your own answer"
        placeholder={OWN_ANSWER}
        value={custom?.text ?? ''}
        onChange={(event) => onDraft(typeCustom(draft, field, event.target.value))}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className="h-8 min-w-0 flex-1 bg-transparent type-body text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </div>
  );
}

/** A one-answer question: radios, then the own answer if the question takes one. */
function SingleChoice(props: StepProps) {
  const { field, draft, onDraft } = props;
  const options = choiceOptions(field);
  const chosen = draft.custom[field.key]?.on ? CUSTOM : (options.find((o) => isChosen(draft, field, o.value))?.value ?? null);
  const pick = (value: string) => {
    if (value === CUSTOM) return onDraft(chooseCustom(draft, field));
    onDraft(chooseOption(draft, field, value));
    props.onPicked();
  };
  return (
    <RadioGroup value={chosen} onValueChange={(value) => pick(String(value))} className="gap-0.5">
      {options.map((option) => (
        <OptionRow
          key={option.value}
          option={option}
          control={(ids) => <RadioGroupItem value={option.value} aria-labelledby={ids.label} aria-describedby={ids.hint} />}
        />
      ))}
      {allowsCustom(field) && (
        <OwnAnswerRow {...props} control={<RadioGroupItem value={CUSTOM} aria-label={OWN_ANSWER} />} />
      )}
    </RadioGroup>
  );
}

/** A many-answer question: checkboxes, then the own answer if the question takes one. */
function MultipleChoice(props: StepProps) {
  const { field, draft, onDraft } = props;
  return (
    <div role="group" className="flex flex-col gap-0.5">
      {choiceOptions(field).map((option) => (
        <OptionRow
          key={option.value}
          option={option}
          control={(ids) => (
            <Checkbox
              checked={isChosen(draft, field, option.value)}
              onCheckedChange={() => onDraft(chooseOption(draft, field, option.value))}
              aria-labelledby={ids.label}
              aria-describedby={ids.hint}
            />
          )}
        />
      ))}
      {allowsCustom(field) && (
        <OwnAnswerRow
          {...props}
          control={
            <Checkbox
              checked={draft.custom[field.key]?.on ?? false}
              onCheckedChange={() => onDraft(chooseCustom(draft, field))}
              aria-label={OWN_ANSWER}
            />
          }
        />
      )}
    </div>
  );
}

/** Free text or a number, labelled by the question above it. */
function TypedAnswer({ field, draft, onDraft, onEnter, labelledBy }: StepProps & { labelledBy: string }) {
  const value = draft.answer[field.key];
  return (
    <div className="px-3 pb-1">
      <Input
        type={field.type === 'string' ? 'text' : 'number'}
        aria-labelledby={labelledBy}
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        placeholder={field.placeholder}
        onChange={(event) => onDraft(setValue(draft, field, event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
}

function StepBody(props: StepProps & { labelledBy: string }) {
  const { field } = props;
  if (field.type === 'external') {
    return (
      <a href={field.url} target="_blank" rel="noreferrer noopener" className="mx-3 type-body text-text-primary underline">
        {field.title ?? field.url}
      </a>
    );
  }
  const mode = choiceMode(field);
  if (mode === 'multiple') return <MultipleChoice {...props} />;
  if (mode === 'single') return <SingleChoice {...props} />;
  return <TypedAnswer {...props} />;
}

/** One question's page: the question, then its answers. */
function Step(props: StepProps & { heading: string; roomFor: 'one' | 'pager' }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 px-1 pt-3.5 pb-1">
      <h2
        id={id}
        className={cn('px-3 type-body font-semibold text-text-primary', props.roomFor === 'pager' ? 'pr-36' : 'pr-12')}
      >
        {props.heading}
      </h2>
      <StepBody {...props} labelledBy={id} />
    </div>
  );
}

/** The question a field asks: its own question, else its title, else the form's title. */
const headingOf = (form: PendingForm, field: FormField) =>
  field.type === 'external' ? (field.description ?? form.title) : (field.description ?? field.title ?? form.title);

/** Back, "n / total" and forward, then the x that declines the whole form. */
function Pager({ index, total, onMove, onClose, busy }: {
  index: number;
  total: number;
  onMove: (index: number) => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1">
      {total > 1 && (
        <div className="flex items-center text-text-tertiary">
          <Button variant="ghost" size="icon-xs" aria-label="Previous question" disabled={index === 0} onClick={() => onMove(index - 1)}>
            <Icon name="arrow-left" />
          </Button>
          <span className="min-w-9 text-center text-xs tabular-nums">{`${index + 1} / ${total}`}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Next question" disabled={index === total - 1} onClick={() => onMove(index + 1)}>
            <Icon name="arrow-right" />
          </Button>
        </div>
      )}
      <Button variant="secondary" size="icon-sm" aria-label="Close" className="rounded-full" disabled={busy} onClick={onClose}>
        <Icon name="close" />
      </Button>
    </div>
  );
}

/**
 * A question the server is waiting on, asked inside the prompt box: one question per page, the
 * pages sliding as you go back and forth. A one-answer question offers radios, a many-answer one
 * checkboxes, each ending with a row for your own answer when the question takes one. Picking
 * a radio option goes on to the next question by itself. The footer button goes on: Skip while the question is unanswered (when it may be skipped), Next
 * once answered, and Submit on the last page. The x declines the form.
 */
export function FormCard({ form, onAnswer, onCancel }: Props) {
  const [draft, setDraft] = useState<FormDraft>(() => startDraft(form));
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const answer = draftAnswer(form, draft);
  const steps = askedFields(form, answer);
  const index = Math.min(at, steps.length - 1);
  const step = steps[index]!;
  const last = index === steps.length - 1;
  const answered = step.type === 'external' || isAnswered(step, answer);

  const settle = async (run: () => unknown) => {
    setBusy(true);
    try {
      await run();
    } finally {
      setBusy(false);
    }
  };
  const submit = () => void settle(() => onAnswer(form.id, answerFor(form, answer)));
  const canGoOn = busy ? false : last ? isComplete(form, answer) : answered || !step.required;
  const goOn = () => {
    if (!canGoOn) return;
    if (last) submit();
    else setAt(index + 1);
  };
  const label = answered || step.required ? (last ? 'Submit' : 'Next') : 'Skip';

  // Picking an option of a one-answer question answers it, so the next question follows by
  // itself. Not from the last one: sending stays the user's own click on Submit.
  const advance = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(advance.current), []);
  const onPicked = () => {
    window.clearTimeout(advance.current);
    if (last) return;
    const from = index;
    advance.current = window.setTimeout(() => setAt((now) => (now === from ? from + 1 : now)), AUTO_ADVANCE_MS);
  };

  return (
    <section aria-label={form.title} className="relative flex flex-col">
      <Pager index={index} total={steps.length} busy={busy} onMove={setAt} onClose={() => void settle(() => onCancel(form.id))} />
      <Tabs defaultValue={step.key} value={step.key} onValueChange={(key) => setAt(steps.findIndex((s) => s.key === key))} className="gap-0">
        <TabsContentWrapper>
          {steps.map((field) => (
            <TabsContent key={field.key} value={field.key}>
              <Step
                field={field}
                draft={draft}
                onDraft={setDraft}
                onEnter={goOn}
                onPicked={onPicked}
                heading={headingOf(form, field)}
                roomFor={steps.length > 1 ? 'pager' : 'one'}
              />
            </TabsContent>
          ))}
        </TabsContentWrapper>
      </Tabs>
      <div className="flex justify-end px-3 pt-1 pb-3">
        <Button size="sm" variant={label === 'Skip' ? 'secondary' : 'default'} className="font-normal" disabled={!canGoOn} onClick={goOn}>
          {label}
        </Button>
      </div>
    </section>
  );
}
