import type { ReactElement, ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cn } from 'cn';

type TooltipProps = {
  /** What the tooltip says. */
  label: ReactNode;
  /** The trigger element, rendered through Base UI's `render` prop (not `asChild`). */
  children: ReactElement<Record<string, unknown>>;
  /** Hides the tooltip without touching the trigger (e.g. while the trigger is disabled). */
  disabled?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};

/**
 * A small text tooltip. It is a visual hint only: give the trigger an accessible name (and an
 * `aria-describedby` when the tooltip adds meaning) instead of relying on the tooltip.
 */
function Tooltip({ label, children, disabled, side = 'top', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger delay={300} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="isolate z-50 outline-none">
          <TooltipPrimitive.Popup
            data-slot="tooltip"
            className={cn(
              'rounded-4xl bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md',
              'origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
              className,
            )}
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip };
