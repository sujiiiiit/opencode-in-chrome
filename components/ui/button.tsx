import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-transparent dark:hover:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: [
          'text-text-primary',
          'hover:bg-background-tertiary-transparent',
          'active:bg-[rgb(from_var(--color-background-tertiary-transparent)_r_g_b_/_calc(alpha_*_(1_+_1_*_1)))]',
          'dark:active:bg-[rgb(from_var(--color-background-tertiary-transparent)_r_g_b_/_calc(alpha_*_(1_+_0.5_*_1)))]'
        ].join(' '),
        // Secondary text that comes forward on hover: disclosure rows in a reply's work group.
        quiet: [
          'text-text-secondary',
          'hover:bg-background-secondary-transparent hover:text-text-primary',
          'aria-expanded:text-text-primary',
        ].join(' '),
        // Controls on the image viewer's dark stage: a white tint that firms up on hover.
        viewer: 'bg-viewer-control text-viewer-text hover:bg-viewer-control-hover focus-visible:ring-viewer-text/40',
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        lg: "h-11 px-5 gap-2 text-sm leading-[1.2] [&_svg:not([class*='size-'])]:size-5",
        default:
          "h-8 px-3 gap-1.5 text-sm leading-[1.2] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 px-2 gap-1.5 text-sm leading-[1.2] [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-6 px-2 gap-1 text-xs leading-[1.2] font-normal [&_svg:not([class*='size-'])]:size-3",
        // A full-width list row (e.g. a chat in History): left-aligned, and
        // shaded while it is the current item (aria-current).
        row: "h-9.5 min-w-0 flex-1 justify-start gap-2 rounded-2xl py-2 pl-3 pr-2 text-left font-normal aria-[current=page]:bg-background-tertiary-transparent",
        // A one-line disclosure (a work group's header, a tool call): left-aligned, full width,
        // text that can truncate. Pair with the `quiet` variant.
        disclosure:
          "h-7 w-full min-w-0 justify-start gap-2 rounded-[0.5rem] px-1.5 text-left type-work font-normal disabled:opacity-100 [&_svg:not([class*='size-'])]:size-3.5",
        // A line inside an open work group (a tool call): one 20px line, set one step down.
        step:
          "h-5 w-full min-w-0 justify-start gap-2 rounded-[0.5rem] px-0 text-left type-work font-normal disabled:opacity-100 [&_svg:not([class*='size-'])]:size-3.5",
        // 40px box with an 18px glyph: the pairing that lines an icon button
        // up with a 40px input in a toolbar row, where icon-xl's 28px glyph
        "icon-field":
          "size-10 [&_svg:not([class*='size-'])]:size-4.5 [&_svg]:stroke-icon-secondary hover:[&_svg]:stroke-icon-primary focus-visible:[&_svg]:stroke-icon-primary [&_svg]:transition-colors",
        // Fills its cell edge to edge with no rounding: a picture that opens (a gallery tile).
        fill: "relative block size-full overflow-hidden rounded-none border-0 p-0 focus-visible:ring-inset",
        "icon-xl": "size-10 [&_svg:not([class*='size-'])]:size-7",
        "icon-lg": "size-8.5 [&_svg:not([class*='size-'])]:size-4.5",
        icon: "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
