import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser, ManualBookingBlock, Room, RoomType } from '@tuljai/types';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { BookingAvailabilityService } from '../bookings/booking-availability.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { isOperationalRoomStatusTransition } from '../notifications/notification-policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import type {
  CreateRoomDto,
  CreateRoomTypeDto,
  CreateManualBookingDto,
  UpdateRoomDto,
  UpdateRoomStatusDto,
  UpdateRoomTypeDto,
} from './dto/room.dto';

const MANUAL_BOOKING_PREFIX = 'MANUAL_BOOKING:';

interface ManualBookingMetadata {
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  createdAt: string;
  guestName: string;
  guestPhone: string;
  notes: string | null;
  source: 'OWNER_OFFLINE_BOOKING';
}

@Injectable()
export class RoomsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
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
        priority: room.status === 'BLOCKED' || room.status === 'MAINTENANCE' ? 'HIGH' : 'NORMAL',
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

  public async createManualBooking(
    roomId: string,
    dto: CreateManualBookingDto,
    user: AuthenticatedUser,
  ): Promise<ManualBookingBlock> {
    const room = await this.prisma.room.findFirst({
      where: { deletedAt: null, id: roomId, isActive: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, room.lodgeId);
    const { checkInDate, checkOutDate } = this.bookingAvailabilityService.parseDateRange(
      dto.checkInDate,
      dto.checkOutDate,
    );
    const roomTypeAvailability = await this.bookingAvailabilityService.getAvailability(
      room.lodgeId,
      room.roomTypeId,
      dto.checkInDate,
      dto.checkOutDate,
    );
    const roomIsAvailable = await this.bookingAvailabilityService.isRoomAvailable({
      checkInDate,
      checkOutDate,
      roomId,
    });

    if (!roomTypeAvailability.available || !roomIsAvailable) {
      throw new ConflictException('This room is already booked or blocked for the selected dates');
    }

    const metadata: ManualBookingMetadata = {
      bookingId: randomUUID(),
      checkInDate: dto.checkInDate.slice(0, 10),
      checkOutDate: dto.checkOutDate.slice(0, 10),
      createdAt: new Date().toISOString(),
      guestName: dto.guestName.trim(),
      guestPhone: dto.guestPhone,
      notes: dto.notes?.trim() || null,
      source: 'OWNER_OFFLINE_BOOKING',
    };
    const reason = `${MANUAL_BOOKING_PREFIX}${JSON.stringify(metadata)}`;

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        this.getStayDates(checkInDate, checkOutDate).map((date) =>
          tx.roomAvailability.upsert({
            create: { date, reason, roomId, status: 'RESERVED' },
            update: { reason, status: 'RESERVED' },
            where: { roomId_date: { date, roomId } },
          }),
        ),
      );
    });
    await this.auditLogService.create({
      action: 'OWNER_MANUAL_BOOKING_CREATED',
      actorUserId: user.id,
      entityId: metadata.bookingId,
      entityType: 'manual_booking',
      metadata: {
        checkInDate: metadata.checkInDate,
        checkOutDate: metadata.checkOutDate,
        lodgeId: room.lodgeId,
        roomId,
      },
    });
    this.publishManualAvailability(room.lodgeId, room.id, room.roomTypeId, metadata, false);

    return this.toManualBooking(metadata, room);
  }

  public async listManualBookings(
    lodgeId: string,
    user: AuthenticatedUser,
  ): Promise<ManualBookingBlock[]> {
    await this.lodgeAccessService.assertCanManageLodge(user, lodgeId);
    const rows = await this.prisma.roomAvailability.findMany({
      include: { room: true },
      orderBy: { date: 'asc' },
      where: {
        reason: { startsWith: MANUAL_BOOKING_PREFIX },
        room: { deletedAt: null, lodgeId },
        status: 'RESERVED',
      },
    });
    const bookings = new Map<string, ManualBookingBlock>();

    for (const row of rows) {
      const metadata = this.parseManualBookingMetadata(row.reason);
      if (metadata && !bookings.has(metadata.bookingId)) {
        bookings.set(metadata.bookingId, this.toManualBooking(metadata, row.room));
      }
    }

    return [...bookings.values()].sort((left, right) =>
      left.checkInDate.localeCompare(right.checkInDate),
    );
  }

  public async deleteManualBooking(
    bookingId: string,
    user: AuthenticatedUser,
  ): Promise<{ deleted: boolean }> {
    const rows = await this.prisma.roomAvailability.findMany({
      include: { room: true },
      where: {
        reason: { contains: `\"bookingId\":\"${bookingId}\"`, startsWith: MANUAL_BOOKING_PREFIX },
        status: 'RESERVED',
      },
    });
    const row = rows.find(
      (candidate) => this.parseManualBookingMetadata(candidate.reason)?.bookingId === bookingId,
    );

    if (!row) {
      throw new NotFoundException('Manual booking not found');
    }

    const metadata = this.parseManualBookingMetadata(row.reason);
    if (!metadata) {
      throw new NotFoundException('Manual booking not found');
    }

    await this.lodgeAccessService.assertCanManageLodge(user, row.room.lodgeId);
    await this.prisma.roomAvailability.deleteMany({
      where: { reason: row.reason, roomId: row.roomId },
    });
    await this.auditLogService.create({
      action: 'OWNER_MANUAL_BOOKING_REMOVED',
      actorUserId: user.id,
      entityId: bookingId,
      entityType: 'manual_booking',
      metadata: { lodgeId: row.room.lodgeId, roomId: row.roomId },
    });
    this.publishManualAvailability(
      row.room.lodgeId,
      row.room.id,
      row.room.roomTypeId,
      metadata,
      true,
    );

    return { deleted: true };
  }

  private getStayDates(checkInDate: Date, checkOutDate: Date): Date[] {
    const dates: Date[] = [];

    for (
      let date = new Date(checkInDate);
      date < checkOutDate;
      date = new Date(date.getTime() + 86_400_000)
    ) {
      dates.push(date);
    }

    return dates;
  }

  private parseManualBookingMetadata(reason: string | null): ManualBookingMetadata | null {
    if (!reason?.startsWith(MANUAL_BOOKING_PREFIX)) {
      return null;
    }

    try {
      const metadata = JSON.parse(
        reason.slice(MANUAL_BOOKING_PREFIX.length),
      ) as Partial<ManualBookingMetadata>;
      return metadata.source === 'OWNER_OFFLINE_BOOKING' &&
        typeof metadata.bookingId === 'string' &&
        typeof metadata.checkInDate === 'string' &&
        typeof metadata.checkOutDate === 'string' &&
        typeof metadata.createdAt === 'string' &&
        typeof metadata.guestName === 'string' &&
        typeof metadata.guestPhone === 'string'
        ? (metadata as ManualBookingMetadata)
        : null;
    } catch {
      return null;
    }
  }

  private publishManualAvailability(
    lodgeId: string,
    roomId: string,
    roomTypeId: string,
    metadata: ManualBookingMetadata,
    released: boolean,
  ): void {
    const payload = {
      checkInDate: metadata.checkInDate,
      checkOutDate: metadata.checkOutDate,
      lodgeId,
      manualBookingId: metadata.bookingId,
      released,
      roomId,
      roomTypeId,
      updatedAt: new Date().toISOString(),
    };
    this.realtimeEventsService.publishToLodge(lodgeId, 'room:availability-updated', payload);
    this.realtimeEventsService.publishToRole('PILGRIM', 'lodge:catalog-updated', payload);
  }

  private toManualBooking(
    metadata: ManualBookingMetadata,
    room: { id: string; lodgeId: string; roomNumber: string; roomTypeId: string },
  ): ManualBookingBlock {
    return {
      checkInDate: metadata.checkInDate,
      checkOutDate: metadata.checkOutDate,
      createdAt: metadata.createdAt,
      guestName: metadata.guestName,
      guestPhone: metadata.guestPhone,
      id: metadata.bookingId,
      lodgeId: room.lodgeId,
      notes: metadata.notes,
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
    };
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
