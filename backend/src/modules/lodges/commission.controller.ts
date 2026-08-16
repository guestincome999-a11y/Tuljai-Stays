import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { UpdateLodgeCommissionDto } from './dto/commission.dto';
import { LodgeCommissionConfig, LodgeCommissionService } from './commission.service';

@Controller()
export class LodgeCommissionController {
  public constructor(private readonly commissionService: LodgeCommissionService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/lodges/:id/commission')
  public get(@Param('id') lodgeId: string): Promise<LodgeCommissionConfig> {
    return this.commissionService.get(lodgeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/lodges/:id/commission')
  public update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') lodgeId: string,
    @Body() dto: UpdateLodgeCommissionDto,
  ): Promise<LodgeCommissionConfig> {
    return this.commissionService.update(lodgeId, dto, user.id);
  }
}
