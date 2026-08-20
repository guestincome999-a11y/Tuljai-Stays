import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AdminUsersQueryDto } from './dto/admin-users.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @Get()
  public list(@Query() query: AdminUsersQueryDto) {
    return this.usersService.listAdminUsers(query);
  }

  @Get(':id')
  public get(@Param('id') id: string) {
    return this.usersService.getAdminUser(id);
  }
}
