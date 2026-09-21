import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
import { PrismaService } from '../prisma/prisma.service';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingHistoryService } from './booking-history.service';
import type {
  AdminBookingsQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  OwnerBookingsQueryDto,
  RejectBookingDto,
  UpdateBookingDatesDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';
import { GuestIdProofService } from './guest-id-proof.service';

const OWNER_VISIBLE_CONTACT_STATUSES: BookingStatus[] = ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'];

// Owners may only change the dates of a pay-at-lodge booking, and only until
// the guest has a QR / has checked in.
const OWNER_DATE_CHANGE_STATUSES: BookingStatus[] = ['PENDING_OWNER_APPROVAL', 'ACCEPTED'];

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

  public async createBooking(dto: CreateBookingDto, user: AuthenticatedUser): Promise<Booking> {
    const lock = await this.prisma.bookingLock.findFirst({
      include: {
        lodge: true,
        roomType: true,
      },
      where: {
        expiresAt: { gt: new Date() },
        lockCode: dto.lockCode,
        pilgrimUserId: user.id,
        status: 'ACTIVE',
      },
    });

    if (!lock) {
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

    const availability = await this.availabilityService.getAvailability(
      lock.lodgeId,
      lock.roomTypeId,
      lock.checkInDate.toISOString().slice(0, 10),
      lock.checkOutDate.toISOString().slice(0, 10),
      { excludeLockId: lock.id },
    );

    if (!availability.available) {
      throw new ConflictException('Room type is no longer available');
    }

    await this.guestIdProofService.assertOwnedUpload(
      user.id,
      dto.guestIdProofStoragePath,
      dto.guestIdProofMimeType,
    );

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingCode: await this.generateBookingCode(),
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
          totalAmount: this.calculateBaseTotalAmount(
            lock.roomType.basePrice,
            lock.checkInDate,
            lock.checkOutDate,
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

      return created;
    });

    await this.auditLogService.create({
      action: 'BOOKING_CREATED',
      actorUserId: user.id,
      entityId: booking.id,
      entityType: 'booking',
    });
    await this.notificationEventsService.bookingCreated(booking.id);

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
  ): Promise<{
    amount: number;
    lockId: string;
    orderAmount: number | null;
    providerOrderId: string | null;
  }> {
    const lock = await this.prisma.bookingLock.findFirst({
      include: { lodge: true, roomType: true },
      where: {
        expiresAt: { gt: new Date() },
        lockCode,
        pilgrimUserId: user.id,
        status: 'ACTIVE',
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
      { excludeLockId: lock.id },
    );
    if (!availability.available) throw new ConflictException('Room type is no longer available');

    return {
      amount: this.calculateBaseTotalAmount(
        lock.roomType.basePrice,
        lock.checkInDate,
        lock.checkOutDate,
      ),
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
    payment: { providerOrderId: string },
  ): Promise<Booking> {
    const lock = await this.prisma.bookingLock.findFirst({
      include: { lodge: true, roomType: true },
      where: {
        expiresAt: { gt: new Date() },
        lockCode: dto.lockCode,
        pilgrimUserId: user.id,
        providerOrderId: payment.providerOrderId,
        status: 'ACTIVE',
      },
    });
    if (!lock || lock.orderAmount === null) {
      throw new BadRequestException(
        'Booking lock is invalid, expired, or does not match this payment',
      );
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

    const booking = await this.prisma.$transaction(async (tx) => {
      // Same FOR UPDATE SKIP LOCKED room selection used when confirming a
      // legacy (booking-first) prepaid payment: money has already changed
      // hands at this point, so this needs the stronger guarantee than the
      // plain availability check used by the owner-approval accept flow.
      const availableRooms = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT r.id FROM rooms r
        WHERE r.lodge_id = ${lock.lodgeId}::uuid
          AND r.room_type_id = ${lock.roomTypeId}::uuid
          AND r.deleted_at IS NULL AND r.status = 'AVAILABLE'
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.room_id = r.id AND b.deleted_at IS NULL
              AND b.status IN ('ACCEPTED', 'QR_GENERATED', 'CHECKED_IN')
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
          bookingCode: await this.generateBookingCode(),
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

      return created;
    });

    await this.auditLogService.create({
      action: 'BOOKING_CREATED',
      actorUserId: user.id,
      entityId: booking.id,
      entityType: 'booking',
    });
    await this.notificationEventsService.bookingAccepted(booking.id);
    await this.notificationEventsService.prepaidBookingConfirmed(booking.id);

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
    if (existing.pilgrimUserId !== user.id && !this.lodgeAccessService.isAdmin(user)) {
      throw new ForbiddenException('You cannot cancel this booking');
    }
    if (!['PENDING_OWNER_APPROVAL', 'ACCEPTED', 'QR_GENERATED'].includes(existing.status)) {
      throw new BadRequestException('This booking can no longer be cancelled');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        data: { cancellationReason: dto.reason ?? 'Cancelled by pilgrim', status: 'CANCELLED' },
        include: this.bookingInclude,
        where: { id },
      });
      if (existing.roomId) {
        await tx.room.update({ data: { status: 'AVAILABLE' }, where: { id: existing.roomId } });
      }
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_CANCELLED_BY_PILGRIM',
          actorUserId: user.id,
          bookingId: id,
          fromStatus: existing.status,
          notes: dto.reason,
          toStatus: 'CANCELLED',
        },
      });
      return updated;
    });
    await this.auditLogService.create({
      action: 'BOOKING_CANCELLED_BY_PILGRIM',
      actorUserId: user.id,
      entityId: id,
      entityType: 'booking',
    });
    await this.notificationEventsService.bookingCancelled(id);

    return this.toBooking(booking);
  }

  public async getOwnerSafeBookingView(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);

    return this.toBooking(booking, this.shouldMaskContactForUser(booking, user));
  }

  public async getOwnerUnlockedBookingView(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, booking.lodgeId);

    return this.toBooking(booking);
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

    return this.toOwnerBookingSummary(booking);
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

    return {
      items: items.map((booking) => this.toOwnerBookingSummary(booking)),
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

    const selectedRoom = existing.room
      ? { id: existing.room.id, status: existing.room.status }
      : await this.availabilityService.findAvailableRoom({
          checkInDate: existing.checkInDate,
          checkOutDate: existing.checkOutDate,
          lodgeId: existing.lodgeId,
          roomTypeId: existing.roomTypeId,
        });

    if (!selectedRoom) {
      throw new ConflictException('No physical room is available for this booking');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
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

  /**
   * Owner date change. Only pay-at-lodge bookings that are still pending or
   * accepted (not yet checked in) can be changed, and the new dates must pass
   * the same inventory check used at booking time — the booking itself is
   * ignored so it does not block its own change. The total is recalculated
   * from the room type's base price. Prepaid bookings are never changed here
   * because a date change can alter the amount already paid.
   */
  public async updateOwnerBookingDates(
    id: string,
    dto: UpdateBookingDatesDto,
    user: AuthenticatedUser,
  ): Promise<OwnerBookingSummary> {
    const existing = await this.findBookingOrThrow(id);
    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);

    if (existing.paymentStatus !== PaymentStatus.PAY_AT_LODGE) {
      throw new ForbiddenException(
        'Owners can only change dates of pay-at-lodge bookings. For prepaid bookings, please contact Tuljai Stays support.',
      );
    }

    if (!OWNER_DATE_CHANGE_STATUSES.includes(existing.status)) {
      throw new BadRequestException('Dates can only be changed before check-in');
    }

    const { checkInDate, checkOutDate } = this.availabilityService.parseDateRange(
      dto.checkInDate,
      dto.checkOutDate,
    );
    const today = this.availabilityService.parseDateOnly(new Date().toISOString());

    if (checkInDate < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }

    if (
      checkInDate.getTime() === existing.checkInDate.getTime() &&
      checkOutDate.getTime() === existing.checkOutDate.getTime()
    ) {
      throw new BadRequestException('Choose different dates to make a change');
    }

    if (existing.roomId) {
      const isRoomFree = await this.availabilityService.isRoomAvailable({
        checkInDate,
        checkOutDate,
        excludeBookingId: existing.id,
        roomId: existing.roomId,
      });

      if (!isRoomFree) {
        throw new ConflictException('The assigned room is not available for those dates');
      }
    } else {
      const availability = await this.availabilityService.getAvailability(
        existing.lodgeId,
        existing.roomTypeId,
        dto.checkInDate,
        dto.checkOutDate,
        { excludeBookingId: existing.id },
      );

      if (!availability.available) {
        throw new ConflictException('No room of this type is available for those dates');
      }
    }

    const previousRange = `${existing.checkInDate.toISOString().slice(0, 10)} to ${existing.checkOutDate
      .toISOString()
      .slice(0, 10)}`;
    const newRange = `${checkInDate.toISOString().slice(0, 10)} to ${checkOutDate
      .toISOString()
      .slice(0, 10)}`;
    const booking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        data: {
          checkInDate,
          checkOutDate,
          totalAmount: this.calculateBaseTotalAmount(
            existing.roomType.basePrice,
            checkInDate,
            checkOutDate,
          ),
        },
        include: this.bookingInclude,
        where: { id },
      });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_DATES_CHANGED',
          actorUserId: user.id,
          bookingId: id,
          fromStatus: existing.status,
          notes: `Dates changed by owner from ${previousRange} to ${newRange}`,
          toStatus: existing.status,
        },
      });

      return updated;
    });

    await this.auditLogService.create({
      action: 'BOOKING_DATES_CHANGED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'booking',
    });

    return this.toOwnerBookingSummary(booking);
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
    if (!ADMIN_ALLOWED_STATUS_UPDATES.includes(dto.status)) {
      throw new BadRequestException('This status cannot be set manually');
    }

    const existing = await this.findBookingOrThrow(id);
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

  private calculateBaseTotalAmount(
    basePrice: { toNumber(): number },
    checkInDate: Date,
    checkOutDate: Date,
  ): number {
    const nights = Math.max(
      Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000),
      1,
    );

    return basePrice.toNumber() * nights;
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

  private async generateBookingCode(): Promise<string> {
    const year = new Date().getUTCFullYear();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const bookingCode = `TJS-${year}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.booking.findUnique({ where: { bookingCode } });

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
}
