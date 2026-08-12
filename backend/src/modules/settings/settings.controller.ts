import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';
import type { FastifyRequest } from 'fastify';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { UpdateFeatureFlagDto, UpdateSystemSettingDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller()
export class SettingsController {
  public constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/settings')
  public listSettings() {
    return this.settingsService.listSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/settings/:key')
  public updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSystemSettingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateSetting(key, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/settings/promotional-banners/image')
  public async uploadPromotionalBannerImage(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestException('Select a banner image to upload');
    }

    return this.settingsService.uploadPromotionalBannerImage(file, user.id);
  }

  @Get('settings/public')
  public publicSettings() {
    return this.settingsService.listPublicSettings();
  }

  @Get('feature-flags/public')
  public publicFeatureFlags() {
    return this.settingsService.listPublicFeatureFlags();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/feature-flags')
  public listFeatureFlags() {
    return this.settingsService.listFeatureFlags();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/feature-flags/:key')
  public updateFeatureFlag(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateFeatureFlag(key, dto, user.id);
  }
}
