import { logoFor } from '@/lib/opencode/models/logo';

// Every provider icon's markup, by file name. They are our own bundled files, never user input.
const sources = import.meta.glob<string>('/assets/provider-icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const ICONS = new Map(
  Object.entries(sources).map(([path, svg]) => [path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), svg]),
);
const AVAILABLE: ReadonlySet<string> = new Set(ICONS.keys());

type Provider = { id: string; canonical?: string };

/** True when the provider has a logo to show in place of its name. */
export const hasLogo = (provider: Provider | undefined): boolean => !!provider && logoFor(provider, AVAILABLE) !== undefined;

/**
 * The logo of a model's provider, drawn in the surrounding text colour (the icons fill with
 * `currentColor`), or nothing when no logo fits.
 */
export function ProviderLogo({ provider, className }: { provider: Provider; className?: string }) {
  const id = logoFor(provider, AVAILABLE);
  const svg = id && ICONS.get(id);
  if (!svg) return null;
  return (
    <span
      aria-hidden="true"
      data-slot="provider-logo"
      data-logo={id}
      className={`inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-full ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
