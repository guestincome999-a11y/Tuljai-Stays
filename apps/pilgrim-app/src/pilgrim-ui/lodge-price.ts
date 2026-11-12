import { catalogPrice, matchesCatalogBudget } from '@tuljai/utils';

import type { PilgrimLodge } from './mock-data';

export function lodgePrice(lodge: PilgrimLodge): number | null {
  // Summary prices are authoritative discovery data even before detail hydration.
  if (lodge.priceAvailable === false) return null;
  if (lodge.priceAvailable === undefined && lodge.rooms.length === 0) return null;
  return catalogPrice(lodge.price);
}

export function matchesLodgeBudget(lodge: PilgrimLodge, min?: number, max?: number): boolean {
  return matchesCatalogBudget(lodgePrice(lodge), min, max);
}
