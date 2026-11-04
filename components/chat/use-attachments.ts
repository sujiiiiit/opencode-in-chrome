import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { attachImage, releaseImage, type ImageAttachment } from '@/lib/opencode/attachments';
import type { PromptBoxHandle } from './prompt-box/prompt-box';

/**
 * The images attached to the draft. A send takes them (`take`) and a failed send puts them back
 * (`restore`); a ref keeps the current set readable from async handlers.
 */
export function useAttachedImages(
  box: RefObject<PromptBoxHandle | null>,
  /** Where a file that cannot be attached is reported. */
  notices: { notify: (message: string) => void } | null | undefined,
) {
  const [images, setState] = useState<ImageAttachment[]>([]);
  const current = useRef<ImageAttachment[]>([]);
  const update = useCallback((next: (images: ImageAttachment[]) => ImageAttachment[]) => {
    current.current = next(current.current);
    setState(current.current);
  }, []);
  // Whatever is still attached when the composer goes releases its object URL.
  useEffect(() => () => current.current.forEach(releaseImage), []);

  const addFiles = useCallback(
    (files: File[]) => {
      const results = files.map(attachImage);
      const added = results.flatMap((result) => ('image' in result ? [result.image] : []));
      const errors = results.flatMap((result) => ('error' in result ? [result.error] : []));
      if (added.length) update((images) => [...images, ...added]);
      if (errors.length) notices?.notify(errors.join(' '));
      box.current?.focus();
    },
    [box, notices, update],
  );

  const removeImage = useCallback(
    (id: string) => {
      current.current.filter((image) => image.id === id).forEach(releaseImage);
      update((images) => images.filter((image) => image.id !== id));
    },
    [update],
  );

  /** The attached images, leaving the composer empty of them. */
  const take = useCallback(() => {
    const taken = current.current;
    update(() => []);
    return taken;
  }, [update]);

  /** Puts a failed send's images back, before anything attached meanwhile. */
  const restore = useCallback((taken: ImageAttachment[]) => update((images) => [...taken, ...images]), [update]);

  return { images, current, addFiles, removeImage, take, restore };
}
