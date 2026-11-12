import type { PublicLodgeDetails } from '@tuljai/types';

import { api } from './api';
import { readCatalog } from './catalog-request';

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

// Allow a Render cold start; callers can cancel obsolete reads immediately.
const CATALOG_TIMEOUT_MS = 60_000;

export function fetchCatalog(query: CatalogQuery = {}, signal?: AbortSignal): Promise<CatalogPage> {
  return readCatalog(
    () =>
      api.get<CatalogPage>('/catalog/lodges', {
        params: { ...query, amenities: query.amenities?.join(','), ids: query.ids?.join(',') },
        timeout: CATALOG_TIMEOUT_MS,
        signal,
      }),
    signal,
  );
}

export function fetchLodge(lodgeId: string): Promise<CatalogLodgeDetails> {
  return readCatalog(() =>
    api.get<CatalogLodgeDetails>(`/catalog/lodges/${lodgeId}`, { timeout: CATALOG_TIMEOUT_MS }),
  );
}
