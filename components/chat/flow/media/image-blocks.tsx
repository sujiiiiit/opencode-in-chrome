import { Children, isValidElement, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import { defaultComponents, parseMarkdownIntoBlocks, type ExtraProps } from 'streamdown';
import { ImageGallery } from './image-gallery';
import type { ImageItem } from './image-viewer';

/** One markdown image: `![alt](url "title")`. */
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
/** A list item's marker at the start of a line (`- `, `* `, `1. `, `2) `). */
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm;

/** The images of a block made of nothing else (a paragraph, or a list whose items are only images). */
function imagesOnly(block: string): string[] | null {
  const images = block.match(IMAGE);
  if (!images) return null;
  const rest = block.replace(IMAGE, '').replace(LIST_MARKER, '').trim();
  return rest === '' ? images : null;
}

/** An image cut off before its `(`: `![alt]`, which Streamdown's healing leaves as plain text. */
const CUT_AT_ALT = /^!\[([^\]]*)\][ \t]*$/;

/**
 * The last block as a stand-in image when it is an image cut off at a step Streamdown's healing
 * does not cover: `![alt]` (before its `(`), or a lone `!` right after images (the next one
 * starting). Without this the set would drop a tile for that moment and add it back.
 */
function pendingImage(block: string, afterImages: boolean): string | null {
  const text = block.trim();
  if (text === '!' && afterImages) return '![](streamdown:incomplete-image)';
  const cut = CUT_AT_ALT.exec(text);
  return cut ? `![${cut[1]}](streamdown:incomplete-image)` : null;
}

/**
 * Streamdown's blocks, with each run of image-only blocks (images in their own paragraphs, or a
 * list of images) joined into one paragraph of images, which renders as a gallery. Blocks are
 * keyed by position, so a growing run stays one block and never remounts as it streams.
 */
export function parseBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length === 0) return;
    blocks.push(`${run.join('\n')}\n\n`);
    run = [];
  };
  const parsed = parseMarkdownIntoBlocks(markdown);
  parsed.forEach((block, at) => {
    const pending = at === parsed.length - 1 ? pendingImage(block, run.length > 0) : null;
    const images = pending ? [pending] : imagesOnly(block);
    if (images) {
      run.push(...images);
      return;
    }
    flush();
    blocks.push(block);
  });
  flush();
  return blocks;
}

type ImageProps = { node?: { tagName?: string }; src?: unknown; alt?: string; title?: string };

const SKIP = 'skip';

/** What one child of a paragraph is to a gallery: an image, nothing (space), or not an image. */
function asImage(child: ReturnType<typeof Children.toArray>[number]): ImageItem | typeof SKIP | null {
  if (typeof child === 'string') return child.trim() === '' ? SKIP : null;
  if (!isValidElement<ImageProps>(child)) return null;
  const tag = child.props.node?.tagName;
  if (tag === 'br') return SKIP;
  return tag === 'img' ? imageOf(child.props) : null;
}

/**
 * The image an `img` stands for. One still streaming in (Streamdown's stand-in) counts, as a
 * skeleton tile, so the set is a gallery from its second image on and never first renders as
 * loose images. Left out (SKIP): a source the sanitizer or the URL filter dropped.
 */
function imageOf({ src, alt, title }: ImageProps): ImageItem | typeof SKIP {
  return typeof src === 'string' && src !== '' ? { src, alt: alt ?? '', title } : SKIP;
}

/** The images of a paragraph holding two or more and nothing else, or null. */
function galleryOf(children: ReactNode): ImageItem[] | null {
  const images: ImageItem[] = [];
  for (const child of Children.toArray(children)) {
    const image = asImage(child);
    if (image === null) return null;
    if (image !== SKIP) images.push(image);
  }
  return images.length >= 2 ? images : null;
}

type ParagraphProps = ComponentProps<'p'> & ExtraProps;
const Paragraph = defaultComponents.p as ComponentType<ParagraphProps>;

/** A paragraph of images is a gallery; anything else is Streamdown's paragraph. */
export const ReplyParagraph = (props: ParagraphProps) => {
  const images = galleryOf(props.children);
  if (images) return <ImageGallery images={images} />;
  return <Paragraph {...props} />;
};
