import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, ManualBookingBlock, Room, RoomType } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import {
  CreateRoomDto,
  CreateManualBookingDto,
  CreateRoomTypeDto,
  UpdateRoomDto,
  UpdateRoomStatusDto,
  UpdateRoomTypeDto,
} from './dto/room.dto';
import { RoomsService } from './rooms.service';

@Controller()
export class RoomsController {
  public constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/lodges/:lodgeId/room-types')
  public createRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
    @Body() dto: CreateRoomTypeDto,
  ): Promise<RoomType> {
    return this.roomsService.createRoomType(lodgeId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('owner/room-types/:id')
  public updateRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoomTypeDto,
  ): Promise<RoomType> {
    return this.roomsService.updateRoomType(id, dto, user);
  }

  @Get('lodges/:lodgeId/room-types')
  public listPublicRoomTypes(@Param('lodgeId') lodgeId: string): Promise<RoomType[]> {
    return this.roomsService.listPublicRoomTypes(lodgeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/room-types/:roomTypeId/rooms')
  public createRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomTypeId') roomTypeId: string,
    @Body() dto: CreateRoomDto,
  ): Promise<Room> {
    return this.roomsService.createRoom(roomTypeId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('owner/rooms/:id')
  public updateRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<Room> {
    return this.roomsService.updateRoom(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('owner/rooms/:id/status')
  public updateRoomStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ): Promise<Room> {
    return this.roomsService.updateRoomStatus(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/lodges/:lodgeId/rooms')
  public listLodgeRooms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
  ): Promise<Room[]> {
    return this.roomsService.listLodgeRooms(lodgeId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('owner/rooms/:id/manual-bookings')
  public createManualBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateManualBookingDto,
  ): Promise<ManualBookingBlock> {
    return this.roomsService.createManualBooking(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('owner/lodges/:lodgeId/manual-bookings')
  public listManualBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lodgeId') lodgeId: string,
  ): Promise<ManualBookingBlock[]> {
    return this.roomsService.listManualBookings(lodgeId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Delete('owner/manual-bookings/:id')
  public deleteManualBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ deleted: boolean }> {
    return this.roomsService.deleteManualBooking(id, user);
  }
}
