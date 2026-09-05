import { randomBytes } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser, BookingLock } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingAvailabilityService } from './booking-availability.service';
import type { CreateBookingLockDto } from './dto/booking.dto';

@Injectable()
export class BookingLocksService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly availabilityService: BookingAvailabilityService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  public async createLock(
    dto: CreateBookingLockDto,
    user: AuthenticatedUser,
  ): Promise<BookingLock> {
    const availability = await this.availabilityService.getAvailability(
      dto.lodgeId,
      dto.roomTypeId,
      dto.checkInDate,
      dto.checkOutDate,
    );

    if (!availability.available) {
      throw new ConflictException('Room type is not available for the selected dates');
    }

    const { checkInDate, checkOutDate } = this.availabilityService.parseDateRange(
      dto.checkInDate,
      dto.checkOutDate,
    );
    const ttlSeconds = this.configService.get<number>('api.booking.lockTtlSeconds', 300);
    const lock = await this.prisma.bookingLock.create({
      data: {
        checkInDate,
        checkOutDate,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        lockCode: await this.generateLockCode(),
        lodgeId: dto.lodgeId,
        pilgrimUserId: user.id,
        roomTypeId: dto.roomTypeId,
      },
    });

    await this.auditLogService.create({
      action: 'BOOKING_LOCK_CREATED',
      actorUserId: user.id,
      entityId: lock.id,
      entityType: 'booking_lock',
      metadata: { expiresAt: lock.expiresAt.toISOString() },
    });

    return {
      checkInDate: lock.checkInDate.toISOString().slice(0, 10),
      checkOutDate: lock.checkOutDate.toISOString().slice(0, 10),
      expiresAt: lock.expiresAt.toISOString(),
      id: lock.id,
      lockCode: lock.lockCode,
      lodgeId: lock.lodgeId,
      roomId: lock.roomId,
      roomTypeId: lock.roomTypeId,
      status: lock.status,
    };
  }

  /**
   * Binds a Razorpay order to a still-active hold so the checkout sheet can
   * be opened immediately when the guest taps Pay, instead of creating the
   * order only after a booking exists. Called from PaymentsService once the
   * order has been created with Razorpay.
   *
   * Also extends the hold's expiry: the normal lock TTL is sized for the
   * short gap between creating a lock and creating a booking, but once an
   * order is attached the lock must additionally survive however long the
   * guest takes inside the Razorpay sheet (entering a UPI PIN, an OTP, a
   * bank redirect, etc.), which can run well past that TTL.
   */
  public async attachProviderOrder(
    lockId: string,
    providerOrderId: string,
    orderAmount: number,
  ): Promise<void> {
    const holdSeconds = this.configService.get<number>('api.booking.prepaidOrderHoldSeconds', 900);
    await this.prisma.bookingLock.update({
      data: {
        expiresAt: new Date(Date.now() + holdSeconds * 1000),
        orderAmount,
        providerOrderId,
      },
      where: { id: lockId },
    });
  }

  public async expireLocks(): Promise<number> {
    const result = await this.prisma.bookingLock.updateMany({
      data: { status: 'EXPIRED' },
      where: {
        expiresAt: { lte: new Date() },
        status: 'ACTIVE',
      },
    });

    return result.count;
  }

  private async generateLockCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const lockCode = `TJS-LOCK-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.bookingLock.findUnique({ where: { lockCode } });

      if (!existing) {
        return lockCode;
      }
    }

    return `TJS-LOCK-${Date.now()}`;
  }
}
