import type { PublicLodgeDetails } from '@tuljai/types';

import { api } from './api';

export interface CatalogAmenity {
  iconName: string | null;
  name: string;
  slug: string;
}

export interface CatalogLodgeCard {
  amenities: CatalogAmenity[];
  amenitySlugs: string[];
  averageRating: number | null;
  coverUrl: string | null;
  distanceFromTempleMeters: number | null;
  festivalStartingPrice: string | null;
  id: string;
  name: string;
  propertyType: string;
  reviewCount: number;
  startingPrice: string | null;
}

export interface CatalogPage {
  items: CatalogLodgeCard[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CatalogRoomType {
  basePrice: string;
  capacityAdults: number;
  capacityChildren: number;
  description: string | null;
  festivalPrice: string | null;
  id: string;
  name: string;
  totalRooms: number;
}

export interface CatalogPhoto {
  category: string;
  id: string;
  isCover: boolean;
  thumbnailUrl: string | null;
  url: string;
}

export interface CatalogLodgeDetails {
  lodge: PublicLodgeDetails;
  photos: CatalogPhoto[];
  roomTypes: CatalogRoomType[];
}

export interface CatalogQuery {
  amenities?: string[];
  ids?: string[];
  maxDistance?: number;
  maxPrice?: number;
  minPrice?: number;
  page?: number;
  pageSize?: number;
  propertyType?: string;
  search?: string;
  sort?: 'distance' | 'name' | 'price' | 'rating';
}

const RETRY_DELAYS_MS = [1500, 4000];
// A sleeping server can take close to a minute to wake, so reads wait far longer than usual.
const CATALOG_TIMEOUT_MS = 60_000;

/**
 * Reads are safe to repeat. A sleeping server or a dropped connection usually works on the next
 * try, so two quiet retries keep the person from ever seeing a one-off failure.
 */
async function withRetry<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      const status = (error as { details?: { statusCode?: number } }).details?.statusCode;
      // A clear "no" from the server (4xx) will not change on retry; only timeouts and 5xx do.
      const retryable = status === undefined || status >= 500;
      if (delay === undefined || !retryable) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function fetchCatalog(query: CatalogQuery = {}): Promise<CatalogPage> {
  return withRetry(() =>
    api.get<CatalogPage>('/catalog/lodges', {
      params: { ...query, amenities: query.amenities?.join(','), ids: query.ids?.join(',') },
      timeout: CATALOG_TIMEOUT_MS,
    }),
  );
}

export function fetchLodge(lodgeId: string): Promise<CatalogLodgeDetails> {
  return withRetry(() =>
    api.get<CatalogLodgeDetails>(`/catalog/lodges/${lodgeId}`, { timeout: CATALOG_TIMEOUT_MS }),
  );
}
