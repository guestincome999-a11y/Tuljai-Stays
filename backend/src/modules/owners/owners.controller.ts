import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AssignLodgeOwnerDto } from './dto/owner.dto';
import { OwnersService } from './owners.service';

@Controller()
export class OwnersController {
  public constructor(private readonly ownersService: OwnersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/lodges/:lodgeId/owners')
  public assignOwner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
    @Body() dto: AssignLodgeOwnerDto,
  ): Promise<{ success: true }> {
    return this.ownersService.assignOwner(lodgeId, dto, user.id);
  }
}
