/** A centered note between two hairlines: a model switch, an interrupted reply. */
export function NoticeDivider({ slot, label }: { slot: string; label: string }) {
  return (
    <div data-slot={slot} className="flex items-center gap-3 text-xs text-text-secondary">
      <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
      <span className="min-w-0 max-w-[70%] truncate" title={label}>{label}</span>
      <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
    </div>
  );
}
