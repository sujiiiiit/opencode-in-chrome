import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

/**
 * The quiet header button a reply's foldable rows share (Thinking, a compaction). A shimmering
 * label takes its colour from the variable here, so it follows the button's own colour
 * (secondary, primary on hover or when open), as the finished label's text does.
 */
export function DisclosureButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="quiet"
      size="disclosure"
      className="-ml-1.5 w-auto max-w-full gap-0 [--shimmer-text-highlight-color:var(--text-secondary)] hover:[--shimmer-text-highlight-color:var(--text-primary)] aria-expanded:[--shimmer-text-highlight-color:var(--text-primary)]"
      {...props}
    />
  );
}

/** The header's chevron: turned while folded, faded out (still taking its room) while there is nothing to open. */
export function DisclosureChevron({ open, hidden }: { open: boolean; hidden: boolean }) {
  return (
    <Icon
      name="chevron-down"
      className={cn('ml-1.5 shrink-0 transition-[rotate,translate,opacity] duration-200', !open && '-rotate-90', hidden && 'opacity-0')}
    />
  );
}
