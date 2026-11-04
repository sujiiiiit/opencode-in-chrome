import { useEffect, useState, type RefObject } from 'react';
import { enqueue } from './load-queue';

/** `cover` fills a fixed tile (cropped); `natural` keeps the image's own shape. */
export type Fit = 'cover' | 'natural';

export type Picture =
  /** Not loaded yet. `width` and `height` arrive early, as soon as the download reveals them. */
  | { status: 'waiting'; width?: number; height?: number }
  | { status: 'failed' }
  /** `bitmap` is the image scaled to its box; null shows the original (it was small enough). */
  | { status: 'ready'; width: number; height: number; bitmap: ImageBitmap | null };

/** How far ahead of the screen an image starts to load. */
const AHEAD = '600px 0px';
/** Below this much shrinking a scaled copy saves too little to be worth making. */
const WORTH_SCALING = 0.8;

/**
 * Resolves once the image is downloaded and decodable; rejects if it cannot be shown. `onSize`
 * hears the image's size as soon as the browser knows it, from the first bytes of the download,
 * well before the image has arrived.
 */
function fetchImage(src: string, onSize?: (width: number, height: number) => void): Promise<HTMLImageElement> {
  const image = new Image();
  // Sends no Referer, so the image's server does not learn which page asked.
  image.referrerPolicy = 'no-referrer';
  image.decoding = 'async';
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image failed'));
  });
  image.src = src;
  if (onSize && typeof requestAnimationFrame === 'function') {
    let frame = 0;
    const watch = () => {
      if (image.naturalWidth > 0) onSize(image.naturalWidth, image.naturalHeight);
      else frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    void loaded.then(
      () => cancelAnimationFrame(frame),
      () => cancelAnimationFrame(frame),
    );
  }
  return loaded.then(() => (typeof image.decode === 'function' ? image.decode().then(() => image, () => image) : image));
}

/** How much to shrink a `width` x `height` image to fill a box at the screen's density. */
function scaleFor(width: number, height: number, box: DOMRect, fit: Fit): number {
  const density = window.devicePixelRatio || 1;
  const across = box.width / width;
  const scale = fit === 'cover' ? Math.max(across, box.height / height) : across;
  return Math.min(1, scale * density);
}

/**
 * A copy of the image at the size it is drawn (cropping nothing), so a 4000px photo shown 400px
 * wide holds a 400px bitmap in memory rather than a 48 MB one. Null when the image is already
 * about that size or the browser cannot scale it (the original is shown instead).
 */
async function scaled(image: HTMLImageElement, box: DOMRect, fit: Fit): Promise<ImageBitmap | null> {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (typeof createImageBitmap !== 'function' || box.width <= 0 || width <= 0 || height <= 0) return null;
  const scale = scaleFor(width, height, box, fit);
  if (scale > WORTH_SCALING) return null;
  try {
    return await createImageBitmap(image, {
      resizeWidth: Math.max(1, Math.round(width * scale)),
      resizeHeight: Math.max(1, Math.round(height * scale)),
      resizeQuality: 'high',
    });
  } catch {
    return null;
  }
}

/** Calls `onNear` once `element` comes within reach of the screen (at once without an observer). */
function whenNear(element: Element, onNear: () => void): () => void {
  if (typeof IntersectionObserver !== 'function') {
    onNear();
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      onNear();
    },
    { rootMargin: AHEAD },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Loads `src` for the element in `box`, cheaply: nothing is fetched until the box nears the
 * screen, downloads wait their turn in the panel's queue, and the result is scaled down to the
 * box (see `scaled`). The original is released once the scaled copy exists. For a `natural` fit
 * the size is reported while still waiting, so the box can take the image's shape before it shows.
 */
export function usePicture(src: string | null, box: RefObject<HTMLElement | null>, fit: Fit): Picture {
  const [picture, setPicture] = useState<{ src: string; picture: Picture } | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!src || !element) return;
    let live = true;
    let bitmap: ImageBitmap | null = null;
    let cancelQueued = () => {};
    const stopWatching = whenNear(element, () => {
      cancelQueued = enqueue(async () => {
        if (!live) return;
        try {
          // Only a natural-shaped picture needs its size early: its box takes that shape at once.
          const onSize = fit === 'natural'
            ? (width: number, height: number) => live && setPicture({ src, picture: { status: 'waiting', width, height } })
            : undefined;
          const image = await fetchImage(src, onSize);
          bitmap = live ? await scaled(image, element.getBoundingClientRect(), fit) : null;
          if (!live) return;
          const ready: Picture = { status: 'ready', width: image.naturalWidth, height: image.naturalHeight, bitmap };
          // The scaled copy replaces the original: let the full-size decode go.
          if (bitmap) image.src = '';
          setPicture({ src, picture: ready });
        } catch {
          if (live) setPicture({ src, picture: { status: 'failed' } });
        }
      });
    });
    return () => {
      live = false;
      stopWatching();
      cancelQueued();
      bitmap?.close();
    };
  }, [src, box, fit]);

  return picture && picture.src === src ? picture.picture : { status: 'waiting' };
}
