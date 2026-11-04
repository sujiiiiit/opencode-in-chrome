import { memo, useMemo, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fileLabel, type SentFile } from '@/lib/opencode/sent-files';
import { ImageViewer, type ImageItem } from './flow/media/image-viewer';
import { PictureTile } from './flow/media/picture-tile';

/** A non-image attachment (a PDF, a text file): its type's badge, name and label. */
function FileCard({ file }: { file: SentFile }) {
  const pdf = file.mime === 'application/pdf';
  return (
    <div
      data-slot="sent-file"
      title={file.name}
      className="flex h-14 w-64 min-w-0 items-center gap-2.5 rounded-xl border border-border bg-background px-2.5"
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          pdf ? 'bg-red-bg text-red-mid' : 'bg-blue-bg text-blue-mid',
        )}
      >
        <Icon name="file" className="size-4.5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate type-work text-text-primary">{file.name}</span>
        <span className="text-xs text-text-secondary">{fileLabel(file)}</span>
      </span>
    </div>
  );
}

/**
 * One line of attachments that never wraps. It spans the chat's full width (not the bubble's),
 * sits right-aligned while it fits, and past that scrolls sideways, fading out at an edge only
 * while there is more beyond it (the same `scroll-fade-x` mask as the composer's strip).
 */
function AttachmentRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ScrollArea horizontal fade="x" className="w-full [--fade-x-max:2.5rem]" viewportClassName="overscroll-x-contain" scrollbarClassName="h-1.5!">
      {/* ml-auto keeps a short row against the right edge, under the bubble's own alignment. */}
      <ul aria-label={label} className="ml-auto flex w-max gap-2 pb-2">
        {children}
      </ul>
    </ScrollArea>
  );
}

/**
 * What a user message was sent with, above its bubble (8px apart, as the bubble and its action
 * row are): a line of file cards, then a line of 80px image squares. Each line scrolls sideways
 * when it outgrows the chat, so five or six images stay one row. An image opens the viewer on the
 * message's whole set. Memoized: a turn keeps the same files array, so streaming leaves it alone.
 */
export const SentAttachments = memo(function SentAttachments({ files, hidden }: { files: SentFile[]; hidden?: boolean }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const images = useMemo(() => files.filter((file) => file.kind === 'image' && file.src), [files]);
  const documents = useMemo(() => files.filter((file) => file.kind === 'file'), [files]);
  const items = useMemo<ImageItem[]>(() => images.map((image) => ({ src: image.src!, alt: image.name })), [images]);

  return (
    // Hidden (keeping its place) while the message's text flies into its bubble.
    <div data-slot="sent-attachments" className={cn('flex w-full flex-col gap-2', hidden && 'invisible')}>
      {documents.length > 0 && (
        <AttachmentRow label="Attached files">
          {documents.map((file, at) => (
            <li key={`${at}:${file.name}`} className="shrink-0">
              <FileCard file={file} />
            </li>
          ))}
        </AttachmentRow>
      )}
      {images.length > 0 && (
        <AttachmentRow label="Attached images">
          {images.map((image, at) => (
            <li key={`${at}:${image.name}`} className="shrink-0">
              <PictureTile src={image.src!} name={image.name} at={at} onOpen={setViewing} className="size-20" />
            </li>
          ))}
        </AttachmentRow>
      )}
      <ImageViewer images={items} index={viewing} onIndexChange={setViewing} />
    </div>
  );
});
