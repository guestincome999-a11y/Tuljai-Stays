import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { PaymentProvider } from './payment-provider';
import { RazorpayProvider } from './providers/razorpay.provider';

@Injectable()
export class PaymentsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayProvider: RazorpayProvider,
  ) {}

  public ensureOnlinePaymentsEnabled(enabled: boolean): void {
    if (!enabled) throw new BadRequestException('Online payments are currently unavailable');
  }

  public async createPayment(provider: PaymentProvider, input: Parameters<PaymentProvider['createPayment']>[0]) {
    return provider.createPayment(input);
  }

  public async verifyPayment(provider: PaymentProvider, input: Parameters<PaymentProvider['verifyPayment']>[0]) {
    return provider.verifyPayment(input);
  }

  public async refundPayment(provider: PaymentProvider, paymentId: string, amount?: number) {
    return provider.refundPayment(paymentId, amount);
  }

  public async createBookingOrder(bookingId: string, pilgrimUserId: string) {
    const booking = await this.prisma.booking.findFirst({
      select: { id: true, bookingCode: true, totalAmount: true, status: true },
      where: { deletedAt: null, id: bookingId, pilgrimUserId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_OWNER_APPROVAL') {
      throw new BadRequestException('This booking is not waiting for payment');
    }

    const settings = await this.prisma.$queryRaw<Array<{ enabled: boolean; provider: string; display_status: string }>>`
      SELECT online_payments_enabled AS enabled, provider, display_status
      FROM payment_settings ORDER BY created_at ASC LIMIT 1
    `;
    const setting = settings[0];
    this.ensureOnlinePaymentsEnabled(
      Boolean(setting?.enabled) && setting?.provider === 'RAZORPAY' && setting.display_status === 'ACTIVE',
    );

    const existing = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM payment_collections
      WHERE booking_id = ${bookingId}::uuid AND method = 'ONLINE'
      ORDER BY created_at DESC LIMIT 1
    `;
    if (existing[0]?.status === 'PAID') throw new BadRequestException('This booking is already paid');

    const amountPaise = Math.round(Number(booking.totalAmount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException('Booking has an invalid payment amount');
    }

    const order = await this.razorpayProvider.createPayment({
      amount: amountPaise,
      bookingId,
      currency: 'INR',
      receipt: booking.bookingCode,
    });

    if (existing[0]?.id) {
      await this.prisma.$executeRaw`
        UPDATE payment_collections SET provider = 'RAZORPAY', amount = ${Number(booking.totalAmount)},
          status = 'PENDING', provider_order_id = ${order.orderId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}::uuid
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO payment_collections (booking_id, method, provider, amount, status, provider_order_id)
        VALUES (${bookingId}::uuid, 'ONLINE', 'RAZORPAY', ${Number(booking.totalAmount)}, 'PENDING', ${order.orderId})
      `;
    }

    return { bookingId, keyId: process.env.RAZORPAY_KEY_ID, orderId: order.orderId, amount: order.amount, currency: order.currency };
  }

  public async verifyBookingPayment(
    bookingId: string,
    pilgrimUserId: string,
    input: { orderId: string; paymentId: string; signature: string },
  ) {
    const booking = await this.prisma.booking.findFirst({
      select: { id: true, bookingCode: true, lodgeId: true, roomTypeId: true, pilgrimUserId: true, checkInDate: true, checkOutDate: true, status: true },
      where: { deletedAt: null, id: bookingId, pilgrimUserId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const collections = await this.prisma.$queryRaw<Array<{ id: string; status: string; provider_order_id: string | null }>>`
      SELECT id, status, provider_order_id FROM payment_collections
      WHERE booking_id = ${bookingId}::uuid AND method = 'ONLINE'
      ORDER BY created_at DESC LIMIT 1
    `;
    const collection = collections[0];
    if (!collection || collection.provider_order_id !== input.orderId) {
      throw new BadRequestException('Payment order does not match this booking');
    }
    if (collection.status === 'PAID') {
      return { bookingId, bookingCode: booking.bookingCode, status: 'ACCEPTED', paymentStatus: 'PAID' };
    }

    const verification = await this.razorpayProvider.verifyPayment(input);
    if (!verification.verified) {
      await this.prisma.$executeRaw`
        UPDATE payment_collections SET status = 'FAILED', provider_payment_id = ${input.paymentId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${collection.id}::uuid
      `;
      throw new BadRequestException('Razorpay payment verification failed');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const rooms = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT r.id FROM rooms r
        WHERE r.lodge_id = ${booking.lodgeId}::uuid
          AND r.room_type_id = ${booking.roomTypeId}::uuid
          AND r.deleted_at IS NULL AND r.status = 'AVAILABLE'
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.room_id = r.id AND b.deleted_at IS NULL
              AND b.status IN ('ACCEPTED', 'QR_GENERATED', 'CHECKED_IN')
              AND b.check_in_date < ${booking.checkOutDate}
              AND b.check_out_date > ${booking.checkInDate}
          )
        ORDER BY r.id LIMIT 1 FOR UPDATE SKIP LOCKED
      `;
      if (!rooms[0]) throw new BadRequestException('Room is no longer available for this booking');

      const roomId = rooms[0].id;
      await tx.$executeRaw`
        UPDATE payment_collections
        SET status = 'PAID', provider_payment_id = ${input.paymentId}, provider_reference = ${input.orderId},
            paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${collection.id}::uuid
      `;
      await tx.booking.update({
        data: { roomId, status: 'ACCEPTED', acceptedByUserId: pilgrimUserId },
        where: { id: bookingId },
      });
      await tx.room.update({ data: { status: 'CONFIRMED' }, where: { id: roomId } });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_ACCEPTED', actorUserId: pilgrimUserId, bookingId,
          fromStatus: booking.status,
          notes: 'Automatically confirmed after successful prepaid Razorpay payment',
          toStatus: 'ACCEPTED',
        },
      });
      return { roomId };
    });

    return { bookingId, bookingCode: booking.bookingCode, status: 'ACCEPTED', paymentStatus: 'PAID', roomId: result.roomId };
  }
}
