import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { AuditLogService } from '../../shared/audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

import type { UpdateUserStatusDto, UserDirectoryQueryDto } from './dto/user-directory.dto';

const RECENT_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const NON_UPCOMING_STATUSES = new Set(['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW']);
const COMPLETED_STATUSES = new Set(['CHECKED_OUT', 'COMPLETED']);

@Injectable()
export class UserDirectoryService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  public async getStats() {
    const recentSince = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS);
    const [
      totalUsers,
      activeUsers,
      recentlyActiveUsers,
      pilgrimCount,
      ownerCount,
      adminCount,
      superAdminCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.user.count({
        where: { deletedAt: null, lastLoginAt: { gte: recentSince } },
      }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { has: 'PILGRIM' } } }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { has: 'OWNER' } } }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { has: 'ADMIN' } } }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { has: 'SUPER_ADMIN' } } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      recentlyActiveUsers,
      byRole: {
        ADMIN: adminCount,
        OWNER: ownerCount,
        PILGRIM: pilgrimCount,
        SUPER_ADMIN: superAdminCount,
      },
    };
  }

  public async listUsers(query: UserDirectoryQueryDto) {
    const pagination = normalizePagination(query.page, query.limit);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.role) where.roles = { has: query.role };
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;

    const term = query.q?.trim();
    if (term && term.length >= 2) {
      where.OR = [
        { displayName: { contains: term, mode: 'insensitive' } },
        { phoneNumber: { contains: term } },
        { authIdentities: { some: { email: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const [users, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: { _count: { select: { pilgrimBookings: true } }, authIdentities: true },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.user.count({ where }),
    ]);

    const recentSince = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS);
    const items = users.map((user) => ({
      createdAt: user.createdAt.toISOString(),
      displayName: user.displayName,
      email: user.authIdentities.map((identity) => identity.email).find(Boolean) ?? null,
      id: user.id,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      phoneNumber: user.phoneNumber,
      recentlyActive: Boolean(user.lastLoginAt && user.lastLoginAt >= recentSince),
      roles: user.roles,
      totalBookings: user._count.pilgrimBookings,
    }));

    return {
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  public async getUserDetail(id: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findFirst({
      include: {
        authIdentities: true,
        pilgrimBookings: {
          include: { lodge: true, room: true, roomType: true },
          orderBy: { checkInDate: 'desc' },
          where: { deletedAt: null },
        },
        sessions: { orderBy: { lastSeenAt: 'desc' }, take: 10 },
      },
      where: { deletedAt: null, id },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.auditLogService.create({
      action: 'ADMIN_USER_DIRECTORY_PROFILE_VIEWED',
      actorUserId: actor.id,
      entityId: id,
      entityType: 'user',
    });

    const now = new Date();
    const upcomingBookings = user.pilgrimBookings.filter(
      (booking) => booking.checkOutDate >= now && !NON_UPCOMING_STATUSES.has(booking.status),
    );
    const upcomingIds = new Set(upcomingBookings.map((booking) => booking.id));
    const pastBookings = user.pilgrimBookings.filter((booking) => !upcomingIds.has(booking.id));

    const completedBookings = user.pilgrimBookings.filter((booking) =>
      COMPLETED_STATUSES.has(booking.status),
    ).length;
    const cancelledBookings = user.pilgrimBookings.filter(
      (booking) => booking.status === 'CANCELLED',
    ).length;
    const totalBookingValue = user.pilgrimBookings
      .reduce((sum, booking) => sum + Number(booking.totalAmount ?? 0), 0)
      .toFixed(2);

    const mapBooking = (booking: (typeof user.pilgrimBookings)[number]) => ({
      bookingCode: booking.bookingCode,
      checkInDate: booking.checkInDate.toISOString().slice(0, 10),
      checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
      guestEmail: booking.guestEmail,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      id: booking.id,
      lodge: { id: booking.lodge.id, name: booking.lodge.name },
      numberOfAdults: booking.numberOfAdults,
      numberOfChildren: booking.numberOfChildren,
      paymentStatus: booking.paymentStatus,
      roomNumber: booking.room?.roomNumber ?? null,
      roomType: { id: booking.roomType.id, name: booking.roomType.name },
      status: booking.status,
      totalAmount: booking.totalAmount?.toString() ?? null,
      totalGuests: booking.totalGuests,
      updatedAt: booking.updatedAt.toISOString(),
    });

    return {
      createdAt: user.createdAt.toISOString(),
      displayName: user.displayName,
      email: user.authIdentities.map((identity) => identity.email).find(Boolean) ?? null,
      id: user.id,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      pastBookings: pastBookings.map(mapBooking),
      phoneNumber: user.phoneNumber,
      roles: user.roles,
      sessions: user.sessions.map((session) => ({
        appType: session.appType,
        deviceName: session.deviceName,
        id: session.id,
        ipAddress: session.ipAddress,
        isActive: session.isActive,
        lastSeenAt: session.lastSeenAt.toISOString(),
        platform: session.platform,
      })),
      stats: {
        cancelledBookings,
        completedBookings,
        totalBookingValue,
        totalBookings: user.pilgrimBookings.length,
        upcomingBookings: upcomingBookings.length,
      },
      updatedAt: user.updatedAt.toISOString(),
      upcomingBookings: upcomingBookings.map(mapBooking),
    };
  }

  public async updateStatus(id: string, dto: UpdateUserStatusDto, actor: AuthenticatedUser) {
    if (id === actor.id) {
      throw new BadRequestException('You cannot change your own account status');
    }
    if (!dto.reason.trim()) {
      throw new BadRequestException('A reason is required');
    }

    const user = await this.prisma.user.findFirst({ where: { deletedAt: null, id } });
    if (!user) throw new NotFoundException('User not found');
    if (!dto.isActive && user.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException('Super admin accounts cannot be suspended here');
    }
    if (user.isActive === dto.isActive) {
      return { id: user.id, isActive: user.isActive };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({ data: { isActive: dto.isActive }, where: { id } });
      if (!dto.isActive) {
        await tx.refreshToken.updateMany({
          data: { revokedAt: new Date() },
          where: { revokedAt: null, userId: id },
        });
        await tx.userSession.updateMany({
          data: { isActive: false, lastSeenAt: new Date() },
          where: { isActive: true, userId: id },
        });
      }
      return result;
    });

    await this.auditLogService.create({
      action: dto.isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_SUSPENDED',
      actorUserId: actor.id,
      entityId: id,
      entityType: 'user',
      metadata: { reason: dto.reason.trim() },
    });

    return { id: updated.id, isActive: updated.isActive };
  }
}
