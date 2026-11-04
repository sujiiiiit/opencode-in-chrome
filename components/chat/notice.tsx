import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

/** An inline error message, dismissible when `onDismiss` is given. */
export function Notice({ text, onDismiss }: { text: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="mx-3 mb-1 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <p className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere">{text}</p>
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss"
          className="text-destructive"
          onClick={onDismiss}
        >
          <Icon name="close" />
        </Button>
      )}
    </div>
  );
}
