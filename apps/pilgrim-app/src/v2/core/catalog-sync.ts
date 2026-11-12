export interface CatalogChange {
  lodgeId?: string;
  isActive?: boolean;
}
const listeners = new Set<(change: CatalogChange) => void>();
export function subscribeCatalogChanges(listener: (change: CatalogChange) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notifyCatalogChange(change: CatalogChange = {}): void {
  for (const listener of listeners) listener(change);
}
