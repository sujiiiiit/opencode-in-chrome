import { memo } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MorphText } from '@/components/chat/flow/morph-text';
import type { ContextUsage } from '@/lib/opencode/context-usage';

const exact = new Intl.NumberFormat();
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const short = (count: number) => compact.format(count).toLowerCase();

/** The ring's colour: calm until the window is mostly full, then a warning, then a stop sign. */
function ringColor(percent: number): string {
  if (percent >= 90) return 'var(--context-ring-full)';
  if (percent >= 70) return 'var(--context-ring-warn)';
  return 'var(--text-secondary)';
}

/** A 16px ring filled to `percent`; `pathLength` lets the dash be the percent itself. */
function Ring({ percent }: { percent: number }) {
  const filled = Math.min(100, Math.max(0, percent));
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" strokeWidth={2} aria-hidden="true" className="-rotate-90">
      <circle cx={8} cy={8} r={7} stroke="var(--context-track)" />
      <circle
        cx={8}
        cy={8}
        r={7}
        pathLength={100}
        stroke={ringColor(filled)}
        strokeLinecap={filled > 0 ? 'round' : 'butt'}
        strokeDasharray={100}
        strokeDashoffset={100 - filled}
        style={{ transition: 'stroke-dashoffset 400ms var(--ease-calm), stroke 200ms var(--ease-calm)' }}
      />
    </svg>
  );
}

/** The percent used; a new value blurs out and the next one in, while the width eases. */
function PercentText({ percent }: { percent: number | null }) {
  const text = percent === null ? '–' : `${percent}%`;
  return <MorphText id={text} text={text} />;
}

type Segment = { key: string; label: string; count: number; color: string };

/**
 * The window's parts, in the bar's order: the prompt (input, its cached part included, since it
 * fills the window too), what the model wrote and reasoned, and the room left. Without a known
 * limit the bar spans what is used.
 */
function segments(usage: ContextUsage): Segment[] {
  const { tokens, total, limit } = usage;
  const used: Segment[] = [
    { key: 'input', label: 'Input', count: tokens.input + tokens.cacheRead + tokens.cacheWrite, color: 'var(--context-input)' },
    { key: 'output', label: 'Output', count: tokens.output, color: 'var(--context-output)' },
    { key: 'reasoning', label: 'Reasoning', count: tokens.reasoning, color: 'var(--context-reasoning)' },
  ];
  return limit ? [...used, { key: 'left', label: 'Left', count: Math.max(0, limit - total), color: 'var(--context-track)' }] : used;
}

/** One track split into a segment per part; a part too small to see still gets a sliver. */
function SegmentedBar({ parts }: { parts: Segment[] }) {
  const sum = parts.reduce((total, part) => total + part.count, 0) || 1;
  return (
    <div className="flex h-2 w-full" aria-hidden="true">
      {/* Every part stays mounted, so one that starts or stops filling grows or shrinks smoothly. */}
      {parts.map((part, index) => (
        <span
          key={part.key}
          className={cn(
            'h-full rounded-full transition-[flex-grow,margin,min-width] duration-400 ease-(--ease-calm)',
            part.count > 0 ? 'min-w-1' : 'min-w-0',
            index > 0 && part.count > 0 && 'ml-0.5',
          )}
          style={{ flexGrow: part.count / sum, flexBasis: 0, background: part.color }}
        />
      ))}
    </div>
  );
}

function Legend({ parts }: { parts: Segment[] }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {parts.map((part) => (
        <div key={part.key} className="flex items-center gap-2 text-xs">
          <span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} aria-hidden="true" />
          <dt className="text-text-secondary">{part.label}</dt>
          <dd className="ml-auto tabular-nums text-text-primary">{exact.format(part.count)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Details({ usage }: { usage: ContextUsage }) {
  const { tokens, total, limit, percent } = usage;
  const parts = segments(usage);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-text-primary">Context window</span>
          <span className="truncate text-xs tabular-nums text-text-secondary">
            {limit ? `${exact.format(total)} of ${exact.format(limit)} tokens` : `${exact.format(total)} tokens`}
          </span>
        </div>
        <span className="shrink-0 text-xl leading-none font-medium tabular-nums text-text-primary" style={percent !== null && percent >= 70 ? { color: ringColor(percent) } : undefined}>
          <PercentText percent={percent} />
        </span>
      </div>
      <SegmentedBar parts={parts} />
      <Legend parts={parts} />
      <div className="flex items-center justify-between gap-3 border-t border-border-secondary pt-2.5 text-xs">
        <span className="text-text-tertiary">Cache</span>
        <span className="tabular-nums text-text-secondary">{`${exact.format(tokens.cacheRead)} read · ${exact.format(tokens.cacheWrite)} write`}</span>
      </div>
    </div>
  );
}

/**
 * How full the chat's context window is, at the end of the model row: a ring and the percent
 * used (or the token count, when the model's window is unknown). Hovering or clicking opens the
 * breakdown: a bar split into what fills the window and what is left, and the cache counts.
 * Every change eases: the ring and the bar's segments glide, and the percent morphs.
 */
export const ContextMeter = memo(function ContextMeter({ usage }: { usage: ContextUsage }) {
  const { percent, total, limit } = usage;
  const label = percent === null
    ? `Context: ${exact.format(total)} tokens`
    : `Context: ${percent}% used, ${exact.format(total)} of ${exact.format(limit)} tokens`;
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={120}
        render={<Button variant="ghost" size="sm" className="shrink-0 gap-1.5 px-2" aria-label={label} data-slot="context-meter" />}
      >
        <Ring percent={percent ?? 0} />
        <span className="text-xs tabular-nums text-text-secondary">
          {percent === null ? short(total) : <PercentText percent={percent} />}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={6} className="w-72 p-3.5">
        <Details usage={usage} />
      </PopoverContent>
    </Popover>
  );
},
// A new usage object comes with every streamed event; the meter only changes when a step reports.
(a, b) => a.usage.tokens === b.usage.tokens && a.usage.limit === b.usage.limit);
