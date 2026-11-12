import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentRecoverySchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(PaymentRecoverySchedulerService.name);
  public constructor(private readonly payments: PaymentsService) {}
  public onModuleInit(): void {
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = true;
      void this.payments
        .reconcilePending()
        .catch(() => this.logger.error('Payment recovery cycle failed'))
        .finally(() => {
          this.running = false;
        });
    }, 30_000);
  }
  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
