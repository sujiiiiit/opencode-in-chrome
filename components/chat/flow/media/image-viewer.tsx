import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogDescription, DialogStage, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import SquiggleLoader from '@/components/ui/squiggle-loader';

export type ImageItem = { src: string; alt: string; title?: string };

/** The name an image goes by: its alt text, its title, or a plain "Image". */
export function nameOf(image: { alt?: string; title?: string }): string {
  return image.alt?.trim() || image.title?.trim() || 'Image';
}

/** A horizontal drag this long (px) moves to the next or previous image. */
const SWIPE_PX = 48;

type Props = {
  images: ImageItem[];
  /** The image showing, or null while the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

/** Starts the neighbours downloading, so stepping through the set never waits. */
function usePreload(images: ImageItem[], index: number | null) {
  useEffect(() => {
    if (index === null) return;
    for (const near of [index + 1, index - 1]) {
      const image = images[near];
      if (!image) continue;
      const preload = new Image();
      preload.referrerPolicy = 'no-referrer';
      preload.src = image.src;
    }
  }, [images, index]);
}

/** The full-size image on the stage: a loader until it arrives, then the same calm fade. */
function StageImage({ image }: { image: ImageItem }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  if (state === 'failed') {
    return (
      <span className="flex flex-col items-center gap-2 text-viewer-text-secondary">
        <Icon name="image-off" className="size-6" />
        <span className="type-work">Couldn't load this image</span>
      </span>
    );
  }
  return (
    <>
      {state === 'loading' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <SquiggleLoader width={28} height={18} strokeColor="var(--viewer-text-secondary)" />
        </span>
      )}
      <img
        src={image.src}
        alt={image.alt}
        referrerPolicy="no-referrer"
        decoding="async"
        draggable={false}
        onLoad={() => setState('loaded')}
        onError={() => setState('failed')}
        className={state === 'loaded' ? 'max-h-full max-w-full animate-reveal object-contain select-none' : 'sr-only'}
      />
    </>
  );
}

/**
 * One viewer for a reply's images, alone or as a set, shown the way Google Drive shows files: a
 * dark full-panel stage with the image fitted inside, its name and place in the set above, and
 * arrows at the sides. Arrow keys and a swipe step through the set; Escape closes.
 */
export function ImageViewer({ images, index, onIndexChange }: Props) {
  const swipe = useRef<number | null>(null);
  // Focus lands on the stage, not the first button: arrow keys work at once, and no control
  // opens already ringed.
  const stage = useRef<HTMLDivElement>(null);
  usePreload(images, index);
  const current = index === null ? undefined : images[index];
  // While the stage fades out on close, it keeps showing the image it closed on.
  const lastShown = useRef<ImageItem | undefined>(undefined);
  if (current) lastShown.current = current;
  const image = current ?? lastShown.current;
  const many = images.length > 1;
  const step = (by: number) => {
    if (index !== null && many) onIndexChange((index + by + images.length) % images.length);
  };

  const onPointerDown = (event: PointerEvent) => {
    swipe.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (start === null || Math.abs(event.clientX - start) < SWIPE_PX) return;
    step(event.clientX < start ? 1 : -1);
  };

  return (
    <Dialog open={current !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogStage
        initialFocus={stage}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') step(1);
          else if (event.key === 'ArrowLeft') step(-1);
        }}
      >
        {image && (
          <>
            <div className="flex h-12 shrink-0 items-center gap-3 px-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <DialogTitle className="truncate type-work font-normal text-viewer-text">{nameOf(image)}</DialogTitle>
                {many && (
                  <span className="text-xs text-viewer-text-secondary tabular-nums">
                    {(index ?? 0) + 1} of {images.length}
                  </span>
                )}
              </div>
              <DialogDescription>Use the arrow keys to move between images.</DialogDescription>
              {/^https?:/i.test(image.src) && (
                <Button
                  variant="viewer"
                  size="icon-sm"
                  nativeButton={false}
                  render={<a href={image.src} target="_blank" rel="noopener noreferrer" />}
                  aria-label="Open original in a new tab"
                >
                  <Icon name="open-external" />
                </Button>
              )}
              <DialogClose render={<Button variant="viewer" size="icon-sm" aria-label="Close" />}>
                <Icon name="close" />
              </DialogClose>
            </div>
            <div
              ref={stage}
              tabIndex={-1}
              className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-3 pb-3 outline-none sm:px-14"
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
            >
              {/* Keyed by position: each image enters with its own fade. */}
              <StageImage key={`${index}:${image.src}`} image={image} />
              {many && (
                <>
                  <Button variant="viewer" size="icon" aria-label="Previous image" className="absolute top-1/2 left-2 -translate-y-1/2" onClick={() => step(-1)}>
                    <Icon name="arrow-left" />
                  </Button>
                  <Button variant="viewer" size="icon" aria-label="Next image" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={() => step(1)}>
                    <Icon name="arrow-right" />
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogStage>
    </Dialog>
  );
}
