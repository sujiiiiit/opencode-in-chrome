import type * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';

const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;

/**
 * A modal sheet for the side panel: it fills the panel's width (inset by a gutter) and caps its
 * height, over a scrim. Focus is trapped inside and returns to the trigger on close.
 */
function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="fixed inset-0 z-50 bg-scrim data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed inset-x-3 top-3 z-50 mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-chat flex-col overflow-hidden rounded-surface bg-popover text-popover-foreground shadow-surface-focus outline-none',
          'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

/**
 * A full-panel stage for media (the image viewer): edge to edge on a near-black backdrop, its
 * content fading in and out with it. Focus is trapped inside and returns to the trigger on close.
 */
function DialogStage({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-stage-backdrop"
        className="fixed inset-0 z-50 bg-viewer-backdrop data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-stage"
        className={cn(
          'fixed inset-0 z-50 flex flex-col text-viewer-text outline-none',
          'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-sm font-medium text-text-primary', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('sr-only', className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogStage, DialogTitle };
