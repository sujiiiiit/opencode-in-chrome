import { memo } from 'react';
import { cn } from 'cn';
import { BLOCK_COMPONENTS, codePlugin } from './markdown-blocks';
import { parseBlocks } from './media/image-blocks';
import { IMAGE_SOURCE } from './media/reply-image';
import {
  defaultRehypePlugins,
  defaultRemarkPlugins,
  Streamdown,
  type AnimateOptions,
  type ControlsConfig,
  type StreamdownProps,
  type UrlTransform,
} from 'streamdown';

type MdNode = { type: string; value?: string; children?: MdNode[] };

/**
 * Raw HTML in a reply shows as the text it is. The model writes `<div>` about code far more often
 * than it means markup, and nothing it sends is ever parsed as HTML (so no tag, attribute or
 * handler from the server reaches the page).
 */
function remarkHtmlAsText() {
  const walk = (node: MdNode) => {
    if (node.type === 'html') node.type = 'text';
    node.children?.forEach(walk);
  };
  return walk;
}

type SanitizeSchema = { protocols?: Record<string, string[] | undefined> };
const [sanitize, schema] = defaultRehypePlugins.sanitize as [unknown, SanitizeSchema];

/** Streamdown's sanitizer, letting an image's source also be inline data (`data:image/...`). */
const sanitizeWithDataImages = [
  sanitize,
  { ...schema, protocols: { ...schema.protocols, src: [...(schema.protocols?.src ?? []), 'data'] } },
];

// Streamdown's sanitizer and hardening, without its raw-HTML pass (nothing is HTML any more).
const rehypePlugins = [sanitizeWithDataImages, defaultRehypePlugins.harden] as StreamdownProps['rehypePlugins'];
const remarkPlugins = [...Object.values(defaultRemarkPlugins), remarkHtmlAsText] as StreamdownProps['remarkPlugins'];

/** Links only to the web and mail; images from the web or inline data (see reply-image.tsx). */
const urlTransform: UrlTransform = (url, key) => {
  if (key === 'src') return IMAGE_SOURCE.test(url) ? url : null;
  return /^(https?:|mailto:)/i.test(url) ? url : null;
};

/** Arrival drives the reveal. Streamdown compresses each batch's stagger to this short backlog. */
/** Highlighting for the code blocks (see markdown-blocks.tsx). */
const PLUGINS: StreamdownProps['plugins'] = { code: codePlugin };

const ANIMATION: AnimateOptions = {
  animation: 'fadeIn', duration: 120, easing: 'ease-out', sep: 'word', stagger: 2, maxBacklogMs: 48,
};

const CONTROLS: ControlsConfig = { mermaid: false, image: false };

type Props = {
  text: string;
  /** `work` is one step smaller, for text inside an open work group. */
  size?: 'body' | 'work';
  /** Only the currently growing part animates. Earlier parts render as settled text. */
  animate: boolean;
  className?: string;
};

/**
 * A reply's markdown (Streamdown): GFM, highlighted code, unfinished syntax healed while it
 * streams, and each settled block memoized so only the growing tail re-renders. Once the stream
 * stops (and its last words have faded in) the text renders without the per-word wrappers.
 */
export const Markdown = memo(function Markdown({ text, animate, size = 'body', className }: Props) {
  return (
    <Streamdown
      // Spacing, headings, lists, tables and code are sized for the narrow panel by `.reply-md`
      // (global.css), not by Streamdown's page-sized defaults.
      className={cn('reply-md min-w-0 text-text-primary wrap-anywhere', size === 'work' ? 'type-work' : 'type-body', className)}
      mode="streaming"
      isAnimating={animate}
      animated={ANIMATION}
      plugins={PLUGINS}
      components={BLOCK_COMPONENTS}
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      urlTransform={urlTransform}
      controls={CONTROLS}
      // Runs of images join into one block, so they render as one gallery.
      parseMarkdownIntoBlocksFn={parseBlocks}
      // No confirmation dialog: a link opens in a new tab on click.
      linkSafety={{ enabled: false }}
      dir="auto"
    >
      {text}
    </Streamdown>
  );
});

/** A code fence that holds `code` whatever backticks it contains. */
export function fenced(code: string, language: string): string {
  const longest = Math.max(0, ...Array.from(code.matchAll(/`+/g), (m) => m[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${code.replace(/\n$/, '')}\n${fence}`;
}
