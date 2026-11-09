import { memo, useState } from 'react';
import { cn } from 'cn';
import { Button, buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icon } from '@/components/ui/icon';
import type { ReplyToolPart } from '@/lib/opencode/reply';
import { shellExit, toolPending, toolResult, toolStopped, toolSubject, toolTitle } from '@/lib/opencode/tool-info';
import { Shimmer } from './live';
import { toolDetails } from './tool-details';

/**
 * What the row reports after its title: a call the interrupt cut off (not a failure, though the
 * server reports it as one), a failure, a non-zero exit, a timeout, or else what a search found.
 */
function outcome(part: ReplyToolPart, live: boolean): { text: string; failed: boolean } | null {
  if (toolStopped(part, live)) return { text: 'Stopped', failed: false };
  if (part.status === 'error') return { text: 'Failed', failed: true };
  const exit = shellExit(part);
  if (exit !== undefined && exit !== 0) return { text: `Exit ${exit}`, failed: true };
  if (part.metadata.timeout === true) return { text: 'Timed out', failed: true };
  const found = toolResult(part);
  return found ? { text: found, failed: false } : null;
}

type Props = { part: ReplyToolPart; live: boolean };

/**
 * One tool call: a row naming what it does ("Running npm test", then "Ran npm test") that opens
 * onto its details (the shell output, the diff, the result) when the reader chooses.
 */
export const ToolRow = memo(function ToolRow({ part, live }: Props) {
  const pending = toolPending(part, live);
  const [open, setOpen] = useState(false);
  const Details = toolDetails(part);
  const subject = toolSubject(part);
  const result = outcome(part, live);

  // A long line truncates instead of running past the row: the subject gives way first (its large
  // shrink takes almost all the overflow), then the title (an MCP tool's title is its whole name),
  // while the outcome ("Failed") and the chevron always stay whole at the end.
  const title = toolTitle(part, live);
  const header = (
    <>
      {result?.failed && <Icon name="alert" className="text-destructive" />}
      <Shimmer active={pending} className="shrink">
        {title}
      </Shimmer>
      {subject && (
        <span className="min-w-0 shrink-1000 truncate font-normal text-text-primary" title={subject}>
          {subject}
        </span>
      )}
      {result && (
        <span className={cn('ml-auto shrink-0 pl-2', result.failed ? 'text-destructive' : 'text-text-tertiary')}>
          {result.text}
        </span>
      )}
    </>
  );
  const chevron = (
    <Icon
      name="chevron-down"
      className={cn('shrink-0 text-text-tertiary transition-transform duration-200', !open && '-rotate-90', !result && 'ml-auto')}
    />
  );

  // Nothing to open (a file read): the same row, not a button.
  if (!Details && !part.error) {
    return (
      <div
        data-tool={part.name}
        data-status={part.status}
        className={cn(buttonVariants({ variant: 'quiet', size: 'step' }), 'cursor-default hover:bg-transparent hover:text-text-secondary')}
      >
        {header}
      </div>
    );
  }

  // Details mount only while open, so a long history never polls or highlights what is not shown.
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-tool={part.name} data-status={part.status}>
      <CollapsibleTrigger render={<Button variant="quiet" size="step" className="hover:bg-transparent" />}>
        {header}
        {chevron}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 pt-2">
          {Details && <Details part={part} live={live} />}
          {part.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 type-work whitespace-pre-wrap wrap-anywhere text-destructive">
              {part.error}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});
