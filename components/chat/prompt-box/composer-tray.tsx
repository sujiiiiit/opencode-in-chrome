import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';

/** The tray's fold time (global.css `[data-slot="tray-fold"]`). */
const FOLD_MS = 320;

/** True once the tray has finished opening: a row that mounts after that slides in on its own. */
const TraySettled = createContext(false);

/**
 * A tab tucked behind the top of the prompt box that holds status rows (the session's goal, and
 * whatever comes later). It slides up from behind the box as it opens and back down as it shuts;
 * `open` is false while it has no rows to show, so it takes no room. Rows that arrive with it ride
 * in with it; a row added while it is open slides up from behind the box on its own, pushing the
 * rows above it up, like a new message. Styled in global.css under `[data-slot="composer-tray"]`.
 */
export function ComposerTray({ open, children }: { open: boolean; children: ReactNode }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!open) return setSettled(false);
    const timer = setTimeout(() => setSettled(true), FOLD_MS);
    return () => clearTimeout(timer);
  }, [open]);
  return (
    <div data-slot="tray-fold" data-hidden={open ? undefined : ''} inert={!open}>
      <div>
        <div data-slot="composer-tray" className="relative mx-4 border border-b-0 border-border bg-background-secondary">
          <TraySettled.Provider value={settled}>{children}</TraySettled.Provider>
        </div>
      </div>
    </div>
  );
}

type RowProps = {
  /** False folds the row away (smoothly); keep its content until the fold ends. */
  shown?: boolean;
  /** An icon name, or your own element (a status icon that changes with the row). */
  icon: IconName | ReactNode;
  /** The row's name (`Goal`, `Goal paused`): the text's size and weight, in the primary colour. */
  label: string;
  /** One line after the label, truncated; it opens the details when there are some. */
  text: ReactNode;
  /** The accessible name of the details toggle (defaults to "Show details"). */
  detailsLabel?: string;
  /** Opened from the text as an overlay above the tray, so the chat behind it does not move. */
  details?: ReactNode;
  /** Quiet text at the end of the header (a count); the chevron then sits after it, at the very end. */
  meta?: ReactNode;
  /** Classes for the details' padding (default: indented under the label, past the icon). */
  detailsClassName?: string;
  /** Buttons at the end of the row (`TrayAction`s). */
  actions?: ReactNode;
};

/**
 * One tray row: a header (icon, label, one-line text, actions) and, with `details`, a collapsible
 * body under it. The header's text toggles the body, which opens inside the tray: the tray grows
 * up from behind the box and the chat moves up with it.
 */
export function TrayRow({ shown = true, icon, label, text, details, detailsLabel = 'Show details', meta, detailsClassName = 'pl-9', actions }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  // A row mounted with the tray (or before it opens) rides in with it instead of folding in too.
  const settled = useContext(TraySettled);
  const [ridesIn] = useState(() => !settled);

  // Icon, label and text: the whole header but its actions, and the toggle when there are details.
  const heading = (
    <>
      {typeof icon === 'string' ? <Icon name={icon as IconName} className="size-4 shrink-0 text-text-secondary" /> : icon}
      <span className="shrink-0 text-text-primary">{label}</span>
      {/* Clips to the row's width; a block child (MorphText) can't inherit text-overflow from here,
          so it truncates itself and plain text below truncates its own span instead. */}
      <span className="min-w-0 overflow-hidden text-text-secondary">{text}</span>
      {meta && <span className="ml-auto shrink-0 pl-2 tabular-nums text-text-tertiary">{meta}</span>}
      {details && <Icon name="chevron-down" size={14} className={cn('shrink-0 text-text-tertiary transition-transform duration-200 ease-(--ease-calm) group-data-panel-open/tray:rotate-180', meta ? '-ml-0.5' : '-ml-1')} />}
    </>
  );
  const headingCn = 'flex h-9 min-w-0 flex-1 items-center gap-2 pl-3 type-work';

  return (
    <div data-slot="tray-fold" data-hidden={shown ? undefined : ''} data-static={ridesIn ? '' : undefined} inert={!shown}>
      <div>
        <Collapsible open={expanded && !!details} onOpenChange={setExpanded} render={<div data-slot="tray-row" />}>
          <div className="flex min-w-0 items-center pr-1.5">
            {details ? (
              <CollapsibleTrigger
                aria-label={detailsLabel}
                className={cn(headingCn, 'group/tray cursor-pointer rounded-tl-[0.8125rem] text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50')}
              >
                {heading}
              </CollapsibleTrigger>
            ) : (
              <div className={headingCn}>{heading}</div>
            )}
            {actions && <div data-slot="tray-actions" className="flex shrink-0 items-center gap-0.5 pl-2">{actions}</div>}
          </div>
          {details && (
            <CollapsibleContent data-tray-details="">
              <ScrollArea viewportClassName="max-h-48">
                <div className={cn('px-3 pb-3 type-work text-text-secondary', detailsClassName)}>{details}</div>
              </ScrollArea>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    </div>
  );
}

/** A quiet icon button for a row's actions; `label` is its accessible name and its tooltip. */
export function TrayAction({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <Tooltip label={label}>
      <Button variant="ghost" size="icon-xs" aria-label={label} className="text-text-secondary hover:text-text-primary" onClick={onClick}>
        <Icon name={icon} />
      </Button>
    </Tooltip>
  );
}
