import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from 'cn';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: ReactNode;
  /** An action under the text, such as a button that clears a filter. */
  children?: ReactNode;
  className?: string;
};

/** What a list shows when it has nothing to list: an icon, what happened, and what to do next. */
function EmptyState({ icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn('animate-fade-in flex flex-col items-center gap-4 px-6 py-16 text-center', className)}
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-background-tertiary text-text-secondary [&_svg]:size-5">
        <Icon name={icon} />
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        {description && <p className="max-w-xs text-sm text-text-secondary">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export { EmptyState };
