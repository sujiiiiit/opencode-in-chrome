import { memo, useRef, useState } from 'react';
import { cn } from 'cn';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ReplyCompaction } from '@/lib/opencode/reply';
import { DisclosureButton, DisclosureChevron } from './disclosure';
import { Markdown } from './markdown';
import { MorphText } from './morph-text';
import { useFollowBottom } from './use-follow-bottom';

/**
 * What the row says, each state in its own words so the label morphs between them. `quiet`: a
 * failure the reader caused (a stop, a cancel), which needs no reason shown.
 */
function statusLabel(item: ReplyCompaction): { key: string; text: string; quiet?: true } {
  if (item.status === 'queued') return { key: 'queued', text: 'Compaction queued' };
  if (item.status === 'running') return { key: 'running', text: 'Compacting' };
  if (item.status === 'completed') return { key: 'done', text: 'Compacted' };
  if (item.error?.type === 'aborted') return { key: 'cancelled', text: 'Compaction cancelled', quiet: true };
  if (item.error?.type === 'compaction.interrupted') return { key: 'interrupted', text: 'Compaction interrupted', quiet: true };
  return { key: 'failed', text: 'Compaction failed' };
}

/**
 * A compaction in the reply, read like the Thinking row: a scroll, a label that morphs from
 * Compacting (shimmering) to Compacted, and, folded under it, the summary the conversation was
 * written down to, streaming in while it runs. A failure that was not the reader's doing says why.
 */
export const CompactionRow = memo(function CompactionRow({ item }: { item: ReplyCompaction }) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const running = item.status === 'running';
  const empty = !item.summary.trim();
  const label = statusLabel(item);
  const error = item.status === 'failed' && !label.quiet ? item.error?.message : undefined;
  useFollowBottom(content, open, running, item.summary);

  return (
    <div data-slot="compaction" data-status={item.status} className="flex flex-col">
      <Collapsible open={open && !empty} onOpenChange={setOpen} disabled={empty}>
        <CollapsibleTrigger render={<DisclosureButton />}>
          <Icon name="compaction" className="mr-1.5 shrink-0" />
          <MorphText
            id={label.key}
            text={label.text}
            shimmer={running}
            textSlot="compaction-label"
            className={cn('leading-[1.6]', !running && 'shrink-0')}
            textClassName="font-normal"
            shimmerDuration={1.2}
          />
          <DisclosureChevron open={open} hidden={empty} />
        </CollapsibleTrigger>
        {/* Unmounted while folded: one summary has nothing to keep between openings. */}
        <CollapsibleContent>
          <div className="mt-1 mb-1 overflow-hidden rounded-xl border border-border-strong-transparent">
            <ScrollArea fade className="[--fade-top-max:1.5rem] [--fade-bottom-max:1.5rem]" viewportClassName="max-h-72 overscroll-contain">
              <div ref={content} className="px-3 py-2">
                <Markdown text={item.summary} animate={running} size="work" className="text-text-secondary" />
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {error && <p data-slot="compaction-error" className="type-work text-text-secondary">{error}</p>}
    </div>
  );
});
