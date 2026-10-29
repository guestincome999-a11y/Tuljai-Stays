import type { Booking, Notification as ApiNotification, RoomType } from '@tuljai/types';

import { apiClient } from '../api/client';
import { listMyBookings, type EnrichedBooking } from '../features/bookings/api/bookings-api';
import { listNotifications } from '../features/notifications/api/notifications-api';
import type { MyBookingCard } from '../v2/core/bookings';
import type { CatalogLodgeCard, CatalogLodgeDetails, CatalogPage } from '../v2/core/catalog';

import {
  initialPilgrimNotifications,
  type PilgrimBooking,
  type PilgrimLodge,
  type PilgrimNotification,
  type PilgrimRoom,
} from './mock-data';

/**
 * Fetches only the lightweight lodge list (a single request) and maps it to
 * summary cards including prices and cover photos immediately. Full room
 * details load through hydrateBackendLodge() afterwards.
 */
export async function loadLodgeSummaries(): Promise<PilgrimLodge[]> {
  const response = await apiClient.get<CatalogPage>('/catalog/lodges', {
    params: { page: 1, pageSize: 6 },
  });
  return response.items.map(toSummaryLodge);
}

/**
 * Fetches full details for a single lodge summary and returns the enriched
 * lodge with hydrated: true. Safe to call with limited concurrency in the
 * background after loadLodgeSummaries() has already rendered summary cards.
 */
export async function loadLodgeById(id: string): Promise<PilgrimLodge> {
  return hydrateBackendLodge({
    id,
    hydrated: false,
    name: '',
    hero: '',
    photos: [],
    rooms: [],
    amenities: [],
    description: '',
    distance: '',
    location: '',
    price: 0,
    priceAvailable: false,
    rating: 0,
    reviewCount: 0,
    rules: [],
    tags: [],
    type: 'Guest House',
  });
}

const lodgeDetailRequests = new Map<string, Promise<CatalogLodgeDetails>>();
function requestLodgeDetails(id: string): Promise<CatalogLodgeDetails> {
  const existing = lodgeDetailRequests.get(id);
  if (existing) return existing;
  const request = apiClient.get<CatalogLodgeDetails>(`/catalog/lodges/${id}`).finally(() => {
    lodgeDetailRequests.delete(id);
  });
  lodgeDetailRequests.set(id, request);
  return request;
}

export async function hydrateBackendLodge(summary: PilgrimLodge): Promise<PilgrimLodge> {
  let view: CatalogLodgeDetails;
  try {
    view = await requestLodgeDetails(summary.id);
  } catch {
    // Keep whatever summary/fallback content we already have, just stop
    // showing a skeleton for this card.
    return { ...summary, hydrated: true };
  }
  const photos = view.photos.map((photo) => photo.thumbnailUrl ?? photo.url);
  const rooms = view.roomTypes.map(mapRoomType);
  const lowestPrice = Math.min(...rooms.map((room) => room.price));
  const details = view.lodge;
  const address = details.address;

  return {
    amenities: details.amenities.map((amenity) => ({
      icon: amenity.iconName ?? iconForAmenity(amenity.slug),
      label: amenity.name,
    })),
    description: details.description ?? '',
    distance: formatDistance(details.distanceFromTempleMeters),
    // Owner/admin-provided Google Maps share link, used directly for the
    // "Open directions" action. Falls back to a name-based Google Maps
    // search on the detail screen when it's missing.
    googleMapsLink: details.googleMapsLink,
    hero: photos[0] ?? summary.hero ?? '',
    hydrated: true,
    id: details.id,
    location: address
      ? [address.addressLine1, address.city].filter(Boolean).join(', ')
      : 'Tuljapur',
    name: details.name,
    photos: photos.length > 0 ? photos : summary.photos,
    price: Number.isFinite(lowestPrice) ? lowestPrice : 0,
    priceAvailable: rooms.length > 0 && Number.isFinite(lowestPrice),
    // NOTE: lodge contact details (primaryPhone/email/secondaryPhone/
    // whatsappNumber) are deliberately never requested or stored here.
    // The public lodge-details endpoint no longer returns them; pilgrims
    // only get contact details after an eligible active booking, via
    // getBookingLodgeContact() on the booking detail screen.
    // Real average of published reviews (null/0 for a lodge with no reviews
    // yet), not the old cosmetic seed-data fallback.
    rating: details.averageRating ?? 0,
    reviewCount: details.reviewCount,
    rooms,
    rules: details.rules ? details.rules.split(/\r?\n/).filter(Boolean) : [],
    slug: details.slug,
    tags: ['Verified'],
    type: mapPropertyType(details.propertyType),
  } satisfies PilgrimLodge;
}

