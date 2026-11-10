import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const CANCELLATION_POLICY_KEY = 'booking_cancellation_policy';
export const ADMIN_CANCELLATION_REASONS = [
  'Room Full',
  'Room Unavailable',
  'Lodge Unable to Accommodate',
  'Operational Issue',
] as const;

export interface CancellationPolicy {
  configured: boolean;
  tiers: Array<{ daysBeforeCheckIn: number; refundPercent: number }>;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  configured: true,
  tiers: [
    { daysBeforeCheckIn: 4, refundPercent: 100 },
    { daysBeforeCheckIn: 2, refundPercent: 90 },
    { daysBeforeCheckIn: 0, refundPercent: 80 },
  ],
};

/** No financial policy is invented for existing bookings. null means manual policy review. */
export function parseCancellationPolicy(value: unknown): CancellationPolicy {
  const policy = value as CancellationPolicy | null;
  if (
    !policy ||
    typeof policy.configured !== 'boolean' ||
    !Array.isArray(policy.tiers) ||
    policy.tiers.length > 20 ||
    (policy.configured && !policy.tiers.length) ||
    policy.tiers.some(
      (t) =>
        !t ||
        typeof t !== 'object' ||
        !Number.isInteger(t.daysBeforeCheckIn) ||
        t.daysBeforeCheckIn < 0 ||
        !Number.isInteger(t.refundPercent) ||
        t.refundPercent < 0 ||
        t.refundPercent > 100,
    ) ||
    new Set(policy.tiers.map((t) => t.daysBeforeCheckIn)).size !== policy.tiers.length
  ) {
    throw new BadRequestException('Invalid cancellation policy');
  }
  return {
    configured: policy.configured,
    tiers: [...policy.tiers].sort((a, b) => b.daysBeforeCheckIn - a.daysBeforeCheckIn),
  };
}

export function moneyToPaise(value: Prisma.Decimal | string): number {
  const result = new Prisma.Decimal(value).mul(100);
  if (!result.isInteger() || result.isNegative() || !Number.isSafeInteger(result.toNumber()))
    throw new BadRequestException('Invalid payment amount');
  return result.toNumber();
}

export function refundPercent(
  policy: CancellationPolicy,
  checkIn: Date,
  cancelledAt: Date,
): number | null {
  if (!policy.configured) return null;
  // SQL date versus India's calendar date, independent of Render's timezone.
  const indiaDay = new Date(cancelledAt.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const days = Math.round(
    (Date.parse(checkIn.toISOString().slice(0, 10)) - Date.parse(indiaDay)) / 86_400_000,
  );
  return policy.tiers.find((t) => days >= t.daysBeforeCheckIn)?.refundPercent ?? 0;
}

export const REFUND_MESSAGES = {
  PENDING: 'Your refund request is being processed. We will notify you when there is an update.',
  INITIATED:
    'Your refund has been initiated successfully. The amount will be credited to your original payment method within 5–7 business days, depending on your bank or payment provider.',
  PROCESSED:
    'Your refund has been successfully processed by our payment provider. Please check your original payment method for the credit.',
  FAILED:
    'We are experiencing a delay in processing your refund. Our team has been notified and is working to resolve it.',
  NOT_REQUIRED:
    'No additional online refund is due. Existing refunds, the cancellation policy and captured payment determine eligibility.',
} as const;
