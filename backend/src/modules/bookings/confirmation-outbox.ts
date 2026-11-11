import type { Prisma } from '@prisma/client';

/** Called only inside the transaction that transitions the booking to ACCEPTED. */
export async function enqueueBookingConfirmation(
  tx: Prisma.TransactionClient,
  bookingId: string,
  recipient: string | null,
): Promise<void> {
  await tx.bookingDeliveryJob.createMany({
    skipDuplicates: true,
    data: [
      { bookingId, type: 'CONFIRMATION_EVENTS' },
      {
        bookingId,
        type: 'CONFIRMATION_EMAIL',
        recipient,
        ...(recipient ? {} : { status: 'SKIPPED', lastError: 'NO_RECIPIENT' }),
      },
    ],
  });
}

export const DELIVERY_MAX_ATTEMPTS = 6;
export const DELIVERY_LEASE_MS = 300_000;

export function retryDelayMs(attempt: number): number {
  return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

/** No provider responses/bodies in persisted errors: they can contain credentials or PII. */
export function deliveryFailure(error: unknown): {
  reason: string;
  permanent: boolean;
  uncertain: boolean;
} {
  const value = error as { code?: string; responseCode?: number; command?: string } | null;
  if (value?.code === 'INVALID_RECIPIENT')
    return { reason: 'INVALID_RECIPIENT', permanent: true, uncertain: false };
  if (value?.code === 'GMAIL_RETRYABLE' || value?.code === 'GMAIL_REJECTED')
    return {
      reason: `GMAIL_${value.responseCode ?? 'REJECTED'}`,
      permanent: value.code === 'GMAIL_REJECTED',
      uncertain: false,
    };
  if (value?.code === 'EMAIL_PREPARATION_FAILED')
    return { reason: 'EMAIL_PREPARATION_FAILED', permanent: false, uncertain: false };
  if (value?.responseCode)
    return {
      reason: `SMTP_${value.responseCode}`,
      permanent: value.responseCode >= 500,
      uncertain: false,
    };
  if (
    ['EAUTH', 'ECONNECTION', 'EDNS'].includes(value?.code ?? '') ||
    ['CONN', 'AUTH', 'AUTH PLAIN', 'AUTH LOGIN', 'MAIL FROM', 'RCPT TO'].includes(
      value?.command ?? '',
    )
  )
    return { reason: 'PROVIDER_UNAVAILABLE', permanent: false, uncertain: false };
  return { reason: 'SUBMISSION_UNKNOWN', permanent: true, uncertain: true };
}
