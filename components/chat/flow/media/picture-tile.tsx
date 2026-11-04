import { memo, useRef } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { HoverShade, PictureView } from './picture-view';
import { usePicture } from './use-picture';

type Props = {
  src: string;
  name: string;
  /** Its place in the set it opens in the viewer. */
  at: number;
  onOpen: (at: number) => void;
  /** The tile's size (e.g. `size-14`). */
  className?: string;
};

/**
 * A square picture that opens the image viewer: an attached image in the composer, or one sent
 * with a message. Like a gallery tile it holds a copy scaled to the tile (`usePicture`), so a
 * large photo never sits decoded at full size behind a small square. The radius lives on the
 * wrapper, since Button's `fill` size is square.
 */
export const PictureTile = memo(function PictureTile({ src, name, at, onOpen, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const picture = usePicture(src, box, 'cover');
  return (
    <div ref={box} className={cn('relative shrink-0 overflow-hidden rounded-xl bg-background-tertiary-transparent', className)}>
      <Button variant="ghost" size="fill" aria-label={`Preview ${name}`} onClick={() => onOpen(at)}>
        {picture.status === 'ready' && (
          <PictureView src={src} alt="" picture={picture} className="absolute inset-0 size-full object-cover" />
        )}
        {picture.status === 'failed' && (
          <span className="absolute inset-0 flex items-center justify-center text-text-tertiary">
            <Icon name="image-off" className="size-5" />
          </span>
        )}
        <HoverShade />
      </Button>
    </div>
  );
});
