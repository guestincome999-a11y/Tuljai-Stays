import * as SecureStore from 'expo-secure-store';

import type { EnrichedBooking } from '../api/bookings-api';

const BOOKING_SUMMARY_CACHE_KEY = 'tuljai.pilgrim.bookingSummaryCache';

export async function saveBookingSummaryCache(bookings: EnrichedBooking[]): Promise<void> {
  await SecureStore.setItemAsync(BOOKING_SUMMARY_CACHE_KEY, JSON.stringify(bookings));
}

export async function loadBookingSummaryCache(): Promise<EnrichedBooking[]> {
  const stored = await SecureStore.getItemAsync(BOOKING_SUMMARY_CACHE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    return isBookingSummaryArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isBookingSummaryArray(value: unknown): value is EnrichedBooking[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const booking = (item as Partial<EnrichedBooking>).booking;

      return Boolean(
        booking &&
        typeof booking === 'object' &&
        typeof booking.id === 'string' &&
        typeof booking.bookingCode === 'string',
      );
    })
  );
}
