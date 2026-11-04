// Files carried by a paste (Ctrl+V on Windows/Linux, Cmd+V on macOS: both fire the same
// `paste` event) or a drag from the system, read the same way on every platform.

/** The parts of a DataTransfer this module reads (a ClipboardEvent's or a DragEvent's). */
export type TransferLike = {
  readonly types: ReadonlyArray<string> | DOMStringList;
  getData(format: string): string;
  readonly items?: ArrayLike<{ readonly kind: string; getAsFile(): File | null }>;
  readonly files?: ArrayLike<File>;
};

/**
 * Whether a drag carries files from outside the page (Explorer, Finder, a desktop). Text or a
 * link dragged within the page carries no "Files" type, so it never shows the drop overlay.
 */
export function isFileDrag(data: Pick<TransferLike, 'types'> | null | undefined): boolean {
  return !!data && Array.from(data.types as ArrayLike<string>).includes('Files');
}

/** Every file in the transfer: its file items, else its `files` list (some browsers fill only one). */
export function transferFiles(data: TransferLike | null | undefined): File[] {
  if (!data) return [];
  const items = Array.from(data.items ?? []).flatMap((item) => {
    if (item.kind !== 'file') return [];
    const file = item.getAsFile();
    return file ? [file] : [];
  });
  return items.length ? items : Array.from(data.files ?? []);
}

/**
 * The name browsers give a picture that exists only on the clipboard (a screenshot, an image
 * copied from a page or an app): "image.png", whatever the platform. A real file keeps its name.
 */
const CLIPBOARD_PICTURE = /^image\.[a-z0-9]+$/i;

/**
 * The files a paste attaches; empty when the paste is text. A screenshot (Win+Shift+S,
 * Cmd+Ctrl+Shift+4), an image copied from a page, and files copied in Explorer or Finder attach.
 * Excel, Word, Google Docs, Numbers and Finder's own icon put a rendered picture of the copy
 * beside its text: when there is text and every file is such a clipboard picture, the text is
 * what was copied, so it pastes as text.
 */
export function pastedFiles(data: TransferLike | null | undefined): File[] {
  const files = transferFiles(data);
  if (files.length === 0) return [];
  const text = data?.getData('text/plain') ?? '';
  if (text.trim() && files.every((file) => CLIPBOARD_PICTURE.test(file.name))) return [];
  return files;
}
