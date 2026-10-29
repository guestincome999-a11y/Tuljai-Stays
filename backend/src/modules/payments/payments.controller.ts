import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';
import { IsString, MaxLength } from 'class-validator';
import type { FastifyRequest } from 'fastify';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBookingDto, CreateBookingLockDto } from '../bookings/dto/booking.dto';

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('recovery')
  public recoveryQueue() {
    return this.paymentsService.listRecoveryRequired();
  }

  @Post('razorpay/webhook')
  @HttpCode(200)
  public webhook(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.paymentsService.receiveWebhook(
      request.rawBody ?? Buffer.alloc(0),
      signature,
      eventId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('prepaid/prepare')
  public prepare(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.preparePrepaidIntent(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:orderId/status')
  public status(@Param('orderId') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.paymentStatus(orderId, user);
  }

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
  @Post('prepaid/hold')
  public createPrepaidHold(
    @Body() dto: CreateBookingLockDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.createPrepaidHold(dto, user, idempotencyKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('prepaid/release')
  public releasePrepaidHold(
    @Body() dto: CreatePrepaidOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.releasePrepaidHold(dto.lockCode, user);
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
