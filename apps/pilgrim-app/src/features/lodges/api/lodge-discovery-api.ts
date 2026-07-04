import type {
  Amenity,
  Announcement,
  City,
  Lodge,
  LodgeDetails,
  LodgePhoto,
  PaginatedResponse,
  PropertyType,
  RoomType,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';
import type { LodgeDetailsView, LodgePreview, LodgeSearchQuery } from '../types/lodge-discovery';

interface PublicLodgeQuery {
  citySlug?: string;
  page: number;
  pageSize: number;
  propertyType?: PropertyType;
  search?: string;
}

const TULJAPUR_CITY_SLUG = 'tuljapur';

const lodgeDetailsCache = new Map<string, LodgeDetails>();
const lodgePhotosCache = new Map<string, LodgePhoto[]>();
const lodgeRoomTypesCache = new Map<string, RoomType[]>();
let amenitiesCache: Amenity[] | null = null;
let citiesCache: City[] | null = null;

export async function listCities(): Promise<City[]> {
  if (citiesCache) {
    return citiesCache;
  }

  const cities = await apiClient.get<City[]>('/api/cities');
  citiesCache = cities;

  return cities;
}

export async function listAmenities(): Promise<Amenity[]> {
  if (amenitiesCache) {
    return amenitiesCache;
  }

  const amenities = await apiClient.get<Amenity[]>('/api/amenities');
  amenitiesCache = amenities;

  return amenities;
}

export async function listPublicLodges(query: PublicLodgeQuery): Promise<PaginatedResponse<Lodge>> {
  return apiClient.get<PaginatedResponse<Lodge>>('/api/lodges', {
    params: {
      citySlug: query.citySlug,
      page: query.page,
      pageSize: query.pageSize,
      propertyType: query.propertyType,
      search: query.search,
    },
  });
}

export async function getLodgeDetails(lodgeId: string): Promise<LodgeDetails> {
  const cached = lodgeDetailsCache.get(lodgeId);

  if (cached) {
    return cached;
  }

  const details = await apiClient.get<LodgeDetails>(`/api/lodges/${lodgeId}`);
  lodgeDetailsCache.set(lodgeId, details);

  return details;
}

export async function listLodgePhotos(lodgeId: string): Promise<LodgePhoto[]> {
  const cached = lodgePhotosCache.get(lodgeId);

  if (cached) {
    return cached;
  }

  const photos = await apiClient.get<LodgePhoto[]>(`/api/lodges/${lodgeId}/photos`);
  const approvedPhotos = photos
    .filter((photo) => photo.approvalStatus === 'APPROVED')
    .sort(
      (left, right) =>
        Number(right.isCover) - Number(left.isCover) || left.sortOrder - right.sortOrder,
    );
  lodgePhotosCache.set(lodgeId, approvedPhotos);

  return approvedPhotos;
}

export async function listLodgeRoomTypes(lodgeId: string): Promise<RoomType[]> {
  const cached = lodgeRoomTypesCache.get(lodgeId);

  if (cached) {
    return cached;
  }

  const roomTypes = await apiClient.get<RoomType[]>(`/api/lodges/${lodgeId}/room-types`);
  const activeRoomTypes = roomTypes
    .filter((roomType) => roomType.isActive)
    .sort((left, right) => Number(left.basePrice) - Number(right.basePrice));
  lodgeRoomTypesCache.set(lodgeId, activeRoomTypes);

  return activeRoomTypes;
}

export async function getLodgeDetailsView(lodgeId: string): Promise<LodgeDetailsView> {
  const [details, photos, roomTypes] = await Promise.all([
    getLodgeDetails(lodgeId),
    listLodgePhotos(lodgeId),
    listLodgeRoomTypes(lodgeId),
  ]);

  return { details, photos, roomTypes };
}

export async function listAnnouncementsPreview(): Promise<Announcement[]> {
  const response = await apiClient.get<PaginatedResponse<Announcement>>('/api/announcements', {
    params: { limit: 3, page: 1 },
  });

  return response.items;
}

export async function searchLodgePreviews(
  query: LodgeSearchQuery,
): Promise<PaginatedResponse<LodgePreview>> {
  const response = await listPublicLodges({
    citySlug: TULJAPUR_CITY_SLUG,
    page: query.page,
    pageSize: query.pageSize,
    propertyType: query.propertyType,
    search: query.search,
  });
  const previews = await Promise.all(response.items.map((lodge) => toLodgePreview(lodge)));
  const filtered = applyClientFilters(previews, query);

  return {
    ...response,
    items: sortLodgePreviews(filtered, query.sort),
  };
}

export async function loadHomeDiscoverySnapshot(): Promise<{
  announcements: Announcement[];
  featuredLodges: LodgePreview[];
  nearbyLodges: LodgePreview[];
}> {
  const [featured, nearby, announcements] = await Promise.all([
    searchLodgePreviews({ amenitySlugs: [], page: 1, pageSize: 4, sort: 'price' }),
    searchLodgePreviews({
      amenitySlugs: [],
      distanceMaxMeters: 2000,
      page: 1,
      pageSize: 4,
      sort: 'distance',
    }),
    listAnnouncementsPreview().catch(() => []),
  ]);

  return {
    announcements,
    featuredLodges: featured.items,
    nearbyLodges: nearby.items,
  };
}

function applyClientFilters(previews: LodgePreview[], query: LodgeSearchQuery): LodgePreview[] {
  return previews.filter((preview) => {
    const price = getRoomPrice(preview.roomTypePreview);
    const distance = preview.lodge.distanceFromTempleMeters;
    const hasAmenities =
      query.amenitySlugs.length === 0 ||
      query.amenitySlugs.every((slug) =>
        preview.amenities.some((amenity) => amenity.slug.toLowerCase() === slug.toLowerCase()),
      );

    if (!hasAmenities) {
      return false;
    }

    if (query.priceMin !== undefined && (!price || price < query.priceMin)) {
      return false;
    }

    if (query.priceMax !== undefined && (!price || price > query.priceMax)) {
      return false;
    }

    if (
      query.distanceMaxMeters !== undefined &&
      (distance === null || distance > query.distanceMaxMeters)
    ) {
      return false;
    }

    return true;
  });
}

function sortLodgePreviews(
  previews: LodgePreview[],
  sort: LodgeSearchQuery['sort'],
): LodgePreview[] {
  return [...previews].sort((left, right) => {
    if (sort === 'price') {
      return (
        (getRoomPrice(left.roomTypePreview) ?? Number.MAX_SAFE_INTEGER) -
        (getRoomPrice(right.roomTypePreview) ?? Number.MAX_SAFE_INTEGER)
      );
    }

    if (sort === 'distance') {
      return (
        (left.lodge.distanceFromTempleMeters ?? Number.MAX_SAFE_INTEGER) -
        (right.lodge.distanceFromTempleMeters ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return left.lodge.name.localeCompare(right.lodge.name);
  });
}

async function toLodgePreview(lodge: Lodge): Promise<LodgePreview> {
  const [details, photos, roomTypes] = await Promise.all([
    getLodgeDetails(lodge.id).catch(() => null),
    listLodgePhotos(lodge.id).catch(() => []),
    listLodgeRoomTypes(lodge.id).catch(() => []),
  ]);
  const coverPhoto = photos.find((photo) => photo.isCover) ?? photos[0] ?? null;

  return {
    amenities: details?.amenities ?? [],
    coverPhotoUrl: coverPhoto?.thumbnailUrl ?? coverPhoto?.fileUrl ?? null,
    lodge,
    roomTypePreview: roomTypes[0] ?? null,
  };
}

function getRoomPrice(roomType: RoomType | null): number | null {
  if (!roomType) {
    return null;
  }

  const parsed = Number(roomType.basePrice);

  return Number.isFinite(parsed) ? parsed : null;
}
