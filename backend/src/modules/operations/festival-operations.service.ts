import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser, FestivalOperationsSnapshot } from '@tuljai/types';

import {
  BookingAvailabilityService,
  ACTIVE_BOOKING_STATUSES,
} from '../bookings/booking-availability.service';
import { QrCheckinService } from '../bookings/qr-checkin.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { SettingsService } from '../settings/settings.service';

import type {
  FestivalModeDto,
  FestivalQueryDto,
  LodgeOperationDto,
  ManualCheckinDto,
} from './dto/festival-operations.dto';
import { operationalDateRange } from './operational-dates';
import { OperationsTelemetry } from './operations-telemetry';

const operationalKeys = ['festival_name', 'festival_start_date', 'festival_end_date'];
const eligible = { deletedAt: null, status: 'VERIFIED', verificationStatus: 'VERIFIED' } as const;
const PAGE_SIZE = 20;

@Injectable()
export class FestivalOperationsService {
  private inflight = new Map<string, Promise<FestivalOperationsSnapshot>>();
  private readonly logger = new Logger(FestivalOperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: BookingAvailabilityService,
    private readonly catalog: CatalogService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeEventsService,
    private readonly paymentsService: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly telemetry: OperationsTelemetry,
    private readonly qrCheckin: QrCheckinService,
  ) {}

  snapshot(query: FestivalQueryDto): Promise<FestivalOperationsSnapshot> {
    const key = JSON.stringify(query);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const request = this.loadSnapshot(query).finally(() => this.inflight.delete(key));
    // Deduplicate simultaneous refreshes; never retain completed operational snapshots.
    if (this.inflight.size < 32) this.inflight.set(key, request);
    return request;
  }

