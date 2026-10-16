import { Body, Controller, Get, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AppConfigService } from './app-config.service';
import { UpdatePilgrimLayoutDto } from './dto/app-config.dto';

@Controller()
export class AppConfigController {
  public constructor(private readonly appConfigService: AppConfigService) {}

  @Get('app-config/pilgrim')
  public async pilgrimConfig(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { body, etag } = await this.appConfigService.getPilgrimConfig();
    void reply.header('ETag', etag);
    void reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');

    if (request.headers['if-none-match'] === etag) {
      void reply.status(304);
      return undefined;
    }

    return body;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/app-config/pilgrim-layout')
  public pilgrimLayout() {
    return this.appConfigService.getLayoutForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('admin/app-config/pilgrim-layout')
  public updatePilgrimLayout(
    @Body() dto: UpdatePilgrimLayoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appConfigService.updateLayout(dto.layout, user.id);
  }
}
