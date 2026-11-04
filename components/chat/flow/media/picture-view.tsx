import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { cn } from 'cn';
import type { Picture } from './use-picture';

type Props = {
  src: string;
  alt: string;
  picture: Extract<Picture, { status: 'ready' }>;
  className?: string;
  style?: CSSProperties;
};

/**
 * A loaded picture, fading in the way the reply's words do. The scaled copy is drawn into a
 * canvas (it holds only the pixels on screen); a small image shows as itself.
 */
export function PictureView({ src, alt, picture, className, style }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { bitmap } = picture;

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element || !bitmap) return;
    element.width = bitmap.width;
    element.height = bitmap.height;
    element.getContext('2d')?.drawImage(bitmap, 0, 0);
  }, [bitmap]);

  const classes = cn('block animate-reveal', className);
  if (bitmap) return <canvas ref={canvas} role="img" aria-label={alt} data-streamdown="image" className={classes} style={style} />;
  return (
    <img
      src={src}
      alt={alt}
      // Sends no Referer, so the image's server does not learn which page asked.
      referrerPolicy="no-referrer"
      decoding="async"
      draggable={false}
      data-streamdown="image"
      className={classes}
      style={style}
    />
  );
}

/** A soft shade over a picture that opens, under the pointer (inside a Button, `group/button`). */
export function HoverShade() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-tile-hover opacity-0 transition-opacity duration-200 ease-(--ease-calm) group-hover/button:opacity-100"
    />
  );
}
