import type { ComponentProps } from 'react';
import { cn } from 'cn';

/**
 * A quiet placeholder block for content that is still loading. Size and round it with `className`
 * to match what will replace it. It pulses softly, and holds still for reduced motion.
 */
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-2xl bg-background-tertiary motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
