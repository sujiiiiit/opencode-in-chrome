// The last catalog loaded from a server, so the composer can name the model while the live
// catalog loads (opencode's web app borrows a catalog loaded for another location the same way).
import { browser } from 'wxt/browser';
import { isRecord } from '../reply';
import { readDetails, type Catalog, type CatalogModel, type CatalogProvider } from './catalog';

const CATALOG_CACHE_KEY = 'opencode.modelCatalog';

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function parseModel(value: unknown, providerID: string): CatalogModel | null {
  if (!isRecord(value) || typeof value.modelID !== 'string' || typeof value.name !== 'string') return null;
  return {
    providerID,
    modelID: value.modelID,
    name: value.name,
    latest: value.latest === true,
    family: typeof value.family === 'string' ? value.family : undefined,
    // JSON turns NaN into null.
    released: typeof value.released === 'number' ? value.released : NaN,
    free: value.free === true,
    variants: strings(value.variants),
    context: typeof value.context === 'number' ? value.context : 0,
    inputs: strings(value.inputs) as CatalogModel['inputs'],
    tools: value.tools === true,
    details: readDetails(value.details),
  };
}

function parseProvider(value: unknown): CatalogProvider | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  const id = value.id;
  return {
    id,
    name: value.name,
    canonical: typeof value.canonical === 'string' ? value.canonical : undefined,
    integrationID: typeof value.integrationID === 'string' ? value.integrationID : undefined,
    models: (Array.isArray(value.models) ? value.models : []).flatMap((model) => {
      const parsed = parseModel(model, id);
      return parsed ? [parsed] : [];
    }),
  };
}

export async function loadCachedCatalog(baseUrl: string): Promise<Catalog | null> {
  const stored = (await browser.storage.local.get(CATALOG_CACHE_KEY))[CATALOG_CACHE_KEY];
  if (!isRecord(stored) || stored.baseUrl !== baseUrl || !Array.isArray(stored.providers)) return null;
  return {
    providers: stored.providers.flatMap((provider) => {
      const parsed = parseProvider(provider);
      return parsed ? [parsed] : [];
    }),
  };
}

export async function saveCachedCatalog(baseUrl: string, catalog: Catalog): Promise<void> {
  await browser.storage.local.set({ [CATALOG_CACHE_KEY]: { baseUrl, providers: catalog.providers } });
}
