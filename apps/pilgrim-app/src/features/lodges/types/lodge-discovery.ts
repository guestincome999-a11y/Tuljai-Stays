import type {
  Amenity,
  Announcement,
  Lodge,
  LodgeDetails,
  LodgePhoto,
  PropertyType,
  RoomType,
} from '@tuljai/types';

export type LodgeSortOption = 'distance' | 'price' | 'rating' | 'newest';

export interface LodgeFilters {
  amenitySlugs: string[];
  distanceMaxMeters?: number;
  priceMax?: number;
  priceMin?: number;
  propertyType?: PropertyType;
  sort: LodgeSortOption;
}

export interface LodgeSearchQuery extends LodgeFilters {
  page: number;
  pageSize: number;
  search?: string;
}

export interface LodgePreview {
  amenities: Amenity[];
  coverPhotoUrl: string | null;
  lodge: Lodge;
  roomTypePreview: RoomType | null;
}

export interface LodgeDetailsView {
  details: LodgeDetails;
  photos: LodgePhoto[];
  roomTypes: RoomType[];
}

export interface HomeDiscoverySnapshot {
  announcements: Announcement[];
  featuredLodges: LodgePreview[];
  nearbyLodges: LodgePreview[];
}
