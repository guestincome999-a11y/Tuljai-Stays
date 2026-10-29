/** Correlation key, not a credential. Keep it unchanged when retrying the same hold request. */
export function newCheckoutAttemptKey(): string {
  return `checkout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}
