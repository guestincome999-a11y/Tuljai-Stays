import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BookingStatus, Prisma, RoomStatus } from '@prisma/client';
import type { AvailabilityResponse } from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

import { calculateStayPrice } from './booking-pricing';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'PENDING_OWNER_APPROVAL',
  'ACCEPTED',
  'QR_GENERATED',
  'CHECKED_IN',
];

const BLOCKING_ROOM_STATUSES: RoomStatus[] = ['OCCUPIED', 'MAINTENANCE', 'BLOCKED'];

interface AvailabilityOptions {
  // Ignore this booking when counting conflicts, so an existing booking does
  // not block its own date change.
  excludeBookingId?: string;
  excludeLockId?: string;
  db?: Prisma.TransactionClient;
}

@Injectable()
export class BookingAvailabilityService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getAvailability(
    lodgeId: string,
    roomTypeId: string,
    checkInDateValue: string,
    checkOutDateValue: string,
    options: AvailabilityOptions = {},
  ): Promise<AvailabilityResponse> {
    const { checkInDate, checkOutDate } = this.parseDateRange(checkInDateValue, checkOutDateValue);
    const roomType = await (options.db ?? this.prisma).roomType.findFirst({
      include: {
        lodge: true,
      },
      where: {
        deletedAt: null,
        id: roomTypeId,
        isActive: true,
        lodgeId,
      },
    });

    if (!roomType || roomType.lodge.deletedAt || !roomType.lodge.isActive) {
      throw new NotFoundException('Room type not found');
    }

    if (roomType.lodge.status !== 'VERIFIED' || roomType.lodge.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException('Lodge is not available for booking');
    }

    const availableRoomCount = await this.countAvailableRooms({
      db: options.db,
      checkInDate,
      checkOutDate,
      excludeBookingId: options.excludeBookingId,
      excludeLockId: options.excludeLockId,
      lodgeId,
      roomTypeId,
    });

    return {
      available: availableRoomCount > 0,
      availableRoomCount,
      lodgeId,
      priceSummary: {
        totalAmount: (
          await calculateStayPrice(
            options.db ?? this.prisma,
            roomTypeId,
            roomType.basePrice,
            checkInDate,
            checkOutDate,
            roomType.festivalPrice,
          )
        ).toString(),
        basePrice: roomType.basePrice.toString(),
        currency: 'INR',
        festivalPrice: roomType.festivalPrice?.toString() ?? null,
      },
      roomTypeId,
    };
  }

  public async findAvailableRoom(input: {
    db?: Prisma.TransactionClient;
    excludeBookingId?: string;
    checkInDate: Date;
    checkOutDate: Date;
    lodgeId: string;
    roomTypeId: string;
  }): Promise<{ id: string; status: RoomStatus } | null> {
    return (input.db ?? this.prisma).room.findFirst({
      select: { id: true, status: true },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      where: this.availableRoomWhere(input),
    });
  }

  public parseDateRange(
    checkInDateValue: string,
    checkOutDateValue: string,
  ): { checkInDate: Date; checkOutDate: Date } {
    const checkInDate = this.parseDateOnly(checkInDateValue);
    const checkOutDate = this.parseDateOnly(checkOutDateValue);

    if (checkInDate >= checkOutDate) {
      throw new BadRequestException('Check-out date must be after check-in date');
    }

    return { checkInDate, checkOutDate };
  }

  public parseDateOnly(value: string): Date {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    return date;
  }

  public async isRoomAvailable(input: {
    db?: Prisma.TransactionClient;
    checkInDate: Date;
    checkOutDate: Date;
    excludeBookingId?: string;
    roomId: string;
  }): Promise<boolean> {
    return !(await this.hasRoomConflict(input));
  }

  private async countAvailableRooms(input: {
    db?: Prisma.TransactionClient;
    checkInDate: Date;
    checkOutDate: Date;
    excludeBookingId?: string;
    excludeLockId?: string;
    lodgeId: string;
    roomTypeId: string;
  }): Promise<number> {
    const availableRoomCount = await (input.db ?? this.prisma).room.count({
      where: this.availableRoomWhere(input),
    });

    const unassignedBookings = await (input.db ?? this.prisma).booking.count({
      where: {
        checkInDate: { lt: input.checkOutDate },
        checkOutDate: { gt: input.checkInDate },
        deletedAt: null,
        id: input.excludeBookingId ? { not: input.excludeBookingId } : undefined,
        lodgeId: input.lodgeId,
        roomId: null,
        roomTypeId: input.roomTypeId,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
    });
    const unassignedLocks = await (input.db ?? this.prisma).bookingLock.count({
      where: {
        checkInDate: { lt: input.checkOutDate },
        checkOutDate: { gt: input.checkInDate },
        expiresAt: { gt: new Date() },
        id: input.excludeLockId ? { not: input.excludeLockId } : undefined,
        lodgeId: input.lodgeId,
        roomId: null,
        roomTypeId: input.roomTypeId,
        status: 'ACTIVE',
      },
    });

    return Math.max(availableRoomCount - unassignedBookings - unassignedLocks, 0);
  }

  private availableRoomWhere(input: {
    checkInDate: Date;
    checkOutDate: Date;
    lodgeId?: string;
    roomTypeId?: string;
    roomId?: string;
    excludeBookingId?: string;
    excludeLockId?: string;
  }): Prisma.RoomWhereInput {
    const overlap = {
      checkInDate: { lt: input.checkOutDate },
      checkOutDate: { gt: input.checkInDate },
    };
    return {
      id: input.roomId,
      lodgeId: input.lodgeId,
      roomTypeId: input.roomTypeId,
      deletedAt: null,
      isActive: true,
      status: { notIn: BLOCKING_ROOM_STATUSES },
      bookings: {
        none: {
          ...overlap,
          deletedAt: null,
          id: input.excludeBookingId ? { not: input.excludeBookingId } : undefined,
          status: { in: ACTIVE_BOOKING_STATUSES },
        },
      },
      bookingLocks: {
        none: {
          ...overlap,
          id: input.excludeLockId ? { not: input.excludeLockId } : undefined,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      },
      availability: {
        none: {
          date: { gte: input.checkInDate, lt: input.checkOutDate },
          status: { not: 'AVAILABLE' },
        },
      },
    };
  }

  private async hasRoomConflict(input: {
    db?: Prisma.TransactionClient;
    checkInDate: Date;
    checkOutDate: Date;
    excludeBookingId?: string;
    excludeLockId?: string;
    roomId: string;
  }): Promise<boolean> {
    const room = await (input.db ?? this.prisma).room.findFirst({
      select: { id: true },
      where: this.availableRoomWhere(input),
    });
    return !room;
  }
}
