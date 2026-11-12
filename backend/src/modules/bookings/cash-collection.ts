import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { Booking } from '@tuljai/types';

export async function withCashCollection<T extends Booking>(
  db: PrismaClient,
  booking: T,
): Promise<T> {
  if (booking.paymentStatus !== 'PAY_AT_LODGE') return booking;
  const rows = await db.$queryRaw<Array<{ amount: string; paidAt: Date | null }>>`
    SELECT COALESCE(SUM(amount), 0)::text AS amount, MAX(paid_at) AS "paidAt"
    FROM payment_collections
    WHERE booking_id = ${booking.id}::uuid AND method = 'PAY_AT_LODGE' AND status = 'PAID'
  `;
  const row = rows[0];
  const total = new Prisma.Decimal(booking.totalAmount ?? 0);
  return {
    ...booking,
    payAtLodgeCollectedAt:
      row?.paidAt && total.gt(0) && new Prisma.Decimal(row.amount).gte(total)
        ? row.paidAt.toISOString()
        : null,
  };
}

// The booking lock serializes devices and retries. The deterministic collection
// reference also has a database unique index; a retry cannot create a second receipt.
export async function recordCashCollection(
  db: PrismaClient,
  assertLodgeAccess: (lodgeId: string) => Promise<void>,
  input: { bookingId: string; actorUserId: string; expectedAmount: string },
): Promise<{ changed: boolean; lodgeId: string }> {
  // Capture the confirmation request time, never the booking/check-in time.
  const collectedAt = new Date();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${input.bookingId}::uuid FOR UPDATE`;
    const booking = await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null } });
    if (!booking) throw new NotFoundException('Booking not found');
    await assertLodgeAccess(booking.lodgeId);
    if (booking.paymentStatus !== 'PAY_AT_LODGE' || booking.status !== 'CHECKED_IN')
      throw new BadRequestException(
        'Only checked-in pay-at-lodge bookings can be marked collected',
      );
    const total = new Prisma.Decimal(booking.totalAmount ?? 0);
    if (!total.gt(0)) throw new BadRequestException('Booking has no amount to collect');
    const rows = await tx.$queryRaw<
      Array<{ id: string; amount: string; status: string; provider: string | null }>
    >`
      SELECT id, amount::text AS amount, status, provider FROM payment_collections
      WHERE booking_id = ${booking.id}::uuid AND method = 'PAY_AT_LODGE'
      ORDER BY created_at FOR UPDATE
    `;
    const paid = rows
      .filter((row) => row.status === 'PAID')
      .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
    if (paid.gte(total)) return { changed: false, lodgeId: booking.lodgeId };
    if (
      paid.gt(0) ||
      rows.some((row) => row.status !== 'PENDING' || row.provider !== null) ||
      rows.length > 1
    )
      throw new ConflictException(
        'Payment has existing adjustments. Review the booking before collecting.',
      );
    const due = new Prisma.Decimal(booking.balanceAmount ?? booking.totalAmount ?? 0);
    if (
      !/^\d+(?:\.\d{1,2})?$/u.test(input.expectedAmount) ||
      !due.eq(input.expectedAmount) ||
      !due.eq(total)
    )
      throw new ConflictException(
        'Amount changed. Refresh the booking and confirm the current amount.',
      );
    const reference = `owner-pay-at-lodge:${booking.id}`;
    const [member, actor] = await Promise.all([
      tx.lodgeOwner.findUnique({
        where: { lodgeId_userId: { lodgeId: booking.lodgeId, userId: input.actorUserId } },
        select: { ownerName: true },
      }),
      tx.user.findUnique({ where: { id: input.actorUserId }, select: { displayName: true } }),
    ]);
    const collectorName = member?.ownerName.trim() || actor?.displayName?.trim() || null;
    if (rows[0]) {
      await tx.$executeRaw`
        UPDATE payment_collections SET status = 'PAID', amount = ${due}, paid_at = ${collectedAt},
        provider_reference = ${reference}, updated_at = CURRENT_TIMESTAMP WHERE id = ${rows[0].id}::uuid
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO payment_collections (booking_id, method, amount, status, provider_reference, paid_at)
        VALUES (${booking.id}::uuid, 'PAY_AT_LODGE', ${due}, 'PAID', ${reference}, ${collectedAt})
      `;
    }
    // Preserve PAY_AT_LODGE: FULLY_PAID denotes prepaid/online bookings elsewhere.
    await tx.booking.update({ where: { id: booking.id }, data: { balanceAmount: 0 } });
    await tx.auditLog.create({
      data: {
        action: 'PAY_AT_LODGE_COLLECTED',
        actorUserId: input.actorUserId,
        entityId: booking.id,
        entityType: 'booking',
        metadata: {
          amount: due.toFixed(2),
          method: 'PAY_AT_LODGE',
          reference,
          collectorName,
          collectedAt: collectedAt.toISOString(),
        },
      },
    });
    return { changed: true, lodgeId: booking.lodgeId };
  });
}
