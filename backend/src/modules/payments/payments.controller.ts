import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PaymentsService } from './payments.service';
import { RazorpayProvider } from './providers/razorpay.provider';

interface CreateOrderBody {
  amount: number;
  currency?: string;
  bookingId: string;
}

interface VerifyPaymentBody {
  orderId: string;
  paymentId: string;
  signature: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  public constructor(
    private readonly paymentsService: PaymentsService,
    private readonly razorpayProvider: RazorpayProvider,
  ) {}

  @Post('create-order')
  public async createOrder(@Body() body: CreateOrderBody, @CurrentUser() user: AuthenticatedUser) {
    if (!Number.isInteger(body.amount) || body.amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer in paise');
    }

    if (!body.bookingId?.trim()) {
      throw new BadRequestException('bookingId is required');
    }

    return this.paymentsService.createPayment(this.razorpayProvider, {
      amount: body.amount,
      currency: body.currency ?? 'INR',
      bookingId: body.bookingId,
      receipt: `booking_${body.bookingId}`.slice(0, 40),
    }, user);
  }

  @Post('verify')
  public async verify(@Body() body: VerifyPaymentBody, @CurrentUser() user: AuthenticatedUser) {
    if (!body.orderId || !body.paymentId || !body.signature) {
      throw new BadRequestException('orderId, paymentId and signature are required');
    }

    return this.paymentsService.verifyPayment(this.razorpayProvider, body, user);
  }
}
