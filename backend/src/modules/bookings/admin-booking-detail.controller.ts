import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AdminBookingSummary, AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AdminBookingDetailService } from './admin-booking-detail.service';

@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBookingDetailController {
  public constructor(private readonly adminBookingDetailService: AdminBookingDetailService) {}

  @Get(':id')
  public getAdminBooking(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminBookingSummary> {
    return this.adminBookingDetailService.getAdminBooking(id, user);
  }
}
