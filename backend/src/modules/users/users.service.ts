import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { AdminUsersQueryDto } from './dto/admin-users.dto';

@Injectable()
export class UsersService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listAdminUsers(query: AdminUsersQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: { has: 'PILGRIM' },
      ...(search ? { OR: [
        { displayName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { authIdentities: { some: { email: { contains: search, mode: 'insensitive' } } } },
        { pilgrimBookings: { some: { bookingCode: { contains: search, mode: 'insensitive' } } } },
      ] } : {}),
    };

    const [users, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, displayName: true, phoneNumber: true, createdAt: true, lastLoginAt: true,
          authIdentities: { select: { email: true }, take: 1 },
          pilgrimBookings: {
            where: { deletedAt: null },
            select: { id: true, bookingCode: true, status: true, totalAmount: true, createdAt: true, lodge: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }, take: 5,
          },
          _count: { select: { pilgrimBookings: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);
    const totals = userIds.length === 0 ? [] : await this.prisma.booking.groupBy({
      by: ['pilgrimUserId'],
      where: { deletedAt: null, pilgrimUserId: { in: userIds } },
      _sum: { totalAmount: true },
    });
    const totalByUser = new Map(totals.map((item) => [item.pilgrimUserId, Number(item._sum.totalAmount ?? 0)]));

    const items = users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      email: user.authIdentities[0]?.email ?? null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      bookingCount: user._count.pilgrimBookings,
      totalBookingValue: totalByUser.get(user.id) ?? 0,
      recentBookings: user.pilgrimBookings.map((booking) => ({
        id: booking.id, bookingCode: booking.bookingCode, status: booking.status,
        totalAmount: Number(booking.totalAmount ?? 0), createdAt: booking.createdAt, lodgeName: booking.lodge.name,
      })),
    }));

    return { items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
  }

  public async getAdminUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, roles: { has: 'PILGRIM' } },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        createdAt: true,
        lastLoginAt: true,
        isActive: true,
        authIdentities: { select: { provider: true, email: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        pilgrimBookings: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bookingCode: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            totalAmount: true,
            commissionAmount: true,
            checkInDate: true,
            checkOutDate: true,
            createdAt: true,
            lodge: { select: { id: true, name: true } },
            roomType: { select: { id: true, name: true, basePrice: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const totalBookingValue = user.pilgrimBookings.reduce((sum, booking) => sum + Number(booking.totalAmount ?? 0), 0);
    const totalCommission = user.pilgrimBookings.reduce((sum, booking) => sum + Number(booking.commissionAmount ?? 0), 0);

    return {
      id: user.id,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
      identities: user.authIdentities,
      bookingCount: user.pilgrimBookings.length,
      totalBookingValue,
      totalCommission,
      bookings: user.pilgrimBookings.map((booking) => ({
        ...booking,
        totalAmount: Number(booking.totalAmount ?? 0),
        commissionAmount: Number(booking.commissionAmount ?? 0),
        roomType: booking.roomType ? { ...booking.roomType, basePrice: Number(booking.roomType.basePrice) } : null,
      })),
    };
  }
}
