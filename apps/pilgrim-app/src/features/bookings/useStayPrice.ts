import type { AvailabilityResponse } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

interface Stay {
  lodgeId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
}

/** The server prices the selected dates; late quotes cannot overwrite newer selections. */
export function useStayPrice(
  stay: Stay | null,
  fetchQuote: (stay: Stay) => Promise<AvailabilityResponse>,
) {
  const [revision, setRevision] = useState(0);
  const [quote, setQuote] = useState<{ key: string; amount: number } | null>(null);
  const key = stay
    ? `${stay.lodgeId}|${stay.roomTypeId}|${stay.checkInDate}|${stay.checkOutDate}`
    : '';
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [lodgeId, roomTypeId, checkInDate, checkOutDate] = key.split('|');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const response = await fetchQuote({ lodgeId, roomTypeId, checkInDate, checkOutDate });
        const amount = Number(response.priceSummary?.totalAmount);
        if (!cancelled) setQuote(Number.isFinite(amount) && amount >= 0 ? { key, amount } : null);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled)
          timer = setTimeout(() => {
            void load();
          }, 30_000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchQuote, key, revision]);
  return { amount: quote?.key === key ? quote.amount : null, retry };
}
