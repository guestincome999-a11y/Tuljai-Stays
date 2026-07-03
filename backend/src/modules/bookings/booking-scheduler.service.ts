import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { PrismaService } from '../prisma/prisma.service';

import { BookingLocksService } from './booking-locks.service';
import { BookingsService } from './bookings.service';

@Injectable()
export class BookingSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingSchedulerService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  public constructor(
    private readonly bookingLocksService: BookingLocksService,
    private readonly bookingsService: BookingsService,
    private readonly configService: ConfigService,
    private readonly notificationDeliveryService: NotificationDeliveryService,
    private readonly prisma: PrismaService,
  ) {}

  public onModuleInit(): void {
    const intervalSeconds = this.configService.get<number>(
      'api.booking.schedulerIntervalSeconds',
      60,
    );
    this.intervalRef = setInterval(() => {
      void this.runExpiryCycle();
    }, intervalSeconds * 1000);
  }

  public onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }

  public async runExpiryCycle(): Promise<void> {
    const [expiredLocks, expiredBookings, expiredQrTokens, retriedNotifications] =
      await Promise.all([
        this.bookingLocksService.expireLocks(),
        this.bookingsService.expirePendingBookings(),
        this.expireQrTokens(),
        this.notificationDeliveryService.retryFailedNotifications(),
      ]);

    if (
      expiredLocks > 0 ||
      expiredBookings > 0 ||
      expiredQrTokens > 0 ||
      retriedNotifications > 0
    ) {
      this.logger.log(
        `Expired ${expiredLocks} locks, ${expiredBookings} bookings, ${expiredQrTokens} QR tokens; retried ${retriedNotifications} notifications`,
      );
    }
  }

  private async expireQrTokens(): Promise<number> {
    const result = await this.prisma.bookingQrToken.updateMany({
      data: { status: 'EXPIRED' },
      where: {
        expiresAt: { lte: new Date() },
        status: 'ACTIVE',
      },
    });

    return result.count;
  }
}
