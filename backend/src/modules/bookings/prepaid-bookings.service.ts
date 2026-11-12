import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser, Booking } from '@tuljai/types';

import { BookingsService } from './bookings.service';
import type { CreateBookingDto } from './dto/booking.dto';

@Injectable()
export class PrepaidBookingsService {
  public constructor(private readonly bookingsService: BookingsService) {}
  public async createBooking(dto: CreateBookingDto, user: AuthenticatedUser): Promise<Booking> {
    if (dto.paymentMethod !== 'ONLINE')
      throw new BadRequestException('This endpoint only creates prepaid bookings');
    return this.bookingsService.createBooking(dto, user);
  }
}
