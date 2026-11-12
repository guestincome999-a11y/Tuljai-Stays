import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser, Booking } from '@tuljai/types';

import { BookingLocksService } from '../bookings/booking-locks.service';
import { BookingsService } from '../bookings/bookings.service';
import type { CreateBookingDto, CreateBookingLockDto } from '../bookings/dto/booking.dto';
import { lockInventory } from '../bookings/inventory-lock';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';

import { PaymentNotificationsService } from './payment-notifications.service';
import { createIdempotentPaymentOrder } from './payment-order-idempotency';
import type { PaymentProvider } from './payment-provider';
import { RazorpayProvider } from './providers/razorpay.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  public constructor(
    private readonly bookingLocksService: BookingLocksService,
    private readonly bookingsService: BookingsService,
    private readonly prisma: PrismaService,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly paymentNotificationsService: PaymentNotificationsService,
    private readonly notificationEventsService: NotificationEventsService,
  ) {}

  public ensureOnlinePaymentsEnabled(enabled: boolean): void {
    if (!enabled) throw new BadRequestException('Online payments are currently unavailable');
  }

  private async assertOnlinePaymentsEnabled(
    db: Pick<Prisma.TransactionClient, '$queryRaw'> = this.prisma,
  ): Promise<void> {
    const settings = await db.$queryRaw<
      Array<{ enabled: boolean; provider: string; display_status: string }>
    >`
      SELECT online_payments_enabled AS enabled, provider, display_status
      FROM payment_settings ORDER BY created_at ASC LIMIT 1
    `;
    const setting = settings[0];
    this.ensureOnlinePaymentsEnabled(
      Boolean(setting?.enabled) &&
        setting?.provider === 'RAZORPAY' &&
        setting.display_status === 'ACTIVE',
    );
  }

  public async createPayment(
    provider: PaymentProvider,
    input: Parameters<PaymentProvider['createPayment']>[0],
  ) {
    return provider.createPayment(input);
  }

  public async verifyPayment(
    provider: PaymentProvider,
    input: Parameters<PaymentProvider['verifyPayment']>[0],
  ) {
    return provider.verifyPayment(input);
  }

  public async refundPayment(provider: PaymentProvider, paymentId: string, amount?: number) {
    return provider.refundPayment(paymentId, amount);
  }

  public async createBookingOrder(bookingId: string, pilgrimUserId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId}::uuid AND pilgrim_user_id = ${pilgrimUserId}::uuid FOR UPDATE`;
        const booking = await tx.booking.findFirst({
          select: { id: true, bookingCode: true, totalAmount: true, status: true, lodgeId: true },
          where: { deletedAt: null, id: bookingId, pilgrimUserId },
        });
        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status !== 'PENDING_OWNER_APPROVAL') {
          throw new BadRequestException('This booking is not waiting for online payment');
        }

        await this.assertOnlinePaymentsEnabled(tx);

        const existing = await tx.$queryRaw<
          Array<{ id: string; status: string; provider_order_id: string | null }>
        >`
      SELECT id, status, provider_order_id FROM payment_collections
      WHERE booking_id = ${bookingId}::uuid AND method = 'ONLINE'
      ORDER BY created_at DESC LIMIT 1
    `;
        if (existing[0]?.status === 'PAID')
          throw new BadRequestException('This booking is already paid');

        const amountPaise = Math.round(Number(booking.totalAmount) * 100);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
          throw new BadRequestException('Booking has an invalid payment amount');
        }

        if (existing[0]?.provider_order_id) {
          await tx.paymentIntent.upsert({
            where: { providerOrderId: existing[0].provider_order_id },
            update: {},
            create: {
              lockCode: `legacy:${bookingId}`,
              pilgrimUserId,
              providerOrderId: existing[0].provider_order_id,
              bookingId,
              amount: Number(booking.totalAmount),
            },
          });
          return {
            bookingId,
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId: existing[0].provider_order_id,
            amount: amountPaise,
            currency: 'INR',
          };
        }

        const order = await createIdempotentPaymentOrder(
          this.prisma,
          this.razorpayProvider,
          `booking:${bookingId}`,
          {
            amount: amountPaise,
            bookingId,
            currency: 'INR',
            receipt: booking.bookingCode,
          },
        );

        if (existing[0]?.id) {
          await tx.$executeRaw`
        UPDATE payment_collections SET provider = 'RAZORPAY', amount = ${Number(booking.totalAmount)},
          status = 'PENDING', provider_order_id = ${order.orderId}, provider_payment_id = NULL,
          provider_reference = NULL, paid_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}::uuid
      `;
        } else {
          await tx.$executeRaw`
        INSERT INTO payment_collections (booking_id, method, provider, amount, status, provider_order_id)
        VALUES (${bookingId}::uuid, 'ONLINE', 'RAZORPAY', ${Number(booking.totalAmount)}, 'PENDING', ${order.orderId})
      `;
        }

        await tx.paymentIntent.create({
          data: {
            lockCode: `legacy:${bookingId}`,
            pilgrimUserId,
            providerOrderId: order.orderId,
            bookingId,
            amount: Number(booking.totalAmount),
          },
        });

        return {
          bookingId,
          keyId: process.env.RAZORPAY_KEY_ID,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
        };
      },
      { timeout: 25_000 },
    );
  }

  /**
   * One-round-trip version of "lock the room, then create its Razorpay order".
   * The pilgrim app calls this in the background as soon as the guest picks
   * their dates, so the room is held and the order is ready long before they
   * tap Pay. Online payments are checked first so no hold is created when
   * they're disabled, and the hold is released again if order creation fails.
   */
  public async createPrepaidHold(
    dto: CreateBookingLockDto,
    user: AuthenticatedUser,
    idempotencyKey?: string,
  ) {
    const started = performance.now();
    await this.assertOnlinePaymentsEnabled();
    const authorized = performance.now();
    const lock = await this.bookingLocksService.createLock(dto, user, idempotencyKey);
    const held = performance.now();
    try {
      return await this.createPrepaidOrder(lock.lockCode, user, true);
    } catch (error) {
      // Preserve a keyed hold after an unknown gateway result so a retry can recover its order.
      if (!idempotencyKey)
        await this.bookingLocksService.releaseLock(lock.lockCode, user).catch(() => undefined);
      throw error;
    } finally {
      this.logger.log({
        operation: 'prepaid_hold',
        authorizationMs: Math.round(authorized - started),
        holdMs: Math.round(held - authorized),
        orderMs: Math.round(performance.now() - held),
        totalMs: Math.round(performance.now() - started),
      });
    }
  }

  public async releasePrepaidHold(lockCode: string, user: AuthenticatedUser) {
    return { released: await this.bookingLocksService.releaseLock(lockCode, user) };
  }

  /** Freeze validated guest details before opening checkout, so recovery needs no app callback. */
  public async preparePrepaidIntent(dto: CreateBookingDto, user: AuthenticatedUser) {
    const lock = await this.prisma.bookingLock.findFirst({
      where: {
        lockCode: dto.lockCode,
        pilgrimUserId: user.id,
      },
    });
    if (!lock?.providerOrderId || lock.orderAmount === null)
      throw new BadRequestException('Payment hold not found');
    const existing = await this.prisma.paymentIntent.findUnique({
      where: { providerOrderId: lock.providerOrderId },
    });
    if (existing?.status === 'CONFIRMED') return { ready: true };
    if (lock.status !== 'ACTIVE' || lock.expiresAt <= new Date())
      throw new BadRequestException('Payment hold expired; check payment status before retrying');
    if (existing?.guestDetails) return { ready: true };
    await this.bookingsService.validatePrepaidGuest(dto, user, lock.roomTypeId);
    const details = JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue;
    await this.prisma.paymentIntent.upsert({
      where: { providerOrderId: lock.providerOrderId },
      create: {
        lockCode: lock.lockCode,
        pilgrimUserId: user.id,
        providerOrderId: lock.providerOrderId,
        amount: lock.orderAmount,
        guestDetails: details,
      },
      update: {},
    });
    await this.prisma.paymentIntent.updateMany({
      where: {
        providerOrderId: lock.providerOrderId,
        guestDetails: { equals: Prisma.DbNull },
        status: 'PENDING',
      },
      data: { guestDetails: details },
    });
    return { ready: true };
  }

  public async paymentStatus(orderId: string, user: AuthenticatedUser) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { providerOrderId: orderId, pilgrimUserId: user.id },
    });
    if (!intent) throw new NotFoundException('Payment intent not found');
    await this.reconcileOrder(orderId);
    const latest = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    let retryCheckout = null;
    if (latest.status === 'PENDING' && latest.guestDetails && !latest.bookingId) {
      const payments = await this.razorpayProvider.getOrderPayments(orderId);
      const lock = await this.prisma.bookingLock.findFirst({
        where: {
          lockCode: latest.lockCode,
          pilgrimUserId: user.id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: { lodge: { select: { name: true } } },
      });
      if (!lock) {
        // The gateway may still settle an interrupted bank flow. Expiry is
        // not proof of failure, so stop offering a fresh payment and surface it.
        await this.prisma.paymentIntent.updateMany({
          where: { id: latest.id, status: 'PENDING' },
          data: { status: 'RECOVERY_REQUIRED', lastError: 'HOLD_EXPIRED_PAYMENT_STATUS_UNCERTAIN' },
        });
        const current = await this.prisma.paymentIntent.findUniqueOrThrow({
          where: { id: latest.id },
        });
        return {
          status: current.status,
          bookingId: current.bookingId,
          recoveryRequired: current.status === 'RECOVERY_REQUIRED',
          retryCheckout: null,
        };
      }
      if (
        lock &&
        !payments.some((payment) => ['authorized', 'captured'].includes(payment.status))
      ) {
        retryCheckout = {
          lodgeName: lock.lodge.name,
          checkInDate: lock.checkInDate.toISOString().slice(0, 10),
          checkOutDate: lock.checkOutDate.toISOString().slice(0, 10),
          guestDetails: latest.guestDetails,
          order: {
            lockCode: lock.lockCode,
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId,
            amount: Math.round(Number(latest.amount) * 100),
            currency: latest.currency,
          },
        };
      }
    }
    return {
      status: latest.status,
      bookingId: latest.bookingId,
      recoveryRequired: latest.status === 'RECOVERY_REQUIRED',
      retryCheckout,
    };
  }

  public async listRecoveryRequired() {
    const intents = await this.prisma.paymentIntent.findMany({
      where: { status: 'RECOVERY_REQUIRED' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        providerOrderId: true,
        providerPaymentId: true,
        bookingId: true,
        amount: true,
        currency: true,
        status: true,
        lastError: true,
        attempts: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const unmatchedEvents = await this.prisma.$queryRaw<
      Array<{
        id: string;
        event_type: string;
        provider_order_id: string;
        provider_payment_id: string;
        created_at: Date;
      }>
    >`
      SELECT e.id, e.event_type, e.provider_order_id, e.provider_payment_id, e.created_at
      FROM payment_webhook_events e LEFT JOIN payment_intents i ON i.provider_order_id=e.provider_order_id
      WHERE i.id IS NULL ORDER BY e.created_at DESC LIMIT 100`;
    const orderRequests = await this.prisma.paymentOrderRequest.findMany({
      where: { status: { in: ['CREATING', 'UNKNOWN'] } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return { intents, unmatchedEvents, orderRequests };
  }

  public async receiveWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    eventId: string | undefined,
  ) {
    if (!this.razorpayProvider.verifyWebhook(rawBody, signature))
      throw new BadRequestException('Invalid webhook signature');
    if (!eventId || eventId.length > 200)
      throw new BadRequestException('Webhook event ID is required');
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('Invalid webhook payload');
    }
    const event = parsed as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    };
    if (!['payment.captured', 'order.paid', 'payment.failed'].includes(event.event ?? ''))
      return { received: true };
    const payment = event.payload?.payment?.entity;
    if (
      typeof payment?.id !== 'string' ||
      !payment.id ||
      payment.id.length > 100 ||
      typeof payment.order_id !== 'string' ||
      !payment.order_id ||
      payment.order_id.length > 100
    )
      throw new BadRequestException('Missing payment reference');
    // Store only references, never the full payload (which contains contact/card data).
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.createMany({
        skipDuplicates: true,
        data: {
          id: eventId,
          eventType: event.event!,
          providerOrderId: payment.order_id!,
          providerPaymentId: payment.id!,
        },
      });
      await tx.paymentIntent.updateMany({
        where: { providerOrderId: payment.order_id, status: 'PENDING' },
        data: { nextCheckAt: new Date() },
      });
    });
    return { received: true };
  }

  /** Gateway reads are authoritative; stale/failed webhooks never demote a confirmed payment. */
  public async reconcileOrder(orderId: string): Promise<void> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { providerOrderId: orderId },
    });
    if (!intent || intent.status === 'CONFIRMED' || intent.status === 'RECOVERY_REQUIRED') return;
    const payments = await this.razorpayProvider.getOrderPayments(orderId);
    const payment = payments.find((item) => item.status === 'captured' && item.captured);
    if (!payment) return;
    if (
      payment.order_id !== orderId ||
      payment.currency !== intent.currency ||
      payment.amount !== Math.round(Number(intent.amount) * 100)
    ) {
      await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'PENDING' },
        data: { status: 'RECOVERY_REQUIRED', lastError: 'GATEWAY_AMOUNT_MISMATCH' },
      });
      return;
    }
    try {
      if (intent.bookingId) {
        await this.verifyBookingPayment(
          intent.bookingId,
          intent.pilgrimUserId,
          { orderId, paymentId: payment.id, signature: '' },
          true,
        );
      } else if (intent.guestDetails) {
        await this.bookingsService.createPrepaidBooking(
          intent.guestDetails as unknown as CreateBookingDto,
          { id: intent.pilgrimUserId, isActive: true, phoneNumber: null, roles: ['PILGRIM'] },
          {
            providerOrderId: orderId,
            providerPaymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
          },
        );
      } else {
        throw new ConflictException('GUEST_DETAILS_NOT_PREPARED');
      }
    } catch (error) {
      await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: { not: 'CONFIRMED' } },
        data: {
          status:
            error instanceof BadRequestException || error instanceof ConflictException
              ? 'RECOVERY_REQUIRED'
              : 'PENDING',
          providerPaymentId: payment.id,
          lastError:
            error instanceof BadRequestException || error instanceof ConflictException
              ? 'PAID_ALLOCATION_REQUIRES_REVIEW'
              : 'CONFIRMATION_RETRY_PENDING',
        },
      });
    }
  }

  public async reconcilePending(): Promise<void> {
    const due = await this.prisma.paymentIntent.findMany({
      where: { status: 'PENDING', nextCheckAt: { lte: new Date() } },
      orderBy: { nextCheckAt: 'asc' },
      take: 10,
    });
    for (const intent of due) {
      // A DB-backed lease avoids duplicate gateway calls across backend instances.
      const claim = await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'PENDING', nextCheckAt: intent.nextCheckAt },
        data: {
          attempts: { increment: 1 },
          nextCheckAt: new Date(
            Date.now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(intent.attempts, 6)),
          ),
        },
      });
      if (claim.count)
        await this.reconcileOrder(intent.providerOrderId).catch(() =>
          this.logger.warn('Payment reconciliation gateway read failed'),
        );
    }
  }

  /**
   * Creates (or reuses) a Razorpay order for a still-active room hold,
   * before any booking exists. Called as soon as the guest reaches the
   * payment step with "Pay online" selected, so that by the time they
   * actually tap Pay, the order already exists and the checkout sheet can
   * open with no further network wait. The booking itself is only created
   * once the payment this order collects is verified as captured — see
   * confirmPrepaidBooking below.
   */
  public async createPrepaidOrder(
    lockCode: string,
    user: AuthenticatedUser,
    alreadyAuthorized = false,
  ) {
    if (!alreadyAuthorized) await this.assertOnlinePaymentsEnabled();

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM booking_locks WHERE lock_code = ${lockCode} AND pilgrim_user_id = ${user.id}::uuid FOR UPDATE`;
        const resolved = await this.bookingsService.resolveLockForPrepay(lockCode, user, tx);

        if (resolved.providerOrderId && resolved.orderAmount !== null) {
          return {
            lockCode,
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId: resolved.providerOrderId,
            amount: Math.round(resolved.orderAmount * 100),
            currency: 'INR',
          };
        }

        const amountPaise = Math.round(resolved.amount * 100);
        if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
          throw new BadRequestException('This booking has an invalid payment amount');
        }

        const order = await createIdempotentPaymentOrder(
          this.prisma,
          this.razorpayProvider,
          `hold:${lockCode}`,
          {
            amount: amountPaise,
            bookingId: lockCode,
            currency: 'INR',
            receipt: lockCode,
          },
        );

        await tx.bookingLock.update({
          where: { id: resolved.lockId },
          data: {
            providerOrderId: order.orderId,
            orderAmount: resolved.amount,
            expiresAt: this.bookingLocksService.prepaidOrderExpiry(),
          },
        });
        await tx.paymentIntent.create({
          data: {
            lockCode,
            pilgrimUserId: user.id,
            providerOrderId: order.orderId,
            amount: resolved.amount,
          },
        });

        return {
          lockCode,
          keyId: process.env.RAZORPAY_KEY_ID,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
        };
      },
      { timeout: 25_000 },
    );
  }

  /**
   * Verifies a Razorpay payment made against a pre-created prepaid order and,
   * only once verified as captured, creates the booking directly as paid and
   * accepted. If verification fails, or the payment isn't captured, or a
   * physical room can't be assigned, no booking is ever created — there is
   * nothing to cancel, by design, since booking creation only happens after
   * payment success is confirmed.
   *
   * Safe to call again for the same payment: a repeat (client retry after a
   * timeout, double tap) returns the booking already created for it instead
   * of failing on the now-consumed hold or creating a second booking.
   */
  public async confirmPrepaidBooking(
    dto: CreateBookingDto,
    user: AuthenticatedUser,
    input: { orderId: string; paymentId: string; signature: string },
  ): Promise<Booking> {
    if (dto.paymentMethod !== 'ONLINE') {
      throw new BadRequestException('This endpoint only confirms prepaid online bookings');
    }

    const verification = await this.razorpayProvider.verifyPayment(input);
    if (!verification.verified) {
      throw new BadRequestException('Razorpay payment verification failed');
    }

    // Already confirmed by an earlier request for this exact payment? Return that booking.
    // The signature above has been verified, and getBookingById only returns a booking to
    // its own pilgrim (or an admin), so this cannot be used to read someone else's booking.
    const alreadyConfirmed = await this.prisma.$queryRaw<Array<{ booking_id: string }>>`
      SELECT c.booking_id FROM payment_collections c JOIN bookings b ON b.id = c.booking_id
      WHERE b.pilgrim_user_id = ${user.id}::uuid AND c.provider_order_id = ${input.orderId}
        AND c.provider_payment_id = ${input.paymentId}
        AND c.status = 'PAID'
      ORDER BY c.created_at ASC LIMIT 1
    `;
    if (alreadyConfirmed[0]) {
      return this.bookingsService.getBookingById(alreadyConfirmed[0].booking_id, user);
    }

    await this.preparePrepaidIntent(dto, user);
    const payment = await this.razorpayProvider.getPayment(input.paymentId);
    if (payment.id !== input.paymentId || payment.order_id !== input.orderId) {
      throw new BadRequestException('Razorpay payment belongs to a different order');
    }
    if (payment.status !== 'captured' || !payment.captured) {
      throw new BadRequestException('Razorpay payment is not captured yet');
    }

    const intent = await this.prisma.paymentIntent.findUniqueOrThrow({
      where: { providerOrderId: input.orderId },
    });
    if (intent.pilgrimUserId !== user.id || intent.lockCode !== dto.lockCode)
      throw new BadRequestException('Payment does not match this hold');
    if (
      payment.currency !== intent.currency ||
      payment.amount !== Math.round(Number(intent.amount) * 100)
    ) {
      throw new BadRequestException('Payment amount or currency does not match the stored order');
    }
    // Another instance may have committed between the initial replay lookup and
    // this gateway read. Its transaction clears the temporary guest snapshot.
    if (intent.status === 'CONFIRMED' && intent.bookingId) {
      return this.bookingsService.getBookingById(intent.bookingId, user);
    }
    try {
      const booking = await this.bookingsService.createPrepaidBooking(
        intent.guestDetails as unknown as CreateBookingDto,
        user,
        {
          providerOrderId: input.orderId,
          providerPaymentId: input.paymentId,
          amount: payment.amount,
          currency: payment.currency,
        },
      );

      await this.paymentNotificationsService
        .successful({
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          pilgrimUserId: user.id,
          lodgeId: booking.lodgeId,
          amount: Number(booking.totalAmount),
          paymentId: input.paymentId,
          roomId: booking.roomId ?? '',
        })
        .catch(() =>
          this.logger.warn('Payment notification failed; committed state remains available'),
        );

      return booking;
    } catch (error) {
      await this.prisma.paymentIntent.updateMany({
        where: {
          providerOrderId: input.orderId,
          pilgrimUserId: user.id,
          status: { not: 'CONFIRMED' },
        },
        data: {
          providerPaymentId: input.paymentId,
          status:
            error instanceof BadRequestException || error instanceof ConflictException
              ? 'RECOVERY_REQUIRED'
              : 'PENDING',
          lastError:
            error instanceof BadRequestException || error instanceof ConflictException
              ? 'CONFIRMATION_REQUIRES_REVIEW'
              : 'CONFIRMATION_RETRY_PENDING',
        },
      });
      throw error;
    }
  }

  public async verifyBookingPayment(
    bookingId: string,
    pilgrimUserId: string,
    input: { orderId: string; paymentId: string; signature: string },
    gatewayReconciliation = false,
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
      },
      where: { deletedAt: null, id: bookingId, pilgrimUserId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const collections = await this.prisma.$queryRaw<
      Array<{ id: string; status: string; provider_order_id: string | null }>
    >`
      SELECT id, status, provider_order_id FROM payment_collections
      WHERE booking_id = ${bookingId}::uuid AND method = 'ONLINE'
      ORDER BY created_at DESC LIMIT 1
    `;
    const collection = collections[0];
    if (!collection || collection.provider_order_id !== input.orderId) {
      throw new BadRequestException('Payment order does not match this booking');
    }
    if (!gatewayReconciliation) {
      const verification = await this.razorpayProvider.verifyPayment(input);
      if (!verification.verified)
        throw new BadRequestException('Razorpay payment verification failed');
    }
    const payment = await this.razorpayProvider.getPayment(input.paymentId);
    if (payment.id !== input.paymentId || payment.order_id !== input.orderId) {
      throw new BadRequestException('Razorpay payment belongs to a different order');
    }
    if (payment.status !== 'captured' || !payment.captured) {
      throw new BadRequestException('Payment is pending; check its status before paying again');
    }
    if (
      payment.currency !== 'INR' ||
      payment.amount !== Math.round(Number(booking.totalAmount) * 100)
    ) {
      throw new BadRequestException('Payment amount or currency does not match the stored order');
    }
    let roomId: string;
    let replayed = false;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await lockInventory(tx, booking.roomTypeId);
        await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE`;
        const fresh = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (fresh.paymentStatus === 'FULLY_PAID' && fresh.roomId) {
          replayed = true;
          return { roomId: fresh.roomId };
        }
        if (fresh.status !== 'PENDING_OWNER_APPROVAL')
          throw new ConflictException('BOOKING_REQUIRES_REVIEW');
        const rooms = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT r.id FROM rooms r
          WHERE r.lodge_id = ${booking.lodgeId}::uuid
            AND r.room_type_id = ${booking.roomTypeId}::uuid
            AND r.deleted_at IS NULL AND r.is_active = true
            AND r.status NOT IN ('OCCUPIED', 'MAINTENANCE', 'BLOCKED')
            AND NOT EXISTS (SELECT 1 FROM room_availability a WHERE a.room_id = r.id AND a.status <> 'AVAILABLE'
              AND a.date >= ${booking.checkInDate} AND a.date < ${booking.checkOutDate})
            AND NOT EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.room_id = r.id AND b.deleted_at IS NULL
                AND b.id <> ${bookingId}::uuid AND b.status IN ('PENDING_OWNER_APPROVAL', 'ACCEPTED', 'QR_GENERATED', 'CHECKED_IN')
                AND b.check_in_date < ${booking.checkOutDate}
                AND b.check_out_date > ${booking.checkInDate}
            )
          ORDER BY r.id LIMIT 1 FOR UPDATE SKIP LOCKED
        `;
        if (!rooms[0]) throw new ConflictException('ROOM_UNAVAILABLE_AFTER_PAYMENT');

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
      const requiresReview =
        error instanceof ConflictException || error instanceof BadRequestException;
      await this.prisma.paymentIntent.updateMany({
        where: { providerOrderId: input.orderId, status: { not: 'CONFIRMED' } },
        data: {
          status: requiresReview ? 'RECOVERY_REQUIRED' : 'PENDING',
          providerPaymentId: input.paymentId,
          lastError: requiresReview ? 'ALLOCATION_REQUIRES_REVIEW' : 'CONFIRMATION_RETRY_PENDING',
          nextCheckAt: new Date(),
        },
      });
      if (!requiresReview) {
        throw new ServiceUnavailableException(
          'Payment received; confirmation will retry. Do not pay again.',
        );
      }
      throw new ConflictException('Payment received; confirmation needs review. Do not pay again.');
    }
    await this.prisma.paymentIntent.updateMany({
      where: { providerOrderId: input.orderId },
      data: { status: 'CONFIRMED', providerPaymentId: input.paymentId, lastError: null },
    });

    if (replayed)
      return {
        bookingId,
        bookingCode: booking.bookingCode,
        status: 'ACCEPTED',
        paymentStatus: 'PAID',
        roomId,
      };
    await this.paymentNotificationsService
      .successful({
        bookingId,
        bookingCode: booking.bookingCode,
        pilgrimUserId,
        lodgeId: booking.lodgeId,
        amount: Number(booking.totalAmount),
        paymentId: input.paymentId,
        roomId,
      })
      .catch(() =>
        this.logger.warn('Payment notification failed; committed state remains available'),
      );
    // The room-assignment transaction above sets the booking to ACCEPTED directly
    // (it can't call the shared accept-booking flow since a physical room must be
    // locked first), so the standard booking:accepted realtime push + BOOKING_ACCEPTED
    // notification that the pilgrim app listens for never fired. Send it explicitly
    // here so prepaid bookings get the same "booking confirmed" signal as owner-accepted ones.
    await this.notificationEventsService
      .bookingAccepted(bookingId)
      .catch(() =>
        this.logger.warn('Booking notification failed; committed state remains available'),
      );

    return {
      bookingId,
      bookingCode: booking.bookingCode,
      status: 'ACCEPTED',
      paymentStatus: 'PAID',
      roomId,
    };
  }
}
