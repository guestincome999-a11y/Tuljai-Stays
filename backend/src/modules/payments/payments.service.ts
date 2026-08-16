import { BadRequestException, Injectable } from '@nestjs/common';

import type { PaymentProvider } from './payment-provider';

@Injectable()
export class PaymentsService {
  public constructor() {}

  public ensureOnlinePaymentsEnabled(enabled: boolean): void {
    if (!enabled) {
      throw new BadRequestException('Online payments are currently unavailable');
    }
  }

  public async createPayment(
    provider: PaymentProvider,
    input: Parameters<PaymentProvider['createPayment']>[0],
  ) {
    return provider.createPayment(input);
  }

  public async verifyPayment(
    provider: PaymentProvider,
    input: Parameters<PaymentProvider['verifyPayment']>[0],
  ) {
    return provider.verifyPayment(input);
  }

  public async refundPayment(provider: PaymentProvider, paymentId: string, amount?: number) {
    return provider.refundPayment(paymentId, amount);
  }
}
