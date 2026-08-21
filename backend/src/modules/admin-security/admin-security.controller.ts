import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AdminSecurityService } from './admin-security.service';
import { VerifyAdminTotpDto } from './dto/admin-security.dto';

@Controller('admin/security/2fa')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_EXECUTIVE', 'PHOTO_REVIEWER', 'ANALYST')
export class AdminSecurityController {
  public constructor(private readonly service: AdminSecurityService) {}
  @Get('status') public status(@CurrentUser() user: AuthenticatedUser) { return this.service.status(user); }
  @Post('setup') public setup(@CurrentUser() user: AuthenticatedUser) { return this.service.setup(user); }
  @Post('verify') public verify(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyAdminTotpDto) { return this.service.verify(user, dto); }
  @Post('disable') public disable(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyAdminTotpDto) { return this.service.disable(user, dto); }
}