  private async loadSnapshot(query: FestivalQueryDto): Promise<FestivalOperationsSnapshot> {
    const dates = operationalDateRange(query.checkInDate, query.checkOutDate);
    const now = new Date();
    const since = new Date(now.getTime() - 86400000);
    const stale = new Date(now.getTime() - 10 * 60000);
    const dbStart = performance.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const databaseLatencyMs = Math.round(performance.now() - dbStart);
    const [
      flag,
      settings,
      counts,
      lodgeTotals,
      activeBookings,
      activeStays,
      pendingPayments,
      stuckOperations,
      qrFailures,
      failedNotifications,
      activity,
      payments,
      changed,
      activated,
    ] = await Promise.all([
      this.prisma.featureFlag.findUnique({ where: { key: 'festival_mode' } }),
      this.prisma.systemSetting.findMany({
        where: { key: { in: operationalKeys } },
        select: { key: true, value: true },
      }),
      this.availability.lodgeAvailableCounts(
        new Date(dates.checkInDate),
        new Date(dates.checkOutDate),
      ),
      this.prisma.lodge.findMany({
        where: eligible,
        select: { id: true, isActive: true, operationsReason: true },
      }),
      this.prisma.booking.count({
        where: { deletedAt: null, status: { in: ACTIVE_BOOKING_STATUSES } },
      }),
      this.prisma.booking.count({ where: { deletedAt: null, status: 'CHECKED_IN' } }),
      this.prisma.paymentIntent.count({ where: { status: 'PENDING' } }),
      this.prisma.paymentIntent.count({
        where: {
          OR: [{ status: 'RECOVERY_REQUIRED' }, { status: 'PENDING', updatedAt: { lt: stale } }],
        },
      }),
      this.prisma.qrScanLog.count({
        where: { createdAt: { gte: since }, result: { not: 'SUCCESS' } },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: { createdAt: { gte: since }, status: 'FAILED' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { action: { startsWith: 'FESTIVAL_' } },
            { entityType: { in: ['room', 'room_availability', 'manual_booking'] } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { actor: { select: { displayName: true } } },
      }),
      this.prisma.paymentIntent.findMany({
        where: { status: { in: ['PENDING', 'RECOVERY_REQUIRED'] } },
        select: {
          id: true,
          providerOrderId: true,
          status: true,
          bookingId: true,
          updatedAt: true,
          attempts: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      this.prisma.auditLog.findFirst({
        where: { action: 'FESTIVAL_MODE_UPDATED' },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { displayName: true } } },
      }),
      this.prisma.auditLog.findFirst({
        where: { action: 'FESTIVAL_MODE_ENABLED' },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { displayName: true } } },
      }),
    ]);
    const values = new Map(
      settings.map((s) => [s.key, typeof s.value === 'string' ? s.value : '']),
    );
    const zeroAvailabilityIds = lodgeTotals
      .filter((l) => (counts.get(l.id) ?? 0) === 0)
      .map((l) => l.id);
    const fullIds = lodgeTotals
      .filter(
        (lodge) =>
          zeroAvailabilityIds.includes(lodge.id) ||
          lodge.operationsReason?.startsWith('Fully booked:'),
      )
      .map((lodge) => lodge.id);
    const where: Prisma.LodgeWhereInput = {
      deletedAt: null,
      name: query.search ? { contains: query.search.trim(), mode: 'insensitive' } : undefined,
      ...(query.filter === 'active' ? { ...eligible, isActive: true } : {}),
      ...(query.filter === 'disabled' ? { isActive: false } : {}),
      ...(query.filter === 'full' ? { id: { in: fullIds } } : {}),
      ...(query.filter === 'empty' ? { id: { in: zeroAvailabilityIds } } : {}),
    };
    const page = query.page ?? 1;
    const [lodges, total] = await Promise.all([
      this.prisma.lodge.findMany({
        where,
        select: {
          id: true,
          name: true,
          isActive: true,
          status: true,
          verificationStatus: true,
          operationsReason: true,
          updatedAt: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.lodge.count({ where }),
    ]);
    const alerts: FestivalOperationsSnapshot['alerts'] = [];
    const alert = (
      id: string,
      severity: 'warning' | 'critical',
      entity: string,
      detail: string,
      action: string,
      href: string,
    ) => alerts.push({ id, severity, entity, detail, action, href, at: now.toISOString() });
    if (stuckOperations)
      alert(
        'stuck',
        'critical',
        'Payment operations',
        `${stuckOperations} intents require recovery or have had no update for ten minutes.`,
        'Review gateway status and allocation',
        '#payment-recovery',
      );
    if (qrFailures)
      alert(
        'qr',
        'warning',
        'QR check-in',
        `${qrFailures} unsuccessful scans recorded in the last 24 hours (including reused passes).`,
        'Review failed scan records',
        '/admin/qr-monitor',
      );
    if (failedNotifications)
      alert(
        'notifications',
        'warning',
        'Notifications',
        `${failedNotifications} failed deliveries in the last 24 hours.`,
        'Review delivery logs',
        '/admin/notifications-monitor',
      );
    const disabled = lodgeTotals.filter((l) => !l.isActive).length;
    if (disabled)
      alert(
        'lodges',
        'warning',
        'Verified lodges',
        `${disabled} verified lodges are disabled for new bookings. Existing reservations remain intact.`,
        'Review disabled lodges',
        '#lodge-operations',
      );
    const metrics = this.telemetry.snapshot();
    const synchronization = this.realtime.getDeliveryDiagnostics();
    if (!synchronization.ready || synchronization.failures.length)
      alert(
        'sync',
        'warning',
        'Realtime publication',
        `${synchronization.failures.length} failed publications in five minutes; clients recover through authoritative reads.`,
        'Review synchronization diagnostics',
        '#festival-performance',
      );
    if (metrics.recentErrors.some((e) => e.status >= 500))
      alert(
        'api',
        'critical',
        'Backend API',
        'Server errors detected in this process in the last five minutes.',
        'Inspect recent endpoint errors',
        '#festival-performance',
      );
    return {
      checkedAt: now.toISOString(),
      ...dates,
      mode: {
        enabled: flag?.enabled ?? false,
        name: values.get('festival_name') ?? '',
        startDate: values.get('festival_start_date') ?? '',
        endDate: values.get('festival_end_date') ?? '',
        updatedAt: flag?.updatedAt.toISOString() ?? null,
        activatedBy: flag?.enabled
          ? (activated?.actor?.displayName ?? activated?.actorUserId ?? null)
          : null,
        lastChangedBy: changed?.actor?.displayName ?? changed?.actorUserId ?? null,
      },
      kpis: {
        activeLodges: lodgeTotals.filter((l) => l.isActive).length,
        eligibleLodges: lodgeTotals.filter((l) => l.isActive && (counts.get(l.id) ?? 0) > 0).length,
        disabledLodges: disabled,
        fullyBookedLodges: fullIds.length,
        availableRooms: lodgeTotals.reduce(
          (sum, l) => sum + (l.isActive ? (counts.get(l.id) ?? 0) : 0),
          0,
        ),
        activeBookings,
        activeStays,
        pendingPayments,
        stuckOperations,
      },
      lodges: {
        items: lodges.map((l) => ({
          ...l,
          availableRooms: counts.get(l.id) ?? 0,
          updatedAt: l.updatedAt.toISOString(),
        })),
        total,
        page,
        pageSize: PAGE_SIZE,
      },
      alerts,
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        actor: a.actor?.displayName ?? a.actorUserId ?? 'System',
        entityId: a.entityId,
        metadata: a.metadata,
        at: a.createdAt.toISOString(),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        orderId: p.providerOrderId,
        status: p.status,
        bookingId: p.bookingId,
        updatedAt: p.updatedAt.toISOString(),
        attempts: p.attempts,
      })),
      diagnostics: {
        database: 'healthy',
        databaseLatencyMs,
        oldestPendingPaymentAt:
          payments.find((p) => p.status === 'PENDING')?.createdAt.toISOString() ?? null,
        onlineConnections: this.realtime.getPresenceSummary().totalOnline,
        synchronization,
        failedNotifications,
        qrFailures,
        telemetry: metrics,
      },
    };
  }

  async updateMode(dto: FestivalModeDto, actorUserId: string) {
    if (!dto.name.trim() || dto.reason.trim().length < 5)
      throw new BadRequestException('Festival name and a meaningful reason are required');
    if (dto.startDate || dto.endDate) {
      if (!dto.startDate || !dto.endDate || dto.startDate > dto.endDate)
        throw new BadRequestException('Set both festival dates in chronological order');
      for (const date of [dto.startDate, dto.endDate]) {
        const parsed = new Date(`${date}T00:00:00Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
          throw new BadRequestException('Invalid festival dates');
      }
    }
    const flag = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('festival_mode', 0))`;
      const before = await tx.featureFlag.findUnique({ where: { key: 'festival_mode' } });
      if ((before?.updatedAt.toISOString() ?? '') !== dto.expectedUpdatedAt)
        throw new ConflictException(
          'Festival configuration changed. Refresh before applying this action.',
        );
      const oldSettings = await tx.systemSetting.findMany({
        where: { key: { in: operationalKeys } },
        select: { key: true, value: true },
      });
      const previous = { enabled: before?.enabled ?? false, settings: oldSettings };
      for (const [key, value] of [
        ['festival_name', dto.name.trim()],
        ['festival_start_date', dto.startDate],
        ['festival_end_date', dto.endDate],
      ]) {
        await tx.systemSetting.upsert({
          where: { key },
          create: { key: key!, value: value!, isPublic: true },
          update: { value: value! },
        });
      }
      const updated = await tx.featureFlag.upsert({
        where: { key: 'festival_mode' },
        create: { key: 'festival_mode', enabled: dto.enabled },
        update: {
          enabled: dto.enabled,
          rolloutPercentage: null,
          updatedAt: new Date(Math.max(Date.now(), (before?.updatedAt.getTime() ?? 0) + 1)),
        },
      });
      const metadata = {
        reason: dto.reason.trim(),
        previous,
        next: {
          enabled: dto.enabled,
          name: dto.name.trim(),
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
      };
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'FESTIVAL_MODE_UPDATED',
          entityType: 'feature_flag',
          entityId: updated.id,
          metadata,
        },
      });
      if ((before?.enabled ?? false) !== dto.enabled)
        await tx.auditLog.create({
          data: {
            actorUserId,
            action: dto.enabled ? 'FESTIVAL_MODE_ENABLED' : 'FESTIVAL_MODE_DISABLED',
            entityType: 'feature_flag',
            entityId: updated.id,
            metadata,
          },
        });
      return updated;
    });
    this.settings.invalidateOperationalCaches();
    this.catalog.invalidate();
    this.publish(
      { enabled: flag.enabled, updatedAt: flag.updatedAt.toISOString() },
      'festival:updated',
    );
    return { enabled: flag.enabled, updatedAt: flag.updatedAt.toISOString() };
  }

