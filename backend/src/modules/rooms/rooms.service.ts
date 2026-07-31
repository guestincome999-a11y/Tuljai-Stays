import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser, Room, RoomType } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { isOperationalRoomStatusTransition } from '../notifications/notification-policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import type {
  CreateRoomDto,
  CreateRoomTypeDto,
  UpdateRoomDto,
  UpdateRoomStatusDto,
  UpdateRoomTypeDto,
} from './dto/room.dto';

@Injectable()
export class RoomsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  public async createRoomType(
    lodgeId: string,
    dto: CreateRoomTypeDto,
    user: AuthenticatedUser,
  ): Promise<RoomType> {
    await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);
    const roomType = await this.prisma.roomType.create({
      data: {
        basePrice: dto.basePrice,
        capacityAdults: dto.capacityAdults,
        capacityChildren: dto.capacityChildren,
        description: dto.description,
        festivalPrice: dto.festivalPrice,
        lodgeId,
        name: dto.name,
        slug: dto.slug,
        totalRooms: dto.totalRooms,
      },
    });
    await this.auditLogService.create({
      action: 'ROOM_TYPE_CREATED',
      actorUserId: user.id,
      entityId: roomType.id,
      entityType: 'room_type',
    });

    return this.toRoomType(roomType);
  }

  public async updateRoomType(
    id: string,
    dto: UpdateRoomTypeDto,
    user: AuthenticatedUser,
  ): Promise<RoomType> {
    const existing = await this.prisma.roomType.findFirst({ where: { deletedAt: null, id } });

    if (!existing) {
      throw new NotFoundException('Room type not found');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);
    const roomType = await this.prisma.roomType.update({
      data: dto,
      where: { id },
    });
    await this.auditLogService.create({
      action: 'ROOM_TYPE_UPDATED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'room_type',
    });

    return this.toRoomType(roomType);
  }

  public async listPublicRoomTypes(lodgeId: string): Promise<RoomType[]> {
    const roomTypes = await this.prisma.roomType.findMany({
      orderBy: { name: 'asc' },
      where: {
        deletedAt: null,
        isActive: true,
        lodge: {
          deletedAt: null,
          isActive: true,
          id: lodgeId,
          status: 'VERIFIED',
          verificationStatus: 'VERIFIED',
        },
        rooms: {
          some: {
            deletedAt: null,
            isActive: true,
            status: 'AVAILABLE',
          },
        },
      },
    });

    return roomTypes.map((roomType) => this.toRoomType(roomType));
  }

  public async createRoom(
    roomTypeId: string,
    dto: CreateRoomDto,
    user: AuthenticatedUser,
  ): Promise<Room> {
    const roomType = await this.prisma.roomType.findFirst({
      where: { deletedAt: null, id: roomTypeId },
    });

    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, roomType.lodgeId);
    const room = await this.prisma.room.create({
      data: {
        floor: dto.floor,
        lodgeId: roomType.lodgeId,
        roomNumber: dto.roomNumber,
        roomTypeId,
      },
    });
    await this.auditLogService.create({
      action: 'ROOM_CREATED',
      actorUserId: user.id,
      entityId: room.id,
      entityType: 'room',
    });

    return this.toRoom(room);
  }

  public async updateRoom(id: string, dto: UpdateRoomDto, user: AuthenticatedUser): Promise<Room> {
    const existing = await this.prisma.room.findFirst({ where: { deletedAt: null, id } });

    if (!existing) {
      throw new NotFoundException('Room not found');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);
    const room = await this.prisma.room.update({ data: dto, where: { id } });

    return this.toRoom(room);
  }

  public async updateRoomStatus(
    id: string,
    dto: UpdateRoomStatusDto,
    user: AuthenticatedUser,
  ): Promise<Room> {
    const existing = await this.prisma.room.findFirst({ where: { deletedAt: null, id } });

    if (!existing) {
      throw new NotFoundException('Room not found');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, existing.lodgeId);
    const room = await this.prisma.room.update({
      data: { status: dto.status },
      where: { id },
    });
    await this.auditLogService.create({
      action: 'ROOM_STATUS_UPDATED',
      actorUserId: user.id,
      entityId: id,
      entityType: 'room',
      metadata: { status: dto.status },
    });
    this.realtimeEventsService.publishToLodge(room.lodgeId, 'room:status-updated', {
      blocked: room.status === 'BLOCKED',
      lodgeId: room.lodgeId,
      roomId: room.id,
      roomTypeId: room.roomTypeId,
      status: room.status,
      updatedAt: new Date().toISOString(),
    });
    this.realtimeEventsService.publishToLodge(room.lodgeId, 'room:availability-updated', {
      blocked: room.status === 'BLOCKED',
      lodgeId: room.lodgeId,
      roomId: room.id,
      roomTypeId: room.roomTypeId,
      status: room.status,
      updatedAt: new Date().toISOString(),
    });
    if (isOperationalRoomStatusTransition(existing.status, room.status)) {
      const ownerUserIds = (
        await this.prisma.lodgeOwner.findMany({
          select: { userId: true },
          where: {
            deletedAt: null,
            isActive: true,
            lodgeId: room.lodgeId,
            userId: { not: user.id },
          },
        })
      ).map((owner) => owner.userId);
      await this.notificationsService.createManyForUsers(ownerUserIds, {
        body:
          room.status === 'BLOCKED'
            ? `Room ${room.roomNumber} was blocked.`
            : room.status === 'MAINTENANCE'
              ? `Room ${room.roomNumber} requires maintenance.`
              : `Room ${room.roomNumber} returned to service.`,
        data: {
          blocked: room.status === 'BLOCKED',
          context: 'ROOM_ALERT',
          lodgeId: room.lodgeId,
          operationallyImportant: true,
          previousStatus: existing.status,
          roomId: room.id,
          roomTypeId: room.roomTypeId,
          status: room.status,
        },
        lodgeId: room.lodgeId,
        priority:
          room.status === 'BLOCKED' || room.status === 'MAINTENANCE'
            ? 'HIGH'
            : 'NORMAL',
        recipientRole: 'OWNER',
        title:
          room.status === 'BLOCKED'
            ? 'Room blocked'
            : room.status === 'MAINTENANCE'
              ? 'Room maintenance alert'
              : 'Room available again',
        type: 'SYSTEM',
      });
    }

    return this.toRoom(room);
  }

  public async listLodgeRooms(lodgeId: string, user: AuthenticatedUser): Promise<Room[]> {
    await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);
    const rooms = await this.prisma.room.findMany({
      orderBy: [{ roomNumber: 'asc' }],
      where: { deletedAt: null, lodgeId },
    });

    return rooms.map((room) => this.toRoom(room));
  }

  private toRoomType(roomType: {
    basePrice: { toString(): string };
    capacityAdults: number;
    capacityChildren: number;
    description: string | null;
    festivalPrice: { toString(): string } | null;
    id: string;
    isActive: boolean;
    lodgeId: string;
    name: string;
    slug: string;
    totalRooms: number;
  }): RoomType {
    return {
      basePrice: roomType.basePrice.toString(),
      capacityAdults: roomType.capacityAdults,
      capacityChildren: roomType.capacityChildren,
      description: roomType.description,
      festivalPrice: roomType.festivalPrice?.toString() ?? null,
      id: roomType.id,
      isActive: roomType.isActive,
      lodgeId: roomType.lodgeId,
      name: roomType.name,
      slug: roomType.slug,
      totalRooms: roomType.totalRooms,
    };
  }

  private toRoom(room: {
    floor: string | null;
    id: string;
    isActive: boolean;
    lodgeId: string;
    roomNumber: string;
    roomTypeId: string;
    status: Room['status'];
  }): Room {
    return {
      floor: room.floor,
      id: room.id,
      isActive: room.isActive,
      lodgeId: room.lodgeId,
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      status: room.status,
    };
  }
}