export function toSummaryLodge(summary: CatalogLodgeCard): PilgrimLodge {
  return {
    amenities: [],
    description: '',
    distance: formatDistance(summary.distanceFromTempleMeters),
    hero: summary.coverUrl ?? '',
    hydrated: false,
    id: summary.id,
    location: 'Tuljapur',
    name: summary.name,
    photos: summary.coverUrl ? [summary.coverUrl] : [],
    price: summary.startingPrice === null ? 0 : Number(summary.startingPrice),
    priceAvailable:
      summary.startingPrice !== null && Number.isFinite(Number(summary.startingPrice)),
    // Real average of published reviews (null/0 for a lodge with no reviews
    // yet), not the old cosmetic seed-data fallback.
    rating: summary.averageRating ?? 0,
    reviewCount: summary.reviewCount,
    rooms: [],
    rules: [],
    tags: ['Verified'],
    type: mapPropertyType(summary.propertyType),
  };
}

export async function loadBackendBookings(lodges: PilgrimLodge[]): Promise<PilgrimBooking[]> {
  const bookings = await listMyBookings();
  // Historical stays need not be present in the small public catalogue page.
  // Reuse the authorized joined-booking endpoint for their actual photographs.
  const missingLodgePhotos = bookings.some(
    (item) => !item.coverPhotoUrl && !lodges.some((lodge) => lodge.id === item.booking.lodgeId),
  );
  const cards = missingLodgePhotos
    ? await apiClient.get<MyBookingCard[]>('/catalog/my-bookings').catch(() => [])
    : [];
  const covers = new Map(cards.map((card) => [card.id, card.coverUrl]));
  return bookings.map((item) =>
    mapBooking(
      { ...item, coverPhotoUrl: item.coverPhotoUrl ?? covers.get(item.booking.id) ?? null },
      lodges,
    ),
  );
}

export async function loadBackendNotifications(): Promise<PilgrimNotification[]> {
  const response = await listNotifications();
  return response.items.map(mapNotification);
}

export function mapBooking(enriched: EnrichedBooking, lodges: PilgrimLodge[]): PilgrimBooking {
  const { booking } = enriched;
  const lodge = lodges.find((item) => item.id === booking.lodgeId);
  return {
    amount: Number(booking.totalAmount ?? 0),
    bookingCode: booking.bookingCode,
    checkIn: formatBookingDate(booking.checkInDate),
    checkInDate: booking.checkInDate,
    checkOut: formatBookingDate(booking.checkOutDate),
    checkOutDate: booking.checkOutDate,
    checkoutDateFlexible: booking.checkoutDateFlexible,
    createdAt: booking.createdAt,
    guests: `${booking.numberOfAdults} ${booking.numberOfAdults === 1 ? 'adult' : 'adults'}${
      booking.numberOfChildren > 0
        ? ` · ${booking.numberOfChildren} ${booking.numberOfChildren === 1 ? 'child' : 'children'}`
        : ''
    }`,
    id: booking.id,
    image: enriched.coverPhotoUrl ?? lodge?.hero ?? '',
    lodgeId: booking.lodgeId,
    lodgeName: booking.lodgeName || enriched.lodgeName || lodge?.name || '',
    googleMapsLink: booking.lodgeGoogleMapsLink ?? lodge?.googleMapsLink,
    checkInTime: booking.expectedCheckInTime ?? booking.lodgeCheckInTime,
    checkOutTime: booking.expectedCheckOutTime ?? booking.lodgeCheckOutTime,
    paymentStatus:
      booking.paymentStatus === 'FULLY_PAID'
        ? 'Paid'
        : booking.paymentStatus === 'ADVANCE_PAID'
          ? 'Partially paid'
          : booking.paymentStatus === 'REFUNDED'
            ? 'Refunded'
            : booking.paymentStatus === 'PENDING'
              ? 'Payment pending'
              : booking.paymentStatus === 'FAILED'
                ? 'Payment failed'
                : booking.paymentStatus === 'NOT_REQUIRED'
                  ? 'Not required'
                  : 'Pay at lodge',
    paidAmount:
      booking.paymentStatus === 'FULLY_PAID' && booking.totalAmount !== null
        ? Number(booking.totalAmount)
        : booking.paymentStatus === 'ADVANCE_PAID' && booking.advanceAmount !== null
          ? Number(booking.advanceAmount)
          : undefined,
    qrReady: booking.status === 'ACCEPTED' || booking.status === 'QR_GENERATED',
    roomName:
      booking.roomTypeName ||
      enriched.roomTypeName ||
      lodge?.rooms.find((room) => room.id === booking.roomTypeId)?.name ||
      '',
    status: mapBookingStatus(booking.status),
    updatedAt: booking.updatedAt,
  };
}

/**
 * Builds an EnrichedBooking straight from data already sitting in memory
 * (the lodges list loaded earlier in the session), with zero network calls.
 * Used right after booking creation so the payment/confirmation flow can
 * proceed immediately instead of waiting on a full listMyBookings() +
 * per-booking lodge/photo/room-type refetch just to learn the new booking's
 * id. loadPrivateData() still runs afterwards in the background to reconcile
 * the authoritative list.
 */
