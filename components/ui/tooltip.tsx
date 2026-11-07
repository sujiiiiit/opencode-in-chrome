import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cn } from 'cn';

type TooltipProps = {
  /** What the tooltip says. */
  label: ReactNode;
  /** The trigger element, rendered through Base UI's `render` prop (not `asChild`). */
  children: ReactElement<Record<string, unknown>>;
  /** Hides the tooltip without touching the trigger (e.g. while the trigger is disabled). */
  disabled?: boolean;
  closeOnClick?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
};

/**
 * A small text tooltip. It is a visual hint only: give the trigger an accessible name (and an
 * `aria-describedby` when the tooltip adds meaning) instead of relying on the tooltip.
 */
function Tooltip({ label, children, disabled, closeOnClick, side = 'top', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger delay={300} closeOnClick={closeOnClick} render={children} />
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

const SharedHandle = createContext<ReturnType<typeof TooltipPrimitive.createHandle<string>> | null>(null);

/** One popup shared by the detached triggers in a panel. */
function TooltipGroup({ children }: { children: ReactNode }) {
  const [handle] = useState(() => TooltipPrimitive.createHandle<string>());
  return (
    <TooltipPrimitive.Provider delay={300}>
      <SharedHandle.Provider value={handle}>
        {children}
        <TooltipPrimitive.Root handle={handle}>
          {({ payload }) => <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner side="bottom" sideOffset={6} className="isolate z-50 outline-none">
              <TooltipPrimitive.Popup data-slot="tooltip" className="rounded-4xl bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
                {payload}
              </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
          </TooltipPrimitive.Portal>}
        </TooltipPrimitive.Root>
      </SharedHandle.Provider>
    </TooltipPrimitive.Provider>
  );
}

function TooltipTrigger({ label, children }: Pick<TooltipProps, 'label' | 'children'>) {
  const handle = useContext(SharedHandle);
  return <TooltipPrimitive.Trigger handle={handle ?? undefined} payload={String(label)} render={children} />;
}

export { Tooltip, TooltipGroup, TooltipTrigger };
