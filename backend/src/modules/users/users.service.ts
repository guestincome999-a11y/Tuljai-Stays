import { Injectable } from '@nestjs/common';
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
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { phoneNumber: { contains: search } },
              { authIdentities: { some: { email: { contains: search, mode: 'insensitive' } } } },
              { pilgrimBookings: { some: { bookingCode: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [users, totalItems] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          displayName: true,
          phoneNumber: true,
          createdAt: true,
          lastLoginAt: true,
          authIdentities: { select: { email: true }, take: 1 },
          pilgrimBookings: {
            where: { deletedAt: null },
            select: { id: true, bookingCode: true, status: true, totalAmount: true, createdAt: true, lodge: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          _count: { select: { pilgrimBookings: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      email: user.authIdentities[0]?.email ?? null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      bookingCount: user._count.pilgrimBookings,
      totalBookingValue: user.pilgrimBookings.reduce((sum, booking) => sum + Number(booking.totalAmount ?? 0), 0),
      recentBookings: user.pilgrimBookings.map((booking) => ({
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        totalAmount: Number(booking.totalAmount ?? 0),
        createdAt: booking.createdAt,
        lodgeName: booking.lodge.name,
      })),
    }));

    return { items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
  }
}
