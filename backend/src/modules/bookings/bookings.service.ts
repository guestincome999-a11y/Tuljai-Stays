import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import type {
  AdminBookingSummary,
  AuthenticatedUser,
  Booking,
  BookingLodgeContact,
  OwnerBookingSummary,
  PaginatedResponse,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import {
  ADMIN_CANCELLATION_REASONS,
  CANCELLATION_POLICY_KEY,
  DEFAULT_CANCELLATION_POLICY,
  moneyToPaise,
  parseCancellationPolicy,
  refundPercent,
  REFUND_MESSAGES,
} from '../payments/refund-policy';
import { PrismaService } from '../prisma/prisma.service';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingHistoryService } from './booking-history.service';
import { calculateStayPrice } from './booking-pricing';
import { recordCashCollection, withCashCollection } from './cash-collection';
import type {
  AdminBookingsQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  OwnerBookingsQueryDto,
  RejectBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';
import { GuestIdProofService } from './guest-id-proof.service';
import { lockInventory } from './inventory-lock';

const OWNER_VISIBLE_CONTACT_STATUSES: BookingStatus[] = ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'];

// Statuses at which a pilgrim's booking counts as an "active upcoming
// stay" for the purpose of releasing lodge contact details: the lodge has
// confirmed (or the booking was already paid+accepted via the prepaid
// flow), but the guest hasn't checked in yet. Deliberately excludes:
//   - DRAFT / PENDING_OWNER_APPROVAL — merely creating or submitting a
//     request must never unlock contact details.
//   - CHECKED_IN / CHECKED_OUT / COMPLETED — once the guest has actually
//     arrived, contact is no longer needed for planning the stay; those
//     bookings show as history/summary only, with contact hidden.
const PILGRIM_CONTACT_ELIGIBLE_STATUSES: BookingStatus[] = ['ACCEPTED', 'QR_GENERATED'];

const ADMIN_ALLOWED_STATUS_UPDATES: BookingStatus[] = [
  'PENDING_OWNER_APPROVAL',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
];

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    city: true;
    guests: true;
    lodge: true;
    room: true;
    roomType: true;
  };
}>;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly availabilityService: BookingAvailabilityService,
    private readonly bookingHistoryService: BookingHistoryService,
    private readonly configService: ConfigService,
    private readonly guestIdProofService: GuestIdProofService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly prisma: PrismaService,
  ) {}

  public async validatePrepaidGuest(
    dto: CreateBookingDto,
    user: AuthenticatedUser,
    roomTypeId: string,
  ): Promise<void> {
    if (dto.paymentMethod !== 'ONLINE') throw new BadRequestException('Online payment is required');
    const roomType = await this.prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId } });
    if (
      dto.numberOfAdults > roomType.capacityAdults ||
      dto.numberOfChildren > roomType.capacityChildren
    ) {
      throw new BadRequestException('Guest count exceeds room capacity');
    }
    await this.guestIdProofService.assertOwnedUpload(
      user.id,
      dto.guestIdProofStoragePath,
      dto.guestIdProofMimeType,
    );
  }

  public async createBooking(dto: CreateBookingDto, user: AuthenticatedUser): Promise<Booking> {
    const lock = await this.prisma.bookingLock.findFirst({
      include: {
        lodge: true,
        roomType: true,
      },
      where: {
        lockCode: dto.lockCode,
        pilgrimUserId: user.id,
      },
    });

    if (!lock) {
      throw new BadRequestException('Booking lock is invalid or expired');
    }

    if (lock.providerOrderId)
      throw new BadRequestException('This hold requires prepaid payment confirmation');
    const prior = await this.prisma.booking.findUnique({
      where: { sourceLockId: lock.id },
      include: this.bookingInclude,
    });
    if (prior) return this.toBooking(prior);
    if (lock.status !== 'ACTIVE' || lock.expiresAt <= new Date()) {
      throw new BadRequestException('Booking lock is invalid or expired');
    }

    if (lock.lodge.status !== 'VERIFIED' || lock.lodge.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Lodge is not available for booking');
    }

    if (!lock.roomType.isActive || lock.roomType.deletedAt) {
      throw new BadRequestException('Room type is not available');
    }

    if (dto.numberOfAdults > lock.roomType.capacityAdults) {
      throw new BadRequestException('Adult guest count exceeds room capacity');
    }

    if (dto.numberOfChildren > lock.roomType.capacityChildren) {
      throw new BadRequestException('Child guest count exceeds room capacity');
    }

    await this.guestIdProofService.assertOwnedUpload(
      user.id,
      dto.guestIdProofStoragePath,
      dto.guestIdProofMimeType,
    );

    let createdNow = false;
    const booking = await this.prisma.$transaction(async (tx) => {
      await lockInventory(tx, lock.roomTypeId);
      const prior = await tx.booking.findUnique({
        where: { sourceLockId: lock.id },
        include: this.bookingInclude,
      });
      if (prior) return prior;
      const claimed = await tx.bookingLock.updateMany({
        where: { id: lock.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        data: { status: 'CONSUMED' },
      });
      if (claimed.count !== 1) throw new ConflictException('Booking hold is no longer active');

      const pricedRoomType = await tx.roomType.findUniqueOrThrow({
        where: { id: lock.roomTypeId },
      });
      const freshAvailability = await this.availabilityService.getAvailability(
        lock.lodgeId,
        lock.roomTypeId,
        lock.checkInDate.toISOString().slice(0, 10),
        lock.checkOutDate.toISOString().slice(0, 10),
        { db: tx, excludeLockId: lock.id },
      );
      if (!freshAvailability.available)
        throw new ConflictException('Room type is no longer available');
      const created = await tx.booking.create({
        data: {
          sourceLockId: lock.id,
          bookingCode: await this.generateBookingCode(tx),
          checkInDate: lock.checkInDate,
          checkOutDate: lock.checkOutDate,
          checkoutDateFlexible: dto.checkoutDateFlexible,
          cityId: lock.lodge.cityId,
          commissionAmount: this.getConfiguredCommissionAmount(),
          guestAddress: dto.guestAddress,
          guestEmail: dto.guestEmail,
          guestName: dto.guestName,
          guestPhone: dto.guestPhone,
          lodgeId: lock.lodgeId,
          numberOfAdults: dto.numberOfAdults,
          numberOfChildren: dto.numberOfChildren,
          ownerResponseDeadline: this.getOwnerResponseDeadline(),
          paymentStatus:
            dto.paymentMethod === 'ONLINE' ? PaymentStatus.PENDING : PaymentStatus.PAY_AT_LODGE,
          pilgrimUserId: user.id,
          roomTypeId: lock.roomTypeId,
          specialRequest: dto.specialRequest,
          totalAmount: await calculateStayPrice(
            tx,
            lock.roomTypeId,
            pricedRoomType.basePrice,
            lock.checkInDate,
            lock.checkOutDate,
            pricedRoomType.festivalPrice,
          ),
          totalGuests: dto.numberOfAdults + dto.numberOfChildren,
          guests: {
            create: {
              fullName: dto.guestName,
              idProofMimeType: dto.guestIdProofMimeType,
              idProofOriginalName: dto.guestIdProofOriginalName,
              idProofSizeBytes: dto.guestIdProofSizeBytes,
              idProofStoragePath: dto.guestIdProofStoragePath,
              isPrimaryGuest: true,
              phone: dto.guestPhone,
            },
          },
        },
        include: this.bookingInclude,
      });
      await tx.bookingLock.update({
        data: { status: 'CONSUMED' },
        where: { id: lock.id },
      });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_CREATED',
          actorUserId: user.id,
          bookingId: created.id,
          toStatus: 'PENDING_OWNER_APPROVAL',
        },
      });

      if (dto.paymentMethod === 'ONLINE') {
        await tx.$executeRaw`INSERT INTO payment_collections (booking_id, method, provider, amount, status)
          VALUES (${created.id}::uuid, 'ONLINE', 'RAZORPAY', ${Number(created.totalAmount)}, 'PENDING')`;
      }
      await tx.auditLog.create({
        data: {
          action: 'BOOKING_CREATED',
          actorUserId: user.id,
          entityId: created.id,
          entityType: 'booking',
        },
      });
      createdNow = true;
      return created;
    });

    if (!createdNow) return this.toBooking(booking);
    await this.notificationEventsService
      .bookingCreated(booking.id)
      .catch(() =>
        this.logger.warn('Booking notification failed; committed state remains available'),
      );

    return this.toBooking(booking);
  }

  /**
   * Validates a hold and returns the amount that should be charged for it,
   * without creating a booking. Used by PaymentsService to create a Razorpay
   * order against the hold as soon as the guest reaches the payment step —
   * well before they tap Pay — so the checkout sheet can open instantly on
   * tap instead of waiting on a booking-creation round trip first.
   */
  public async resolveLockForPrepay(
    lockCode: string,
    user: AuthenticatedUser,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<{
    amount: number;
    lockId: string;
    orderAmount: number | null;
    providerOrderId: string | null;
  }> {
    const lock = await db.bookingLock.findFirst({
      include: { lodge: true, roomType: true },
      where: {
        lockCode,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        pilgrimUserId: user.id,
      },
    });

    if (!lock) throw new BadRequestException('Booking lock is invalid or expired');
    if (lock.lodge.status !== 'VERIFIED' || lock.lodge.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Lodge is not available for booking');
    }
    if (!lock.roomType.isActive || lock.roomType.deletedAt) {
      throw new BadRequestException('Room type is not available');
    }

    const availability = await this.availabilityService.getAvailability(
      lock.lodgeId,
      lock.roomTypeId,
      lock.checkInDate.toISOString().slice(0, 10),
      lock.checkOutDate.toISOString().slice(0, 10),
      { excludeLockId: lock.id, db },
    );
    if (!availability.available) throw new ConflictException('Room type is no longer available');

    return {
      amount: (
        await calculateStayPrice(
          db,
          lock.roomTypeId,
          lock.roomType.basePrice,
          lock.checkInDate,
          lock.checkOutDate,
          lock.roomType.festivalPrice,
        )
      ).toNumber(),
      lockId: lock.id,
      orderAmount: lock.orderAmount?.toNumber() ?? null,
      providerOrderId: lock.providerOrderId,
    };
  }

  /**
   * Creates a booking that is already paid and already accepted, straight
   * from a verified Razorpay payment — no booking exists until this point.
   * If no physical room can be assigned, the transaction rolls back and
   * nothing is created; the caller (PaymentsService) is responsible for
   * refunding the payment in that case since there is no booking to cancel.
   */
  public async createPrepaidBooking(
    dto: CreateBookingDto,
    user: AuthenticatedUser,
    payment: {
      providerOrderId: string;
      providerPaymentId: string;
      amount: number;
      currency: string;
    },
  ): Promise<Booking> {
    const lock = await this.prisma.bookingLock.findFirst({
      include: { lodge: true, roomType: true },
      where: {
        lockCode: dto.lockCode,
        pilgrimUserId: user.id,
        providerOrderId: payment.providerOrderId,
      },
    });
    if (!lock || lock.orderAmount === null) {
      throw new BadRequestException(
        'Booking lock is invalid, expired, or does not match this payment',
      );
    }
    const prior = await this.prisma.booking.findUnique({
      where: { sourceLockId: lock.id },
      include: this.bookingInclude,
    });
    if (prior) return this.toBooking(prior);
    if (lock.status !== 'ACTIVE' || lock.expiresAt <= new Date()) {
      throw new BadRequestException('Booking lock is invalid or expired');
    }

    if (
      payment.currency !== 'INR' ||
      payment.amount !== Math.round(lock.orderAmount.toNumber() * 100)
    ) {
      throw new BadRequestException('Payment amount or currency does not match the stored order');
    }
    if (lock.lodge.status !== 'VERIFIED' || lock.lodge.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Lodge is not available for booking');
    }
    if (!lock.roomType.isActive || lock.roomType.deletedAt) {
      throw new BadRequestException('Room type is not available');
    }
    if (dto.numberOfAdults > lock.roomType.capacityAdults) {
      throw new BadRequestException('Adult guest count exceeds room capacity');
    }
    if (dto.numberOfChildren > lock.roomType.capacityChildren) {
      throw new BadRequestException('Child guest count exceeds room capacity');
    }

    await this.guestIdProofService.assertOwnedUpload(
      user.id,
      dto.guestIdProofStoragePath,
      dto.guestIdProofMimeType,
    );

    const totalAmount = lock.orderAmount.toNumber();

    let createdNow = false;
    const booking = await this.prisma.$transaction(async (tx) => {
      await lockInventory(tx, lock.roomTypeId);
      const prior = await tx.booking.findUnique({
        where: { sourceLockId: lock.id },
        include: this.bookingInclude,
      });
      if (prior) return prior;
      const currentType = await tx.roomType.findUniqueOrThrow({
        where: { id: lock.roomTypeId },
        include: { lodge: true },
      });
      if (
        !currentType.isActive ||
        currentType.deletedAt ||
        !currentType.lodge.isActive ||
        currentType.lodge.deletedAt ||
        currentType.lodge.status !== 'VERIFIED' ||
        currentType.lodge.verificationStatus !== 'VERIFIED' ||
        dto.numberOfAdults > currentType.capacityAdults ||
        dto.numberOfChildren > currentType.capacityChildren
      ) {
        throw new ConflictException('ROOM_UNAVAILABLE_AFTER_PAYMENT');
      }
      const claimed = await tx.bookingLock.updateMany({
        where: { id: lock.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        data: { status: 'CONSUMED' },
      });
      if (claimed.count !== 1) throw new ConflictException('Booking hold is no longer active');

      // Same FOR UPDATE SKIP LOCKED room selection used when confirming a
      // legacy (booking-first) prepaid payment: money has already changed
      // hands at this point, so this needs the stronger guarantee than the
      // plain availability check used by the owner-approval accept flow.
      const availableRooms = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT r.id FROM rooms r
        WHERE r.lodge_id = ${lock.lodgeId}::uuid
          AND r.room_type_id = ${lock.roomTypeId}::uuid
          AND r.deleted_at IS NULL AND r.is_active = true
          AND r.status NOT IN ('OCCUPIED', 'MAINTENANCE', 'BLOCKED')
          AND NOT EXISTS (SELECT 1 FROM room_availability a WHERE a.room_id = r.id
            AND a.date >= ${lock.checkInDate} AND a.date < ${lock.checkOutDate} AND a.status <> 'AVAILABLE')
          AND NOT EXISTS (SELECT 1 FROM booking_locks h WHERE h.room_id = r.id
            AND h.id <> ${lock.id}::uuid AND h.status = 'ACTIVE' AND h.expires_at > CURRENT_TIMESTAMP
            AND h.check_in_date < ${lock.checkOutDate} AND h.check_out_date > ${lock.checkInDate})
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.room_id = r.id AND b.deleted_at IS NULL
              AND b.status IN ('PENDING_OWNER_APPROVAL', 'ACCEPTED', 'QR_GENERATED', 'CHECKED_IN')
              AND b.check_in_date < ${lock.checkOutDate}
              AND b.check_out_date > ${lock.checkInDate}
          )
        ORDER BY r.id LIMIT 1 FOR UPDATE SKIP LOCKED
      `;
      const selectedRoomId = availableRooms[0]?.id;
      if (!selectedRoomId) throw new ConflictException('ROOM_UNAVAILABLE_AFTER_PAYMENT');

      const created = await tx.booking.create({
        data: {
          acceptedByUserId: user.id,
          sourceLockId: lock.id,
          bookingCode: await this.generateBookingCode(tx),
          checkInDate: lock.checkInDate,
          checkOutDate: lock.checkOutDate,
          checkoutDateFlexible: dto.checkoutDateFlexible,
          cityId: lock.lodge.cityId,
          commissionAmount: this.getConfiguredCommissionAmount(),
          guestAddress: dto.guestAddress,
          guestEmail: dto.guestEmail,
          guestName: dto.guestName,
          guestPhone: dto.guestPhone,
          lodgeId: lock.lodgeId,
          numberOfAdults: dto.numberOfAdults,
          numberOfChildren: dto.numberOfChildren,
          paymentStatus: PaymentStatus.FULLY_PAID,
          pilgrimUserId: user.id,
          roomId: selectedRoomId,
          roomTypeId: lock.roomTypeId,
          specialRequest: dto.specialRequest,
          status: 'ACCEPTED',
          totalAmount,
          totalGuests: dto.numberOfAdults + dto.numberOfChildren,
          guests: {
            create: {
              fullName: dto.guestName,
              idProofMimeType: dto.guestIdProofMimeType,
              idProofOriginalName: dto.guestIdProofOriginalName,
              idProofSizeBytes: dto.guestIdProofSizeBytes,
              idProofStoragePath: dto.guestIdProofStoragePath,
              isPrimaryGuest: true,
              phone: dto.guestPhone,
            },
          },
        },
        include: this.bookingInclude,
      });

      await tx.room.update({ data: { status: 'CONFIRMED' }, where: { id: selectedRoomId } });
      await tx.bookingLock.update({ data: { status: 'CONSUMED' }, where: { id: lock.id } });
      await tx.roomStatusHistory.create({
        data: {
          actorUserId: user.id,
          bookingId: created.id,
          fromStatus: 'AVAILABLE',
          reason: 'BOOKING_ACCEPTED',
          roomId: selectedRoomId,
          toStatus: 'CONFIRMED',
        },
      });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_CREATED',
          actorUserId: user.id,
          bookingId: created.id,
          notes: 'Created directly as accepted after a successful prepaid Razorpay payment',
          toStatus: 'ACCEPTED',
        },
      });

      await tx.$executeRaw`INSERT INTO payment_collections
        (booking_id, method, provider, amount, status, provider_order_id, provider_payment_id, provider_reference, paid_at)
        VALUES (${created.id}::uuid, 'ONLINE', 'RAZORPAY', ${totalAmount}, 'PAID',
          ${payment.providerOrderId}, ${payment.providerPaymentId}, ${payment.providerOrderId}, CURRENT_TIMESTAMP)`;
      await tx.paymentIntent.updateMany({
        where: { providerOrderId: payment.providerOrderId },
        data: {
          bookingId: created.id,
          providerPaymentId: payment.providerPaymentId,
          status: 'CONFIRMED',
          guestDetails: Prisma.DbNull,
          lastError: null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'BOOKING_CREATED',
          actorUserId: user.id,
          entityId: created.id,
          entityType: 'booking',
        },
      });
      createdNow = true;
      return created;
    });

    if (!createdNow) return this.toBooking(booking);
    await this.notificationEventsService
      .bookingAccepted(booking.id)
      .catch(() =>
        this.logger.warn('Booking notification failed; committed state remains available'),
      );
    await this.notificationEventsService
      .prepaidBookingConfirmed(booking.id)
      .catch(() =>
        this.logger.warn('Booking notification failed; committed state remains available'),
      );

    return this.toBooking(booking);
  }

  public async listMyBookings(user: AuthenticatedUser): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      include: this.bookingInclude,
      orderBy: { createdAt: 'desc' },
      where: {
        deletedAt: null,
        pilgrimUserId: user.id,
      },
    });

    return bookings.map((booking) => this.toBooking(booking));
  }

  public async getBookingById(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findBookingOrThrow(id);
    await this.assertCanViewBooking(booking, user);

    return this.toBooking(booking, this.shouldMaskContactForUser(booking, user));
  }

  /**
   * Returns the booked lodge's contact details, but only for the pilgrim
   * who owns the booking (or an admin) and only while the booking is an
   * "active upcoming stay" — confirmed by the lodge but not yet checked
   * in. This is the sole place in the API that ever returns lodge contact
   * details to a pilgrim — the public lodge listing/details endpoints
   * never include them (see LodgesService.toPublicLodge /
   * toPublicLodgeDetails). Once the guest checks in, checks out, or the
   * stay completes, this endpoint stops returning contact details — the
   * booking detail screen shows history/summary only from that point.
   */
  public async getLodgeContactForBooking(
    id: string,
    user: AuthenticatedUser,
  ): Promise<BookingLodgeContact> {
    const booking = await this.findBookingOrThrow(id);

    if (booking.pilgrimUserId !== user.id && !this.lodgeAccessService.isAdmin(user)) {
      throw new ForbiddenException('You cannot view this booking');
    }

    if (!PILGRIM_CONTACT_ELIGIBLE_STATUSES.includes(booking.status)) {
      throw new ForbiddenException(
        'Lodge contact details are only available for your active upcoming stay, from when the lodge confirms your booking until you check in.',
      );
    }

    return {
      bookingId: booking.id,
      lodgeId: booking.lodgeId,
      lodgeName: booking.lodge.name,
      primaryPhone: booking.lodge.primaryPhone,
      secondaryPhone: booking.lodge.secondaryPhone,
      whatsappNumber: booking.lodge.whatsappNumber,
    };
  }

  public async cancelBooking(
    id: string,
    dto: CancelBookingDto,
    user: AuthenticatedUser,
  ): Promise<Booking> {
    const existing = await this.findBookingOrThrow(id);
    const admin = user.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN');
    if (!admin && (!user.roles.includes('PILGRIM') || existing.pilgrimUserId !== user.id)) {
      throw new ForbiddenException('You cannot cancel this booking');
    }
    // Released pilgrim builds already show a confirmation dialog but do not send a flag.
    // Retain that flow during OTA rollout; new clients send true and admins must do so.
    if ((admin ? dto.confirmed !== true : dto.confirmed === false) || !dto.reason?.trim())
      throw new BadRequestException('Confirm cancellation and provide a reason');
    if (!admin && (dto.deductionPaise !== undefined || dto.supportTicketId || dto.deductionReason))
      throw new ForbiddenException('Only administrators can apply support deductions');
    if (
      admin &&
      !(ADMIN_CANCELLATION_REASONS as readonly string[]).includes(dto.reason) &&
      dto.reason !== 'Pilgrim Support Request'
    )
      throw new BadRequestException(
        'Select an operational cancellation reason or Pilgrim Support Request',
      );
    if (
      admin &&
      dto.reason !== 'Pilgrim Support Request' &&
      (dto.deductionPaise || dto.supportTicketId || dto.deductionReason)
    )
      throw new BadRequestException('Operational cancellations require a full refund');
    if (existing.status === 'CANCELLED') return this.toBooking(existing);
    if (!['PENDING_OWNER_APPROVAL', 'ACCEPTED', 'QR_GENERATED'].includes(existing.status)) {
      throw new BadRequestException('This booking can no longer be cancelled');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      await lockInventory(tx, existing.roomTypeId);
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${id}::uuid FOR UPDATE`;
      const fresh = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: this.bookingInclude,
      });
      if (fresh.status === 'CANCELLED') return fresh;
      if (!['PENDING_OWNER_APPROVAL', 'ACCEPTED', 'QR_GENERATED'].includes(fresh.status))
        throw new ConflictException('This booking can no longer be cancelled');
      const now = new Date();
      const setting = await tx.systemSetting.findUnique({
        where: { key: CANCELLATION_POLICY_KEY },
      });
      const policy = parseCancellationPolicy(
        fresh.cancellationPolicy ?? setting?.value ?? DEFAULT_CANCELLATION_POLICY,
      );
      const percent = admin ? 100 : refundPercent(policy, fresh.checkInDate, now);
      const deduction = dto.deductionPaise ?? 0;
      if (!Number.isSafeInteger(deduction) || deduction < 0)
        throw new BadRequestException('Invalid deduction amount');
      if (admin && dto.reason === 'Pilgrim Support Request') {
        if (!dto.supportTicketId || !dto.deductionReason?.trim())
          throw new BadRequestException(
            'Link the pilgrim support ticket and record the deduction reason',
          );
        const tickets = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM support_tickets WHERE id=${dto.supportTicketId}::uuid AND requester_user_id=${fresh.pilgrimUserId}::uuid AND requester_role='PILGRIM' AND (booking_id=${id}::uuid OR booking_id IS NULL) FOR UPDATE`;
        if (!tickets.length)
          throw new BadRequestException('Support ticket must belong to this pilgrim and booking');
        await tx.$executeRaw`UPDATE support_tickets SET booking_id=${id}::uuid WHERE id=${dto.supportTicketId}::uuid`;
      }
      await tx.$queryRaw`SELECT id FROM payment_collections WHERE booking_id=${id}::uuid ORDER BY id FOR UPDATE`;
      const collections = await tx.paymentCollection.findMany({
        where: { bookingId: id, method: 'ONLINE', provider: 'RAZORPAY' },
        orderBy: { id: 'asc' },
      });
      if (
        deduction >
        collections
          .filter((c) => c.status === 'PAID')
          .reduce((sum, c) => sum + moneyToPaise(c.amount), 0)
      )
        throw new BadRequestException(
          'Deduction exceeds captured online collection; reconcile payment first',
        );
      let remainingDeduction = deduction;
      for (const collection of collections) {
        const collected = moneyToPaise(collection.amount);
        const appliedDeduction =
          collection.status === 'PAID' ? Math.min(remainingDeduction, collected) : 0;
        remainingDeduction -= appliedDeduction;
        const amount =
          percent === null
            ? null
            : Math.max(0, Math.floor((collected * percent) / 100) - appliedDeduction);
        const refund = await tx.bookingRefund.create({
          data: {
            reference: `cancel:${collection.id}`,
            bookingId: id,
            collectionId: collection.id,
            providerPaymentId: collection.providerPaymentId,
            percent,
            amount,
            eligibleAmount: amount,
            status: amount === 0 ? 'NOT_REQUIRED' : 'PENDING',
            reason: dto.reason.trim(),
          },
        });
        if (refund.status === 'PENDING')
          await tx.refundNotificationOutbox.create({
            data: {
              key: `refund:${refund.id}:PENDING`,
              bookingId: id,
              refundId: refund.id,
              status: 'PENDING',
            },
          });
      }
      const action = admin ? 'BOOKING_CANCELLED_BY_ADMIN' : 'BOOKING_CANCELLED_BY_PILGRIM';
      const settledCommission = await tx.$queryRaw<
        Array<{ ledgerId: string; amount: string }>
      >`SELECT l.id AS "ledgerId",SUM(a.amount)::text AS amount
        FROM lodge_commission_ledger l INNER JOIN lodge_commission_settlement_allocations a ON a.ledger_id=l.id
        WHERE l.booking_id=${id}::uuid GROUP BY l.id HAVING SUM(a.amount)>0`;
      const metadata = {
        reason: dto.reason.trim(),
        percent,
        policy: { configured: policy.configured, tiers: policy.tiers },
        deductionPaise: deduction,
        supportTicketId: dto.supportTicketId ?? null,
        deductionReason: dto.deductionReason ?? null,
        settledCommissionReview: settledCommission,
      };
      const updated = await tx.booking.update({
        data: {
          cancellationReason: dto.reason.trim(),
          cancelledAt: now,
          cancelledByUserId: user.id,
          cancellationPolicy: metadata,
          status: 'CANCELLED',
        },
        include: this.bookingInclude,
        where: { id },
      });
      if (fresh.roomId) {
        const released = await tx.room.updateMany({
          data: { status: 'AVAILABLE' },
          where: {
            id: fresh.roomId,
            status: { in: ['CONFIRMED', 'RESERVED'] },
            bookings: {
              none: {
                id: { not: id },
                deletedAt: null,
                status: { in: ['ACCEPTED', 'QR_GENERATED', 'CHECKED_IN'] },
              },
            },
          },
        });
        if (released.count)
          await tx.roomStatusHistory.create({
            data: {
              roomId: fresh.roomId,
              bookingId: id,
              actorUserId: user.id,
              fromStatus: fresh.room?.status ?? 'CONFIRMED',
              toStatus: 'AVAILABLE',
              reason: 'Booking cancellation released inventory',
            },
          });
      }
      await tx.bookingQrToken.updateMany({
        where: { bookingId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED' },
      });
      await tx.bookingHistory.create({
        data: {
          action,
          actorUserId: user.id,
          bookingId: id,
          fromStatus: fresh.status,
          notes: dto.reason,
          toStatus: 'CANCELLED',
        },
      });
      await tx.auditLog.create({
        data: { action, actorUserId: user.id, entityId: id, entityType: 'booking', metadata },
      });
      await tx.refundNotificationOutbox.create({
        data: { key: `cancel:${id}`, bookingId: id, status: 'CANCELLED' },
      });
      if (settledCommission.length)
        await tx.refundNotificationOutbox.create({
          data: { key: `accounting-review:${id}`, bookingId: id, status: 'ACCOUNTING_REVIEW' },
        });
      return updated;
    });

    return this.toBooking(booking);
  }

  public async cancellationPreview(id: string, user: AuthenticatedUser) {
    const booking = await this.findBookingOrThrow(id);
    if (booking.pilgrimUserId !== user.id)
      throw new ForbiddenException('You cannot view this cancellation');
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: CANCELLATION_POLICY_KEY },
    });
    const policy = parseCancellationPolicy(
      booking.cancellationPolicy ?? setting?.value ?? DEFAULT_CANCELLATION_POLICY,
    );
    const percent = refundPercent(policy, booking.checkInDate, new Date());
    const collections = await this.prisma.paymentCollection.findMany({
      where: { bookingId: id, method: 'ONLINE', provider: 'RAZORPAY', status: 'PAID' },
    });
    const amountPaise =
      percent === null
        ? null
        : collections.reduce(
            (sum, c) => sum + Math.floor((moneyToPaise(c.amount) * percent) / 100),
            0,
          );
    return {
      policy,
      refundPercent: percent,
      amountPaise,
      currency: 'INR',
      message:
        'Final refund depends on captured payment and any earlier refunds. Refunds return to the original payment method within 5–7 business days after initiation.',
    };
  }

  public async getOwnerSafeBookingView(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);

    return this.toBooking(booking, this.shouldMaskContactForUser(booking, user));
  }

  public async getOwnerUnlockedBookingView(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);

    return withCashCollection(this.prisma, this.toBooking(booking));
  }

  public async collectPayAtLodge(
    id: string,
    expectedAmount: string,
    user: AuthenticatedUser,
  ): Promise<Booking> {
    const result = await recordCashCollection(
      this.prisma,
      (lodgeId) => this.lodgeAccessService.assertCanManageLodge(user, lodgeId),
      { bookingId: id, actorUserId: user.id, expectedAmount },
    );
    if (result.changed) this.notificationEventsService.paymentCollected(id, result.lodgeId);
    return this.getOwnerUnlockedBookingView(id, user);
  }

  /**
   * Owner-facing booking detail: same shape as a list row (adds lodge name,
   * room type and assigned room number) and always masks guest contact
   * details until the guest has checked in.
   */
  public async getOwnerBookingSummary(
    id: string,
    user: AuthenticatedUser,
  ): Promise<OwnerBookingSummary> {
    const booking = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);

    return withCashCollection(this.prisma, this.toOwnerBookingSummary(booking));
  }

  public async listOwnerBookings(
    query: OwnerBookingsQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<OwnerBookingSummary>> {
    if (query.lodgeId) {
      await this.lodgeAccessService.assertCanManageLodge(user, query.lodgeId);
    }

    const checkInFrom = this.parseOptionalDate(query.checkInFrom);
    const checkInTo = this.parseOptionalDate(query.checkInTo);
    const checkOutFrom = this.parseOptionalDate(query.checkOutFrom);
    const checkOutTo = this.parseOptionalDate(query.checkOutTo);

    if (checkInFrom && checkInTo && checkInFrom > checkInTo) {
      throw new BadRequestException('checkInFrom must not be after checkInTo');
    }
    if (checkOutFrom && checkOutTo && checkOutFrom > checkOutTo) {
      throw new BadRequestException('checkOutFrom must not be after checkOutTo');
    }

    const rangeFilters: Prisma.BookingWhereInput[] = [];
    if (checkInFrom || checkInTo) {
      rangeFilters.push({
        checkInDate: {
          ...(checkInFrom ? { gte: checkInFrom } : {}),
          ...(checkInTo ? { lte: checkInTo } : {}),
        },
      });
    }
    if (checkOutFrom || checkOutTo) {
      rangeFilters.push({
        checkOutDate: {
          ...(checkOutFrom ? { gte: checkOutFrom } : {}),
          ...(checkOutTo ? { lte: checkOutTo } : {}),
        },
      });
    }

    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.lodgeId ? { lodgeId: query.lodgeId } : {}),
      ...(query.payment === 'PAY_AT_LODGE' ? { paymentStatus: PaymentStatus.PAY_AT_LODGE } : {}),
      ...(query.payment === 'PREPAID'
        ? { paymentStatus: { in: [PaymentStatus.ADVANCE_PAID, PaymentStatus.FULLY_PAID] } }
        : {}),
      ...(query.date
        ? {
            checkInDate: { lte: this.availabilityService.parseDateOnly(query.date) },
            checkOutDate: { gt: this.availabilityService.parseDateOnly(query.date) },
          }
        : {}),
      ...(rangeFilters.length > 0 ? { AND: rangeFilters } : {}),
      ...(this.lodgeAccessService.isAdmin(user)
        ? {}
        : {
            lodge: {
              owners: {
                some: {
                  deletedAt: null,
                  isActive: true,
                  userId: user.id,
                },
              },
            },
          }),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        include: this.bookingInclude,
        orderBy:
          rangeFilters.length > 0
            ? [{ checkInDate: query.order ?? 'desc' }, { createdAt: 'desc' }]
            : { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const outstandingByBookingId = await this.getOutstandingCommissionByBookingId(
      items.map((booking) => booking.id),
    );

    return {
      items: items.map((booking) => ({
        ...this.toOwnerBookingSummary(booking),
        commissionOutstandingAmount: outstandingByBookingId.get(booking.id) ?? '0',
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async acceptBooking(id: string, user: AuthenticatedUser): Promise<Booking> {
    const existing = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);

    if (existing.status !== 'PENDING_OWNER_APPROVAL') {
      throw new BadRequestException('Only pending bookings can be accepted');
    }

    // Only pay-at-lodge (cash) bookings go through owner approval. Prepaid
    // bookings are confirmed and assigned a room automatically on payment.
    if (existing.paymentStatus !== PaymentStatus.PAY_AT_LODGE) {
      throw new BadRequestException('Only pay-at-lodge bookings can be accepted by the owner');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      await lockInventory(tx, existing.roomTypeId);
      const current = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'PENDING_OWNER_APPROVAL')
        throw new ConflictException('Booking has already changed');
      const selectedRoom = await this.availabilityService.findAvailableRoom({
        db: tx,
        excludeBookingId: id,
        checkInDate: existing.checkInDate,
        checkOutDate: existing.checkOutDate,
        lodgeId: existing.lodgeId,
        roomTypeId: existing.roomTypeId,
      });
      if (!selectedRoom)
        throw new ConflictException('No physical room is available for this booking');
      const updated = await tx.booking.update({
        data: {
          acceptedByUserId: user.id,
          roomId: selectedRoom.id,
          status: 'ACCEPTED',
        },
        include: this.bookingInclude,
        where: { id },
      });
      await tx.room.update({
        data: { status: 'CONFIRMED' },
        where: { id: selectedRoom.id },
      });
      await tx.roomStatusHistory.create({
        data: {
          actorUserId: user.id,
          bookingId: id,
          fromStatus: selectedRoom.status,
          reason: 'BOOKING_ACCEPTED',
          roomId: selectedRoom.id,
          toStatus: 'CONFIRMED',
        },
      });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_ACCEPTED',
          actorUserId: user.id,
          bookingId: id,
          fromStatus: existing.status,
          toStatus: 'ACCEPTED',
        },
      });

      return updated;
    });

    await this.auditLogService.create({
      action: 'BOOKING_ACCEPTED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'booking',
    });
    await this.notificationEventsService.bookingAccepted(id);

    return this.toBooking(booking, this.shouldMaskContactForUser(booking, user));
  }

  public async rejectBooking(
    id: string,
    dto: RejectBookingDto,
    user: AuthenticatedUser,
  ): Promise<Booking> {
    const existing = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);

    if (existing.status !== 'PENDING_OWNER_APPROVAL') {
      throw new BadRequestException('Only pending bookings can be rejected');
    }

    if (existing.paymentStatus !== PaymentStatus.PAY_AT_LODGE) {
      throw new BadRequestException('Only pay-at-lodge bookings can be rejected by the owner');
    }

    const booking = await this.prisma.booking.update({
      data: {
        rejectedByUserId: user.id,
        rejectedReason: dto.reason,
        status: 'REJECTED',
      },
      include: this.bookingInclude,
      where: { id },
    });
    await this.bookingHistoryService.create({
      action: 'BOOKING_REJECTED',
      actorUserId: user.id,
      bookingId: id,
      fromStatus: existing.status,
      notes: dto.reason,
      toStatus: 'REJECTED',
    });
    await this.auditLogService.create({
      action: 'BOOKING_REJECTED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'booking',
    });
    await this.notificationEventsService.bookingRejected(id);

    return this.toBooking(booking, this.shouldMaskContactForUser(booking, user));
  }

  public async listAdminBookings(
    query: AdminBookingsQueryDto,
  ): Promise<PaginatedResponse<AdminBookingSummary>> {
    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.lodgeId ? { lodgeId: query.lodgeId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            checkInDate: query.toDate
              ? { lte: this.availabilityService.parseDateOnly(query.toDate) }
              : undefined,
            checkOutDate: query.fromDate
              ? { gte: this.availabilityService.parseDateOnly(query.fromDate) }
              : undefined,
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        include: this.bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((booking) => this.toAdminBookingSummary(booking)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async updateBookingStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    user: AuthenticatedUser,
  ): Promise<Booking> {
    if (!user.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN'))
      throw new ForbiddenException('Administrator required');
    if (dto.status === 'CANCELLED')
      return this.cancelBooking(
        id,
        { reason: dto.notes ?? '', confirmed: dto.confirmed === true },
        user,
      );
    if (!ADMIN_ALLOWED_STATUS_UPDATES.includes(dto.status)) {
      throw new BadRequestException('This status cannot be set manually');
    }

    const existing = await this.findBookingOrThrow(id);
    if (existing.status === 'CANCELLED')
      throw new BadRequestException('Cancelled bookings cannot be reactivated');
    if (
      ['REJECTED', 'EXPIRED'].includes(dto.status) &&
      ['FULLY_PAID', 'ADVANCE_PAID'].includes(existing.paymentStatus)
    )
      throw new BadRequestException('Use administrative cancellation for paid bookings');
    const booking = await this.prisma.booking.update({
      data: { status: dto.status },
      include: this.bookingInclude,
      where: { id },
    });
    await this.bookingHistoryService.create({
      action: 'ADMIN_STATUS_UPDATED',
      actorUserId: user.id,
      bookingId: id,
      fromStatus: existing.status,
      notes: dto.notes,
      toStatus: dto.status,
    });

    return this.toBooking(booking);
  }

  public async markCheckedIn(id: string, actorUserId: string | null): Promise<Booking> {
    return this.transitionBooking(id, 'ACCEPTED', 'CHECKED_IN', 'BOOKING_CHECKED_IN', actorUserId, {
      checkedInAt: new Date(),
    });
  }

  public async markCheckedOut(id: string, actorUserId: string | null): Promise<Booking> {
    return this.transitionBooking(
      id,
      'CHECKED_IN',
      'CHECKED_OUT',
      'BOOKING_CHECKED_OUT',
      actorUserId,
      {
        checkedOutAt: new Date(),
      },
    );
  }

  public async markCompleted(id: string, actorUserId: string | null): Promise<Booking> {
    return this.transitionBooking(id, 'CHECKED_OUT', 'COMPLETED', 'BOOKING_COMPLETED', actorUserId);
  }

  public async expirePendingBookings(): Promise<number> {
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        ownerResponseDeadline: { lte: new Date() },
        status: 'PENDING_OWNER_APPROVAL',
      },
    });

    for (const booking of expiredBookings) {
      await this.prisma.booking.update({
        data: { status: 'EXPIRED' },
        where: { id: booking.id },
      });
      await this.bookingHistoryService.create({
        action: 'BOOKING_EXPIRED',
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'EXPIRED',
      });
      await this.notificationEventsService.bookingExpired(booking.id);
    }

    return expiredBookings.length;
  }

  private readonly bookingInclude = {
    refunds: { include: { history: { orderBy: { createdAt: 'desc' as const } } } },
    city: true,
    guests: {
      where: { deletedAt: null },
    },
    lodge: true,
    room: true,
    roomType: true,
  } satisfies Prisma.BookingInclude;

  private async assertCanViewBooking(
    booking: BookingWithRelations,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (booking.pilgrimUserId === user.id || this.lodgeAccessService.isAdmin(user)) {
      return;
    }

    try {
      await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);
    } catch {
      throw new ForbiddenException('You cannot view this booking');
    }
  }

  private async findBookingOrThrow(id: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findFirst({
      include: this.bookingInclude,
      where: {
        deletedAt: null,
        id,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private async generateBookingCode(
    db: Pick<Prisma.TransactionClient, 'booking'> = this.prisma,
  ): Promise<string> {
    const year = new Date().getUTCFullYear();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const bookingCode = `TJS-${year}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const existing = await db.booking.findUnique({ where: { bookingCode } });

      if (!existing) {
        return bookingCode;
      }
    }

    return `TJS-${year}-${Date.now()}`;
  }

  private getConfiguredCommissionAmount(): number | null {
    return this.configService.get<number | null>('api.booking.commissionFlatAmount', null);
  }

  private getOwnerResponseDeadline(): Date {
    const seconds = this.configService.get<number>('api.booking.ownerResponseDeadlineSeconds', 120);

    return new Date(Date.now() + seconds * 1000);
  }

  private parseOptionalDate(value: string | undefined): Date | null {
    return value ? this.availabilityService.parseDateOnly(value) : null;
  }

  private shouldMaskContactForUser(
    booking: BookingWithRelations,
    user: AuthenticatedUser,
  ): boolean {
    if (booking.pilgrimUserId === user.id || this.lodgeAccessService.isAdmin(user)) {
      return false;
    }

    return !OWNER_VISIBLE_CONTACT_STATUSES.includes(booking.status);
  }

  private async transitionBooking(
    id: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
    action: string,
    actorUserId: string | null,
    extraData: Prisma.BookingUpdateInput = {},
  ): Promise<Booking> {
    const existing = await this.findBookingOrThrow(id);

    if (existing.status !== fromStatus) {
      throw new BadRequestException(`Booking must be ${fromStatus} before this transition`);
    }

    const booking = await this.prisma.booking.update({
      data: {
        ...extraData,
        status: toStatus,
      },
      include: this.bookingInclude,
      where: { id },
    });
    await this.bookingHistoryService.create({
      action,
      actorUserId,
      bookingId: id,
      fromStatus,
      toStatus,
    });

    return this.toBooking(booking);
  }

  private toAdminBookingSummary(booking: BookingWithRelations): AdminBookingSummary {
    return {
      ...this.toBooking(booking),
      cityName: booking.city.name,
      lodgeName: booking.lodge.name,
      roomNumber: booking.room?.roomNumber ?? null,
      roomTypeName: booking.roomType.name,
    };
  }

  private toBooking(booking: BookingWithRelations, maskContact = false): Booking {
    return {
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      refunds: ('refunds' in booking
        ? (booking.refunds as Array<Prisma.BookingRefundGetPayload<{ include: { history: true } }>>)
        : []
      ).map((refund) => ({
        id: refund.id,
        amount: refund.amount === null ? null : (refund.amount / 100).toFixed(2),
        currency: refund.currency,
        status: refund.status,
        refundId: refund.history.find((a) => a.providerRefundId)?.providerRefundId ?? null,
        originalPaymentMethod: refund.paymentMethod ?? 'Original online payment method',
        initiatedAt: refund.initiatedAt?.toISOString() ?? null,
        processedAt: refund.processedAt?.toISOString() ?? null,
        message: REFUND_MESSAGES[refund.status],
      })),
      acceptedByUserId: booking.acceptedByUserId,
      advanceAmount: booking.advanceAmount?.toString() ?? null,
      alternatePhone: maskContact ? null : booking.alternatePhone,
      balanceAmount: booking.balanceAmount?.toString() ?? null,
      bookingCode: booking.bookingCode,
      cancellationReason: booking.cancellationReason,
      checkInDate: booking.checkInDate.toISOString().slice(0, 10),
      checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
      checkoutDateFlexible: booking.checkoutDateFlexible,
      checkedInAt: booking.checkedInAt?.toISOString() ?? null,
      checkedOutAt: booking.checkedOutAt?.toISOString() ?? null,
      cityId: booking.cityId,
      commissionAmount: booking.commissionAmount?.toString() ?? null,
      createdAt: booking.createdAt.toISOString(),
      expectedCheckInTime: booking.expectedCheckInTime,
      expectedCheckOutTime: booking.expectedCheckOutTime,
      guestAddress: maskContact ? null : booking.guestAddress,
      guestEmail: maskContact ? null : booking.guestEmail,
      guestName: booking.guestName,
      guestPhone: maskContact ? null : booking.guestPhone,
      guests: booking.guests.map((guest) => ({
        age: guest.age,
        fullName: guest.fullName,
        gender: guest.gender,
        id: guest.id,
        idNumber: maskContact ? null : guest.idNumber,
        idProofMimeType: maskContact ? null : guest.idProofMimeType,
        idProofOriginalName: maskContact ? null : guest.idProofOriginalName,
        idProofSizeBytes: maskContact ? null : guest.idProofSizeBytes,
        idProofStoragePath: maskContact ? null : guest.idProofStoragePath,
        idType: guest.idType,
        isPrimaryGuest: guest.isPrimaryGuest,
        phone: maskContact ? null : guest.phone,
      })),
      id: booking.id,
      lodgeId: booking.lodgeId,
      lodgeName: booking.lodge.name,
      lodgeGoogleMapsLink: booking.lodge.googleMapsLink,
      lodgeCheckInTime: booking.lodge.checkInTime,
      lodgeCheckOutTime: booking.lodge.checkOutTime,
      roomTypeName: booking.roomType.name,
      numberOfAdults: booking.numberOfAdults,
      numberOfChildren: booking.numberOfChildren,
      ownerResponseDeadline: booking.ownerResponseDeadline?.toISOString() ?? null,
      paymentStatus: booking.paymentStatus,
      pilgrimUserId: booking.pilgrimUserId,
      rejectedByUserId: booking.rejectedByUserId,
      rejectedReason: booking.rejectedReason,
      roomId: booking.roomId,
      roomTypeId: booking.roomTypeId,
      specialRequest: booking.specialRequest,
      status: booking.status,
      totalAmount: booking.totalAmount?.toString() ?? null,
      totalGuests: booking.totalGuests,
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  private toOwnerBookingSummary(booking: BookingWithRelations): OwnerBookingSummary {
    return {
      ...this.toBooking(booking, !OWNER_VISIBLE_CONTACT_STATUSES.includes(booking.status)),
      lodgeName: booking.lodge.name,
      roomNumber: booking.room?.roomNumber ?? null,
      roomTypeName: booking.roomType.name,
    };
  }

  private async getOutstandingCommissionByBookingId(
    bookingIds: string[],
  ): Promise<Map<string, string>> {
    if (bookingIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<
      Array<{ bookingId: string; outstandingAmount: string }>
    >(Prisma.sql`
      SELECT
        l.booking_id AS "bookingId",
        GREATEST(l.commission_amount - COALESCE(a.allocated_amount, 0), 0)::text AS "outstandingAmount"
      FROM lodge_commission_ledger l
      LEFT JOIN (
        SELECT ledger_id, SUM(amount) AS allocated_amount
        FROM lodge_commission_settlement_allocations
        GROUP BY ledger_id
      ) a ON a.ledger_id = l.id
      WHERE l.booking_id IN (${Prisma.join(bookingIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND l.status <> 'VOIDED'
    `);

    return new Map(rows.map((row) => [row.bookingId, row.outstandingAmount]));
  }
}
