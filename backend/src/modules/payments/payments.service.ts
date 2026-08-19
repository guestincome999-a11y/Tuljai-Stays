import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

import { PaymentNotificationsService } from './payment-notifications.service';
import type { PaymentProvider } from './payment-provider';
import { RazorpayProvider } from './providers/razorpay.provider';

@Injectable()
export class PaymentsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly paymentNotificationsService: PaymentNotificationsService,
    private readonly notificationEventsService: NotificationEventsService,
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
      select: { id: true, bookingCode: true, totalAmount: true, status: true, lodgeId: true, paymentStatus: true },
      where: { deletedAt: null, id: bookingId, pilgrimUserId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_OWNER_APPROVAL') {
      throw new BadRequestException('This booking is not waiting for online payment');
    }
    if (booking.paymentStatus !== 'PENDING') {
      throw new BadRequestException('This booking is not configured for prepaid online payment');
    }

    const settings = await this.prisma.$queryRaw<Array<{ enabled: boolean; provider: string; display_status: string }>>`
      SELECT online_payments_enabled AS enabled, provider, display_status
      FROM payment_settings ORDER BY created_at ASC LIMIT 1
    `;
    const setting = settings[0];
    this.ensureOnlinePaymentsEnabled(
      Boolean(setting?.enabled) && setting?.provider === 'RAZORPAY' && setting.display_status === 'ACTIVE',
    );

    const existing = await this.prisma.$queryRaw<Array<{ id: string; status: string; provider_order_id: string | null }>>`
      SELECT id, status, provider_order_id FROM payment_collections
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
          status = 'PENDING', provider_order_id = ${order.orderId}, provider_payment_id = NULL,
          provider_reference = NULL, paid_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}::uuid
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO payment_collections (booking_id, method, provider, amount, status, provider_order_id)
        VALUES (${bookingId}::uuid, 'ONLINE', 'RAZORPAY', ${Number(booking.totalAmount)}, 'PENDING', ${order.orderId})
      `;
    }

    await this.paymentNotificationsService.orderCreated({
      bookingId,
      bookingCode: booking.bookingCode,
      pilgrimUserId,
      lodgeId: booking.lodgeId,
      amount: Number(booking.totalAmount),
      orderId: order.orderId,
    });

    return { bookingId, keyId: process.env.RAZORPAY_KEY_ID, orderId: order.orderId, amount: order.amount, currency: order.currency };
  }

  public async verifyBookingPayment(
    bookingId: string,
    pilgrimUserId: string,
    input: { orderId: string; paymentId: string; signature: string },
  ) {
    const booking = await this.prisma.booking.findFirst({
      select: {
        id: true,
        bookingCode: true,
        lodgeId: true,
        roomTypeId: true,
        pilgrimUserId: true,
        checkInDate: true,
        checkOutDate: true,
        status: true,
        totalAmount: true,
        paymentStatus: true,
      },
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
    if (collection.status === 'PAID' && booking.paymentStatus === 'FULLY_PAID') {
      return { bookingId, bookingCode: booking.bookingCode, status: 'ACCEPTED', paymentStatus: 'PAID' };
    }
    if (booking.paymentStatus !== 'PENDING') {
      throw new BadRequestException('This booking is not awaiting prepaid payment');
    }

    const verification = await this.razorpayProvider.verifyPayment(input);
    if (!verification.verified) {
      await this.prisma.$executeRaw`
        UPDATE payment_collections SET status = 'FAILED', provider_payment_id = ${input.paymentId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${collection.id}::uuid
      `;
      await this.paymentNotificationsService.failed({
        bookingId,
        bookingCode: booking.bookingCode,
        pilgrimUserId,
        lodgeId: booking.lodgeId,
        reason: 'The payment signature could not be verified.',
      });
      throw new BadRequestException('Razorpay payment verification failed');
    }

    const payment = await this.razorpayProvider.getPayment(input.paymentId);
    if (payment.order_id !== input.orderId) {
      throw new BadRequestException('Razorpay payment belongs to a different order');
    }
    if (payment.status !== 'captured' || !payment.captured) {
      await this.prisma.$executeRaw`
        UPDATE payment_collections SET status = CASE WHEN ${payment.status} = 'failed' THEN 'FAILED' ELSE 'PENDING' END,
          provider_payment_id = ${input.paymentId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${collection.id}::uuid
      `;
      await this.paymentNotificationsService.failed({
        bookingId,
        bookingCode: booking.bookingCode,
        pilgrimUserId,
        lodgeId: booking.lodgeId,
        reason: 'The payment has not reached the captured state yet. Please retry after Razorpay completes the payment.',
      });
      throw new BadRequestException('Razorpay payment is not captured yet');
    }

    let roomId: string;
    try {
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
        if (!rooms[0]) throw new Error('ROOM_UNAVAILABLE_AFTER_PAYMENT');

        const selectedRoomId = rooms[0].id;
        await tx.$executeRaw`
          UPDATE payment_collections
          SET status = 'PAID', provider_payment_id = ${input.paymentId}, provider_reference = ${input.orderId},
              paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${collection.id}::uuid
        `;
        await tx.booking.update({
          data: {
            roomId: selectedRoomId,
            status: 'ACCEPTED',
            acceptedByUserId: pilgrimUserId,
            paymentStatus: 'FULLY_PAID',
          },
          where: { id: bookingId },
        });
        await tx.room.update({ data: { status: 'CONFIRMED' }, where: { id: selectedRoomId } });
        await tx.bookingHistory.create({
          data: {
            action: 'BOOKING_ACCEPTED',
            actorUserId: pilgrimUserId,
            bookingId,
            fromStatus: booking.status,
            notes: 'Automatically confirmed after successful prepaid Razorpay payment',
            toStatus: 'ACCEPTED',
          },
        });
        return { roomId: selectedRoomId };
      });
      roomId = result.roomId;
    } catch (error) {
      if (error instanceof Error && error.message === 'ROOM_UNAVAILABLE_AFTER_PAYMENT') {
        try {
          await this.razorpayProvider.refundPayment(input.paymentId);
          await this.prisma.$executeRaw`
            UPDATE payment_collections
            SET status = 'REFUNDED', provider_payment_id = ${input.paymentId}, provider_reference = ${input.orderId},
                paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${collection.id}::uuid
          `;
        } catch {
          await this.prisma.$executeRaw`
            UPDATE payment_collections
            SET status = 'PAID', provider_payment_id = ${input.paymentId}, provider_reference = ${input.orderId},
                paid_at = CURRENT_TIMESTAMP, notes = 'Payment received but automatic refund requires reconciliation', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${collection.id}::uuid
          `;
        }
        await this.paymentNotificationsService.roomUnavailableAfterPayment({
          bookingId,
          bookingCode: booking.bookingCode,
          pilgrimUserId,
          lodgeId: booking.lodgeId,
          paymentId: input.paymentId,
        });
        throw new BadRequestException('Payment was received but the room became unavailable. The payment is being refunded.');
      }
      throw error;
    }

    await this.paymentNotificationsService.successful({
      bookingId,
      bookingCode: booking.bookingCode,
      pilgrimUserId,
      lodgeId: booking.lodgeId,
      amount: Number(booking.totalAmount),
      paymentId: input.paymentId,
      roomId,
    });
    await this.notificationEventsService.bookingAccepted(bookingId);

    return { bookingId, bookingCode: booking.bookingCode, status: 'ACCEPTED', paymentStatus: 'PAID', roomId };
  }
}