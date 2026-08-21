import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser, Booking } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingAvailabilityService } from './booking-availability.service';
import { BookingsService } from './bookings.service';
import type { CreateBookingDto } from './dto/booking.dto';
import { GuestIdProofService } from './guest-id-proof.service';

@Injectable()
export class PrepaidBookingsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly availabilityService: BookingAvailabilityService,
    private readonly bookingsService: BookingsService,
    private readonly guestIdProofService: GuestIdProofService,
    private readonly prisma: PrismaService,
  ) {}

  public async createBooking(dto: CreateBookingDto, user: AuthenticatedUser): Promise<Booking> {
    if (dto.paymentMethod !== 'ONLINE') {
      throw new BadRequestException('This endpoint only creates prepaid bookings');
    }

    const lock = await this.prisma.bookingLock.findFirst({
      include: { lodge: true, roomType: true },
      where: {
        expiresAt: { gt: new Date() },
        lockCode: dto.lockCode,
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
    if (!availability.available) throw new ConflictException('Room type is no longer available');

    await this.guestIdProofService.assertOwnedUpload(
      user.id,
      dto.guestIdProofStoragePath,
      dto.guestIdProofMimeType,
    );

    const bookingId = await this.prisma.$transaction(async (tx) => {
      const bookingCode = await this.generateBookingCode(tx);
      const created = await tx.booking.create({
        data: {
          bookingCode,
          checkInDate: lock.checkInDate,
          checkOutDate: lock.checkOutDate,
          checkoutDateFlexible: dto.checkoutDateFlexible,
          cityId: lock.lodge.cityId,
          commissionAmount: null,
          guestAddress: dto.guestAddress,
          guestEmail: dto.guestEmail,
          guestName: dto.guestName,
          guestPhone: dto.guestPhone,
          lodgeId: lock.lodgeId,
          numberOfAdults: dto.numberOfAdults,
          numberOfChildren: dto.numberOfChildren,
          ownerResponseDeadline: null,
          paymentStatus: 'PENDING',
          pilgrimUserId: user.id,
          roomTypeId: lock.roomTypeId,
          specialRequest: dto.specialRequest,
          totalAmount: this.calculateTotal(
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
        select: { id: true },
      });

      await tx.bookingLock.update({ data: { status: 'CONSUMED' }, where: { id: lock.id } });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_CREATED',
          actorUserId: user.id,
          bookingId: created.id,
          notes: 'Prepaid booking created; waiting for Razorpay payment',
          toStatus: 'PENDING_OWNER_APPROVAL',
        },
      });
      await tx.$executeRaw`
        INSERT INTO payment_collections (booking_id, method, provider, amount, status)
        VALUES (${created.id}::uuid, 'ONLINE', 'RAZORPAY', ${this.calculateTotal(lock.roomType.basePrice, lock.checkInDate, lock.checkOutDate)}, 'PENDING')
      `;
      return created.id;
    });

    await this.auditLogService.create({
      action: 'BOOKING_CREATED',
      actorUserId: user.id,
      entityId: bookingId,
      entityType: 'booking',
    });

    return this.bookingsService.getBookingById(bookingId, user);
  }

  private calculateTotal(
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

  private async generateBookingCode(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getUTCFullYear();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bookingCode = `TJS-${year}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await tx.booking.findUnique({
        where: { bookingCode },
        select: { id: true },
      });
      if (!existing) return bookingCode;
    }
    throw new ConflictException('Unable to allocate a unique booking code');
  }
}
