import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AssignLodgeOwnerDto, CreateTeamMemberDto, UpdateTeamMemberDto } from './dto/owner.dto';
import { OwnersService, type TeamMember } from './owners.service';

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/lodges/:lodgeId/team')
  public listTeam(@Param('lodgeId') lodgeId: string): Promise<TeamMember[]> {
    return this.ownersService.listTeam(lodgeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/lodges/:lodgeId/team')
  public createTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
    @Body() dto: CreateTeamMemberDto,
  ): Promise<TeamMember> {
    return this.ownersService.createTeamMember(lodgeId, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/lodges/:lodgeId/team/:membershipId')
  public updateTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateTeamMemberDto,
  ): Promise<TeamMember> {
    return this.ownersService.updateTeamMember(lodgeId, membershipId, dto, user.id);
  }
}
