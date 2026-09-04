import type {
  Booking,
  Lodge,
  Notification as ApiNotification,
  PropertyType,
  RoomType,
} from '@tuljai/types';

import { listMyBookings, type EnrichedBooking } from '../features/bookings/api/bookings-api';
import { getLodgeDetailsView, listPublicLodges } from '../features/lodges/api/lodge-discovery-api';
import { listNotifications } from '../features/notifications/api/notifications-api';

import {
  initialPilgrimNotifications,
  pilgrimLodges,
  type PilgrimBooking,
  type PilgrimLodge,
  type PilgrimNotification,
  type PilgrimRoom,
} from './mock-data';

/**
 * Fetches only the lightweight lodge list (a single request) and maps it to
 * summary cards immediately. Full details (photos, room prices) are NOT
 * fetched here — call hydrateBackendLodge() per lodge afterwards so the app
 * can render something on screen right away instead of blocking on every
 * lodge's detail/photo/room-type calls before showing anything.
 */
export async function loadLodgeSummaries(): Promise<PilgrimLodge[]> {
  const response = await listPublicLodges({
    citySlug: 'tuljapur',
    page: 1,
    pageSize: 100,
  });
  const summaries = response.items.map(toSummaryLodge);
  return summaries.length > 0 ? summaries : pilgrimLodges.map((lodge) => ({ ...lodge, hydrated: true }));
}

/**
 * Fetches full details for a single lodge summary and returns the enriched
 * lodge with hydrated: true. Safe to call with limited concurrency in the
 * background after loadLodgeSummaries() has already rendered summary cards.
 */
export async function hydrateBackendLodge(summary: PilgrimLodge): Promise<PilgrimLodge> {
  const visualFallback = pilgrimLodges.find((item) => item.id === summary.slug);
  let view: Awaited<ReturnType<typeof getLodgeDetailsView>>;
  try {
    view = await getLodgeDetailsView(summary.id);
  } catch {
    // Keep whatever summary/fallback content we already have, just stop
    // showing a skeleton for this card.
    return { ...summary, hydrated: true };
  }
  const photos = view.photos.map((photo) => photo.thumbnailUrl ?? photo.fileUrl);
  const rooms = view.roomTypes.map((roomType) => mapRoomType(roomType, visualFallback));
  const lowestPrice = Math.min(...rooms.map((room) => room.price));
  const address = view.details.address;

  return {
    amenities: view.details.amenities.map((amenity) => ({
      icon: amenity.iconName ?? iconForAmenity(amenity.slug),
      label: amenity.name,
    })),
    badge: visualFallback?.badge,
    description: view.details.description ?? visualFallback?.description ?? '',
    distance: formatDistance(view.details.distanceFromTempleMeters),
    hero: photos[0] ?? visualFallback?.hero ?? pilgrimLodges[0].hero,
    hydrated: true,
    id: view.details.id,
    location: address
      ? [address.addressLine1, address.city].filter(Boolean).join(', ')
      : (visualFallback?.location ?? 'Tuljapur'),
    name: view.details.name,
    photos: photos.length > 0 ? photos : (visualFallback?.photos ?? [pilgrimLodges[0].hero]),
    price: Number.isFinite(lowestPrice) ? lowestPrice : (visualFallback?.price ?? 0),
    primaryPhone: view.details.primaryPhone,
    rating: visualFallback?.rating ?? 4.5,
    reviewCount: visualFallback?.reviewCount ?? 0,
    rooms,
    rules: view.details.rules
      ? view.details.rules.split(/\r?\n/).filter(Boolean)
      : (visualFallback?.rules ?? []),
    slug: view.details.slug,
    tags: visualFallback?.tags ?? ['Verified'],
    type: mapPropertyType(view.details.propertyType),
  } satisfies PilgrimLodge;
}

function toSummaryLodge(summary: Lodge): PilgrimLodge {
  const visualFallback = pilgrimLodges.find((item) => item.id === summary.slug);
  return {
    amenities: visualFallback?.amenities ?? [],
    badge: visualFallback?.badge,
    description: summary.description ?? visualFallback?.description ?? '',
    distance: formatDistance(summary.distanceFromTempleMeters),
    hero: visualFallback?.hero ?? pilgrimLodges[0].hero,
    hydrated: false,
    id: summary.id,
    location: visualFallback?.location ?? 'Tuljapur',
    name: summary.name,
    photos: visualFallback?.photos ?? [pilgrimLodges[0].hero],
    price: visualFallback?.price ?? 0,
    primaryPhone: summary.primaryPhone,
    rating: visualFallback?.rating ?? 4.5,
    reviewCount: visualFallback?.reviewCount ?? 0,
    rooms: visualFallback?.rooms ?? [],
    rules: visualFallback?.rules ?? [],
    slug: summary.slug,
    tags: visualFallback?.tags ?? ['Verified'],
    type: mapPropertyType(summary.propertyType),
  };
}

export async function loadBackendBookings(lodges: PilgrimLodge[]): Promise<PilgrimBooking[]> {
  const bookings = await listMyBookings();
  return bookings.map((item) => mapBooking(item, lodges));
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
    image: enriched.coverPhotoUrl ?? lodge?.hero ?? pilgrimLodges[0].hero,
    lodgeId: booking.lodgeId,
    lodgeName: enriched.lodgeName,
    paymentStatus:
      booking.paymentStatus === 'FULLY_PAID' || booking.paymentStatus === 'ADVANCE_PAID'
        ? 'Paid'
        : booking.paymentStatus === 'REFUNDED'
          ? 'Refunded'
          : 'Pay at lodge',
    qrReady: booking.status === 'ACCEPTED' || booking.status === 'QR_GENERATED',
    roomName: enriched.roomTypeName,
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
export function synthesizeEnrichedBooking(booking: Booking, lodges: PilgrimLodge[]): EnrichedBooking {
  const lodge = lodges.find((item) => item.id === booking.lodgeId);
  const room = lodge?.rooms.find((item) => item.id === booking.roomTypeId);
  return {
    booking,
    coverPhotoUrl: lodge?.photos[0] ?? lodge?.hero ?? null,
    directionsQuery: lodge?.location ?? lodge?.name ?? null,
    lodgeName: lodge?.name ?? 'Tuljai Stays lodge',
    roomTypeName: room?.name ?? 'Selected room',
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

function mapRoomType(roomType: RoomType, fallback?: PilgrimLodge): PilgrimRoom {
  const visualRoom = fallback?.rooms.find(
    (room) => room.name.toLowerCase() === roomType.name.toLowerCase(),
  );
  const descriptionParts = roomType.description?.split(' · ').filter(Boolean) ?? [];
  return {
    available: roomType.totalRooms,
    bed: descriptionParts[0] ?? visualRoom?.bed ?? 'Comfortable bedding',
    capacity: `${roomType.capacityAdults} adults${
      roomType.capacityChildren > 0 ? ` + ${roomType.capacityChildren} child` : ''
    }`,
    features:
      descriptionParts.slice(1).length > 0
        ? descriptionParts.slice(1)
        : (visualRoom?.features ?? []),
    id: roomType.id,
    name: roomType.name,
    price: Number(roomType.basePrice),
  };
}

function mapNotification(notification: ApiNotification): PilgrimNotification {
  return {
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

function mapPropertyType(propertyType: PropertyType): PilgrimLodge['type'] {
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
  if (distance === null) return 'Near Tulja Bhavani Temple';
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
