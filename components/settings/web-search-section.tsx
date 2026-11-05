import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Connection } from '@/lib/opencode/connection';
import type { WebSearchChoice } from '@/lib/opencode/websearch';
import { useWebSearch } from './use-web-search';

const toValue = (choice: WebSearchChoice) => (typeof choice === 'string' ? choice : `provider:${choice.provider}`);
const fromValue = (value: string): WebSearchChoice =>
  value.startsWith('provider:') ? { provider: value.slice('provider:'.length) } : (value as WebSearchChoice);

type Option = { value: string; label: string; hint?: string };

/** Which search backend the extension's chats use. */
export function WebSearchSection({ connection }: { connection: Connection }) {
  const { choice, providers, error, choose } = useWebSearch(connection);
  const options: Option[] = [
    { value: 'server', label: 'Server default', hint: "Use whatever the opencode server picks." },
    { value: 'random', label: 'Any available', hint: 'Let the server choose among the providers it offers.' },
    ...providers.map((provider) => ({ value: `provider:${provider.id}`, label: provider.name })),
  ];

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <RadioGroup
        aria-label="Web search"
        value={toValue(choice)}
        onValueChange={(value) => void choose(fromValue(value as string))}
        className="gap-0 overflow-hidden rounded-2xl border border-border"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 border-b border-border-secondary-transparent px-4 py-3 last:border-b-0 hover:bg-background-secondary has-data-checked:bg-background-secondary"
          >
            <RadioGroupItem value={option.value} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-text-primary">{option.label}</span>
              {option.hint && <span className="block text-xs text-text-secondary">{option.hint}</span>}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
