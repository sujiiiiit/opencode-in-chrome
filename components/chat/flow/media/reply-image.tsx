import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { cn } from 'cn';
import { StreamdownContext, type Components } from 'streamdown';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ImageViewer, nameOf, type ImageItem } from './image-viewer';
import { HoverShade, PictureView } from './picture-view';
import { usePicture, type Picture } from './use-picture';

/** Streamdown's stand-in (from remend) for an image whose `](url)` has not streamed in yet. */
export const INCOMPLETE = 'streamdown:incomplete-image';

/** Image sources a reply may use at all: the web, inline data, and the streaming stand-in. */
export const IMAGE_SOURCE = /^(?:https?:|data:image\/|streamdown:incomplete-image$)/i;

/**
 * The shape of every gallery card and of a lone image's skeleton until its size is known: when a
 * second image starts streaming in, the one box divides into tiles of the same card, and the card
 * keeps that height however many images follow.
 */
export const CARD_ASPECT = '4 / 3';

/** The tallest a lone image is drawn (28rem), in px. */
const MAX_HEIGHT = 448;
const GLIDE_MS = 320;

export function hostOf(src: string): string {
  try {
    return new URL(src).host;
  } catch {
    return src;
  }
}

/**
 * When `state` changes, the box glides from its old height to its new one (the panel's calm
 * curve) instead of jumping, while the new content fades in. Off screen it just takes the new
 * height: nobody would see the glide, and it would cost a layout every frame.
 */
export function useHeightGlide(box: RefObject<HTMLElement | null>, state: string) {
  const last = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const from = last.current;
    const rect = element.getBoundingClientRect();
    last.current = rect.height;
    if (from === null || Math.abs(from - rect.height) < 1 || typeof element.animate !== 'function') return;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const easing = getComputedStyle(element).getPropertyValue('--ease-calm').trim() || 'ease-out';
    element.style.overflow = 'hidden';
    const glide = element.animate([{ height: `${from}px` }, { height: `${rect.height}px` }], { duration: GLIDE_MS, easing });
    const settle = () => {
      element.style.overflow = '';
    };
    glide.onfinish = settle;
    glide.oncancel = settle;
    return () => glide.cancel();
  }, [box, state]);
}

/** A soft box that holds a picture's place while it streams in or loads. */
export function HeldSpace({ fade, className, style }: { fade: boolean; className?: string; style?: CSSProperties }) {
  // Two layers: the fade and the pulse are both animations, so each needs its own element.
  return (
    <span className={cn('block', fade && 'animate-reveal', className)} style={style}>
      <span className="block size-full animate-pulse bg-background-tertiary-transparent" />
    </span>
  );
}

/** A quiet card in the work group's style, in place of an image that could not load. */
function FailedNote({ name, source, fade }: { name: string; source: string; fade: boolean }) {
  return (
    <span
      className={cn(
        'flex w-full max-w-sm min-w-0 items-center gap-2.5 rounded-media border border-border-strong-transparent py-2 pr-2 pl-3',
        fade && 'animate-reveal',
      )}
    >
      <Icon name="image-off" className="size-4 shrink-0 text-text-secondary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-work text-text-primary">{name}</span>
        <span className="truncate text-xs text-text-secondary">{`Couldn't load from ${hostOf(source)}`}</span>
      </span>
    </span>
  );
}

/** Its own shape, no wider than the column or the image, no taller than MAX_HEIGHT. */
function naturalSize(picture: { width: number; height: number }): CSSProperties {
  const ratio = picture.width / picture.height;
  return { aspectRatio: `${picture.width} / ${picture.height}`, width: `min(100%, ${picture.width}px, ${Math.round(MAX_HEIGHT * ratio)}px)` };
}

/** The loaded image, in its own shape, opening the viewer. */
function LoneImage({ item, picture }: { item: ImageItem; picture: Extract<Picture, { status: 'ready' }> }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const name = nameOf(item);
  return (
    <>
      {/* The rounding lives on this frame, as on a gallery card: `cn` does not know `rounded-media`
          is a radius, so on the Button it could not override `fill`'s rounded-none. */}
      <span className="block overflow-hidden rounded-media" style={naturalSize(picture)}>
        <Button variant="ghost" size="fill" aria-label={`View ${name}`} onClick={() => setViewing(0)}>
          <PictureView src={item.src} alt={item.alt} picture={picture} className="size-full object-cover" />
          <HoverShade />
        </Button>
      </span>
      <ImageViewer images={[item]} index={viewing} onIndexChange={setViewing} />
    </>
  );
}

type StateProps = { item: ImageItem; picture: Picture; fadeIn: boolean; changed: boolean };

/** What a lone image shows: a held box, the image, or why it is missing (fading in when it changed). */
function ImageState({ item, picture, fadeIn, changed }: StateProps) {
  if (picture.status === 'ready') return <LoneImage item={item} picture={picture} />;
  if (picture.status === 'failed') return <FailedNote name={nameOf(item)} source={item.src} fade={fadeIn || changed} />;
  // Until the download reveals the image's size, the card's shape; then the image's own, so the
  // image fades in without moving anything.
  const sized = picture.width && picture.height ? naturalSize({ width: picture.width, height: picture.height }) : null;
  return (
    <HeldSpace
      fade={fadeIn}
      className="w-full max-w-md overflow-hidden rounded-media"
      style={sized ?? { aspectRatio: CARD_ASPECT }}
    />
  );
}

/**
 * A lone image in a reply, in its own shape. It loads when it nears the screen, scaled to the
 * size it is drawn, and fades in like the words around it; until then a soft box holds its place,
 * and the box glides to the image's height rather than jumping. It opens in the image viewer.
 * A live reply fades the held box in with its text; a settled one (history) shows it as it is.
 */
export const ReplyImage: Components['img'] = ({ src, alt, title, node: _node }) => {
  const source = typeof src === 'string' ? src : '';
  const streaming = useContext(StreamdownContext).isAnimating;
  // Read once: the stream ending must not start a fade on what is already shown.
  const [enterAnimated] = useState(streaming);
  const box = useRef<HTMLSpanElement>(null);
  const incomplete = source === INCOMPLETE;
  const picture = usePicture(source && !incomplete ? source : null, box, 'natural');
  const [firstStatus] = useState(picture.status);

  // Glides when the skeleton takes the image's shape; the image then fades in at that same size.
  useHeightGlide(box, picture.status === 'waiting' && picture.width ? 'sized' : picture.status);

  if (!source) return null;
  const item: ImageItem = { src: source, alt: alt ?? '', title };

  return (
    <span ref={box} data-streamdown="image-wrapper" data-incomplete={incomplete || undefined} className="relative block max-w-full">
      <ImageState item={item} picture={picture} fadeIn={enterAnimated} changed={picture.status !== firstStatus} />
    </span>
  );
};
