import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PaymentsService } from './payments.service';

class VerifyRazorpayPaymentDto {
  orderId!: string;
  paymentId!: string;
  signature!: string;
}

@Controller('payments')
export class PaymentsController {
  public constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('bookings/:bookingId/order')
  public createBookingOrder(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createBookingOrder(bookingId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings/:bookingId/verify')
  public verifyBookingPayment(
    @Param('bookingId') bookingId: string,
    @Body() dto: VerifyRazorpayPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.verifyBookingPayment(bookingId, user.id, dto);
  }
}
