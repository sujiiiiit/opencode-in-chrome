import { memo, useContext, useRef, useState } from 'react';
import { cn } from 'cn';
import { StreamdownContext } from 'streamdown';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ImageViewer, nameOf, type ImageItem } from './image-viewer';
import { HoverShade, PictureView } from './picture-view';
import { CARD_ASPECT, HeldSpace, INCOMPLETE } from './reply-image';
import { usePicture } from './use-picture';

/** Tiles a gallery card shows; the last one carries "+N" for the rest. */
const MAX_TILES = 5;

/** A mosaic: CSS grid tracks and one area row per line (tiles take areas a, b, c, ... in order). */
type Mosaic = { columns: string; rows: string; areas: string[] };

/**
 * Pinterest-like mosaic families. Every card has one shape (CARD_ASPECT) whatever its count, so
 * its height is set once and never changes as images stream in or load: each image is cropped to
 * its tile. Within a family the first (largest) tile keeps its place and size as the set grows;
 * each new image only divides the remaining side. Index = tile count - 2.
 */
const FAMILIES: Mosaic[][] = [
  // Hero left: the first image takes the left three fifths.
  [
    { columns: '3fr 2fr', rows: '1fr', areas: ['a b'] },
    { columns: '3fr 2fr', rows: '1fr 1fr', areas: ['a b', 'a c'] },
    { columns: '3fr 2fr', rows: '1fr 1fr 1fr', areas: ['a b', 'a c', 'a d'] },
    { columns: '3fr 1fr 1fr', rows: '1fr 1fr', areas: ['a b c', 'a d e'] },
  ],
  // Hero top: the first image takes the top three fifths.
  [
    { columns: '1fr', rows: '3fr 2fr', areas: ['a', 'b'] },
    { columns: '1fr 1fr', rows: '3fr 2fr', areas: ['a a', 'b c'] },
    { columns: '1fr 1fr 1fr', rows: '3fr 2fr', areas: ['a a a', 'b c d'] },
    { columns: 'repeat(4, 1fr)', rows: '3fr 2fr', areas: ['a a a a', 'b c d e'] },
  ],
  // Hero right: the mirror of hero left.
  [
    { columns: '2fr 3fr', rows: '1fr', areas: ['b a'] },
    { columns: '2fr 3fr', rows: '1fr 1fr', areas: ['b a', 'c a'] },
    { columns: '2fr 3fr', rows: '1fr 1fr 1fr', areas: ['b a', 'c a', 'd a'] },
    { columns: '1fr 1fr 3fr', rows: '1fr 1fr', areas: ['b c a', 'd e a'] },
  ],
];

const AREAS = 'abcde';

/** A stable family per gallery (from its first image), so one reply keeps its mosaic as it grows. */
function mosaicFor(images: ImageItem[], tiles: number): Mosaic {
  let hash = 0;
  for (const char of images[0]?.src ?? '') hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FAMILIES[hash % FAMILIES.length]![tiles - 2]!;
}

type TileProps = { image: ImageItem; at: number; more: number; onOpen: (at: number) => void };

/**
 * One tile: a held box until the image nears the screen and loads (scaled to the tile), then the
 * image fades in over it, cropped to fill. The last tile of a long set dims under "+N".
 */
const Tile = memo(function Tile({ image, at, more, onOpen }: TileProps) {
  const box = useRef<HTMLSpanElement>(null);
  // A tile whose URL is still streaming in stays a skeleton.
  const picture = usePicture(image.src === INCOMPLETE ? null : image.src, box, 'cover');
  const name = nameOf(image);
  return (
    <span ref={box} className="relative block min-h-0 min-w-0" style={{ gridArea: AREAS[at] }}>
      <Button variant="ghost" size="fill" aria-label={more > 0 ? `View ${more} more images` : `View ${name}`} onClick={() => onOpen(at)}>
        {picture.status !== 'ready' && <HeldSpace fade={false} className="absolute inset-0" />}
        {picture.status === 'failed' && (
          <span className="absolute inset-0 flex items-center justify-center text-text-tertiary">
            <Icon name="image-off" className="size-5" />
          </span>
        )}
        {picture.status === 'ready' && <PictureView src={image.src} alt={image.alt} picture={picture} className="absolute inset-0 size-full object-cover" />}
        <HoverShade />
        {more > 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-tile-shade type-body font-medium text-viewer-text tabular-nums backdrop-blur-xs">
            +{more}
          </span>
        )}
      </Button>
    </span>
  );
});

/**
 * Several images in a row of a reply, as one rounded card with no border: a mosaic of up to
 * five tiles with no space between them, each image cropped to
 * fill its tile. A longer set shows a frosted "+N" on the last tile. Any tile opens the viewer
 * there, to step through the whole set.
 */
export const ImageGallery = memo(function ImageGallery({ images }: { images: ImageItem[] }) {
  const streaming = useContext(StreamdownContext).isAnimating;
  // A live reply fades the card in with its text; a settled one (history) shows it as it is.
  const [enterAnimated] = useState(streaming);
  const [viewing, setViewing] = useState<number | null>(null);
  const tiles = Math.min(images.length, MAX_TILES);
  const mosaic = mosaicFor(images, tiles);
  const hidden = images.length - tiles;
  // Only whole images can be viewed; a streaming one is always last, so tile positions still match.
  const viewable = images.filter((image) => image.src !== INCOMPLETE);

  return (
    <span data-streamdown="image-wrapper" data-gallery={images.length} className="block">
      {/* No border: the images are the edge. While they load, each tile is a pulsing skeleton. */}
      <span
        className={cn(
          'grid w-full max-w-md overflow-hidden rounded-media bg-background-tertiary-transparent',
          enterAnimated && 'animate-reveal',
        )}
        style={{
          gridTemplateColumns: mosaic.columns,
          gridTemplateRows: mosaic.rows,
          gridTemplateAreas: mosaic.areas.map((row) => `"${row}"`).join(' '),
          aspectRatio: CARD_ASPECT,
        }}
      >
        {images.slice(0, tiles).map((image, at) => (
          <Tile
            key={`${at}:${image.src}`}
            image={image}
            at={at}
            more={at === tiles - 1 ? hidden : 0}
            onOpen={(index) => index < viewable.length && setViewing(index)}
          />
        ))}
      </span>
      <ImageViewer images={viewable} index={viewing} onIndexChange={setViewing} />
    </span>
  );
});
