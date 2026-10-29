import { useCallback, useEffect, useRef, useState } from 'react';

import { newCheckoutAttemptKey } from '../../features/bookings/checkout-attempt';

import { holdPrepaidRoom, isRoomFullError, releasePrepaidHold } from './booking';
import type { PrepaidOrder, StayRequest } from './booking';

// The server keeps a hold for 15 minutes once its order is attached. Swap in a fresh one well
// before that, so a slow guest never pays against a hold that is about to lapse.
const REFRESH_AFTER_MS = 7 * 60 * 1000;
// Wait for the guest to stop tapping through dates before holding a room.
const DATE_DEBOUNCE_MS = 800;

export interface PreparedHold {
  lockCode: string;
  order: PrepaidOrder;
  preparedAt: number;
}

export type HoldStatus = 'error' | 'idle' | 'preparing' | 'ready';

function releaseHeld(held: Promise<PreparedHold> | undefined): Promise<void> {
  if (!held) return Promise.resolve();
  return held.then((prepared) => releasePrepaidHold(prepared.lockCode)).catch(() => undefined);
}

/**
 * Keeps a room held and a Razorpay order ready while the guest fills in their details, so tapping
 * Pay can open the payment sheet immediately.
 *
 * Rules it enforces: only one hold at a time (the previous is released before a new one is taken,
 * because the backend counts a guest's own holds); the hold is refreshed before it can lapse;
 * it is released when the guest leaves or switches to pay-at-lodge; and it is never refreshed or
 * released once a payment has started.
 */
export function usePrepaidHold({ enabled, stay }: { enabled: boolean; stay: StayRequest | null }) {
  const signature = stay
    ? `${stay.lodgeId}|${stay.roomTypeId}|${stay.checkInDate}|${stay.checkOutDate}`
    : '';
  const [status, setStatus] = useState<HoldStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [order, setOrder] = useState<PrepaidOrder | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const stayRef = useRef(stay);
  stayRef.current = stay;
  const heldRef = useRef<{ promise: Promise<PreparedHold>; signature: string } | null>(null);
  const pendingReleaseRef = useRef<Promise<void>>(Promise.resolve());
  const paymentStartedRef = useRef(false);
  const refreshDueRef = useRef(false);
  const firstPrepareRef = useRef(true);
  const attemptRef = useRef<{ signature: string; key: string } | null>(null);

  const prepare = useCallback(
    (force = false): Promise<PreparedHold> => {
      const wanted = stayRef.current;
      if (!wanted) return Promise.reject(new Error('Choose dates and a room first'));
      const current = heldRef.current;
      if (current && current.signature === signature && !force) return current.promise;

      if (force || attemptRef.current?.signature !== signature) {
        attemptRef.current = { signature, key: newCheckoutAttemptKey() };
      }
      const attemptKey = attemptRef.current.key;

      const release = current ? releaseHeld(current.promise) : Promise.resolve();
      pendingReleaseRef.current = release;
      const promise = (async (): Promise<PreparedHold> => {
        await release;
        const prepared = await holdPrepaidRoom(wanted, attemptKey);
        return { lockCode: prepared.lockCode, order: prepared, preparedAt: Date.now() };
      })();
      heldRef.current = { promise, signature };
      promise.catch(() => {
        if (heldRef.current?.promise === promise) heldRef.current = null;
      });
      return promise;
    },
    [signature],
  );

  useEffect(() => {
    if (!enabled || signature === '') return undefined;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const force = refreshDueRef.current;
    refreshDueRef.current = false;
    const immediate = force || firstPrepareRef.current;
    firstPrepareRef.current = false;

    const startTimer = setTimeout(
      () => {
        setError(null);
        setRoomFull(false);
        setStatus('preparing');
        prepare(force)
          .then((prepared) => {
            if (cancelled) return;
            setOrder(prepared.order);
            setStatus('ready');
            refreshTimer = setTimeout(
              () => {
                if (paymentStartedRef.current) return;
                refreshDueRef.current = true;
                setRefreshTick((tick) => tick + 1);
              },
              Math.max(prepared.preparedAt + REFRESH_AFTER_MS - Date.now(), 0),
            );
          })
          .catch((cause: unknown) => {
            if (cancelled) return;
            setOrder(null);
            setStatus('error');
            setRoomFull(isRoomFullError(cause));
            setError(cause instanceof Error ? cause.message : 'Could not prepare payment');
          });
      },
      immediate ? 0 : DATE_DEBOUNCE_MS,
    );

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [enabled, prepare, refreshTick, signature]);

  // Pay at lodge holds nothing: drop any hold taken earlier.
  useEffect(() => {
    if (enabled) return;
    const held = heldRef.current;
    heldRef.current = null;
    if (held) pendingReleaseRef.current = releaseHeld(held.promise);
    attemptRef.current = null;
    setOrder(null);
    setStatus('idle');
  }, [enabled]);

  // Leaving without paying frees the room straight away.
  useEffect(
    () => () => {
      if (paymentStartedRef.current) return;
      const held = heldRef.current;
      heldRef.current = null;
      if (held) void releaseHeld(held.promise);
    },
    [],
  );

  /** Resolves instantly when the hold is ready; prepares (or refreshes a stale) one otherwise. */
  const ensureReady = useCallback(async (): Promise<PreparedHold> => {
    let prepared = await prepare();
    if (Date.now() - prepared.preparedAt > REFRESH_AFTER_MS) prepared = await prepare(true);
    return prepared;
  }, [prepare]);

  return {
    /** Call right before opening the payment sheet so the hold is never swapped mid-payment. */
    beginPayment: () => {
      paymentStartedRef.current = true;
    },
    /** Call when the sheet was dismissed: the hold is still good for another attempt. */
    cancelPayment: () => {
      paymentStartedRef.current = false;
    },
    /** Call once the booking exists: the lock is consumed and must never be reused. */
    consume: () => {
      heldRef.current = null;
    },
    ensureReady,
    error,
    order,
    /** Resolves once any release triggered by switching to pay-at-lodge has landed. */
    settled: (): Promise<void> => pendingReleaseRef.current,
    roomFull,
    status,
  };
}
