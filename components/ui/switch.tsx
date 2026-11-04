import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from 'cn';

/** An on/off toggle. Give it an accessible name (`aria-label` or a wrapping label). */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input p-px outline-none transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/30 data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-3.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
