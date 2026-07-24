import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Amenity, AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AmenitiesService } from './amenities.service';
import { AssignLodgeAmenitiesDto, CreateAmenityDto } from './dto/amenity.dto';

@Controller()
export class AmenitiesController {
  public constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get('amenities')
  public listActive(): Promise<Amenity[]> {
    return this.amenitiesService.listActive();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/amenities')
  public create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAmenityDto,
  ): Promise<Amenity> {
    return this.amenitiesService.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/lodges/:lodgeId/amenities')
  public assignToLodge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
    @Body() dto: AssignLodgeAmenitiesDto,
  ): Promise<{ success: true }> {
    return this.amenitiesService.assignToLodge(lodgeId, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/lodges/:lodgeId/amenities')
  public assignToOwnerLodge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
    @Body() dto: AssignLodgeAmenitiesDto,
  ): Promise<{ success: true }> {
    return this.amenitiesService.assignToOwnerLodge(lodgeId, dto, user);
  }
}
