import type { Booking } from '@tuljai/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { PaymentRecoveryStatus } from './api/bookings-api';
import { onPaymentUpdate } from './payment-outcome';

const delays = [0, 1500, 3000, 6000, 10000, 15000, 30000];

/** Bounded reconciliation only while a checkout outcome is uncertain; refresh again on foreground. */
export function usePaymentResolution(
  read: (orderId: string) => Promise<PaymentRecoveryStatus>,
  confirmed: (bookingId: string, booking?: Booking | null) => void,
) {
  const [state, setState] = useState<{
    orderId: string;
    phase: 'VERIFYING' | 'PENDING' | 'FAILED';
    message: string;
  } | null>(null);
  const readers = useRef({ read, confirmed });
  readers.current = { read, confirmed };
  const [revision, setRevision] = useState(0);
  const [retryCheckout, setRetryCheckout] = useState<PaymentRecoveryStatus['retryCheckout']>(null);
  const clear = useCallback(() => {
    setState(null);
    setRetryCheckout(null);
  }, []);
  const uncertain = useCallback(
    (orderId: string) =>
      setState({
        orderId,
        phase: 'PENDING',
        message:
          'Payment verification pending. We are checking your existing payment. Do not pay again.',
      }),
    [],
  );
  const verifying = useCallback(
    (orderId: string) =>
      setState({
        orderId,
        phase: 'VERIFYING',
        message: 'Verifying payment and confirming your booking…',
      }),
    [],
  );
  const failed = useCallback(
    (orderId: string) =>
      setState({
        orderId,
        phase: 'FAILED',
        message: 'Razorpay reported a payment failure. Retry your existing checkout to try again.',
      }),
    [],
  );
  useEffect(
    () =>
      onPaymentUpdate(() => {
        if (state) {
          setState((current) =>
            current?.phase === 'FAILED'
              ? { ...current, phase: 'PENDING', message: 'Checking the latest payment result…' }
              : current,
          );
          setRevision((value) => value + 1);
        }
      }),
    [state?.orderId],
  );

  useEffect(() => {
    if (!state || state.phase === 'FAILED') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const check = async () => {
      try {
        const result = await readers.current.read(state.orderId);
        if (!active) return;
        setRetryCheckout(result.retryCheckout);
        if (result.status === 'CONFIRMED' && result.bookingId) {
          setState(null);
          readers.current.confirmed(result.bookingId, result.booking);
          return;
        }
        if (result.recoveryRequired) {
          setState({
            orderId: state.orderId,
            phase: 'PENDING',
            message:
              'Payment verification needs support review. Your payment reference is saved. Do not pay again.',
          });
          return;
        }
        if (result.gatewayStatus === 'failed') {
          failed(state.orderId);
          return;
        }
      } catch {
        /* Offline/timeout remains pending, never failed. */
      }
      if (active && attempt < delays.length)
        timer = setTimeout(() => {
          void check();
        }, delays[attempt++]);
    };
    if (state.phase === 'VERIFYING') {
      // A hung HTTP request must not leave an indefinite blocking loader.
      timer = setTimeout(() => {
        if (active) uncertain(state.orderId);
      }, 12_000);
    } else
      timer = setTimeout(() => {
        void check();
      }, delays[attempt++]);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setRevision((value) => value + 1);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [state?.orderId, state?.phase, revision, failed, uncertain]);

  return {
    state,
    verifying,
    uncertain,
    failed,
    clear,
    retryCheckout,
    retry: () => setRevision((value) => value + 1),
  };
}
