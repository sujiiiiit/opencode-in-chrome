import type { ReactNode } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverViewport,
  createPopoverHandle,
} from '@/components/ui/popover';
import type { CatalogModel, CatalogProvider } from '@/lib/opencode/models/catalog';
import { ModelCard } from './model-card';

/** What a row hands the shared card: the model to describe and its provider. */
export type ModelCardPayload = { model: CatalogModel; provider: CatalogProvider | undefined };

/** One handle per list: every row's trigger and the single card are tied together through it. */
export const createModelCardHandle = () => createPopoverHandle<ModelCardPayload>();
export type ModelCardHandle = ReturnType<typeof createModelCardHandle>;

// The card is one popover that glides from row to row (a Base UI popover with detached triggers),
// not one popover per row. These classes animate that glide and are kept here, not in the shared
// popover, because only this card moves between triggers.
const POSITIONER =
  'h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom,transform] duration-300 ease-(--ease-calm) data-instant:transition-none';
const POPUP =
  'h-(--popup-height,auto) w-(--popup-width,auto) max-w-none overflow-hidden transition-[width,height] duration-300 ease-(--ease-calm) data-instant:transition-none';
// The old content slides out and the new slides in, away from and toward the row the card moved to.
// Written out in full: Tailwind finds classes by scanning the source, so none can be assembled here.
const VIEWPORT = [
  'relative h-full w-full overflow-clip',
  '[&_[data-current]]:translate-y-0 [&_[data-current]]:opacity-100 [&_[data-current]]:transition-[translate,opacity] [&_[data-current]]:duration-300 [&_[data-current]]:ease-(--ease-calm)',
  '[&_[data-previous]]:translate-y-0 [&_[data-previous]]:opacity-100 [&_[data-previous]]:transition-[translate,opacity] [&_[data-previous]]:duration-300 [&_[data-previous]]:ease-(--ease-calm)',
  '[&_[data-current][data-starting-style]]:opacity-0 [&_[data-previous][data-ending-style]]:opacity-0',
  "data-[activation-direction~='down']:[&_[data-current][data-starting-style]]:translate-y-3 data-[activation-direction~='down']:[&_[data-previous][data-ending-style]]:-translate-y-3",
  "data-[activation-direction~='up']:[&_[data-current][data-starting-style]]:-translate-y-3 data-[activation-direction~='up']:[&_[data-previous][data-ending-style]]:translate-y-3",
].join(' ');

/** The single card. Render it once; rows open it through `ModelCardTrigger`. */
export function ModelCardPopover({ handle }: { handle: ModelCardHandle }) {
  return (
    <Popover handle={handle}>
      {({ payload }) => (
        <PopoverContent
          side="right"
          sideOffset={12}
          initialFocus={false}
          positionerClassName={POSITIONER}
          className={POPUP}
        >
          <PopoverViewport className={VIEWPORT}>
            {payload && <ModelCard model={payload.model} provider={payload.provider} />}
          </PopoverViewport>
        </PopoverContent>
      )}
    </Popover>
  );
}

/** A row that opens the shared card with its model while hovered or focused. */
export function ModelCardTrigger({
  handle,
  payload,
  className,
  children,
}: {
  handle: ModelCardHandle;
  payload: ModelCardPayload;
  className?: string;
  children: ReactNode;
}) {
  return (
    <PopoverTrigger
      handle={handle}
      payload={payload}
      openOnHover
      delay={250}
      closeDelay={120}
      nativeButton={false}
      render={<label className={className} />}
    >
      {children}
    </PopoverTrigger>
  );
}
