import type { PrismaClient } from '@prisma/client';
import type { Booking, BookingActivity } from '@tuljai/types';

const statusTitles: Record<string, string> = {
  PENDING_OWNER_APPROVAL: 'Awaiting owner approval',
  ACCEPTED: 'Booking accepted',
  REJECTED: 'Booking rejected',
  QR_GENERATED: 'QR generated',
  CHECKED_IN: 'Checked in',
  CHECKED_OUT: 'Checked out',
  COMPLETED: 'Stay completed',
  CANCELLED: 'Booking cancelled',
  EXPIRED: 'Booking expired',
  NO_SHOW: 'Guest marked no-show',
};

export async function getAdminBookingActivity(
  db: PrismaClient,
  booking: Booking,
): Promise<BookingActivity[]> {
  const [history, tokens, collections, audits] = await Promise.all([
    db.bookingHistory.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { displayName: true } } },
    }),
    db.bookingQrToken.findMany({
      where: { bookingId: booking.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, createdAt: true },
    }),
    db.$queryRaw<
      Array<{ id: string; method: string; amount: string; paidAt: Date; reference: string | null }>
    >`
      SELECT id, method, amount::text AS amount, paid_at AS "paidAt", provider_reference AS reference
      FROM payment_collections WHERE booking_id = ${booking.id}::uuid AND status IN ('PAID', 'REFUNDED') AND paid_at IS NOT NULL
      ORDER BY paid_at, id`,
    db.auditLog.findMany({
      where: { entityType: 'booking', entityId: booking.id, action: 'PAY_AT_LODGE_COLLECTED' },
      include: { actor: { select: { displayName: true } } },
    }),
  ]);
  const items: BookingActivity[] = [
    {
      id: `booked:${booking.id}`,
      title: 'Booked',
      description: 'Booking record created.',
      timestamp: booking.createdAt,
    },
  ];
  for (const event of history) {
    if (
      event.action === 'BOOKING_CREATED' ||
      (tokens.length > 0 && event.toStatus === 'QR_GENERATED')
    )
      continue;
    items.push({
      id: `history:${event.id}`,
      title: statusTitles[event.toStatus] ?? event.action.replaceAll('_', ' ').toLowerCase(),
      description: event.notes || event.action.replaceAll('_', ' ').toLowerCase(),
      timestamp: event.createdAt.toISOString(),
      actorName: event.actor?.displayName ?? null,
    });
  }
  tokens.forEach((token, index) =>
    items.push({
      id: `qr:${token.id}`,
      title: index === 0 ? 'QR generated' : 'QR reissued',
      description: 'Booking QR pass issued.',
      timestamp: token.createdAt.toISOString(),
    }),
  );
  for (const receipt of collections) {
    if (receipt.method !== 'ONLINE' && receipt.method !== 'PAY_AT_LODGE') continue;
    const audit = receipt.reference
      ? audits.find((item) => {
          const metadata = item.metadata;
          return (
            metadata &&
            typeof metadata === 'object' &&
            !Array.isArray(metadata) &&
            metadata.reference === receipt.reference
          );
        })
      : undefined;
    items.push({
      id: `receipt:${receipt.id}`,
      title: receipt.method === 'ONLINE' ? 'Payment received online' : 'Payment collected at lodge',
      description:
        receipt.method === 'ONLINE'
          ? 'Online payment confirmed by the payment provider.'
          : 'Payment receipt recorded at the lodge.',
      timestamp: receipt.paidAt.toISOString(),
      amount: receipt.amount,
      paymentMethod: receipt.method,
      actorName: audit?.actor?.displayName ?? null,
    });
  }
  // Legacy bookings may predate history logging. Use only their explicit event timestamps.
  for (const [status, timestamp, title] of [
    ['CHECKED_IN', booking.checkedInAt, 'Checked in'],
    ['CHECKED_OUT', booking.checkedOutAt, 'Checked out'],
  ] as const) {
    if (timestamp && !history.some((item) => item.toStatus === status))
      items.push({
        id: `${status}:${booking.id}`,
        title,
        description: 'Recorded booking milestone.',
        timestamp,
      });
  }
  return items.sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id),
  );
}
