import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { RefundStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { RefundsService } from './refunds.service';

@Controller('admin/finance/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RefundsController {
  public constructor(private readonly refunds: RefundsService) {}
  @Get()
  public list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    const p = Number(page ?? 1);
    return this.refunds.list({
      search: search?.trim().slice(0, 100),
      status: Object.values(RefundStatus).find((s) => s === status),
      page: Number.isSafeInteger(p) && p > 0 ? Math.min(p, 100000) : 1,
      pageSize: 50,
    });
  }
  @Get(':id')
  public detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.refunds.detail(id);
  }
  @Post(':id/reconcile')
  public async reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.refunds.adminReconcile(id, user);
    return this.refunds.detail(id);
  }
  @Post(':id/retry')
  public async retry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.refunds.retry(id, user);
    return this.refunds.detail(id);
  }
}
