import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { LodgesService } from '../lodges/lodges.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CatalogAmenity,
  CatalogLodgeCard,
  CatalogLodgeDetails,
  CatalogPage,
  CatalogPhoto,
  CatalogRoomType,
  MyBookingCard,
} from './catalog.types';
import type { CatalogQueryDto } from './dto/catalog-query.dto';

const DEFAULT_CITY_SLUG = 'tuljapur';
const DEFAULT_PAGE_SIZE = 12;
// Lodge counts in a pilgrimage town are small, so the whole visible catalogue is assembled in
// three batched queries and cached briefly. Filtering and sorting then happen before pagination,
// which the previous client-side approach could not do correctly.
const CATALOG_CACHE_TTL_MS = 15_000;
const MAX_CARD_AMENITIES = 4;

interface CatalogCacheEntry {
  cards: CatalogLodgeCard[];
  expiresAt: number;
}

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

@Injectable()
export class CatalogService {
  private cache: CatalogCacheEntry | null = null;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly lodgesService: LodgesService,
  ) {}

  public async listLodges(query: CatalogQueryDto): Promise<CatalogPage> {
    const cards = await this.getAllCards();
    const amenitySlugs = (query.amenities ?? '')
      .split(',')
      .map((slug) => slug.trim().toLowerCase())
      .filter((slug) => slug.length > 0);
    const search = query.search?.trim().toLowerCase();
    const ids =
      query.ids === undefined
        ? null
        : new Set(
            query.ids
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id.length > 0),
          );

    const filtered = cards.filter((card) => {
      const price = toNumber(card.startingPrice);
      if (ids && !ids.has(card.id)) return false;
      if (query.propertyType && card.propertyType !== query.propertyType) return false;
      if (search && !card.name.toLowerCase().includes(search)) return false;
      if (
        amenitySlugs.length > 0 &&
        !amenitySlugs.every((slug) => card.amenitySlugs.includes(slug))
      ) {
        return false;
      }
      if (query.minPrice !== undefined && (price === null || price < query.minPrice)) return false;
      if (query.maxPrice !== undefined && (price === null || price > query.maxPrice)) return false;
      if (
        query.maxDistance !== undefined &&
        (card.distanceFromTempleMeters === null ||
          card.distanceFromTempleMeters > query.maxDistance)
      ) {
        return false;
      }
      return true;
    });

    const sorted = this.sortCards(filtered, query.sort ?? 'distance');
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = query.page ?? 1;
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      page,
      pageSize,
      totalItems: sorted.length,
      totalPages: Math.ceil(sorted.length / pageSize),
    };
  }

  public async getLodge(lodgeId: string): Promise<CatalogLodgeDetails> {
    const [lodge, photos, roomTypes] = await Promise.all([
      this.lodgesService.getPublicById(lodgeId),
      this.prisma.lodgePhoto.findMany({
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        where: { approvalStatus: 'APPROVED', deletedAt: null, lodgeId },
      }),
      this.prisma.roomType.findMany({
        orderBy: { basePrice: 'asc' },
        where: this.visibleRoomTypeWhere({ lodgeId }),
      }),
    ]);

    if (!lodge) {
      throw new NotFoundException('Lodge not found');
    }

    return {
      lodge,
      photos: photos.map((photo): CatalogPhoto => ({
        category: photo.category,
        id: photo.id,
        isCover: photo.isCover,
        thumbnailUrl: photo.thumbnailUrl,
        url: photo.fileUrl,
      })),
      roomTypes: roomTypes.map((roomType): CatalogRoomType => ({
        basePrice: roomType.basePrice.toString(),
        capacityAdults: roomType.capacityAdults,
        capacityChildren: roomType.capacityChildren,
        description: roomType.description,
        festivalPrice: roomType.festivalPrice?.toString() ?? null,
        id: roomType.id,
        name: roomType.name,
        totalRooms: roomType.totalRooms,
      })),
    };
  }

  /**
   * The signed-in pilgrim's bookings with lodge name, room name and cover photo already joined,
   * so the app needs one request instead of several per booking.
   */
  public async listMyBookings(userId: string): Promise<MyBookingCard[]> {
    const bookings = await this.prisma.booking.findMany({
      include: {
        lodge: { select: { name: true } },
        roomType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      where: { deletedAt: null, pilgrimUserId: userId },
    });
    const lodgeIds = [...new Set(bookings.map((booking) => booking.lodgeId))];
    const photos = await this.prisma.lodgePhoto.findMany({
      orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      where: { approvalStatus: 'APPROVED', deletedAt: null, lodgeId: { in: lodgeIds } },
    });
    const coverByLodge = new Map<string, string>();
    for (const photo of photos) {
      if (!coverByLodge.has(photo.lodgeId)) {
        coverByLodge.set(photo.lodgeId, photo.thumbnailUrl ?? photo.fileUrl);
      }
    }

    return bookings.map((booking): MyBookingCard => ({
      bookingCode: booking.bookingCode,
      checkInDate: booking.checkInDate.toISOString().slice(0, 10),
      checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
      coverUrl: coverByLodge.get(booking.lodgeId) ?? null,
      createdAt: booking.createdAt.toISOString(),
      id: booking.id,
      lodgeId: booking.lodgeId,
      lodgeName: booking.lodge.name,
      paymentStatus: booking.paymentStatus,
      roomTypeName: booking.roomType.name,
      status: booking.status,
      totalAmount: booking.totalAmount?.toString() ?? null,
      totalGuests: booking.totalGuests,
    }));
  }

  /** Drops the cached catalogue so the next read rebuilds it from the database. */
  public invalidate(): void {
    this.cache = null;
  }

  private async getAllCards(): Promise<CatalogLodgeCard[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.cards;
    }

    const lodges = await this.prisma.lodge.findMany({
      include: {
        amenities: { include: { amenity: true } },
      },
      where: {
        city: { slug: DEFAULT_CITY_SLUG },
        deletedAt: null,
        isActive: true,
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
      },
    });
    const lodgeIds = lodges.map((lodge) => lodge.id);

    const [photos, roomTypes, reviews] = await Promise.all([
      this.prisma.lodgePhoto.findMany({
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        where: { approvalStatus: 'APPROVED', deletedAt: null, lodgeId: { in: lodgeIds } },
      }),
      this.prisma.roomType.findMany({
        where: this.visibleRoomTypeWhere({ lodgeId: { in: lodgeIds } }),
      }),
      this.prisma.review.groupBy({
        _avg: { rating: true },
        _count: { rating: true },
        by: ['lodgeId'],
        where: { deletedAt: null, lodgeId: { in: lodgeIds }, status: 'PUBLISHED' },
      }),
    ]);

    const coverByLodge = new Map<string, { thumbnailUrl: string | null; url: string }>();
    for (const photo of photos) {
      // Photos arrive cover-first, so the first photo seen per lodge is its cover.
      if (!coverByLodge.has(photo.lodgeId)) {
        coverByLodge.set(photo.lodgeId, { thumbnailUrl: photo.thumbnailUrl, url: photo.fileUrl });
      }
    }

    const pricesByLodge = new Map<string, { base: number; festival: number | null }>();
    for (const roomType of roomTypes) {
      const base = Number(roomType.basePrice);
      const festival = roomType.festivalPrice === null ? null : Number(roomType.festivalPrice);
      const current = pricesByLodge.get(roomType.lodgeId);
      if (!current || base < current.base) {
        pricesByLodge.set(roomType.lodgeId, { base, festival });
      }
    }

    const reviewByLodge = new Map(
      reviews.map((row) => [
        row.lodgeId,
        {
          averageRating: row._avg.rating === null ? null : Math.round(row._avg.rating * 10) / 10,
          reviewCount: row._count.rating,
        },
      ]),
    );

    const cards = lodges.map((lodge): CatalogLodgeCard => {
      const cover = coverByLodge.get(lodge.id);
      const price = pricesByLodge.get(lodge.id);
      const review = reviewByLodge.get(lodge.id);
      const allAmenities: CatalogAmenity[] = lodge.amenities
        .filter((item) => item.amenity.isActive && item.amenity.deletedAt === null)
        .map((item) => ({
          iconName: item.amenity.iconName,
          name: item.amenity.name,
          slug: item.amenity.slug.toLowerCase(),
        }));

      return {
        amenities: allAmenities.slice(0, MAX_CARD_AMENITIES),
        amenitySlugs: allAmenities.map((item) => item.slug),
        averageRating: review?.averageRating ?? null,
        coverUrl: cover ? (cover.thumbnailUrl ?? cover.url) : null,
        distanceFromTempleMeters: lodge.distanceFromTempleMeters,
        festivalStartingPrice:
          price?.festival === null ? null : (price?.festival.toString() ?? null),
        id: lodge.id,
        name: lodge.name,
        propertyType: lodge.propertyType,
        reviewCount: review?.reviewCount ?? 0,
        startingPrice: price ? price.base.toString() : null,
      };
    });

    this.cache = { cards, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS };
    return cards;
  }

  private sortCards(cards: CatalogLodgeCard[], sort: string): CatalogLodgeCard[] {
    const far = Number.MAX_SAFE_INTEGER;
    return [...cards].sort((left, right) => {
      if (sort === 'price') {
        return (toNumber(left.startingPrice) ?? far) - (toNumber(right.startingPrice) ?? far);
      }
      if (sort === 'rating') {
        return (right.averageRating ?? 0) - (left.averageRating ?? 0);
      }
      if (sort === 'name') {
        return left.name.localeCompare(right.name);
      }
      return (
        (left.distanceFromTempleMeters ?? far) - (right.distanceFromTempleMeters ?? far) ||
        left.name.localeCompare(right.name)
      );
    });
  }

  // Mirrors the existing public room-type rule: active room types that have at least one
  // available room, belonging to a verified, active lodge.
  private visibleRoomTypeWhere(lodgeFilter: Prisma.RoomTypeWhereInput): Prisma.RoomTypeWhereInput {
    return {
      ...lodgeFilter,
      deletedAt: null,
      isActive: true,
      lodge: {
        deletedAt: null,
        isActive: true,
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
      },
      rooms: { some: { deletedAt: null, isActive: true, status: 'AVAILABLE' } },
    };
  }
}
