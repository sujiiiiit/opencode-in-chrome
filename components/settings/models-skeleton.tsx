import { Skeleton } from '@/components/ui/skeleton';

/** Name widths vary row to row, so the placeholder reads as a list of different providers. */
const NAME_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-40', 'w-20'];

/**
 * The provider list while the catalog loads: rows shaped like the real ones (chevron, logo, name,
 * switch) that fade in together, then give way to the real list.
 */
export function ModelsSkeleton() {
  return (
    <div role="status" aria-label="Loading models" className="animate-fade-in space-y-1">
      {NAME_WIDTHS.map((width) => (
        <div key={width} className="flex h-9.5 items-center gap-2 pr-3 pl-3">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="size-4 rounded-md" />
          <Skeleton className={`h-3.5 rounded-full ${width}`} />
          <span className="flex-1" />
          <Skeleton className="h-4.5 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}
