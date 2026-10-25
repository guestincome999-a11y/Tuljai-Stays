import { useMemo } from 'react';

import type { Bilingual } from '../i18n/language';
import { amenityOptions, priceOptions, propertyTypeOptions, sortOptions } from '../i18n/strings';

import { useRemoteConfig } from './config';

export const REMOTE_FILTERS_KEY = 'pilgrim_explore_filters';

export type SortId = 'distance' | 'name' | 'price' | 'rating';
const SORT_IDS: readonly string[] = ['distance', 'name', 'price', 'rating'];
const PROPERTY_TYPE_IDS: readonly string[] = [
  'LODGE',
  'BHAKT_NIWAS',
  'DHARAMSHALA',
  'HOTEL',
  'HOMESTAY',
];

export interface FilterOption {
  id: string;
  label: Bilingual;
}
export interface PriceFilterOption extends FilterOption {
  max?: number;
  min?: number;
}
export interface ExploreFilterOptions {
  amenities: FilterOption[];
  prices: PriceFilterOption[];
  propertyTypes: FilterOption[];
  sorts: Array<FilterOption & { id: SortId }>;
}

const DEFAULTS: ExploreFilterOptions = {
  amenities: [...amenityOptions],
  prices: [...priceOptions],
  propertyTypes: [...propertyTypeOptions],
  sorts: sortOptions.map((option) => ({ ...option })),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readLabel(item: Record<string, unknown>, fallback: string): Bilingual {
  const en = typeof item['labelEn'] === 'string' && item['labelEn'] ? item['labelEn'] : fallback;
  const mr = typeof item['labelMr'] === 'string' && item['labelMr'] ? item['labelMr'] : en;
  return { en, mr };
}

function readList<T extends FilterOption>(
  raw: unknown,
  accept: (id: string, item: Record<string, unknown>) => Omit<T, 'id' | 'label'> | null,
): T[] | null {
  if (!Array.isArray(raw)) return null;
  const items: T[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || entry['enabled'] === false) continue;
    const extra = accept(entry['id'], entry);
    if (extra) items.push({ ...extra, id: entry['id'], label: readLabel(entry, entry['id']) } as T);
  }
  return items;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Filter choices come from the server so they can be reworded, reordered or removed from the admin
 * panel without a new app. Anything missing or malformed falls back to the built-in list.
 */
export function useExploreFilters(): ExploreFilterOptions {
  const { config } = useRemoteConfig();
  const raw = config.settings[REMOTE_FILTERS_KEY];

  return useMemo(() => {
    if (!isRecord(raw)) return DEFAULTS;
    const sorts = readList<FilterOption & { id: SortId }>(raw['sorts'], (id) =>
      SORT_IDS.includes(id) ? {} : null,
    );
    const propertyTypes = readList<FilterOption>(raw['propertyTypes'], (id) =>
      PROPERTY_TYPE_IDS.includes(id) ? {} : null,
    );
    const prices = readList<PriceFilterOption>(raw['prices'], (_id, item) => {
      const min = number(item['min']);
      const max = number(item['max']);
      return min === undefined && max === undefined
        ? null
        : { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
    });
    const amenities = readList<FilterOption>(raw['amenities'], () => ({}));
    return {
      amenities: amenities && amenities.length > 0 ? amenities : DEFAULTS.amenities,
      prices: prices && prices.length > 0 ? prices : DEFAULTS.prices,
      propertyTypes:
        propertyTypes && propertyTypes.length > 0 ? propertyTypes : DEFAULTS.propertyTypes,
      sorts: sorts && sorts.length > 0 ? sorts : DEFAULTS.sorts,
    };
  }, [raw]);
}
