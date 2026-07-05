import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, LodgePhoto } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CreateLodgePhotoDto, RejectPhotoDto } from './dto/photo.dto';
import { PhotosService } from './photos.service';

@Controller()
export class PhotosController {
  public constructor(private readonly photosService: PhotosService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/lodges/:lodgeId/photos')
  public createLodgePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
    @Body() dto: CreateLodgePhotoDto,
  ): Promise<LodgePhoto> {
    return this.photosService.createLodgePhoto(lodgeId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/photos/pending')
  public listPending(): Promise<LodgePhoto[]> {
    return this.photosService.listPending();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/lodges/:lodgeId/photos')
  public listOwnerPhotos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
  ): Promise<LodgePhoto[]> {
    return this.photosService.listOwnerPhotos(lodgeId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/photos/:id/approve')
  public approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LodgePhoto> {
    return this.photosService.approve(id, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/photos/:id/reject')
  public reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectPhotoDto,
  ): Promise<LodgePhoto> {
    return this.photosService.reject(id, dto, user.id);
  }

  @Get('lodges/:lodgeId/photos')
  public listPublic(@Param('lodgeId') lodgeId: string): Promise<LodgePhoto[]> {
    return this.photosService.listPublic(lodgeId);
  }
}