  async updateLodge(id: string, dto: LodgeOperationDto, actorUserId: string) {
    if (dto.detail.trim().length < 5)
      throw new BadRequestException('Provide a meaningful operational explanation');
    const dates = operationalDateRange(dto.checkInDate, dto.checkOutDate);
    const result = await this.prisma.$transaction(async (tx) => {
      // Same lock hierarchy as checkout: lodge first, then room type. Existing paid stays survive.
      await tx.$queryRaw`SELECT id FROM lodges WHERE id = ${id}::uuid FOR UPDATE`;
      const before = await tx.lodge.findFirstOrThrow({ where: { id, deletedAt: null } });
      const reason = dto.isActive ? null : `${dto.reason}: ${dto.detail.trim()}`;
      if (before.isActive === dto.isActive && before.operationsReason === reason)
        return { lodge: before, changed: false };
      if (before.updatedAt.toISOString() !== dto.expectedUpdatedAt)
        throw new ConflictException('This lodge changed. Refresh before applying the action.');
      if (dto.isActive) {
        if (before.status !== 'VERIFIED' || before.verificationStatus !== 'VERIFIED')
          throw new BadRequestException('Only verified lodges can be enabled');
        const counts = await this.availability.lodgeAvailableCounts(
          new Date(dates.checkInDate),
          new Date(dates.checkOutDate),
          [id],
          tx,
        );
        if (!(counts.get(id) ?? 0))
          throw new ConflictException(
            'No rooms available for this stay window. Resolve availability before enabling.',
          );
      }
      const lodge = await tx.lodge.update({
        where: { id },
        data: {
          isActive: dto.isActive,
          operationsReason: reason,
          updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: dto.isActive ? 'FESTIVAL_LODGE_ENABLED' : 'FESTIVAL_LODGE_DISABLED',
          entityType: 'lodge',
          entityId: id,
          metadata: {
            reason: dto.detail.trim(),
            previous: { isActive: before.isActive, reason: before.operationsReason },
            next: { isActive: lodge.isActive, reason },
            availabilityWindow: dates,
          },
        },
      });
      const members = await tx.lodgeOwner.findMany({
        where: { lodgeId: id, isActive: true, deletedAt: null },
        select: { userId: true },
      });
      const userIds = [
        ...new Set([
          ...members.map((member) => member.userId),
          ...(lodge.ownerUserId ? [lodge.ownerUserId] : []),
        ]),
      ];
      // Persist the owner's inbox item in the same transaction as the operational change.
      // Push/socket delivery is a hint; reconnect and inbox reads recover failed delivery.
      if (userIds.length)
        await tx.notification.createMany({
          skipDuplicates: true,
          data: userIds.map((recipientUserId) => ({
            recipientUserId,
            lodgeId: id,
            type: 'SYSTEM',
            dedupeKey: `lodge-operation:${id}:${lodge.updatedAt.toISOString()}:${recipientUserId}`,
            title: dto.isActive ? 'Lodge reopened for bookings' : 'Lodge closed to new bookings',
            body: `${lodge.name}: ${dto.detail.trim()}. Existing reservations remain valid.`,
            data: { lodgeId: id, isActive: dto.isActive },
          })),
        });
      return { lodge, changed: true };
    });
    this.catalog.invalidate();
    if (result.changed) {
      const payload = {
        lodgeId: id,
        isActive: result.lodge.isActive,
        updatedAt: result.lodge.updatedAt.toISOString(),
      };
      this.publish(payload, 'lodge:catalog-updated');
      this.realtime.publishToLodge(id, 'lodge:catalog-updated', payload);
      const recipients = await this.prisma.lodgeOwner.findMany({
        where: { lodgeId: id, isActive: true, deletedAt: null },
        select: { userId: true },
      });
      const userIds = new Set([
        ...recipients.map((r) => r.userId),
        ...(result.lodge.ownerUserId ? [result.lodge.ownerUserId] : []),
      ]);
      for (const recipientUserId of userIds) {
        this.realtime.publishToUser(recipientUserId, 'lodge:catalog-updated', payload);
        void this.notifications
          .create({
            recipientUserId,
            dedupeKey: `lodge-operation:${id}:${result.lodge.updatedAt.toISOString()}:${recipientUserId}`,
            lodgeId: id,
            type: 'SYSTEM',
            title: dto.isActive ? 'Lodge reopened for bookings' : 'Lodge closed to new bookings',
            body: `${result.lodge.name}: ${dto.detail.trim()}. Existing reservations remain valid.`,
            data: { lodgeId: id, isActive: dto.isActive },
          })
          .catch(async () => {
            await this.prisma.auditLog.create({
              data: {
                action: 'FESTIVAL_NOTIFICATION_SYNC_FAILED',
                actorUserId,
                entityType: 'lodge',
                entityId: id,
                metadata: { recipientUserId, durableInbox: true },
              },
            });
          })
          .catch(() =>
            this.logger.warn(
              'Owner delivery hint failed; the transactional inbox item remains available',
            ),
          );
      }
    }
    return { isActive: result.lodge.isActive, updatedAt: result.lodge.updatedAt.toISOString() };
  }

