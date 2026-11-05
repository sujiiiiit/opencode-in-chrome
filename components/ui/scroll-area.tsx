import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "cn"

function ScrollArea({
  className,
  children,
  fade = false,
  horizontal = false,
  viewportClassName,
  viewportProps,
  scrollbarClassName,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  /** Classes for the scrolling viewport (e.g. a `max-h-*` so the area grows with its content). */
  viewportClassName?: string
  /** Props for the viewport itself: its ref, scroll handler, or accessible label. */
  viewportProps?: Omit<ScrollAreaPrimitive.Viewport.Props, "className" | "children">
  /** Classes for the vertical scrollbar track (Base UI sets top/bottom inline: use `!` to override). */
  scrollbarClassName?: string
  /**
   * Fade content out at the edges while there is more to scroll: `true` or `"y"` at the
   * top/bottom, `"x"` at the left/right (for a `horizontal` area).
   */
  fade?: boolean | "x" | "y"
  /**
   * Let content grow wider than the viewport and scroll sideways (with a horizontal scrollbar
   * that shows on hover or while scrolling). Off by default: Base UI
   * sizes the content `min-width: fit-content`, so one long unbreakable line (a URL, a code
   * line) would widen everything; vertical-only areas pin the content to the viewport width.
   */
  horizontal?: boolean
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        {...viewportProps}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          fade === "x" ? "scroll-fade-x" : fade && "scroll-fade-y",
          viewportClassName
        )}
      >
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          style={horizontal ? undefined : { minWidth: 0, width: "100%" }}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {horizontal ? (
        <ScrollBar
          orientation="horizontal"
          className={cn(
            "opacity-0 transition-opacity duration-200 data-hovering:opacity-100 data-scrolling:opacity-100",
            scrollbarClassName
          )}
        />
      ) : (
        <ScrollBar className={scrollbarClassName} />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
