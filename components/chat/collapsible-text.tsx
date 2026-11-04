import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from 'cn';

/** Height of the collapsed preview, and how much overflow is worth hiding behind a toggle. */
const COLLAPSED_PX = 240;
const SLACK_PX = 24;

/**
 * Long text, clamped to a faded preview with a Show more / Show less toggle. The height is
 * animated between two measured pixel values (a CSS transition cannot reach `auto`), and the
 * block opts out of scroll anchoring so the list does not jump while it grows or shrinks.
 */
export function CollapsibleText({ text, testId }: { text: string; testId?: string }) {
  const content = useRef<HTMLParagraphElement>(null);
  const [full, setFull] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // The text's own height, kept current when the width (and so the wrapping) changes.
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    setFull(element.scrollHeight);
    const observer = new ResizeObserver(() => setFull(element.scrollHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  const collapsible = full > COLLAPSED_PX + SLACK_PX;
  const open = expanded || !collapsible;

  return (
    <>
      <div
        data-collapsible={collapsible ? (open ? 'open' : 'closed') : undefined}
        className="collapsible-text overflow-hidden [overflow-anchor:none]"
        style={collapsible ? { height: open ? full : COLLAPSED_PX } : undefined}
      >
        <p ref={content} data-testid={testId} className="whitespace-pre-wrap wrap-anywhere">
          {text}
        </p>
      </div>
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            'mt-1 cursor-pointer self-start text-xs font-medium text-text-secondary',
            'transition-colors duration-200 hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none',
          )}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}
