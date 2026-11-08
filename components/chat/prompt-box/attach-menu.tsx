import { memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';
import { IMAGE_MIMES } from '@/lib/opencode/attachments';
import type { MentionItem } from '@/lib/opencode/mentions';

const LABEL = 'Add photos and files';

type SkillsProps = {
  skills: readonly MentionItem[];
  /** The skills are still loading. */
  loading: boolean;
  /** A skill was picked: it goes into the draft as a chip. */
  onSkill: (skill: MentionItem) => void;
};

/** The "Skills" submenu: every skill the server offers, each added to the draft as a chip. */
function SkillsSubmenu({ skills, loading, onSkill }: SkillsProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger icon={<Icon name="skill" />} text="Skills" />
      <DropdownMenuSubContent className="min-w-48 overflow-hidden p-0">
        <ScrollArea fade className="[--fade-top-max:1.5rem] [--fade-bottom-max:1.5rem]" viewportClassName="max-h-72 overscroll-contain">
          <DropdownMenuGroup className="flex flex-col gap-px p-1">
            {skills.length === 0 && <DropdownMenuItem disabled text={loading ? 'Loading…' : 'No skills'} />}
            {skills.map((skill) => (
              <DropdownMenuItem key={skill.id} icon={<Icon name="skill" />} text={skill.name} title={skill.description} onClick={() => onSkill(skill)} />
            ))}
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

type Props = Partial<SkillsProps> & {
  onFiles: (files: File[]) => void;
  /** The menu opened: the skills load the first time. */
  onOpen?: () => void;
};

/**
 * The composer's "+" menu: it opens the system file picker for images to attach, and lists the
 * skills to add to the draft. Memoized, so typing in the composer does not re-render it.
 */
export const AttachMenu = memo(function AttachMenu({ onFiles, onOpen, skills, loading = false, onSkill }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  // A picked skill focuses the editor; closing must not move focus back to the + button.
  const picked = useRef(false);
  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) return;
          picked.current = false;
          onOpen?.();
        }}
      >
        <Tooltip label={LABEL}>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" data-slot="attach-menu" aria-label={LABEL} />}>
            <Icon name="plus" className="size-4"  />
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent side="top" align="start" className="min-w-64" finalFocus={() => !picked.current}>
          <DropdownMenuGroup>
            <DropdownMenuItem icon={<Icon name="attach" />} text={LABEL} onClick={() => picker.current?.click()} />
            {skills && onSkill && (
              <SkillsSubmenu
                skills={skills}
                loading={loading}
                onSkill={(skill) => {
                  picked.current = true;
                  onSkill(skill);
                }}
              />
            )}
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
