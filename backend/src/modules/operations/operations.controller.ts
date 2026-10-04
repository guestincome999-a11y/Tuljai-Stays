import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminDashboardPeriod, AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { ReportQueryDto } from './dto/operations.dto';
import { OperationsService } from './operations.service';

@Controller()
export class OperationsController {
  public constructor(private readonly operationsService: OperationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/dashboard/summary')
  public adminSummary() {
    return this.operationsService.adminDashboardSummary();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/dashboard/kpis')
  public adminKpis() {
    return this.operationsService.adminDashboardKpis();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/dashboard/booking-trend')
  public adminBookingTrend(@Query('days') days?: string) {
    return this.operationsService.adminBookingTrend(days ? Number(days) : 7);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/dashboard/insights')
  public adminInsights(@Query('period') period?: string) {
    const allowed: AdminDashboardPeriod[] = ['today', 'week', 'month'];
    const selected = allowed.find((value) => value === period) ?? 'month';
    return this.operationsService.adminDashboardInsights(selected);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/dashboard/summary')
  public ownerSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.operationsService.ownerDashboardSummary(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/summary')
  public profileSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.operationsService.pilgrimProfileSummary(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/reports/bookings')
  public adminBookingReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.bookingReport(query, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/reports/occupancy')
  public adminOccupancyReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.bookingReport(query, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/reports/bookings')
  public ownerBookingReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.ownerBookingReport(query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/reports/register')
  public ownerRegisterReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.ownerBookingReport(query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/reports/commission')
  public adminCommissionReport(@Query() query: ReportQueryDto) {
    return this.operationsService.commissionReport(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/reports/commission')
  public async ownerCommissionReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const report = await this.operationsService.ownerBookingReport(query, user);
    const lodgeIds = [...new Set(report.items.map((item) => item.lodgeId))];
    return this.operationsService.commissionReport(query, lodgeIds);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/notifications/metrics')
  public notificationMetrics() {
    return this.operationsService.notificationMetrics();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/realtime/presence')
  public presence() {
    return this.operationsService.presenceSummary();
  }
}
