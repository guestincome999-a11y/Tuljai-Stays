import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { UpdateUserStatusDto, UserDirectoryQueryDto } from './dto/user-directory.dto';
import { UserDirectoryService } from './user-directory.service';

@Controller('admin/user-directory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UserDirectoryController {
  public constructor(private readonly userDirectoryService: UserDirectoryService) {}

  @Get('stats')
  public getStats() {
    return this.userDirectoryService.getStats();
  }

  @Get()
  public listUsers(@Query() query: UserDirectoryQueryDto) {
    return this.userDirectoryService.listUsers(query);
  }

  @Get(':id')
  public getUserDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.userDirectoryService.getUserDetail(id, user);
  }

  @Patch(':id/status')
  public updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userDirectoryService.updateStatus(id, dto, user);
  }
}
