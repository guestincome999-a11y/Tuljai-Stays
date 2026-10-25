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

// Lodge details, photos and room types (prices!) are edited from the admin
// panel at any time, so cached copies expire quickly instead of living for the
// whole app session. invalidateLodgeCatalogCache() clears them immediately
// when the backend announces a catalog change.
const CATALOG_CACHE_TTL_MS = 45_000;

interface CacheEntry<TValue> {
  expiresAt: number;
  value: TValue;
}

// Bumped on every invalidation so a request that was already in flight when
// the catalog changed can't write its (now stale) response back into the cache.
let cacheGeneration = 0;

const lodgeDetailsCache = new Map<string, CacheEntry<LodgeDetails>>();
const lodgePhotosCache = new Map<string, CacheEntry<LodgePhoto[]>>();
const lodgeRoomTypesCache = new Map<string, CacheEntry<RoomType[]>>();
let amenitiesCache: CacheEntry<Amenity[]> | null = null;
let citiesCache: CacheEntry<City[]> | null = null;

function readCache<TValue>(entry: CacheEntry<TValue> | null | undefined): TValue | null {
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.value;
}

function writeCache<TValue>(value: TValue): CacheEntry<TValue> {
  return { expiresAt: Date.now() + CATALOG_CACHE_TTL_MS, value };
}

export function invalidateLodgeCatalogCache(): void {
  cacheGeneration += 1;
  lodgeDetailsCache.clear();
  lodgePhotosCache.clear();
  lodgeRoomTypesCache.clear();
  amenitiesCache = null;
  citiesCache = null;
}

export async function listCities(): Promise<City[]> {
  const cached = readCache(citiesCache);

  if (cached) {
    return cached;
  }

  const generation = cacheGeneration;
  const cities = await apiClient.get<City[]>('/cities');

  if (generation === cacheGeneration) {
    citiesCache = writeCache(cities);
  }

  return cities;
}

export async function listAmenities(): Promise<Amenity[]> {
  const cached = readCache(amenitiesCache);

  if (cached) {
    return cached;
  }

  const generation = cacheGeneration;
  const amenities = await apiClient.get<Amenity[]>('/amenities');

  if (generation === cacheGeneration) {
    amenitiesCache = writeCache(amenities);
  }

  return amenities;
}

export async function listPublicLodges(query: PublicLodgeQuery): Promise<PaginatedResponse<Lodge>> {
  return apiClient.get<PaginatedResponse<Lodge>>('/lodges', {
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
  const cached = readCache(lodgeDetailsCache.get(lodgeId));

  if (cached) {
    return cached;
  }

  const generation = cacheGeneration;
  const details = await apiClient.get<LodgeDetails>(`/lodges/${lodgeId}`);

  if (generation === cacheGeneration) {
    lodgeDetailsCache.set(lodgeId, writeCache(details));
  }

  return details;
}

export async function listLodgePhotos(lodgeId: string): Promise<LodgePhoto[]> {
  const cached = readCache(lodgePhotosCache.get(lodgeId));

  if (cached) {
    return cached;
  }

  const generation = cacheGeneration;
  const photos = await apiClient.get<LodgePhoto[]>(`/lodges/${lodgeId}/photos`);
  const approvedPhotos = photos
    .filter((photo) => photo.approvalStatus === 'APPROVED')
    .sort(
      (left, right) =>
        Number(right.isCover) - Number(left.isCover) || left.sortOrder - right.sortOrder,
    );

  if (generation === cacheGeneration) {
    lodgePhotosCache.set(lodgeId, writeCache(approvedPhotos));
  }

  return approvedPhotos;
}

export async function listLodgeRoomTypes(lodgeId: string): Promise<RoomType[]> {
  const cached = readCache(lodgeRoomTypesCache.get(lodgeId));

  if (cached) {
    return cached;
  }

  const generation = cacheGeneration;
  const roomTypes = await apiClient.get<RoomType[]>(`/lodges/${lodgeId}/room-types`);
  const activeRoomTypes = roomTypes
    .filter((roomType) => roomType.isActive)
    .sort((left, right) => Number(left.basePrice) - Number(right.basePrice));

  if (generation === cacheGeneration) {
    lodgeRoomTypesCache.set(lodgeId, writeCache(activeRoomTypes));
  }

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

export async function getLodgePreview(lodgeId: string): Promise<LodgePreview> {
  const details = await getLodgeDetails(lodgeId);

  return toLodgePreview(details);
}

export async function listAnnouncementsPreview(): Promise<Announcement[]> {
  const response = await apiClient.get<PaginatedResponse<Announcement>>('/announcements', {
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
