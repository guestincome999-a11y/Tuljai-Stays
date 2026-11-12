import { randomBytes } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser, BookingLock } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingAvailabilityService } from './booking-availability.service';
import type { CreateBookingLockDto } from './dto/booking.dto';
import { lockInventory } from './inventory-lock';

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
    checkoutAttemptKey?: string,
  ): Promise<BookingLock> {
    if (checkoutAttemptKey !== undefined && !/^[a-zA-Z0-9_-]{16,128}$/.test(checkoutAttemptKey)) {
      throw new BadRequestException(
        'Idempotency-Key must contain 16–128 letters, numbers, hyphens or underscores',
      );
    }
    const { checkInDate, checkOutDate } = this.availabilityService.parseDateRange(
      dto.checkInDate,
      dto.checkOutDate,
    );
    const ttlSeconds = this.configService.get<number>('api.booking.lockTtlSeconds', 300);
    const lock = await this.prisma.$transaction(async (tx) => {
      if (checkoutAttemptKey) {
        const scope = `checkout:${user.id}:${checkoutAttemptKey}`;
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
      }
      await lockInventory(tx, dto.roomTypeId);
      if (checkoutAttemptKey) {
        const existing = await tx.bookingLock.findUnique({
          where: {
            pilgrimUserId_checkoutAttemptKey: { pilgrimUserId: user.id, checkoutAttemptKey },
          },
        });
        if (existing) {
          if (
            existing.lodgeId !== dto.lodgeId ||
            existing.roomTypeId !== dto.roomTypeId ||
            existing.checkInDate.getTime() !== checkInDate.getTime() ||
            existing.checkOutDate.getTime() !== checkOutDate.getTime()
          ) {
            throw new ConflictException(
              'Idempotency-Key was already used for different booking details',
            );
          }
          if (existing.status !== 'ACTIVE' || existing.expiresAt <= new Date()) {
            throw new ConflictException(
              'This checkout attempt ended. Check payment status before starting again.',
            );
          }
          return existing;
        }
      }
      const availability = await this.availabilityService.getAvailability(
        dto.lodgeId,
        dto.roomTypeId,
        dto.checkInDate,
        dto.checkOutDate,
        { db: tx },
      );

      if (!availability.available) {
        throw new ConflictException('Room type is not available for the selected dates');
      }

      const created = await tx.bookingLock.create({
        data: {
          checkInDate,
          checkOutDate,
          checkoutAttemptKey,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000),
          lockCode: this.generateLockCode(),
          lodgeId: dto.lodgeId,
          pilgrimUserId: user.id,
          roomTypeId: dto.roomTypeId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'BOOKING_LOCK_CREATED',
          actorUserId: user.id,
          entityId: created.id,
          entityType: 'booking_lock',
          metadata: { expiresAt: created.expiresAt.toISOString() },
        },
      });
      return created;
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
    const result = await this.prisma.bookingLock.updateMany({
      data: { expiresAt: this.prepaidOrderExpiry(), orderAmount, providerOrderId },
      where: { id: lockId, status: 'ACTIVE', expiresAt: { gt: new Date() }, providerOrderId: null },
    });
    if (result.count !== 1)
      throw new ConflictException('Payment order is already attached or hold expired');
  }

  /**
   * Frees a still-active hold the guest no longer needs (dates changed, they
   * switched to pay-at-lodge, or they left checkout), so it stops blocking the
   * room immediately instead of lingering until its TTL. Scoped to the
   * caller's own ACTIVE locks; consumed/expired locks are left untouched.
   */
  public async releaseLock(lockCode: string, user: AuthenticatedUser): Promise<boolean> {
    const result = await this.prisma.bookingLock.updateMany({
      data: { expiresAt: new Date(), status: 'RELEASED' },
      where: { lockCode, pilgrimUserId: user.id, status: 'ACTIVE' },
    });
    return result.count > 0;
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

  public prepaidOrderExpiry(): Date {
    const seconds = this.configService.get<number>('api.booking.prepaidOrderHoldSeconds', 900);
    return new Date(Date.now() + seconds * 1000);
  }

  private generateLockCode(): string {
    return `TJS-LOCK-${randomBytes(16).toString('hex').toUpperCase()}`;
  }
}
