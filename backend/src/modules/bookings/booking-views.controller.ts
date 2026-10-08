import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type {
  AdminBookingConflict,
  AdminBookingViewPage,
} from '@tuljai/types';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import {
  BOOKING_DATE_RANGES,
  BOOKING_VIEW_KEYS,
  BookingViewsService,
} from './booking-views.service';

function toPage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

@Controller('admin/booking-views')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BookingViewsController {
  public constructor(private readonly bookingViewsService: BookingViewsService) {}

  @Get()
  public list(
    @Query('view') view?: string,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ): Promise<AdminBookingViewPage> {
    return this.bookingViewsService.listView({
      from,
      page: toPage(page),
      pageSize: 20,
      range: BOOKING_DATE_RANGES.find((value) => value === range) ?? 'all',
      search: search?.trim().slice(0, 80) || undefined,
      to,
      view: BOOKING_VIEW_KEYS.find((value) => value === view) ?? 'upcoming',
    });
  }

  @Get('conflicts')
  public conflicts(): Promise<AdminBookingConflict[]> {
    return this.bookingViewsService.listConflicts();
  }
}
