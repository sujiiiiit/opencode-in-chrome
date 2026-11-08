import { Icon, type IconName } from '@/components/ui/icon';

/** A centered note between two hairlines: a model switch, an interrupted reply, a goal and its rounds. */
export function NoticeDivider({ slot, label, icon }: { slot: string; label: string; icon?: IconName }) {
  return (
    <div data-slot={slot} className="flex items-center gap-3 text-xs text-text-secondary">
      <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
      {icon && <Icon name={icon} size={14} className="-mr-1.5 shrink-0" />}
      <span className="min-w-0 max-w-[70%] truncate" title={label}>{label}</span>
      <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
    </div>
  );
}
