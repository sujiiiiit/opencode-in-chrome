import { Button } from '@/components/ui/button';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { shortcutLabel } from '@/lib/keyboard';
import type { ModelControls as Controls } from '@/lib/opencode/models/controls';
import { hasLogo, ProviderLogo } from './provider-logo';

export const SHORTCUTS = {
  picker: "⌘'",
  variant: '⇧⌘D',
  agent: '⌘.',
} as const;

type Props = {
  controls: Controls;
  pending?: boolean;
};

/**
 * The model name, including its provider when no logo stands for it, or why none is available.
 */
function chipLabel(controls: Controls): string {
  const { label, provider } = controls.model;
  if (label) return label.provider && !hasLogo(provider) ? `${label.provider} / ${label.model}` : label.model;
  return controls.empty ? 'No models' : 'Choose model';
}

/**
 * The composer's model picker trigger, including its effort when available.
 * While the catalog loads, a skeleton reserves space for the cached selection.
 */
export function ModelControls({ controls, pending = false }: Props) {
  const { variant, loading } = controls;
  if (pending) {
    return (
      <div role="status" aria-label="Loading model and effort" data-slot="model-controls" className="flex min-w-0 items-center gap-0.5">
        <div className="flex h-7 min-w-0 max-w-[12rem] items-center gap-1.5 px-2">
          {controls.preview ? (
            <span className="relative inline-flex min-w-0 items-center gap-1.5 text-[13px]">
              <span className="invisible inline-flex min-w-0 items-center gap-1.5">
                {controls.model.provider && <ProviderLogo provider={controls.model.provider} />}
                <span className="truncate">{chipLabel(controls)}</span>
                {variant.options.length > 1 && <><span>·</span><span className="shrink-0">{variant.current}</span></>}
              </span>
              <Skeleton className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-md" />
            </span>
          ) : <Skeleton className="h-3 w-28 rounded-md" />}
        </div>
      </div>
    );
  }
  return (
    <div data-slot="model-controls" className="flex min-w-0 items-center gap-0.5">
      <Tooltip label={`Choose model (${shortcutLabel(SHORTCUTS.picker)})`}>
        <DropdownMenuTrigger
          disabled={loading}
          render={<Button
          variant="ghost"
          size="sm"
          className="min-w-0 max-w-[12rem] shrink justify-start gap-1 text-[13px]"
          data-slot="model-chip"
          aria-label={controls.model.label ? `Model: ${controls.model.label.model}${variant.options.length > 1 ? `, effort: ${variant.current}` : ''}` : 'Choose model'}
          />}
        >
          {controls.model.provider && <ProviderLogo provider={controls.model.provider} />}
          <span className="min-w-0 truncate">{chipLabel(controls)}</span>
          {variant.options.length > 1 && <><span aria-hidden="true" className="shrink-0 text-text-tertiary">·</span><span className="shrink-0 text-text-secondary">{variant.current}</span></>}
        </DropdownMenuTrigger>
      </Tooltip>
    </div>
  );
}
