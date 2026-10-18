import { useEffect, useRef, useState } from 'react';

import { fetchAvailability } from './booking';

/**
 * How many rooms are free for each room type on the chosen dates. Results are ignored while the
 * guest holds a room themselves, because the backend counts their own hold against the total.
 */
export function useAvailability({
  checkInDate,
  checkOutDate,
  enabled,
  lodgeId,
  roomTypeIds,
  shouldDiscard,
}: {
  checkInDate: string;
  checkOutDate: string;
  enabled: boolean;
  lodgeId: string;
  roomTypeIds: string[];
  shouldDiscard: () => boolean;
}): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const discardRef = useRef(shouldDiscard);
  discardRef.current = shouldDiscard;
  const idsKey = roomTypeIds.join(',');

  useEffect(() => {
    if (!enabled || idsKey === '') return undefined;
    let cancelled = false;
    void Promise.all(
      idsKey.split(',').map(async (roomTypeId) => {
        try {
          const result = await fetchAvailability({
            checkInDate,
            checkOutDate,
            lodgeId,
            roomTypeId,
          });
          return [roomTypeId, result.availableRoomCount] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled || discardRef.current()) return;
      const next: Record<string, number> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [checkInDate, checkOutDate, enabled, idsKey, lodgeId]);

  return counts;
}
