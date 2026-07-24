import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, RoomStatus } from '@prisma/client';
import type { AvailabilityResponse } from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'PENDING_OWNER_APPROVAL',
  'ACCEPTED',
  'QR_GENERATED',
  'CHECKED_IN',
];

const BLOCKING_ROOM_STATUSES: RoomStatus[] = ['OCCUPIED', 'MAINTENANCE', 'BLOCKED'];

interface AvailabilityOptions {
  excludeLockId?: string;
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
    const roomType = await this.prisma.roomType.findFirst({
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
      checkInDate,
      checkOutDate,
      excludeLockId: options.excludeLockId,
      lodgeId,
      roomTypeId,
    });

    return {
      available: availableRoomCount > 0,
      availableRoomCount,
      lodgeId,
      priceSummary: {
        basePrice: roomType.basePrice.toString(),
        currency: 'INR',
        festivalPrice: roomType.festivalPrice?.toString() ?? null,
      },
      roomTypeId,
    };
  }

  public async findAvailableRoom(input: {
    checkInDate: Date;
    checkOutDate: Date;
    lodgeId: string;
    roomTypeId: string;
  }): Promise<{ id: string; status: RoomStatus } | null> {
    const rooms = await this.prisma.room.findMany({
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      where: {
        deletedAt: null,
        isActive: true,
        lodgeId: input.lodgeId,
        roomTypeId: input.roomTypeId,
        status: { notIn: BLOCKING_ROOM_STATUSES },
      },
    });

    for (const room of rooms) {
      const hasConflict = await this.hasRoomConflict({
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        roomId: room.id,
      });

      if (!hasConflict) {
        return { id: room.id, status: room.status };
      }
    }

    return null;
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

  private async countAvailableRooms(input: {
    checkInDate: Date;
    checkOutDate: Date;
    excludeLockId?: string;
    lodgeId: string;
    roomTypeId: string;
  }): Promise<number> {
    const rooms = await this.prisma.room.findMany({
      select: { id: true },
      where: {
        deletedAt: null,
        isActive: true,
        lodgeId: input.lodgeId,
        roomTypeId: input.roomTypeId,
        status: { notIn: BLOCKING_ROOM_STATUSES },
      },
    });

    let availableRoomCount = 0;

    for (const room of rooms) {
      const hasConflict = await this.hasRoomConflict({
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        excludeLockId: input.excludeLockId,
        roomId: room.id,
      });

      if (!hasConflict) {
        availableRoomCount += 1;
      }
    }

    const [unassignedBookings, unassignedLocks] = await this.prisma.$transaction([
      this.prisma.booking.count({
        where: {
          checkInDate: { lt: input.checkOutDate },
          checkOutDate: { gt: input.checkInDate },
          deletedAt: null,
          lodgeId: input.lodgeId,
          roomId: null,
          roomTypeId: input.roomTypeId,
          status: { in: ACTIVE_BOOKING_STATUSES },
        },
      }),
      this.prisma.bookingLock.count({
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
      }),
    ]);

    return Math.max(availableRoomCount - unassignedBookings - unassignedLocks, 0);
  }

  private async hasRoomConflict(input: {
    checkInDate: Date;
    checkOutDate: Date;
    excludeLockId?: string;
    roomId: string;
  }): Promise<boolean> {
    const overlapWhere = {
      checkInDate: { lt: input.checkOutDate },
      checkOutDate: { gt: input.checkInDate },
    };
    const now = new Date();
    const [booking, lock] = await this.prisma.$transaction([
      this.prisma.booking.findFirst({
        where: {
          ...overlapWhere,
          deletedAt: null,
          roomId: input.roomId,
          status: { in: ACTIVE_BOOKING_STATUSES },
        },
      }),
      this.prisma.bookingLock.findFirst({
        where: {
          ...overlapWhere,
          expiresAt: { gt: now },
          id: input.excludeLockId ? { not: input.excludeLockId } : undefined,
          roomId: input.roomId,
          status: 'ACTIVE',
        } satisfies Prisma.BookingLockWhereInput,
      }),
    ]);

    return Boolean(booking || lock);
  }
}
