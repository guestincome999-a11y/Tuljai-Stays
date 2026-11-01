import type { AvailabilityResponse, RoomType } from '@tuljai/types';
import { useEffect, useState } from 'react';

import { getRoomTypeAvailability } from '../../bookings/api/owner-bookings-api';

export function useDateAvailability(
  lodgeId: string | null,
  roomTypes: RoomType[],
  from: string,
  to: string,
  enabled: boolean,
  isOffline: boolean,
) {
  const [state, setState] = useState<{
    data: Record<string, AvailabilityResponse>;
    isLoading: boolean;
    errorMessage: string | null;
  }>({ data: {}, isLoading: false, errorMessage: null });
  useEffect(() => {
    let current = true;
    if (!enabled || !lodgeId) return;
    if (isOffline) {
      setState({
        data: {},
        isLoading: false,
        errorMessage: 'Connect to check availability for these dates.',
      });
      return;
    }
    setState({ data: {}, isLoading: true, errorMessage: null });
    void Promise.allSettled(
      roomTypes
        .filter((type) => type.isActive)
        .map((type) => getRoomTypeAvailability(lodgeId, type.id, from, to)),
    ).then((results) => {
      if (!current) return;
      const data: Record<string, AvailabilityResponse> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') data[result.value.roomTypeId] = result.value;
      }
      setState({
        data,
        isLoading: false,
        errorMessage: results.some((result) => result.status === 'rejected')
          ? 'Some availability could not be checked. Refresh to try again.'
          : null,
      });
    });
    return () => {
      current = false;
    };
    // roomTypes receives a new identity after the existing room board reloads on
    // mutation/realtime/reconnect. It invalidates these date counts without polling.
  }, [enabled, from, isOffline, lodgeId, roomTypes, to]);
  return state;
}
