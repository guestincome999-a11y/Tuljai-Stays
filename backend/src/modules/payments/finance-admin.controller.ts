import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminPaymentsPage, AdminSettlementHistoryPage } from '@tuljai/types';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { FinanceAdminService, PAYMENT_METHODS, PAYMENT_STATUSES } from './finance-admin.service';

function toPage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

function toPageSize(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : fallback;
}

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class FinanceAdminController {
  public constructor(private readonly financeAdminService: FinanceAdminService) {}

  @Get('payments')
  public payments(
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<AdminPaymentsPage> {
    return this.financeAdminService.listPayments({
      method: PAYMENT_METHODS.find((value) => value === method),
      page: toPage(page),
      pageSize: toPageSize(pageSize, 20),
      search: search?.trim().slice(0, 80) || undefined,
      status: PAYMENT_STATUSES.find((value) => value === status),
    });
  }

  @Get('settlements/history')
  public settlementHistory(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<AdminSettlementHistoryPage> {
    return this.financeAdminService.settlementHistory({
      page: toPage(page),
      pageSize: toPageSize(pageSize, 15),
    });
  }
}
