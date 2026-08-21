import { Controller, Get, Param, Patch, Query, UseGuards, Body } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AdminSupportService } from './admin-support.service';
import { AdminBookingUpdateDto, AdminUserSearchQueryDto } from './dto/admin-support.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSupportController {
  public constructor(private readonly adminSupportService: AdminSupportService) {}

  @Get('admin/users/search')
  public searchUsers(
    @Query() query: AdminUserSearchQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSupportService.searchUsers(query, user);
  }

  @Get('admin/users/:id')
  public getUser(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.adminSupportService.getUser(id, user);
  }

  @Patch('admin/users/:userId/bookings/:bookingId')
  public updateBooking(
    @Param('userId') userId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: AdminBookingUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSupportService.updateBooking(userId, bookingId, dto, user);
  }
}
