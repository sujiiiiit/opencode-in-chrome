// Effort ("variant") resolution, ported from opencode's web app (providers/models/variant.ts).
//
// A variant has three states in a selection:
//   - a string ("high"): chosen explicitly
//   - null: "default" chosen explicitly; it beats a configured variant
//   - undefined: never chosen; the configured variant (agent or config file) applies

/** The label the UI shows for "no variant": the server picks the model's own default. */
export const DEFAULT_VARIANT = 'default';

type ModelRef = { providerID: string; modelID: string };

type VariantInput = {
  /** The model's variant IDs, in catalog order. */
  variants: readonly string[];
  selected: string | null | undefined;
  /** The agent's (or the config file's) variant, when it names this exact model. */
  configured: string | undefined;
};

/** A configured variant applies only to the model it was configured with. */
export function configuredVariant(input: {
  config: { model?: ModelRef; variant?: string } | undefined;
  model: (ModelRef & { variants: readonly string[] }) | undefined;
}): string | undefined {
  const { config, model } = input;
  if (!config?.variant || !config.model || !model || model.variants.length === 0) return undefined;
  if (config.model.providerID !== model.providerID || config.model.modelID !== model.modelID) return undefined;
  return config.variant;
}

/** The variant to send: undefined means the model's default. */
export function resolveVariant(input: VariantInput): string | undefined {
  if (input.selected === null) return undefined;
  const value = input.selected ?? input.configured;
  return value && value !== DEFAULT_VARIANT && input.variants.includes(value) ? value : undefined;
}

/** The next variant after the current one: default → first → … → last → default. */
export function cycleVariant(input: VariantInput): string | undefined {
  const current = resolveVariant(input);
  return input.variants[current ? input.variants.indexOf(current) + 1 : 0];
}
