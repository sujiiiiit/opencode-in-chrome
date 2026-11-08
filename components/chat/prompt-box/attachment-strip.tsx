import { memo, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageViewer, type ImageItem } from '../flow/media/image-viewer';
import { PictureTile } from '../flow/media/picture-tile';
import type { ImageAttachment } from '@/lib/opencode/attachments';

type Props = {
  images: ImageAttachment[];
  onRemove: (id: string) => void;
};

type ThumbProps = { image: ImageAttachment; at: number; onOpen: (at: number) => void; onRemove: (id: string) => void };

/** One attached image: its tile, with an x (on hover or focus) that removes it. */
const Thumb = memo(function Thumb({ image, at, onOpen, onRemove }: ThumbProps) {
  return (
    <li className="group/thumb relative size-14 shrink-0 animate-thumb-in">
      {/* The light theme border keeps a white or transparent picture from blending into the card. */}
      <PictureTile src={image.url} name={image.name} at={at} onOpen={onOpen} className="size-full border border-border" />
      <Button
        variant="viewer"
        size="icon-xs"
        aria-label={`Remove ${image.name}`}
        className="absolute top-1 right-1 size-5 bg-tile-shade opacity-0 hover:bg-tile-shade-strong backdrop-blur-xs duration-200 transition-[opacity,background-color] ease-(--ease-calm) group-hover/thumb:opacity-100 group-focus-within/thumb:opacity-100 [&_svg]:size-3"
        onClick={() => onRemove(image.id)}
      >
        <Icon name="close" />
      </Button>
    </li>
  );
});

/**
 * The images attached to the draft, as one row of thumbnails above the text. The row never
 * wraps: it scrolls sideways, fading out at an edge only while there is more past it. A
 * thumbnail opens the same viewer a reply's images use. Memoized: the composer re-renders on
 * every keystroke, the row only when the images change.
 */
export const AttachmentStrip = memo(function AttachmentStrip({ images, onRemove }: Props) {
  const [viewing, setViewing] = useState<number | null>(null);
  const items = useMemo<ImageItem[]>(() => images.map((image) => ({ src: image.url, alt: image.name })), [images]);
  if (images.length === 0) return null;

  return (
    <>
      <ScrollArea
        horizontal
        fade="x"
        className="[--fade-x-max:2.5rem]"
        viewportClassName="overscroll-x-contain"
        scrollbarClassName="h-2!"
      >
        <ul aria-label="Attached images" className="flex w-max gap-2 px-3 pt-3 pb-2">
          {images.map((image, at) => (
            <Thumb key={image.id} image={image} at={at} onOpen={setViewing} onRemove={onRemove} />
          ))}
        </ul>
      </ScrollArea>
      <ImageViewer images={items} index={viewing !== null && viewing < items.length ? viewing : null} onIndexChange={setViewing} />
    </>
  );
});
