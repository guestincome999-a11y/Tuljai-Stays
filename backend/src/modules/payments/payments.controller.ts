import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';
import { IsString, MaxLength } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBookingDto } from '../bookings/dto/booking.dto';

import { PaymentsService } from './payments.service';

class VerifyRazorpayPaymentDto {
  @IsString()
  @MaxLength(100)
  orderId!: string;

  @IsString()
  @MaxLength(100)
  paymentId!: string;

  @IsString()
  @MaxLength(200)
  signature!: string;
}

class CreatePrepaidOrderDto {
  @IsString()
  @MaxLength(64)
  lockCode!: string;
}

class ConfirmPrepaidBookingDto extends CreateBookingDto {
  @IsString()
  @MaxLength(100)
  orderId!: string;

  @IsString()
  @MaxLength(100)
  paymentId!: string;

  @IsString()
  @MaxLength(200)
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

  @UseGuards(JwtAuthGuard)
  @Post('prepaid/order')
  public createPrepaidOrder(
    @Body() dto: CreatePrepaidOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createPrepaidOrder(dto.lockCode, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('prepaid/confirm')
  public confirmPrepaidBooking(
    @Body() dto: ConfirmPrepaidBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { orderId, paymentId, signature, ...bookingDto } = dto;
    return this.paymentsService.confirmPrepaidBooking(bookingDto, user, {
      orderId,
      paymentId,
      signature,
    });
  }
}
