// Which logo a model's provider shows. The logos are opencode's provider icons (assets/provider-icons).

type LogoProvider = { id: string; canonical?: string };

/**
 * The provider's logo, chosen as opencode's own model lists do (ProviderModelIcon): the first of
 * the canonical provider, the canonical provider without "-token-plan", and the provider's ID
 * without "console-" that has an icon. Undefined when none does.
 */
export function logoFor(provider: LogoProvider, available: ReadonlySet<string>): string | undefined {
  return [provider.canonical, provider.canonical?.replace(/-token-plan$/, ''), provider.id.replace(/^console-/, '')].find(
    (id): id is string => !!id && id !== 'synthetic' && available.has(id),
  );
}
