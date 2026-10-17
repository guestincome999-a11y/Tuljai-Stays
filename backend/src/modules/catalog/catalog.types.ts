import type { PublicLodgeDetails } from '@tuljai/types';

export interface CatalogAmenity {
  iconName: string | null;
  name: string;
  slug: string;
}

export interface CatalogLodgeCard {
  /** Up to four amenities for display on the card. */
  amenities: CatalogAmenity[];
  /** Every amenity slug the lodge offers, used for filtering. */
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
