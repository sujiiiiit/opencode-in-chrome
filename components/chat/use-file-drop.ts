import { useEffect, useRef, useState } from 'react';
import { isFileDrag, transferFiles } from '@/lib/transfer-files';

/**
 * How long a drag that left (a `dragleave` with no element entered) waits before the overlay
 * goes. A drag still over the panel fires `dragover` far sooner (Chrome: every ~50ms), which
 * cancels it; leaving the window, or Escape, lets it run out.
 */
export const LEAVE_GRACE_MS = 100;

/**
 * Lets files dragged from the system (Explorer, Finder, a desktop) drop anywhere on the panel.
 * Returns whether such a drag is over it now, for the drop overlay.
 *
 * Listens on `window`, so the drop zone is the whole panel and moving between its elements never
 * flickers the overlay: `dragover` keeps it up and only a leave out of the window (or Escape,
 * which ends the drag the same way) takes it down. Text or a link dragged within the page carries
 * no files and is left alone. A file drop is always swallowed, even while `enabled` is false, so
 * the browser never opens the file in place of the panel.
 */
export function useFileDrop(onFiles: (files: File[]) => void, enabled: boolean): boolean {
  const [dragging, setDragging] = useState(false);
  const latest = useRef(onFiles);
  latest.current = onFiles;

  useEffect(() => {
    let leaving: ReturnType<typeof setTimeout> | undefined;
    const stay = () => clearTimeout(leaving);
    const end = () => {
      stay();
      setDragging(false);
    };

    const over = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer)) return;
      // Without this the drop is refused, and the browser handles the file itself.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = enabled ? 'copy' : 'none';
      stay();
      if (enabled) setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (event.relatedTarget) return;
      stay();
      leaving = setTimeout(end, LEAVE_GRACE_MS);
    };
    const drop = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      end();
      const files = enabled ? transferFiles(event.dataTransfer) : [];
      if (files.length) latest.current(files);
    };

    window.addEventListener('dragenter', over);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('dragend', end);
    return () => {
      window.removeEventListener('dragenter', over);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('dragend', end);
      end();
    };
  }, [enabled]);

  return dragging;
}
