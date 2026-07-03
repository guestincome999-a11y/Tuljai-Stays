import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto,
  ListAnnouncementsQueryDto,
  ListNotificationsQueryDto,
  UpdateAnnouncementDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  public constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  public listNotifications(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.listForUser(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications/unread-count')
  public unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications/:id/read')
  public markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications/read-all')
  public markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('notifications/:id')
  public deleteNotification(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.softDelete(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/announcements')
  public createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcementsService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('announcements')
  public listAnnouncements(
    @Query() query: ListAnnouncementsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcementsService.listVisible(query, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('announcements/:id/read')
  public markAnnouncementRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.markRead(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/announcements/:id')
  public updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcementsService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('admin/announcements/:id')
  public deleteAnnouncement(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.softDelete(id, user);
  }
}
