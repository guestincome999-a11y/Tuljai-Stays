import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminBookingSummary, AuthenticatedUser } from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

import { getAdminBookingActivity } from './admin-booking-activity';
import { BookingsService } from './bookings.service';
import { withCashCollection } from './cash-collection';

@Injectable()
export class AdminBookingDetailService {
  public constructor(
    private readonly bookingsService: BookingsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Admin booking detail: the full booking (admins are never masked) plus the lodge name,
   * room type name, assigned room number and city name, so the admin panel can show real
   * names instead of raw IDs. The pilgrim `GET /bookings/:id` response is left unchanged.
   */
  public async getAdminBooking(id: string, user: AuthenticatedUser): Promise<AdminBookingSummary> {
    const booking = await this.bookingsService.getBookingById(id, user);
    const names = await this.prisma.booking.findUnique({
      select: {
        city: { select: { name: true } },
        lodge: { select: { name: true } },
        room: { select: { roomNumber: true } },
        roomType: { select: { name: true } },
      },
      where: { id },
    });

    if (!names) {
      throw new NotFoundException('Booking not found');
    }

    const [activity, enrichedBooking] = await Promise.all([
      getAdminBookingActivity(this.prisma, booking),
      withCashCollection(this.prisma, booking),
    ]);
    return {
      ...enrichedBooking,
      activity,
      cityName: names.city.name,
      lodgeName: names.lodge.name,
      roomNumber: names.room?.roomNumber ?? null,
      roomTypeName: names.roomType.name,
    };
  }
}
