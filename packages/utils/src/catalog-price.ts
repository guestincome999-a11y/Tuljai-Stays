/** Wire prices are non-negative INR numbers or ASCII decimal strings, never localized labels. */
export function catalogPrice(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

/** Inclusive bounds; an unknown price cannot satisfy an explicit budget. */
export function matchesCatalogBudget(value: unknown, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true;
  const price = catalogPrice(value);
  return (
    price !== null && (min === undefined || price >= min) && (max === undefined || price <= max)
  );
}
