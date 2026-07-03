import { Injectable } from '@nestjs/common';
import type {
  AdminDashboardSummary,
  AuthenticatedUser,
  BookingReportRow,
  CommissionSummary,
  NotificationMetrics,
  OwnerDashboardSummary,
  PaginatedResponse,
  PilgrimProfileSummary,
  PresenceSummary,
} from '@tuljai/types';
import { normalizePagination } from '@tuljai/utils';

import { Prisma } from '../../../generated/prisma';
import { AuditLogService } from '../../shared/audit/audit-log.service';
import { LodgeAccessService } from '../lodges/lodge-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

import type { ReportQueryDto } from './dto/operations.dto';

@Injectable()
export class OperationsService {
  public constructor(
    private readonly auditLogService: AuditLogService,
    private readonly lodgeAccessService: LodgeAccessService,
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  public async adminDashboardSummary(): Promise<AdminDashboardSummary> {
    const today = this.todayRange();
    const presence = this.realtimeEventsService.getPresenceSummary();
    const [
      totalUsers,
      totalPilgrims,
      totalOwners,
      totalLodges,
      verifiedLodges,
      pendingLodgeApprovals,
      pendingPhotoApprovals,
      totalBookings,
      pendingBookings,
      acceptedBookings,
      checkedInBookings,
      checkedOutBookings,
      completedBookings,
      cancelledBookings,
      availableRooms,
      occupiedRooms,
      todayBookings,
      todayCheckIns,
      todayCheckOuts,
      failedNotifications,
      commission,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { has: 'PILGRIM' } } }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { has: 'OWNER' } } }),
      this.prisma.lodge.count({ where: { deletedAt: null } }),
      this.prisma.lodge.count({ where: { deletedAt: null, status: 'VERIFIED' } }),
      this.prisma.lodge.count({ where: { deletedAt: null, verificationStatus: 'PENDING' } }),
      this.prisma.lodgePhoto.count({ where: { deletedAt: null, approvalStatus: 'PENDING' } }),
      this.prisma.booking.count({ where: { deletedAt: null } }),
      this.prisma.booking.count({ where: { deletedAt: null, status: 'PENDING_OWNER_APPROVAL' } }),
      this.prisma.booking.count({ where: { deletedAt: null, status: 'ACCEPTED' } }),
      this.prisma.booking.count({ where: { deletedAt: null, status: 'CHECKED_IN' } }),
      this.prisma.booking.count({ where: { deletedAt: null, status: 'CHECKED_OUT' } }),
      this.prisma.booking.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { deletedAt: null, status: 'CANCELLED' } }),
      this.prisma.room.count({ where: { deletedAt: null, status: 'AVAILABLE' } }),
      this.prisma.room.count({ where: { deletedAt: null, status: 'OCCUPIED' } }),
      this.prisma.booking.count({ where: { createdAt: today, deletedAt: null } }),
      this.prisma.booking.count({ where: { checkedInAt: today, deletedAt: null } }),
      this.prisma.booking.count({ where: { checkedOutAt: today, deletedAt: null } }),
      this.prisma.notificationDeliveryLog.count({ where: { status: 'FAILED' } }),
      this.prisma.booking.aggregate({
        _sum: { commissionAmount: true },
        where: { deletedAt: null },
      }),
    ]);

    return {
      acceptedBookings,
      availableRooms,
      cancelledBookings,
      checkedInBookings,
      checkedOutBookings,
      completedBookings,
      failedNotifications,
      liveOwnersOnline: presence.onlineOwners,
      occupiedRooms,
      pendingBookings,
      pendingLodgeApprovals,
      pendingPhotoApprovals,
      todayBookings,
      todayCheckIns,
      todayCheckOuts,
      totalBookings,
      totalCommissionEstimate: commission._sum.commissionAmount?.toString() ?? '0',
      totalLodges,
      totalOwners,
      totalPilgrims,
      totalUsers,
      unreadSupportTickets: 0,
      verifiedLodges,
    };
  }

  public async ownerDashboardSummary(user: AuthenticatedUser): Promise<OwnerDashboardSummary> {
    const lodgeIds = await this.getOwnerLodgeIds(user);
    const today = this.todayRange();
    const where = { deletedAt: null, lodgeId: { in: lodgeIds } } satisfies Prisma.BookingWhereInput;
    const [revenue, commission, rating, recentNotifications] = await Promise.all([
      this.prisma.booking.aggregate({ _sum: { totalAmount: true }, where }),
      this.prisma.booking.aggregate({ _sum: { commissionAmount: true }, where }),
      this.prisma.review.aggregate({
        _avg: { rating: true },
        where: { deletedAt: null, lodgeId: { in: lodgeIds }, status: 'PUBLISHED' },
      }),
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        where: { deletedAt: null, recipientUserId: user.id },
      }),
    ]);

    return {
      acceptedBookings: await this.prisma.booking.count({
        where: { ...where, status: 'ACCEPTED' },
      }),
      availableRooms: await this.prisma.room.count({
        where: { deletedAt: null, lodgeId: { in: lodgeIds }, status: 'AVAILABLE' },
      }),
      averageRating: rating._avg.rating,
      checkedInGuests: await this.prisma.booking.count({
        where: { ...where, status: 'CHECKED_IN' },
      }),
      estimatedCommission: commission._sum.commissionAmount?.toString() ?? '0',
      estimatedRevenue: revenue._sum.totalAmount?.toString() ?? '0',
      lodgesManaged: lodgeIds.length,
      occupiedRooms: await this.prisma.room.count({
        where: { deletedAt: null, lodgeId: { in: lodgeIds }, status: 'OCCUPIED' },
      }),
      pendingBookings: await this.prisma.booking.count({
        where: { ...where, status: 'PENDING_OWNER_APPROVAL' },
      }),
      pendingPhotoApprovals: await this.prisma.lodgePhoto.count({
        where: { deletedAt: null, lodgeId: { in: lodgeIds }, approvalStatus: 'PENDING' },
      }),
      recentNotifications,
      roomsUnderMaintenance: await this.prisma.room.count({
        where: { deletedAt: null, lodgeId: { in: lodgeIds }, status: 'MAINTENANCE' },
      }),
      todayBookings: await this.prisma.booking.count({ where: { ...where, createdAt: today } }),
      todayCheckOuts: await this.prisma.booking.count({ where: { ...where, checkedOutAt: today } }),
    };
  }

  public async pilgrimProfileSummary(user: AuthenticatedUser): Promise<PilgrimProfileSummary> {
    const now = new Date();
    return {
      cancelledBookings: await this.prisma.booking.count({
        where: { deletedAt: null, pilgrimUserId: user.id, status: 'CANCELLED' },
      }),
      completedBookings: await this.prisma.booking.count({
        where: {
          deletedAt: null,
          pilgrimUserId: user.id,
          status: { in: ['CHECKED_OUT', 'COMPLETED'] },
        },
      }),
      reviewsSubmitted: await this.prisma.review.count({
        where: { deletedAt: null, pilgrimUserId: user.id },
      }),
      unreadAnnouncements: await this.prisma.announcement.count({
        where: { deletedAt: null, isActive: true, reads: { none: { userId: user.id } } },
      }),
      unreadNotifications: await this.prisma.notification.count({
        where: { deletedAt: null, readAt: null, recipientUserId: user.id },
      }),
      upcomingBookings: await this.prisma.booking.count({
        where: {
          checkInDate: { gte: now },
          deletedAt: null,
          pilgrimUserId: user.id,
          status: { in: ['ACCEPTED', 'QR_GENERATED'] },
        },
      }),
    };
  }

  public async bookingReport(
    query: ReportQueryDto,
    actorUserId: string,
  ): Promise<PaginatedResponse<BookingReportRow>> {
    await this.auditLogService.create({
      action: 'ADMIN_BOOKING_REPORT_VIEWED',
      actorUserId,
      entityType: 'report',
    });
    return this.listBookingReport(query);
  }

  public async ownerBookingReport(
    query: ReportQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<BookingReportRow>> {
    const lodgeIds = await this.getOwnerLodgeIds(user);
    return this.listBookingReport({ ...query, lodgeId: query.lodgeId }, lodgeIds);
  }

  public async commissionReport(
    query: ReportQueryDto,
    lodgeIds?: string[],
  ): Promise<CommissionSummary[]> {
    const where = this.buildBookingWhere(query, lodgeIds);
    const bookings = await this.prisma.booking.groupBy({
      by: ['lodgeId'],
      _count: { id: true },
      _sum: { commissionAmount: true },
      where,
    });

    return bookings.map((item) => ({
      bookingCount: item._count.id,
      commissionTotal: item._sum.commissionAmount?.toString() ?? '0',
      lodgeId: item.lodgeId,
    }));
  }

  public async notificationMetrics(): Promise<NotificationMetrics> {
    const [
      totalNotifications,
      sentCount,
      failedCount,
      deliveredCount,
      readCount,
      invalidDeviceTokens,
      recentFailures,
    ] = await Promise.all([
      this.prisma.notification.count({ where: { deletedAt: null } }),
      this.prisma.notificationDeliveryLog.count({ where: { status: 'SENT' } }),
      this.prisma.notificationDeliveryLog.count({ where: { status: 'FAILED' } }),
      this.prisma.notificationDeliveryLog.count({ where: { status: 'DELIVERED' } }),
      this.prisma.notification.count({ where: { deletedAt: null, readAt: { not: null } } }),
      this.prisma.deviceToken.count({ where: { isActive: false } }),
      this.prisma.notificationDeliveryLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        where: { status: 'FAILED' },
      }),
    ]);

    return {
      deliveredCount,
      failedCount,
      failureRate: totalNotifications === 0 ? 0 : failedCount / totalNotifications,
      invalidDeviceTokens,
      readCount,
      recentFailures: recentFailures.map((failure) => ({
        failureReason: failure.failureReason,
        notificationId: failure.notificationId,
      })),
      sentCount,
      totalNotifications,
    };
  }

  public presenceSummary(): PresenceSummary {
    return this.realtimeEventsService.getPresenceSummary();
  }

  private buildBookingWhere(query: ReportQueryDto, lodgeIds?: string[]): Prisma.BookingWhereInput {
    return {
      deletedAt: null,
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.lodgeId
        ? { lodgeId: query.lodgeId }
        : lodgeIds
          ? { lodgeId: { in: lodgeIds } }
          : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              gte: query.startDate ? new Date(query.startDate) : undefined,
              lte: query.endDate ? new Date(query.endDate) : undefined,
            },
          }
        : {}),
    };
  }

  private async getOwnerLodgeIds(user: AuthenticatedUser): Promise<string[]> {
    if (this.lodgeAccessService.isAdmin(user)) {
      const lodges = await this.prisma.lodge.findMany({
        select: { id: true },
        where: { deletedAt: null },
      });
      return lodges.map((lodge) => lodge.id);
    }
    const owners = await this.prisma.lodgeOwner.findMany({
      select: { lodgeId: true },
      where: { deletedAt: null, isActive: true, userId: user.id },
    });
    return owners.map((owner) => owner.lodgeId);
  }

  private async listBookingReport(
    query: ReportQueryDto,
    lodgeIds?: string[],
  ): Promise<PaginatedResponse<BookingReportRow>> {
    const pagination = normalizePagination(query.page, query.limit);
    const where = this.buildBookingWhere(query, lodgeIds);
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        where,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: items.map((booking) => ({
        bookingCode: booking.bookingCode,
        checkInDate: booking.checkInDate.toISOString().slice(0, 10),
        checkOutDate: booking.checkOutDate.toISOString().slice(0, 10),
        commissionAmount: booking.commissionAmount?.toString() ?? null,
        guestName: booking.guestName,
        lodgeId: booking.lodgeId,
        status: booking.status,
        totalAmount: booking.totalAmount?.toString() ?? null,
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
    };
  }

  private todayRange(): { gte: Date; lt: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { gte: start, lt: end };
  }
}
