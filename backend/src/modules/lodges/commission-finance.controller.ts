import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { LodgeCommissionFinanceService } from './commission-finance.service';
import { CreateCommissionSettlementDto } from './dto/commission-settlement.dto';

@Controller()
export class LodgeCommissionFinanceController {
  public constructor(private readonly financeService: LodgeCommissionFinanceService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/lodges/:id/commission/report')
  public adminReport(@Param('id') lodgeId: string) {
    return this.financeService.getReport(lodgeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/lodges/:id/commission/report')
  public ownerReport(@CurrentUser() user: AuthenticatedUser, @Param('id') lodgeId: string) {
    return this.financeService.getReport(lodgeId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/lodges/:id/commission/settlements')
  public createSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') lodgeId: string,
    @Body() dto: CreateCommissionSettlementDto,
  ) {
    return this.financeService.createSettlement(lodgeId, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/commission/transactions/:ledgerId/void')
  public voidTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ledgerId') ledgerId: string,
  ) {
    return this.financeService.voidTransaction(ledgerId, user.id);
  }
}
