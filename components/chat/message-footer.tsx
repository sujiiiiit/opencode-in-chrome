import { CopyButton } from '@/components/ui/copy-button';
import { formatDuration } from '@/lib/opencode/flow';
import { formatSpeed, variantLabel, type TurnStats } from '@/lib/opencode/turn-stats';
import { useModelName } from './model/model-names';

/** Items separated by a middle dot, in the footer's faint small type. */
function Meta({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <span data-slot="message-meta" className="min-w-0 truncate text-[13px] leading-5 text-text-secondary select-none">
      {items.join(' · ')}
    </span>
  );
}

const sentFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Under a sent prompt: when it was sent, and Copy. Shown while the message is hovered or focused. */
export function UserMessageFooter({ text, created }: { text: string; created?: number }) {
  return (
    <div data-slot="message-footer" className="flex h-6 items-center justify-end gap-1">
      {created !== undefined && (
        <time dateTime={new Date(created).toISOString()} className="text-[13px] leading-5 text-text-secondary select-none">
          {sentFormat.format(created)}
        </time>
      )}
      {text && <CopyButton text={text} label="Copy message" />}
    </div>
  );
}

/**
 * Under a finished turn's answer: Copy, then the model (and its variant), how long the turn took,
 * and how fast the model wrote.
 */
export function AnswerFooter({ text, stats }: { text: string; stats?: TurnStats }) {
  const name = useModelName(stats?.model);
  const variant = variantLabel(stats?.model?.variant);
  const items = [
    name && (variant ? `${name} ${variant}` : name),
    stats?.durationMs !== undefined && formatDuration(stats.durationMs),
    stats?.tokensPerSecond !== undefined && formatSpeed(stats.tokensPerSecond),
  ].filter((item): item is string => !!item);

  return (
    <div data-slot="message-footer" className="-ml-0.5 flex h-6 min-w-0 items-center gap-1">
      <CopyButton text={text} label="Copy response" />
      <Meta items={items} />
    </div>
  );
}
