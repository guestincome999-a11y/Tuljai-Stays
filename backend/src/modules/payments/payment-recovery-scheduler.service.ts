import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';

@Injectable()
export class PaymentRecoverySchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly logger = new Logger(PaymentRecoverySchedulerService.name);
  public constructor(
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
  ) {}
  public onModuleInit(): void {
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = true;
      void Promise.allSettled([this.payments.reconcilePending(), this.refunds.reconcilePending()])
        .then((results) => {
          if (results.some((result) => result.status === 'rejected'))
            this.logger.error('Payment or refund recovery cycle failed');
        })
        .finally(() => {
          this.running = false;
        });
    }, 30_000);
  }
  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
