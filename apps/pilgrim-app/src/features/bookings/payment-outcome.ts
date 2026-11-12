/** Only an explicit gateway failure is a failure. SDK dismissal/network codes are uncertain. */
export function isExplicitPaymentFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { reason?: string; error?: { reason?: string }; description?: string };
  let reason = value.error?.reason ?? value.reason;
  if (!reason && value.description) {
    try {
      reason = (JSON.parse(value.description) as { error?: { reason?: string } }).error?.reason;
    } catch {
      /* A human-readable SDK description is not proof of payment failure. */
    }
  }
  return [
    'payment_failed',
    'payment_declined',
    'bank_declined',
    'insufficient_funds',
    'card_declined',
  ].includes(reason ?? '');
}

export function paymentTiming(
  operation: string,
  orderId?: string,
  durationMs?: number,
  bookingId?: string,
): void {
  // Correlation and timing only; never include SDK responses, signatures, or guest details.
  console.info(
    JSON.stringify({
      operation,
      orderId,
      bookingId,
      timestamp: Date.now(),
      durationMs: durationMs === undefined ? undefined : Math.round(durationMs),
    }),
  );
}

const paymentListeners = new Set<() => void>();
export function onPaymentUpdate(listener: () => void): () => void {
  paymentListeners.add(listener);
  return () => {
    paymentListeners.delete(listener);
  };
}
export function requestPaymentReconciliation(): void {
  for (const listener of paymentListeners) listener();
}
