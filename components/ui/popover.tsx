import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from 'cn';

const Popover = PopoverPrimitive.Root;

/**
 * A handle that ties one popover to many triggers placed anywhere: pass it to `Popover` and to each
 * `PopoverTrigger`, and give each trigger its own `payload` for the popover to render.
 */
const createPopoverHandle = PopoverPrimitive.createHandle;

/**
 * What opens the popover. Add `openOnHover` (with `delay` / `closeDelay`) for one that opens on
 * hover or focus instead of a click; render it onto your own element with the `render` prop.
 */
function PopoverTrigger<Payload = unknown>(props: PopoverPrimitive.Trigger.Props<Payload>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * Wraps content that changes with the active trigger, so a shared popover can animate between
 * them. Needed only for a popover with several triggers; style the `[data-current]` and
 * `[data-previous]` children for the transition.
 */
function PopoverViewport(props: PopoverPrimitive.Viewport.Props) {
  return <PopoverPrimitive.Viewport data-slot="popover-viewport" {...props} />;
}

type PopoverContentProps = PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset' | 'anchor'> & {
    /** Classes for the positioner, the box that moves to the trigger (e.g. to animate that move). */
    positionerClassName?: string;
  };

/**
 * The floating surface. It shares the dropdown menu's look (same fill, ring, shadow, corners and
 * motion), so every popup in the extension matches; size it with `className`.
 */
function PopoverContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  anchor,
  className,
  positionerClassName,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className={cn('isolate z-50 outline-none', positionerClassName)}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--available-height) w-max max-w-72 min-w-45 origin-(--transform-origin) overflow-y-auto rounded-3xl p-1.5 outline-hidden',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverViewport, createPopoverHandle };
