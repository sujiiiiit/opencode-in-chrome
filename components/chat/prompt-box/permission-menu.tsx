import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { savePermissionMode, type PermissionMode } from '@/lib/opencode/permission-mode';
import { usePermissionMode } from '@/lib/opencode/use-permission-mode';

export function PermissionMenu() {
  const mode = usePermissionMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`OpenCode permissions: ${mode ?? 'loading'}`} disabled={!mode} className="gap-1 text-text-secondary sm:w-auto sm:px-2" />}>
        <Icon name={mode === 'auto' ? 'forward' : 'hand'} className="size-4.5" />
        <span className="hidden sm:inline">{mode === 'auto' ? 'Automatically approve' : 'Manually approve'}</span>
        <Icon name="chevron-down" className="hidden size-4 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Permission</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={mode ?? 'manual'} onValueChange={(value) => void savePermissionMode(value as PermissionMode)}>
            <DropdownMenuRadioItem value="manual" text="Manually approve" icon={<Icon name="hand" className="size-4.5" />} />
            <DropdownMenuRadioItem value="auto" text="Automatically approve" icon={<Icon name="forward" className="size-4.5" />} />
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
