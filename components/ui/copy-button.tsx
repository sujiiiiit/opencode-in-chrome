import { useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Icon, Tick2Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';

const COPIED_MS = 2000;

/** Both glyphs share one cell and trade places: the outgoing one shrinks and blurs away. */
const GLYPH = 'col-start-1 row-start-1 transition-[opacity,scale,filter] duration-200 ease-(--ease-calm) motion-reduce:transition-none';
const HIDDEN = 'scale-50 opacity-0 blur-[2px]';

type Props = {
  /** What to copy; a function is read at click time (for text that is costly or only known then). */
  text: string | (() => string);
  /** What the button does ("Copy response"); it reads "Copied" for a moment after the copy lands. */
  label: string;
  variant?: 'ghost' | 'quiet';
  className?: string;
};

/**
 * Copies `text`. The copy icon gives way to the dropdown menu's check once the copy lands (a
 * smooth crossfade with a little scale and blur, no bounce), then comes back; the button itself
 * presses in slightly on click. Focus stays where it was, so a composer's caret is not lost.
 */
export function CopyButton({ text, label, variant = 'ghost', className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void navigator.clipboard?.writeText(typeof text === 'function' ? text() : text).then(
      () => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => {},
    );
  };

  const name = copied ? 'Copied' : label;
  return (
    <Tooltip label={name}>
      <Button
        variant={variant}
        size="icon-xs"
        className={cn(
          'rounded-md text-text-secondary hover:text-text-primary active:scale-95 motion-reduce:transition-none',
          className,
        )}
        aria-label={name}
        onMouseDown={(event) => event.preventDefault()}
        onClick={copy}
      >
        <span className="grid size-3.5 place-items-center">
          <Icon name="copy" className={cn(GLYPH, 'size-3.5', copied && HIDDEN)} />
          <Tick2Icon className={cn(GLYPH, 'size-3', !copied && HIDDEN)} />
        </span>
      </Button>
    </Tooltip>
  );
}
