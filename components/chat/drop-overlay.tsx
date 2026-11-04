import { cn } from 'cn';
import { Icon, type IconName } from '@/components/ui/icon';

/** The fanned cards over the title: code and a file behind, a picture in front. */
const CARDS: Array<{ icon: IconName; className: string }> = [
  { icon: 'code', className: '-translate-x-7 translate-y-1 -rotate-12 bg-blue-bg text-blue-mid' },
  { icon: 'file', className: 'translate-x-7 -translate-y-1.5 rotate-12 bg-blue-bg text-blue-mid' },
  { icon: 'image', className: 'translate-y-3 bg-blue-mid text-background' },
];

/**
 * Shown while files are dragged over the panel, like ChatGPT's: the chat fades behind a white
 * veil, with fanned file cards and "Add anything" at its centre. It takes no pointer events, so
 * the drag keeps reaching the panel underneath (see useFileDrop). It stays mounted and fades in
 * and out, so a drag that only grazes the panel never flashes it.
 */
export function DropOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      data-slot="drop-overlay"
      data-visible={visible || undefined}
      className={cn(
        'pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-drop-veil px-6 text-center backdrop-blur-[2px]',
        'opacity-0 transition-opacity duration-200 ease-(--ease-calm) data-visible:opacity-100',
      )}
    >
      <div className="relative h-16 w-24">
        {CARDS.map((card) => (
          <span
            key={card.icon}
            className={cn('absolute inset-x-0 mx-auto flex size-12 items-center justify-center rounded-xl shadow-surface-rest', card.className)}
          >
            <Icon name={card.icon} className="size-6" />
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1 pt-2">
        <p className="type-body font-semibold text-text-primary">Add anything</p>
        <p className="type-work text-text-secondary">Drop any file here to add it to the conversation</p>
      </div>
    </div>
  );
}