export function synthesizeEnrichedBooking(
  booking: Booking,
  lodges: PilgrimLodge[],
): EnrichedBooking {
  const lodge = lodges.find((item) => item.id === booking.lodgeId);
  const room = lodge?.rooms.find((item) => item.id === booking.roomTypeId);
  return {
    booking,
    coverPhotoUrl: lodge?.photos[0] ?? lodge?.hero ?? null,
    directionsQuery: lodge?.location ?? lodge?.name ?? null,
    lodgeName: booking.lodgeName ?? lodge?.name ?? '',
    roomTypeName: booking.roomTypeName ?? room?.name ?? '',
  };
}

export function applyBackendBookingRecord(
  current: PilgrimBooking,
  booking: Booking,
): PilgrimBooking {
  const currentUpdatedAt = Date.parse(current.updatedAt);
  const backendUpdatedAt = Date.parse(booking.updatedAt);
  if (
    Number.isFinite(currentUpdatedAt) &&
    Number.isFinite(backendUpdatedAt) &&
    currentUpdatedAt > backendUpdatedAt
  ) {
    return current;
  }

  return {
    ...current,
    checkIn: formatBookingDate(booking.checkInDate),
    checkInDate: booking.checkInDate,
    checkOut: formatBookingDate(booking.checkOutDate),
    checkOutDate: booking.checkOutDate,
    qrReady: booking.status === 'ACCEPTED' || booking.status === 'QR_GENERATED',
    status: mapBookingStatus(booking.status),
    updatedAt: booking.updatedAt,
  };
}

export function getFallbackNotifications(): PilgrimNotification[] {
  return initialPilgrimNotifications;
}

function mapRoomType(
  roomType: Pick<
    RoomType,
    | 'id'
    | 'name'
    | 'description'
    | 'totalRooms'
    | 'capacityAdults'
    | 'capacityChildren'
    | 'basePrice'
  >,
): PilgrimRoom {
  const descriptionParts = roomType.description?.split(' · ').filter(Boolean) ?? [];
  return {
    available: roomType.totalRooms,
    bed: descriptionParts[0] ?? '',
    capacity: `${roomType.capacityAdults} adults${
      roomType.capacityChildren > 0 ? ` + ${roomType.capacityChildren} child` : ''
    }`,
    features: descriptionParts.slice(1),
    id: roomType.id,
    name: roomType.name,
    price: Number(roomType.basePrice),
  };
}

function mapNotification(notification: ApiNotification): PilgrimNotification {
  const action = notification.data?.action === 'RATE_AND_REVIEW' ? 'RATE_AND_REVIEW' : undefined;
  return {
    action,
    body: notification.body,
    bookingId: notification.bookingId ?? undefined,
    id: notification.id,
    read: Boolean(notification.readAt),
    time: formatRelativeTime(notification.createdAt),
    title: notification.title,
    type:
      notification.type.startsWith('BOOKING') || notification.type.includes('CHECK')
        ? 'booking'
        : notification.type === 'QR_GENERATED'
          ? 'booking'
          : notification.type === 'ADMIN_ANNOUNCEMENT' || notification.type === 'EMERGENCY_ALERT'
            ? 'temple'
            : notification.type === 'SYSTEM'
              ? 'offer'
              : 'payment',
  };
}

function mapPropertyType(propertyType: string): PilgrimLodge['type'] {
  if (propertyType === 'BHAKT_NIWAS') return 'Bhakt Niwas';
  if (propertyType === 'DHARAMSHALA') return 'Dharamshala';
  if (propertyType === 'HOTEL') return 'Hotel';
  return 'Guest House';
}

function mapBookingStatus(status: EnrichedBooking['booking']['status']): PilgrimBooking['status'] {
  if (status === 'PENDING_OWNER_APPROVAL' || status === 'DRAFT') return 'pending';
  if (status === 'CHECKED_IN') return 'checked-in';
  if (['ACCEPTED', 'QR_GENERATED'].includes(status)) return 'confirmed';
  if (['CHECKED_OUT', 'COMPLETED'].includes(status)) return 'completed';
  return 'cancelled';
}

function formatDistance(distance: number | null): string {
  if (distance === null) return 'Tuljapur';
  if (distance < 1000) return `${distance} m from temple`;
  return `${(distance / 1000).toFixed(1)} km from temple`;
}

function formatBookingDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function formatRelativeTime(value: string): string {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  if (elapsedMinutes < 1440) return `${Math.floor(elapsedMinutes / 60)} hr ago`;
  return `${Math.floor(elapsedMinutes / 1440)} days ago`;
}

function iconForAmenity(slug: string): string {
  const icons: Record<string, string> = {
    ac: 'air-conditioner',
    cctv: 'cctv',
    'family-friendly': 'account-group',
    'hot-water': 'water',
    lift: 'elevator-passenger',
    parking: 'car',
    restaurant: 'silverware-fork-knife',
    wifi: 'wifi',
  };
  return icons[slug] ?? 'check-circle-outline';
}
