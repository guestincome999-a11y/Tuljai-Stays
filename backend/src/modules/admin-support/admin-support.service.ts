import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import type { AdminBookingUpdateDto, AdminUserSearchQueryDto } from './dto/admin-support.dto';

@Injectable()
export class AdminSupportService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly prisma: PrismaService,
  ) {}

  public async searchUsers(query: AdminUserSearchQueryDto, actor: AuthenticatedUser) {
    const term = query.q.trim();
    if (term.length < 2) throw new BadRequestException('Enter at least 2 characters to search');
    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: { has: 'PILGRIM' },
      OR: [
        { displayName: { contains: term, mode: 'insensitive' } },
        { phoneNumber: { contains: term } },
        { authIdentities: { some: { email: { contains: term, mode: 'insensitive' } } } },
        { pilgrimBookings: { some: { bookingCode: { contains: term, mode: 'insensitive' } } } },
      ],
    };
    const [users, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: { authIdentities: true },
        orderBy: { updatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.user.count({ where }),
    ]);

    await this.auditLogService.create({
      action: 'ADMIN_USER_SEARCHED',
      actorUserId: actor.id,
      entityType: 'user_search',
      metadata: { queryLength: term.length, resultCount: users.length },
    });

    const items = await Promise.all(users.map((user) => this.toUserSummary(user.id, user.displayName, user.phoneNumber, user.authIdentities.map((identity) => identity.email).find(Boolean) ?? null, user.createdAt, user.lastLoginAt)));
    return {
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async getUser(id: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findFirst({
      include: {
        authIdentities: true,
        pilgrimBookings: {
          include: { city: true, lodge: true, roomType: true, room: true },
          orderBy: { createdAt: 'desc' },
          where: { deletedAt: null },
        },
      },
      where: { deletedAt: null, id },
    });
    if (!user || !user.roles.includes('PILGRIM')) throw new NotFoundException('Pilgrim not found');

    await this.auditLogService.create({
      action: 'ADMIN_USER_PROFILE_VIEWED',
      actorUserId: actor.id,
      entityId: id,
      entityType: 'user',
    });

    const totalAmount = user.pilgrimBookings.reduce((sum, booking) => sum + Number(booking.totalAmount ?? 0), 0);
    const completed = user.pilgrimBookings.filter((booking) => ['CHECKED_OUT', 'COMPLETED'].includes(booking.status)).length;
    const cancelled = user.pilgrimBookings.filter((booking) => booking.status === 'CANCELLED').length;

    return {
      id: user.id,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      email: user.authIdentities.map((identity) => identity.email).find(Boolean) ?? null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      stats: {
        totalBookings: user.pilgrimBookings.length,
        completedBookings: completed,
        cancelledBookings: cancelled,
        totalBookingValue: totalAmount.toFixed(2),
      },
      bookings: user.pilgrimBookings.map((booking) => ({
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        guestName: booking.guestName,
        guestPhone: booking.guestPhone,
        guestEmail: booking.guestEmail,
        numberOfAdults: booking.numberOfAdults,
        numberOfChildren: booking.numberOfChildren,
        totalGuests: booking.totalGuests,
        checkInDate: booking.checkInDate.toISOString().slice(0, 10),
        checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
        totalAmount: booking.totalAmount?.toString() ?? null,
        lodge: { id: booking.lodge.id, name: booking.lodge.name },
        roomType: { id: booking.roomType.id, name: booking.roomType.name },
        roomNumber: booking.room?.roomNumber ?? null,
        updatedAt: booking.updatedAt.toISOString(),
      })),
    };
  }

  public async updateBooking(userId: string, bookingId: string, dto: AdminBookingUpdateDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.booking.findFirst({
      include: { lodge: { include: { owners: { where: { deletedAt: null, isActive: true } } } }, roomType: true, room: true },
      where: { deletedAt: null, id: bookingId, pilgrimUserId: userId },
    });
    if (!existing) throw new NotFoundException('Booking not found for this pilgrim');
    if (['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(existing.status)) {
      throw new BadRequestException('This booking can no longer be edited through support');
    }
    if (!dto.notes.trim()) throw new BadRequestException('Support notes are required');

    const checkInDate = dto.checkInDate ? this.parseDate(dto.checkInDate) : existing.checkInDate;
    const checkOutDate = dto.checkOutDate ? this.parseDate(dto.checkOutDate) : existing.checkOutDate;
    if (checkInDate >= checkOutDate) throw new BadRequestException('Check-out date must be after check-in date');
    if (checkInDate < this.startOfToday()) throw new BadRequestException('Check-in date cannot be in the past');

    const adults = dto.numberOfAdults ?? existing.numberOfAdults;
    const children = dto.numberOfChildren ?? existing.numberOfChildren;
    if (adults > existing.roomType.capacityAdults || children > existing.roomType.capacityChildren) {
      throw new BadRequestException('Guest count exceeds room capacity');
    }

    if (existing.roomId) {
      const conflict = await this.prisma.booking.findFirst({
        where: {
          checkInDate: { lt: checkOutDate },
          checkOutDate: { gt: checkInDate },
          deletedAt: null,
          id: { not: existing.id },
          roomId: existing.roomId,
          status: { in: ['PENDING_OWNER_APPROVAL', 'ACCEPTED', 'QR_GENERATED', 'CHECKED_IN'] },
        },
      });
      if (conflict) throw new ConflictException('The assigned room is unavailable for the requested dates');
    }

    const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000));
    const totalAmount = existing.roomType.basePrice.mul(nights);
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        data: {
          checkInDate,
          checkOutDate,
          guestAddress: dto.guestAddress === undefined ? existing.guestAddress : dto.guestAddress?.trim() || null,
          guestEmail: dto.guestEmail === undefined ? existing.guestEmail : dto.guestEmail.trim() || null,
          guestName: dto.guestName?.trim() || existing.guestName,
          guestPhone: dto.guestPhone || existing.guestPhone,
          numberOfAdults: adults,
          numberOfChildren: children,
          specialRequest: dto.specialRequest === undefined ? existing.specialRequest : dto.specialRequest.trim() || null,
          totalAmount,
          totalGuests: adults + children,
        },
        include: { lodge: { include: { owners: { where: { deletedAt: null, isActive: true } } } } },
        where: { id: bookingId },
      });
      await tx.bookingHistory.create({
        data: {
          action: 'BOOKING_UPDATED_BY_ADMIN',
          actorUserId: actor.id,
          bookingId,
          fromStatus: existing.status,
          toStatus: existing.status,
          notes: dto.notes.trim(),
          metadata: {
            changedBySupport: true,
            previousCheckInDate: existing.checkInDate.toISOString().slice(0, 10),
            previousCheckOutDate: existing.checkOutDate.toISOString().slice(0, 10),
          },
        },
      });
      return booking;
    });

    await this.auditLogService.create({
      action: 'ADMIN_BOOKING_UPDATED_FOR_SUPPORT',
      actorUserId: actor.id,
      entityId: bookingId,
      entityType: 'booking',
      metadata: { userId, notes: dto.notes.trim() },
    });

    const payload = {
      bookingId: updated.id,
      bookingCode: updated.bookingCode,
      checkInDate: updated.checkInDate.toISOString().slice(0, 10),
      checkOutDate: updated.checkOutDate.toISOString().slice(0, 10),
      guestName: updated.guestName,
      numberOfAdults: updated.numberOfAdults,
      numberOfChildren: updated.numberOfChildren,
      totalGuests: updated.totalGuests,
      totalAmount: updated.totalAmount?.toString() ?? null,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      updatedAt: updated.updatedAt.toISOString(),
    };

    this.realtimeEventsService.publishToUser(userId, 'booking:updated', payload);
    this.realtimeEventsService.publishToRole('ADMIN', 'dashboard:update', { bookingId, type: 'booking:updated' });
    for (const owner of existing.lodge.owners) {
      this.realtimeEventsService.publishToUser(owner.userId, 'booking:updated', payload);
      await this.notificationsService.create({
        body: `Booking ${updated.bookingCode} was updated by Tuljai Stays support.`,
        bookingId,
        data: payload,
        lodgeId: updated.lodgeId,
        priority: 'HIGH',
        recipientRole: 'OWNER',
        recipientUserId: owner.userId,
        title: 'Booking updated',
        type: 'SYSTEM',
      });
    }
    await this.notificationsService.create({
      body: `Your booking ${updated.bookingCode} was updated by Tuljai Stays support.`,
      bookingId,
      data: payload,
      lodgeId: updated.lodgeId,
      priority: 'HIGH',
      recipientRole: 'PILGRIM',
      recipientUserId: userId,
      title: 'Booking updated',
      type: 'SYSTEM',
    });

    return payload;
  }

  private async toUserSummary(id: string, displayName: string | null, phoneNumber: string | null, email: string | null, createdAt: Date, lastLoginAt: Date | null) {
    const [totalBookings, completedBookings, totalValue] = await Promise.all([
      this.prisma.booking.count({ where: { deletedAt: null, pilgrimUserId: id } }),
      this.prisma.booking.count({ where: { deletedAt: null, pilgrimUserId: id, status: { in: ['CHECKED_OUT', 'COMPLETED'] } } }),
      this.prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { deletedAt: null, pilgrimUserId: id } }),
    ]);
    return {
      id,
      displayName,
      phoneNumber,
      email,
      createdAt: createdAt.toISOString(),
      lastLoginAt: lastLoginAt?.toISOString() ?? null,
      totalBookings,
      completedBookings,
      totalBookingValue: totalValue._sum.totalAmount?.toString() ?? '0',
    };
  }

  private parseDate(value: string): Date {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
    return date;
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
