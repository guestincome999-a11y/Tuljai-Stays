import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  CreatePaymentInput,
  PaymentOrder,
  PaymentProvider,
  PaymentVerificationInput,
  PaymentVerificationResult,
} from '../payment-provider';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  public readonly name = 'RAZORPAY' as const;

  public async createPayment(_input: CreatePaymentInput): Promise<PaymentOrder> {
    throw new BadRequestException(
      'Razorpay online payments are not configured yet. Enable them only after Razorpay credentials are configured.',
    );
  }

  public async verifyPayment(_input: PaymentVerificationInput): Promise<PaymentVerificationResult> {
    throw new BadRequestException('Razorpay payment verification is not configured yet');
  }

  public async refundPayment(_paymentId: string, _amount?: number): Promise<{ refundId: string }> {
    throw new BadRequestException('Razorpay refunds are not configured yet');
  }
}
