import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    const [expiredLocks, expiredBookings] = await Promise.all([
      this.bookingLocksService.expireLocks(),
      this.bookingsService.expirePendingBookings(),
    ]);

    if (expiredLocks > 0 || expiredBookings > 0) {
      this.logger.log(
        `Expired ${expiredLocks} booking locks and ${expiredBookings} pending bookings`,
      );
    }
  }
}
