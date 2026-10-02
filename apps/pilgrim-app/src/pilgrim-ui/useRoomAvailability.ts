import { useEffect, useRef, useState } from 'react';

import { checkAvailability } from '../features/bookings/api/bookings-api';

// Wait for the guest to stop tapping through dates before asking the server.
const AVAILABILITY_DEBOUNCE_MS = 350;

export interface RoomAvailabilityState {
  /** True only when every room type was checked and none has a room free. */
  allFull: boolean;
  /** True while the check for the current dates is still running. */
  checking: boolean;
  /** Free rooms per room type id. A missing id means "unknown", never "full". */
  counts: Record<string, number>;
}

interface RoomAvailabilityInput {
  checkInDate: string;
  checkOutDate: string;
  enabled?: boolean;
  lodgeId?: string;
  roomTypeIds: string[];
  /**
   * Return true to throw the result away. The availability endpoint counts the
   * guest's own active room hold, so a check that overlaps one of our own
   * holds could wrongly report the last room as taken.
   */
  shouldDiscard?: () => boolean;
}

const EMPTY_COUNTS: Record<string, number> = {};

interface CompletedCheck {
  counts: Record<string, number>;
  key: string;
}

/**
 * Live availability for each room type of a lodge for one date window.
 * Failures (network, unhydrated lodge) just leave a room "unknown": this
 * hook never blocks a booking, it only adds the "full" signal when the
 * server positively says no room is free.
 */
export function useRoomAvailability(input: RoomAvailabilityInput): RoomAvailabilityState {
  const { checkInDate, checkOutDate, enabled = true, lodgeId, shouldDiscard } = input;
  // Kept in a ref so callers can pass an inline function without it
  // re-triggering the check on every render.
  const discardRef = useRef(shouldDiscard);
  useEffect(() => {
    discardRef.current = shouldDiscard;
  });
  const roomKey = input.roomTypeIds.join('|');
  const requestKey = `${lodgeId ?? ''}#${roomKey}#${checkInDate}#${checkOutDate}`;
  const active = enabled && Boolean(lodgeId) && roomKey !== '';
  const [completed, setCompleted] = useState<CompletedCheck | null>(null);

  useEffect(() => {
    if (!active || !lodgeId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (discardRef.current?.()) return;
      const roomTypeIds = roomKey.split('|');
      void Promise.allSettled(
        roomTypeIds.map(async (roomTypeId) => {
          const result = await checkAvailability({
            checkInDate,
            checkOutDate,
            lodgeId,
            roomTypeId,
          });
          return [roomTypeId, result.availableRoomCount] as const;
        }),
      ).then((results) => {
        if (cancelled || discardRef.current?.()) return;
        const counts: Record<string, number> = {};
        for (const result of results) {
          if (result.status === 'fulfilled') counts[result.value[0]] = result.value[1];
        }
        setCompleted({ counts, key: requestKey });
      });
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, checkInDate, checkOutDate, lodgeId, requestKey, roomKey]);

  const counts = completed?.key === requestKey ? completed.counts : EMPTY_COUNTS;
  const roomTypeIds = roomKey === '' ? [] : roomKey.split('|');
  return {
    allFull: roomTypeIds.length > 0 && roomTypeIds.every((id) => counts[id] === 0),
    checking: active && completed?.key !== requestKey,
    counts,
  };
}

/** The server answers 409 Conflict when a room can't be held or booked. */
export function isRoomFullError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('details' in error)) return false;
  const { details } = error as { details?: { statusCode?: number } };
  return details?.statusCode === 409;
}

function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Tomorrow for one night: the same default stay the checkout screen opens with. */
export function defaultStayWindow(): { checkInDate: string; checkOutDate: string } {
  const today = new Date();
  const checkIn = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const checkOut = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  return { checkInDate: toDateOnly(checkIn), checkOutDate: toDateOnly(checkOut) };
}
