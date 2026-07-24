import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, Lodge, LodgeDetails, PaginatedResponse } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import {
  CreateLodgeDto,
  ListLodgesQueryDto,
  UpdateLodgeDto,
  UpdateLodgeStatusDto,
  VerifyLodgeDto,
} from './dto/lodge.dto';
import { LodgesService } from './lodges.service';

@Controller()
export class LodgesController {
  public constructor(private readonly lodgesService: LodgesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/lodges')
  public create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLodgeDto,
  ): Promise<LodgeDetails> {
    return this.lodgesService.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/lodges')
  public listAdmin(@Query() query: ListLodgesQueryDto): Promise<PaginatedResponse<Lodge>> {
    return this.lodgesService.listAdmin(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/lodges/:id')
  public getAdminById(@Param('id') id: string): Promise<LodgeDetails> {
    return this.lodgesService.getAdminById(id);
  }

  @Get('lodges')
  public list(@Query() query: ListLodgesQueryDto): Promise<PaginatedResponse<Lodge>> {
    return this.lodgesService.listPublic(query);
  }

  @Get('lodges/:id')
  public getById(@Param('id') id: string): Promise<LodgeDetails> {
    return this.lodgesService.getPublicById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/lodges/:id')
  public update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLodgeDto,
  ): Promise<LodgeDetails> {
    return this.lodgesService.update(id, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/lodges/:id/status')
  public updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLodgeStatusDto,
  ): Promise<LodgeDetails> {
    return this.lodgesService.updateStatus(id, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/lodges/:id/verify')
  public verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VerifyLodgeDto,
  ): Promise<LodgeDetails> {
    return this.lodgesService.verify(id, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/lodges')
  public listOwnerLodges(@CurrentUser() user: AuthenticatedUser): Promise<Lodge[]> {
    return this.lodgesService.listForOwner(user);
  }
}
