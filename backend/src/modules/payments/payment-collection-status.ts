import { Prisma } from '@prisma/client';
import type { PaymentCollectionStatus } from '@tuljai/types';

import type { PrismaService } from '../prisma/prisma.service';

/** A receipt stays paid while its booking/refund follows a separate lifecycle. */
export function resolvePaymentCollectionStatus(
  collection: { status: string; method: string },
  booking: { status: string; paymentStatus: string },
): PaymentCollectionStatus {
  if (collection.status !== 'PENDING') return collection.status as PaymentCollectionStatus;
  if (collection.method === 'ONLINE' && booking.paymentStatus === 'FAILED') return 'FAILED';
  if (['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) return 'CANCELLED';
  return 'PENDING';
}

// The same projection is used for rows, filters, pagination and totals, including older records.
export const PAYMENT_COLLECTION_STATUS_SQL = Prisma.sql`CASE
  WHEN pc.status <> 'PENDING' THEN pc.status
  WHEN pc.method = 'ONLINE' AND b.payment_status = 'FAILED' THEN 'FAILED'
  WHEN b.status IN ('CANCELLED','REJECTED','EXPIRED','NO_SHOW') THEN 'CANCELLED'
  ELSE pc.status END`;

/** An authoritative order read owns these transitions; captured receipts are never demoted. */
export async function recordUncapturedPaymentOutcome(
  prisma: Pick<PrismaService, '$transaction'>,
  orderId: string,
  status: 'FAILED' | 'CANCELLED' | 'PENDING',
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const bookings = await tx.$queryRaw<Array<{ id: string }>>`SELECT b.id FROM bookings b
      WHERE EXISTS (SELECT 1 FROM payment_collections pc WHERE pc.booking_id=b.id AND pc.method='ONLINE' AND pc.provider='RAZORPAY' AND pc.provider_order_id=${orderId})
      ORDER BY b.id FOR UPDATE`;
    await tx.paymentCollection.updateMany({
      where: {
        providerOrderId: orderId,
        method: 'ONLINE',
        provider: 'RAZORPAY',
        status: { in: ['PENDING', 'FAILED', 'CANCELLED'], not: status },
      },
      data: { status, updatedAt: new Date() },
    });
    await tx.booking.updateMany({
      where: {
        id: { in: bookings.map((b) => b.id) },
        paymentStatus: { in: ['PENDING', 'FAILED', 'NOT_REQUIRED'] },
        collections: { none: { method: 'ONLINE', status: { in: ['PAID', 'REFUNDED'] } } },
      },
      data: {
        paymentStatus:
          status === 'FAILED' ? 'FAILED' : status === 'PENDING' ? 'PENDING' : 'NOT_REQUIRED',
      },
    });
  });
}
