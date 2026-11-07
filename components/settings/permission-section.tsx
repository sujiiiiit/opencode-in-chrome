import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { savePermissionMode, type PermissionMode } from '@/lib/opencode/permission-mode';
import { usePermissionMode } from '@/lib/opencode/use-permission-mode';

export function PermissionSection() {
  const mode = usePermissionMode();
  if (!mode) return null;
  return (
    <RadioGroup aria-label="OpenCode permission mode" value={mode} onValueChange={(value) => {
      const next = value as PermissionMode;
      void savePermissionMode(next);
    }} className="gap-0 overflow-hidden rounded-2xl border border-border">
      {[
        { value: 'manual', label: 'Manual', hint: 'Ask when OpenCode or the browser needs permission.' },
        { value: 'auto', label: 'Auto', hint: 'Automatically allow OpenCode requests while the panel is connected and browser actions on unblocked sites.' },
      ].map((item) => (
        <label key={item.value} className="flex cursor-pointer items-start gap-3 border-b border-border-secondary-transparent px-4 py-3 last:border-b-0 hover:bg-background-secondary">
          <RadioGroupItem value={item.value} className="mt-0.5" />
          <span><span className="block text-sm text-text-primary">{item.label}</span><span className="block text-xs text-text-secondary">{item.hint}</span></span>
        </label>
      ))}
    </RadioGroup>
  );
}
