import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

/**
 * shadcn's base-luma Badge, plus Notion's badge colours: each hue (gray … teal) is the accent text on
 * its translucent tint, as Notion's "New" badge in the / menu. The radius lives on the size, not
 * the base, because `cn` does not see the custom `rounded-badge` as a radius and would keep both.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        destructive:
          'bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline',
        // Notion's hues: accent text on a translucent tint.
        gray: 'bg-gray-tint text-gray-accent',
        brown: 'bg-brown-tint text-brown-accent',
        orange: 'bg-orange-tint text-orange-accent',
        yellow: 'bg-yellow-tint text-yellow-accent',
        green: 'bg-green-tint text-green-accent',
        blue: 'bg-blue-tint text-blue-accent',
        purple: 'bg-purple-tint text-purple-accent',
        pink: 'bg-pink-tint text-pink-accent',
        red: 'bg-red-tint text-red-accent',
        teal: 'bg-teal-tint text-teal-accent',
      },
      size: {
        default:
          'h-5 rounded-3xl px-2 py-0.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
        // Notion's "New" badge: 11px medium text, 2px 4px padding, 4px corners.
        sm: 'rounded-badge px-1 py-0.5 type-badge',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type BadgeColor = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red' | 'teal';

function Badge({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>({ className: cn(badgeVariants({ variant, size }), className) }, props),
    render,
    state: { slot: 'badge', variant },
  });
}

export { Badge, badgeVariants };
