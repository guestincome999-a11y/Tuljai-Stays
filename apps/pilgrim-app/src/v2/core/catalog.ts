import type { PublicLodgeDetails } from '@tuljai/types';

import { api } from './api';

export interface CatalogAmenity {
  iconName: string | null;
  name: string;
  slug: string;
}

export interface CatalogLodgeCard {
  amenities: CatalogAmenity[];
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
  maxDistance?: number;
  maxPrice?: number;
  minPrice?: number;
  page?: number;
  pageSize?: number;
  propertyType?: string;
  search?: string;
  sort?: 'distance' | 'name' | 'price' | 'rating';
}

export function fetchCatalog(query: CatalogQuery = {}): Promise<CatalogPage> {
  return api.get<CatalogPage>('/catalog/lodges', {
    params: { ...query, amenities: query.amenities?.join(',') },
  });
}

export function fetchLodge(lodgeId: string): Promise<CatalogLodgeDetails> {
  return api.get<CatalogLodgeDetails>(`/catalog/lodges/${lodgeId}`);
}
