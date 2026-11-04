// The files a user message carries, as the message list shows them above its bubble.
import { isRecord } from './reply';

export type SentFile = {
  /** "image" shows as a picture; anything else (a PDF, a text file) as a file card. */
  kind: 'image' | 'file';
  name: string;
  mime: string;
  /** A `data:` URL of the bytes (images only; a file card shows no content). */
  src?: string;
};

const DATA_URL = /^data:([^;,]+)[;,]/;

/**
 * One file as the server stores it (`{data, mime, source, name}`) or as this panel sent it
 * (`{uri: data URL, name}`). Like opencode's message UI (session-ui message-file `attached`), only
 * attachments travel with the message: a file mentioned in the text (`@path`, `[Image 1]`) or
 * referenced by its path on the server is part of the text, and `media:` refs (which this panel
 * does not ask for) carry no bytes to show.
 */
function parseFile(value: unknown): SentFile | null {
  if (!isRecord(value) || !travelsWithMessage(value)) return null;
  const uri = typeof value.uri === 'string' ? value.uri : '';
  const mime = mimeOf(value, uri);
  const src = mime && bytesURL(value, mime, uri);
  if (!mime || !src) return null;
  const name = nameOf(value, mime);
  return mime.startsWith('image/') ? { kind: 'image', name, mime, src } : { kind: 'file', name, mime };
}

/** The stored type, else the one a sent data URL names. */
const mimeOf = (value: Record<string, unknown>, uri: string) =>
  typeof value.mime === 'string' ? value.mime : DATA_URL.exec(uri)?.[1];

const nameOf = (value: Record<string, unknown>, mime: string) =>
  typeof value.name === 'string' && value.name ? value.name : fallbackName(mime);

/** Not mentioned in the text, and not a reference to a file on the server. */
function travelsWithMessage(value: Record<string, unknown>): boolean {
  if (value.mention !== undefined) return false;
  const source = isRecord(value.source) ? value.source : undefined;
  return !(source?.type === 'uri' && typeof source.uri === 'string' && !source.uri.startsWith('data:'));
}

/** The bytes as a data URL: the stored base64, else the data URL it was sent as. */
function bytesURL(value: Record<string, unknown>, mime: string, uri: string): string | undefined {
  if (typeof value.data === 'string') return `data:${mime};base64,${value.data}`;
  return uri.startsWith('data:') ? uri : undefined;
}

const fallbackName = (mime: string) => (mime === 'application/pdf' ? 'PDF' : 'Attachment');

/** `{files}` when there are any, so a text-only prompt keeps exactly its old shape. */
export const withFiles = (files: SentFile[] | undefined): { files?: SentFile[] } => (files ? { files } : {});

/** The message's attachments, or undefined when it has none (so a text-only turn stays as it was). */
export function parseSentFiles(value: unknown): SentFile[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const files = value.flatMap((item) => parseFile(item) ?? []);
  return files.length ? files : undefined;
}

/** The card's type label: "PDF", else the file's extension in capitals, else "File". */
export function fileLabel(file: Pick<SentFile, 'name' | 'mime'>): string {
  if (file.mime === 'application/pdf') return 'PDF';
  const dot = file.name.lastIndexOf('.');
  return dot > 0 ? file.name.slice(dot + 1).toUpperCase() : 'File';
}
