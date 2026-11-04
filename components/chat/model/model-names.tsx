import { createContext, useContext, type ReactNode } from 'react';
import { findModel, type Catalog } from '@/lib/opencode/models/catalog';
import type { StepModel } from '@/lib/opencode/reply';

const CatalogContext = createContext<Catalog | null>(null);

/** Lets message footers name the model a reply ran on. */
export function ModelCatalogProvider({ catalog, children }: { catalog: Catalog | null; children: ReactNode }) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

/** The model's display name, or its ID while the catalog is loading or does not list it. */
export function useModelName(model: StepModel | undefined): string | undefined {
  const catalog = useContext(CatalogContext);
  if (!model) return undefined;
  return findModel(catalog, model)?.name ?? model.modelID;
}
