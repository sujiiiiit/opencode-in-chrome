import { memo, useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { displayTitle, isUntitled, relativeTime, type ChatSummary } from '@/lib/opencode/sessions';

type Props = {
  chat: ChatSummary;
  active: boolean;
  activity?: 'running' | 'unseen';
  now: number;
  /** These take the row's id, so the list can pass the same functions to every row (see `memo`). */
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** Runs once the user confirms the delete in the row. */
  onDelete: (id: string) => void;
};

/** Inline title editor: Enter saves, Escape (or leaving the field) cancels. */
function RenameField({ initial, onDone }: { initial: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <Input
      autoFocus
      aria-label="Chat title"
      value={value}
      className="h-9.5 rounded-2xl text-sm"
      onChange={(event) => setValue(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => onDone(null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onDone(value);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onDone(null);
        }
      }}
    />
  );
}

type ActionsProps = {
  title: string;
  confirming: boolean;
  onRename: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

/**
 * The buttons that take the time's place while the row is hovered or focused: Rename and Delete,
 * or, once Delete is picked, a confirm and a cancel button. The two sets cross-fade.
 */
function RowActions({ title, confirming, onRename, onAskDelete, onConfirmDelete, onCancelDelete }: ActionsProps) {
  const cancel = useRef<HTMLButtonElement>(null);

  // The menu hands focus back to its trigger as it closes; move it to the safe choice afterwards.
  useEffect(() => {
    if (!confirming) return;
    const frame = requestAnimationFrame(() => cancel.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [confirming]);

  return (
    <div
      className={cn(
        'absolute inset-y-0 right-1 grid items-center justify-items-end',
        confirming
          ? 'visible'
          : 'invisible group-hover:visible group-has-[:focus-visible]:visible',
      )}
      onKeyDown={(event) => {
        if (confirming && event.key === 'Escape') {
          event.preventDefault();
          onCancelDelete();
        }
      }}
    >
      <div
        inert={confirming}
        className={cn('col-start-1 row-start-1 transition-opacity duration-150', confirming ? 'opacity-0' : 'opacity-100')}
      >
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="transition-none"
            aria-label={`Rename ${title}`}
            title="Rename"
            onClick={onRename}
          >
            <Icon name="edit" className="size-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="transition-none text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${title}`}
            title="Delete"
            onClick={onAskDelete}
          >
            <Icon name="delete" className="size-4.5" />
          </Button>
        </div>
      </div>
      <div
        inert={!confirming}
        className={cn(
          'col-start-1 row-start-1 flex items-center transition-opacity duration-150',
          confirming ? 'opacity-100' : 'opacity-0',
        )}
      >
        <Button
          ref={cancel}
          variant="ghost"
          size="icon"
          className="transition-none"
          aria-label={`Cancel deleting ${title}`}
          title="Cancel"
          onClick={onCancelDelete}
        >
          <Icon name="close" className="size-4.5" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="transition-none"
          aria-label={`Confirm delete ${title}`}
          title="Delete"
          onClick={onConfirmDelete}
        >
          <Icon name="check" className="size-4.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * One chat in the history list. Titles render as text: they come from the server.
 * Hovering (or focusing into) a row swaps its time for the Rename and Delete buttons;
 * deleting asks for a confirm or cancel right in the row.
 */
export const HistoryRow = memo(function HistoryRow({ chat, active, activity, now, onOpen, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const title = displayTitle(chat.title);

  if (editing) {
    return (
      <li>
        <RenameField
          initial={isUntitled(chat.title) ? '' : chat.title}
          onDone={(next) => {
            setEditing(false);
            if (next !== null) onRename(chat.id, next);
          }}
        />
      </li>
    );
  }

  return (
    <li
      data-confirming={confirming || undefined}
      className="group relative flex items-center rounded-2xl hover:bg-background-tertiary-transparent has-[:focus-visible]:bg-background-tertiary-transparent data-[confirming]:bg-background-tertiary-transparent"
    >
      <Button
        variant="ghost"
        size="row"
        className="transition-none group-hover:actions-fade group-has-[:focus-visible]:actions-fade group-data-[confirming]:actions-fade hover:bg-transparent active:bg-transparent"
        aria-current={active ? 'page' : undefined}
        onClick={() => onOpen(chat.id)}
      >
        <span className={cn('min-w-0 flex-1 truncate', isUntitled(chat.title) && 'text-text-secondary')}>{title}</span>
        {activity === 'running' && <span role="status" aria-label="Chat running"><Icon name="loader-circle" className="animate-spin text-text-secondary" /></span>}
        {activity === 'unseen' && <span role="status" aria-label="Unseen chat result" className="size-2 shrink-0 rounded-full bg-primary" />}
        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-text-tertiary select-none group-hover:invisible group-has-[:focus-visible]:invisible group-data-[confirming]:mr-9 group-data-[confirming]:invisible">
          {relativeTime(chat.updated, now)}
        </span>
      </Button>
      <RowActions
        title={title}
        confirming={confirming}
        onRename={() => setEditing(true)}
        onAskDelete={() => setConfirming(true)}
        onConfirmDelete={() => onDelete(chat.id)}
        onCancelDelete={() => setConfirming(false)}
      />
    </li>
  );
});
