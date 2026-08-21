import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignStaffRoleDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class StaffController {
  public constructor(private readonly staffService: StaffService) {}

  @Get('admin/staff')
  public list() {
    return this.staffService.list();
  }

  @Patch('admin/staff/:userId/role')
  public assign(
    @Param('userId') userId: string,
    @Body() dto: AssignStaffRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.staffService.assign(userId, dto, actor.id);
  }
}
