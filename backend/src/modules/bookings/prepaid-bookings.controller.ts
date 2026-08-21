import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateBookingDto } from './dto/booking.dto';
import { PrepaidBookingsService } from './prepaid-bookings.service';

@Controller('bookings')
export class PrepaidBookingsController {
  public constructor(private readonly prepaidBookingsService: PrepaidBookingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('prepaid')
  public create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.prepaidBookingsService.createBooking(dto, user);
  }
}
