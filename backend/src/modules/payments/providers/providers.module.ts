import { Module } from '@nestjs/common';

import { RazorpayProvider } from './razorpay.provider';

@Module({
  providers: [RazorpayProvider],
  exports: [RazorpayProvider],
})
export class PaymentProvidersModule {}
