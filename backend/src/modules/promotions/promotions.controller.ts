import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CreatePromoCodeDto, ValidatePromoCodeDto } from './dto/promotions.dto';
import { PromotionsService } from './promotions.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  public constructor(private readonly service: PromotionsService) {}

  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  @Get('admin/promotions')
  public list() { return this.service.list(); }

  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  @Post('admin/promotions')
  public create(@Body() dto: CreatePromoCodeDto, @CurrentUser() user: AuthenticatedUser) { return this.service.create(dto, user); }

  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  @Patch('admin/promotions/:id/deactivate')
  public deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.service.deactivate(id, user); }

  @Roles('PILGRIM', 'ADMIN', 'SUPER_ADMIN')
  @Post('promotions/validate')
  public validate(@Body() dto: ValidatePromoCodeDto, @CurrentUser() user: AuthenticatedUser) { return this.service.validate(dto, user); }
}
