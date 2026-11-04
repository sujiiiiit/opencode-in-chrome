import { memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import { IMAGE_MIMES } from '@/lib/opencode/attachments';

const LABEL = 'Add photos and files';

/**
 * The composer's "+" menu: it opens the system file picker for images to attach. Memoized, so
 * typing in the composer does not re-render it.
 */
export const AttachMenu = memo(function AttachMenu({ onFiles }: { onFiles: (files: File[]) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <DropdownMenu>
        <Tooltip label={LABEL}>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" data-slot="attach-menu" aria-label={LABEL} />}>
            <Icon name="plus" />
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent side="top" align="start" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem icon={<Icon name="attach" />} text={LABEL} onClick={() => picker.current?.click()} />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        accept={IMAGE_MIMES.join(',')}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          // Cleared, so picking the same file again still fires a change.
          event.currentTarget.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
});
