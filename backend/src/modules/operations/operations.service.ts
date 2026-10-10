import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminBookingTrendPoint,
  AdminDashboardAlert,
  AdminDashboardInsights,
  AdminDashboardPeriod,
  AdminPendingAction,
  AdminDashboardKpis,
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

  public async adminDashboardKpis(): Promise<AdminDashboardKpis> {
    const today = this.todayRange();
    const yesterday = { gte: new Date(today.gte.getTime() - 24 * 60 * 60 * 1000), lt: today.gte };
    const alive = { deletedAt: null } as const;
    const collected = { AND: [this.commissionEligibleWhere], ...alive };
    const [
      totalBookings,
      bookingsToday,
      bookingsYesterday,
      totalRevenue,
      revenueToday,
      revenueYesterday,
      pendingBookings,
      pendingLodges,
      pendingPhotos,
      activeStays,
    ] = await Promise.all([
      this.prisma.booking.count({ where: alive }),
      this.prisma.booking.count({ where: { ...alive, createdAt: today } }),
      this.prisma.booking.count({ where: { ...alive, createdAt: yesterday } }),
      this.prisma.booking.aggregate({ _sum: { totalAmount: true }, where: collected }),
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { ...collected, createdAt: today },
      }),
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { ...collected, createdAt: yesterday },
      }),
      this.prisma.booking.count({ where: { ...alive, status: 'PENDING_OWNER_APPROVAL' } }),
      this.prisma.lodge.count({ where: { ...alive, verificationStatus: 'PENDING' } }),
      this.prisma.lodgePhoto.count({ where: { ...alive, approvalStatus: 'PENDING' } }),
      this.prisma.booking.count({ where: { ...alive, status: 'CHECKED_IN' } }),
    ]);
    return {
      activeStays,
      bookingsToday,
      bookingsYesterday,
      pendingOwnerActions: pendingBookings + pendingLodges + pendingPhotos,
      revenueToday: revenueToday._sum.totalAmount?.toString() ?? '0',
      revenueYesterday: revenueYesterday._sum.totalAmount?.toString() ?? '0',
      totalBookings,
      totalRevenue: totalRevenue._sum.totalAmount?.toString() ?? '0',
    };
  }

  public async adminBookingTrend(days = 7): Promise<AdminBookingTrendPoint[]> {
    const span = Math.min(Math.max(Math.trunc(days) || 7, 1), 90);
    const dayKey = (date: Date): string =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
    const points = new Map<string, { bookings: number; revenue: number }>();
    for (let offset = span - 1; offset >= 0; offset -= 1) {
      points.set(dayKey(new Date(Date.now() - offset * 24 * 60 * 60 * 1000)), {
        bookings: 0,
        revenue: 0,
      });
    }
    // Pull one extra day so IST day boundaries are fully covered, then bucket in IST.
    const since = new Date(Date.now() - (span + 1) * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.booking.findMany({
      select: { createdAt: true, paymentStatus: true, status: true, totalAmount: true },
      where: { createdAt: { gte: since }, deletedAt: null },
    });
    const collected = (row: (typeof rows)[number]): boolean =>
      row.paymentStatus === 'FULLY_PAID' ||
      (row.paymentStatus === 'PAY_AT_LODGE' &&
        ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(row.status));
    for (const row of rows) {
      const bucket = points.get(dayKey(row.createdAt));
      if (!bucket) continue;
      bucket.bookings += 1;
      if (collected(row)) bucket.revenue += Number(row.totalAmount ?? 0);
    }
    return [...points.entries()].map(([date, value]) => ({
      bookings: value.bookings,
      date,
      revenue: value.revenue.toFixed(2),
    }));
  }

  public async adminDashboardInsights(
    period: AdminDashboardPeriod = 'month',
  ): Promise<AdminDashboardInsights> {
    const since = this.periodStart(period);
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const staleBefore = new Date(now - 30 * 60 * 1000);
    const alive = { deletedAt: null } as const;
    const [
      rows,
      pendingBookingTotal,
      pendingBookings,
      pendingLodgeTotal,
      pendingLodges,
      pendingPhotoTotal,
      pendingPhotos,
      failedPayments,
      failedNotifications,
      staleBookings,
    ] = await Promise.all([
      this.prisma.booking.findMany({
        select: {
          commissionAmount: true,
          lodgeId: true,
          paymentStatus: true,
          status: true,
          totalAmount: true,
        },
        where: { ...alive, createdAt: { gte: since } },
      }),
      this.prisma.booking.count({ where: { ...alive, status: 'PENDING_OWNER_APPROVAL' } }),
      this.prisma.booking.findMany({
        orderBy: { createdAt: 'asc' },
        select: { bookingCode: true, createdAt: true, id: true, lodge: { select: { name: true } } },
        take: 5,
        where: { ...alive, status: 'PENDING_OWNER_APPROVAL' },
      }),
      this.prisma.lodge.count({ where: { ...alive, verificationStatus: 'PENDING' } }),
      this.prisma.lodge.findMany({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, id: true, name: true },
        take: 5,
        where: { ...alive, verificationStatus: 'PENDING' },
      }),
      this.prisma.lodgePhoto.count({ where: { ...alive, approvalStatus: 'PENDING' } }),
      this.prisma.lodgePhoto.findMany({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, id: true, lodge: { select: { name: true } } },
        take: 5,
        where: { ...alive, approvalStatus: 'PENDING' },
      }),
      this.prisma.booking.count({ where: { ...alive, paymentStatus: 'FAILED', updatedAt: { gte: dayAgo } } }),
      this.prisma.notificationDeliveryLog.count({ where: { createdAt: { gte: dayAgo }, status: 'FAILED' } }),
      this.prisma.booking.count({
        where: { ...alive, createdAt: { lt: staleBefore }, status: 'PENDING_OWNER_APPROVAL' },
      }),
    ]);

    const collected = (row: (typeof rows)[number]): boolean =>
      row.paymentStatus === 'FULLY_PAID' ||
      (row.paymentStatus === 'PAY_AT_LODGE' &&
        ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(row.status));
    let online = 0;
    let payAtLodge = 0;
    let commission = 0;
    const perLodge = new Map<string, { bookings: number; revenue: number }>();
    for (const row of rows) {
      const entry = perLodge.get(row.lodgeId) ?? { bookings: 0, revenue: 0 };
      entry.bookings += 1;
      if (collected(row)) {
        const amount = Number(row.totalAmount ?? 0);
        entry.revenue += amount;
        commission += Number(row.commissionAmount ?? 0);
        if (row.paymentStatus === 'FULLY_PAID') online += amount;
        else payAtLodge += amount;
      }
      perLodge.set(row.lodgeId, entry);
    }
    const topIds = [...perLodge.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue || b[1].bookings - a[1].bookings)
      .slice(0, 5)
      .map(([lodgeId]) => lodgeId);
    const lodgeNames = topIds.length
      ? await this.prisma.lodge.findMany({
          select: { id: true, name: true },
          where: { id: { in: topIds } },
        })
      : [];
    const nameById = new Map<string, string>(
      lodgeNames.map((lodge): [string, string] => [lodge.id, lodge.name]),
    );

    const pendingActions: AdminPendingAction[] = [
      ...pendingBookings.map((booking) => ({
        createdAt: booking.createdAt.toISOString(),
        href: `/admin/bookings/${booking.id}`,
        id: `booking-${booking.id}`,
        kind: 'BOOKING_APPROVAL' as const,
        subtitle: booking.lodge.name,
        title: `Booking ${booking.bookingCode} awaiting owner approval`,
      })),
      ...pendingLodges.map((lodge) => ({
        createdAt: lodge.createdAt.toISOString(),
        href: '/admin/verification',
        id: `lodge-${lodge.id}`,
        kind: 'LODGE_VERIFICATION' as const,
        subtitle: lodge.name,
        title: 'Lodge verification pending',
      })),
      ...pendingPhotos.map((photo) => ({
        createdAt: photo.createdAt.toISOString(),
        href: '/admin/photos',
        id: `photo-${photo.id}`,
        kind: 'PHOTO_APPROVAL' as const,
        subtitle: photo.lodge.name,
        title: 'Lodge photo awaiting review',
      })),
    ]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, 6);

    const alerts: AdminDashboardAlert[] = [];
    if (failedPayments > 0)
      alerts.push({
        detail: `${failedPayments} payment${failedPayments === 1 ? '' : 's'} failed in the last 24 hours`,
        href: '/admin/finance',
        id: 'failed-payments',
        severity: 'critical',
        title: 'Payment failures',
      });
    if (staleBookings > 0)
      alerts.push({
        detail: `${staleBookings} booking${staleBookings === 1 ? ' has' : 's have'} waited over 30 minutes for the owner`,
        href: '/admin/operations/intervention',
        id: 'stale-bookings',
        severity: 'warning',
        title: 'Owner response overdue',
      });
    if (pendingLodgeTotal > 0)
      alerts.push({
        detail: `${pendingLodgeTotal} lodge${pendingLodgeTotal === 1 ? '' : 's'} awaiting verification`,
        href: '/admin/verification',
        id: 'pending-lodges',
        severity: 'warning',
        title: 'Lodge verification pending',
      });
    if (failedNotifications > 0)
      alerts.push({
        detail: `${failedNotifications} notification${failedNotifications === 1 ? '' : 's'} failed to send in the last 24 hours`,
        href: '/admin/notifications-monitor',
        id: 'failed-notifications',
        severity: 'info',
        title: 'Notification delivery issues',
      });

    return {
      alerts,
      pendingActionTotal: pendingBookingTotal + pendingLodgeTotal + pendingPhotoTotal,
      pendingActions,
      revenueSummary: {
        bookingCount: rows.length,
        commission: commission.toFixed(2),
        online: online.toFixed(2),
        payAtLodge: payAtLodge.toFixed(2),
        period,
        total: (online + payAtLodge).toFixed(2),
      },
      topLodges: topIds.map((lodgeId) => {
        const entry = perLodge.get(lodgeId) ?? { bookings: 0, revenue: 0 };
        return {
          bookings: entry.bookings,
          lodgeId,
          name: nameById.get(lodgeId) ?? 'Unknown lodge',
          revenue: entry.revenue.toFixed(2),
        };
      }),
    };
  }

  private periodStart(period: AdminDashboardPeriod): Date {
    const istDay = (offsetDays: number): string =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
        new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000),
      );
    const key =
      period === 'today' ? istDay(0) : period === 'week' ? istDay(6) : `${istDay(0).slice(0, 7)}-01`;
    return new Date(`${key}T00:00:00+05:30`);
  }

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
        where: { deletedAt: null, AND: [this.commissionEligibleWhere] },
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
    const [revenue, commission, financeRows, rating, recentNotifications] = await Promise.all([
      this.prisma.booking.aggregate({ _sum: { totalAmount: true }, where }),
      this.prisma.booking.aggregate({
        _sum: { commissionAmount: true },
        where: { ...where, AND: [this.commissionEligibleWhere] },
      }),
      lodgeIds.length === 0
        ? Promise.resolve([{ commissionPayable: '0', totalIncome: '0' }])
        : this.prisma.$queryRaw<
            Array<{ commissionPayable: string; totalIncome: string }>
          >(Prisma.sql`
            SELECT
              COALESCE(SUM(COALESCE(b.total_amount, 0)), 0)::text AS "totalIncome",
              COALESCE(SUM(GREATEST(l.commission_amount - COALESCE(a.allocated_amount, 0), 0)), 0)::text AS "commissionPayable"
            FROM lodge_commission_ledger l
            INNER JOIN bookings b ON b.id = l.booking_id
            LEFT JOIN (
              SELECT ledger_id, SUM(amount) AS allocated_amount
              FROM lodge_commission_settlement_allocations
              GROUP BY ledger_id
            ) a ON a.ledger_id = l.id
            WHERE l.lodge_id IN (${Prisma.join(lodgeIds.map((id) => Prisma.sql`${id}::uuid`))})
              AND l.status <> 'VOIDED'
          `),
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

    const finance = financeRows[0] ?? { commissionPayable: '0', totalIncome: '0' };

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
      commissionPayable: finance.commissionPayable,
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
      totalIncome: finance.totalIncome,
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

  /**
   * Commission is only real revenue once it's actually owed to the platform:
   * - Pay-at-lodge (cash) bookings: only once the guest has actually checked in
   *   (a no-show / cancelled cash booking never collected anything).
   * - Online bookings: as soon as the Razorpay payment is verified successful —
   *   the platform already holds the money, so it shouldn't wait for check-in.
   *   A cancelled, rejected or expired online booking is refunded, so it owes nothing.
   * Anything else (pending approval, rejected, cancelled, unpaid online) must be
   * excluded or owners see commission on money that was never actually collected.
   *
   * This MUST stay identical to the database function `tuljai_commission_is_eligible`,
   * which decides when a lodge_commission_ledger entry is created.
   */
  private readonly commissionEligibleWhere: Prisma.BookingWhereInput = {
    OR: [
      { paymentStatus: 'PAY_AT_LODGE', status: { in: ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'] } },
      { paymentStatus: 'FULLY_PAID', status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] } },
    ],
  };

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
      where: { AND: [where, this.commissionEligibleWhere] },
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