  async retryPayment(id: string, reason: string, actorUserId: string) {
    if (reason.trim().length < 5) throw new BadRequestException('Recovery requires a reason');
    const intent = await this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentIntent.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'PENDING')
        throw new ConflictException(
          'Only pending gateway verification can be retried. Allocation recovery requires review.',
        );
      const claim = await tx.paymentIntent.updateMany({
        where: { id, status: 'PENDING', nextCheckAt: { lte: new Date() } },
        data: { nextCheckAt: new Date(Date.now() + 60000), attempts: { increment: 1 } },
      });
      if (!claim.count)
        throw new ConflictException(
          'Verification is already running or cooling down. Refresh shortly.',
        );
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'FESTIVAL_PAYMENT_VERIFICATION_REQUESTED',
          entityType: 'payment_intent',
          entityId: id,
          metadata: {
            reason: reason.trim(),
            previous: { status: current.status, attempts: current.attempts },
            next: { attempts: current.attempts + 1 },
          },
        },
      });
      return current;
    });
    // Existing gateway reconciliation only reads captured payments; it never creates a charge.
    await this.paymentsService.reconcileOrder(intent.providerOrderId);
    const result = await this.prisma.paymentIntent.findUniqueOrThrow({
      where: { id },
      select: { status: true, bookingId: true },
    });
    this.publish({ intentId: id }, 'festival:updated');
    return result;
  }

  private publish(payload: Record<string, unknown>, event: string) {
    // Clients also recover via reconnect/foreground and 45s disconnected fallback reads.
    this.realtime.publishToRole('ADMIN', event, payload);
    this.realtime.publishToRole('SUPER_ADMIN', event, payload);
    this.realtime.publishToRole('PILGRIM', event, payload);
  }

  async manualCheckin(dto: ManualCheckinDto, user: AuthenticatedUser) {
    if (dto.reason.trim().length < 5)
      throw new BadRequestException('Manual verification requires a reason');
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingCode: dto.bookingCode.trim(),
        deletedAt: null,
        ...(dto.bookingId ? { id: dto.bookingId } : {}),
      },
      select: { id: true, bookingCode: true, guestPhone: true, status: true },
    });
    const normalize = (phone: string) => phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (
      !booking ||
      booking.bookingCode !== dto.bookingCode.trim() ||
      normalize(booking.guestPhone) !== normalize(dto.guestPhone)
    )
      throw new BadRequestException('Booking identity could not be verified');
    await this.prisma.auditLog.create({
      data: {
        action: 'FESTIVAL_MANUAL_CHECKIN_REQUESTED',
        actorUserId: user.id,
        entityType: 'booking',
        entityId: booking.id,
        metadata: { reason: dto.reason.trim(), previous: { status: booking.status } },
      },
    });
    // Reuse the signed token, atomic token consumption, room allocation and duplicate-check-in logic.
    const result = await this.qrCheckin.verifyManualCheckin(booking.id, user);
    await this.prisma.auditLog.create({
      data: {
        action: 'FESTIVAL_MANUAL_CHECKIN_COMPLETED',
        actorUserId: user.id,
        entityType: 'booking',
        entityId: booking.id,
        metadata: { reason: dto.reason.trim(), next: { status: result.booking.status } },
      },
    });
    this.publish({ bookingId: booking.id }, 'festival:updated');
    return { bookingId: result.booking.id, status: result.booking.status };
  }
}
