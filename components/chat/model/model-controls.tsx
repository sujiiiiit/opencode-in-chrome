import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import { shortcutLabel } from '@/lib/keyboard';
import type { ModelControls as Controls } from '@/lib/opencode/models/controls';
import { DEFAULT_VARIANT } from '@/lib/opencode/models/variant';

export const SHORTCUTS = {
  picker: "⌘'",
  variant: '⇧⌘D',
  agent: '⌘.',
} as const;

type SelectProps = {
  label: string;
  shortcut: string;
  options: string[];
  current: string;
  disabled?: boolean;
  slot: string;
  onSelect: (value: string) => void;
};

/** A compact chip that opens a single-choice menu (agent, effort). */
function ChipSelect({ label, shortcut, options, current, disabled, slot, onSelect }: SelectProps) {
  return (
    <DropdownMenu>
      <Tooltip label={`${label} (${shortcutLabel(shortcut)})`}>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button variant="ghost" size="sm" className="text-[13px]" data-slot={slot} aria-label={`${label}: ${current}`} />
          }
        >
          {current}
          <Icon name="chevron-down" />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent side="top" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={current} onValueChange={(value) => onSelect(String(value))}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option} value={option} closeOnClick text={option} className="capitalize" />
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = {
  controls: Controls;
  onOpenPicker: () => void;
  // Agent chip hidden for now (build mode only); restore with the chip below.
  // onAgent: (name: string) => void;
  onVariant: (value: string | undefined) => void;
};

/** The model chip's text: provider and model, a placeholder while loading, or why none. */
function chipLabel(controls: Controls): string {
  const { label } = controls.model;
  if (label) return label.provider ? `${label.provider} / ${label.model}` : label.model;
  if (controls.loading) return 'Loading models…';
  return controls.empty ? 'No models' : 'Choose model';
}

/**
 * The composer's selection chips, as in opencode's composer toolbar: the agent (when there is a
 * choice), the model (opens the picker) and the effort variant (when the model has variants).
 * While the catalog loads they show the model named last time and stay inert.
 */
export function ModelControls({ controls, onOpenPicker, onVariant }: Props) {
  const { variant, loading } = controls;
  return (
    <div data-slot="model-controls" className="flex min-w-0 items-center gap-0.5">
      {/* Agent chip hidden for now: the panel runs in build mode only (see PANEL_AGENTS).
      {controls.agent.visible && controls.agent.current && (
        <ChipSelect
          slot="agent-select"
          label="Agent"
          shortcut={SHORTCUTS.agent}
          options={controls.agent.options}
          current={controls.agent.current}
          disabled={loading}
          onSelect={onAgent}
        />
      )} */}
      <Tooltip label={`Choose model (${shortcutLabel(SHORTCUTS.picker)})`}>
        <Button
          variant="ghost"
          size="sm"
          className="text-[13px]"
          data-slot="model-chip"
          aria-label={controls.model.label ? `Model: ${controls.model.label.model}` : 'Choose model'}
          aria-haspopup="dialog"
          disabled={loading && !controls.preview}
          onClick={() => !loading && onOpenPicker()}
        >
          {chipLabel(controls)}
        </Button>
      </Tooltip>
      {variant.options.length > 1 && (
        <ChipSelect
          slot="variant-select"
          label="Effort"
          shortcut={SHORTCUTS.variant}
          options={variant.options}
          current={variant.current}
          disabled={loading}
          onSelect={(value) => onVariant(value === DEFAULT_VARIANT ? undefined : value)}
        />
      )}
    </div>
  );
}
