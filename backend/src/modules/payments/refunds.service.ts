import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RefundStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@tuljai/types';

import { NotificationEventsService } from '../notifications/notification-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

import { resolvePaymentCollectionStatus } from './payment-collection-status';
import {
  RazorpayProvider,
  RazorpayOrderRejectedException,
  type RazorpayRefund,
} from './providers/razorpay.provider';
import { moneyToPaise, REFUND_MESSAGES } from './refund-policy';

const include = {
  collection: true,
  booking: { include: { lodge: true } },
  history: { orderBy: { createdAt: 'asc' as const } },
};
type RefundRecord = Prisma.BookingRefundGetPayload<{ include: typeof include }>;

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  public constructor(
    private readonly prisma: PrismaService,
    private readonly provider: RazorpayProvider,
    private readonly notifications: NotificationsService,
    private readonly events: NotificationEventsService,
  ) {}

  public async reconcilePending(): Promise<void> {
    // Events persist independently of processing, so a crash after acceptance is recoverable.
    const events = await this.prisma.refundWebhookEvent.findMany({
      where: { processedAt: null, nextCheckAt: { lte: new Date() } },
      orderBy: { nextCheckAt: 'asc' },
      take: 50,
    });
    for (const event of events) {
      await this.processEvent(event.id).catch(async () => {
        await this.prisma.refundWebhookEvent.update({
          where: { id: event.id },
          data: {
            nextCheckAt: new Date(Date.now() + 60_000),
            lastError: 'Provider reconciliation temporarily unavailable',
          },
        });
      });
    }
    const refunds = await this.prisma.bookingRefund.findMany({
      where: { status: { in: ['PENDING', 'INITIATED'] }, nextCheckAt: { lte: new Date() } },
      take: 50,
      orderBy: { nextCheckAt: 'asc' },
    });
    for (const refund of refunds) await this.reconcile(refund.id);
    await this.deliverNotifications();
  }

  /** A durable lease is acquired before any provider read/write, across all Render instances. */
  public async reconcile(id: string): Promise<void> {
    const token = randomUUID();
    const now = new Date();
    const claim = await this.prisma.bookingRefund.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'INITIATED', 'FAILED', 'PROCESSED'] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 300_000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) return;
    try {
      let row = await this.prisma.bookingRefund.findUniqueOrThrow({ where: { id }, include });
      if (row.booking.status !== 'CANCELLED')
        throw new BadRequestException('Refund requires a cancelled booking');
      if (row.percent === null || row.amount === null)
        throw new BadRequestException('Cancellation policy requires review');
      if (row.collection.method !== 'ONLINE' || row.collection.provider !== 'RAZORPAY')
        throw new BadRequestException('No Razorpay collection');
      const orderId = row.collection.providerOrderId;
      if (!orderId) throw new BadRequestException('Payment order requires review');
      let paymentId = row.providerPaymentId ?? row.collection.providerPaymentId;
      if (!paymentId) {
        const payments = await this.provider.getOrderPayments(orderId);
        const captured = payments.filter(
          (p) => p.captured && ['captured', 'refunded'].includes(p.status),
        );
        if (captured.length > 1)
          throw new BadRequestException('Multiple captured payments require review');
        paymentId = captured[0]?.id ?? null;
        if (!paymentId) {
          // Never capture an authorization just to refund it. Keep checking in case capture arrives later.
          const authorized = payments.some(
            (p) => p.status === 'authorized' || p.status === 'created',
          );
          if (authorized || !payments.length) {
            await this.prisma.bookingRefund.update({
              where: { id },
              data: {
                failureReason: authorized
                  ? 'Awaiting authorization expiry or capture; no refund sent'
                  : 'Awaiting payment outcome; no refund sent',
              },
            });
            return;
          }
          await this.prisma.bookingRefund.update({
            where: { id },
            data: { status: 'NOT_REQUIRED', failureReason: 'No captured payment', amount: 0 },
          });
          return;
        }
      }
      const payment = await this.provider.getPayment(paymentId);
      if (
        payment.order_id !== orderId ||
        payment.id !== paymentId ||
        payment.currency !== 'INR' ||
        payment.amount !== moneyToPaise(row.collection.amount)
      )
        throw new BadRequestException('Payment ownership, currency or amount mismatch');
      if (!payment.captured || !['captured', 'refunded'].includes(payment.status)) {
        if (payment.status === 'failed' || (payment.status === 'refunded' && !payment.captured)) {
          await this.prisma.bookingRefund.update({
            where: { id },
            data: {
              status: 'NOT_REQUIRED',
              amount: 0,
              failureReason:
                'Payment failed or authorization was reversed before capture; no online refund required',
            },
          });
        }
        return;
      }
      row = await this.prisma.bookingRefund.update({
        where: { id },
        data: {
          providerPaymentId: paymentId,
          capturedAmount: payment.amount,
          paymentMethod: payment.method ?? null,
        },
        include,
      });
      // Always reconcile before POST, including every retry after an ambiguous timeout.
      const providerRefunds = await this.provider.getPaymentRefunds(paymentId);
      const providerProcessedTotal = Math.max(
        payment.amount_refunded ?? 0,
        providerRefunds
          .filter((r) => r.status === 'processed')
          .reduce((sum, r) => sum + r.amount, 0),
      );
      const active = row.history.at(-1);
      const found =
        active &&
        providerRefunds.find(
          (r) => r.id === active.providerRefundId || r.receipt === active.receipt,
        );
      if (found) {
        await this.applyProviderRefund(row, active, found, true, token, providerProcessedTotal);
        return;
      }
      if (active?.providerRefundId) {
        await this.applyProviderRefund(
          row,
          active,
          await this.provider.getRefund(active.providerRefundId),
          true,
          token,
          providerProcessedTotal,
        );
        return;
      }
      if (row.status === 'FAILED' || row.status === 'PROCESSED') return; // Reconciliation cannot authorize a retry.
      const used = providerRefunds
        .filter((r) => r.status !== 'failed')
        .reduce((sum, r) => sum + r.amount, 0);
      if (!Number.isSafeInteger(used) || used < 0 || used > payment.amount)
        throw new BadRequestException('Invalid provider refund totals');
      // Include Razorpay's aggregate even if its list is eventually consistent.
      const remaining = payment.amount - Math.max(used, payment.amount_refunded ?? 0);
      const amount = active?.amount ?? Math.min(Math.max(0, row.amount! - used), remaining);
      if (!active && amount === 0) {
        if (providerRefunds.some((refund) => refund.status === 'pending')) return;
        await this.prisma.$transaction(async (tx) => {
          await tx.bookingRefund.update({
            where: { id },
            data: {
              amount: 0,
              status: 'NOT_REQUIRED',
              failureReason:
                'Existing processed refunds already cover the cancellation entitlement',
            },
          });
          await tx.auditLog.create({
            data: {
              action: 'REFUND_ENTITLEMENT_ALREADY_COVERED',
              entityType: 'booking_refund',
              entityId: id,
              metadata: {
                previousRefunds: providerRefunds.map((refund) => ({
                  id: refund.id,
                  amountPaise: refund.amount,
                  status: refund.status,
                })),
              },
            },
          });
          if (providerProcessedTotal >= payment.amount)
            await tx.paymentCollection.update({
              where: { id: row.collectionId },
              data: { status: 'REFUNDED' },
            });
        });
        return;
      }
      if (amount <= 0 || amount > remaining)
        throw new BadRequestException(
          'Refund exceeds remaining captured payment; reconcile provider records',
        );
      const attempt = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM bookings WHERE id=${row.bookingId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM payment_collections WHERE id=${row.collectionId}::uuid FOR UPDATE`;
        const fresh = await tx.bookingRefund.findUniqueOrThrow({ where: { id } });
        if (
          fresh.leaseToken !== token ||
          !fresh.leaseUntil ||
          fresh.leaseUntil.getTime() < Date.now() ||
          !['PENDING', 'INITIATED'].includes(fresh.status)
        )
          throw new BadRequestException('Refund lease expired');
        await tx.bookingRefund.update({
          where: { id },
          data: {
            providerPaymentId: paymentId,
            capturedAmount: payment.amount,
            amount,
            paymentMethod: payment.method ?? null,
          },
        });
        await tx.paymentCollection.update({
          where: { id: row.collectionId },
          data: {
            providerPaymentId: paymentId,
            status: 'PAID',
            paidAt: row.collection.paidAt ?? new Date(),
          },
        });
        const result =
          active ??
          (await tx.refundAttempt.create({
            data: { refundId: id, amount, receipt: `rf_${randomUUID().replace(/-/g, '')}` },
          }));
        if (!active && providerRefunds.length)
          await tx.auditLog.create({
            data: {
              action: 'REFUND_PRIOR_PROVIDER_RECORDS_RECONCILED',
              entityType: 'booking_refund',
              entityId: id,
              metadata: {
                previousRefunds: providerRefunds.map((r) => ({
                  id: r.id,
                  amountPaise: r.amount,
                  status: r.status,
                })),
              },
            },
          });
        // This marker is committed before the external write. Its receipt NEVER changes after a timeout.
        await tx.refundAttempt.update({
          where: { id: result.id },
          data: { requestedAt: result.requestedAt ?? new Date() },
        });
        return result;
      });
      row = await this.prisma.bookingRefund.findUniqueOrThrow({ where: { id }, include });
      try {
        const created = await this.provider.createRefund(paymentId, {
          amount,
          receipt: attempt.receipt,
          notes: {
            booking_reference: row.booking.bookingCode,
            cancellation_reason: row.reason.slice(0, 250),
            internal_reference: row.reference,
          },
        });
        // A successful POST is an initiation, never proof that the bank credited the customer.
        await this.applyProviderRefund(row, attempt, created, false, token);
      } catch (error) {
        if (error instanceof RazorpayOrderRejectedException) {
          // A duplicate-receipt rejection may itself mean the first POST succeeded.
          const reconciled = (await this.provider.getPaymentRefunds(paymentId)).find(
            (r) => r.receipt === attempt.receipt,
          );
          if (reconciled) await this.applyProviderRefund(row, attempt, reconciled, true, token);
          else await this.fail(id, error.message, token);
        } else throw error;
      }
    } catch (error) {
      // Unknown transport outcomes stay pending and retain the exact same attempt/receipt.
      const message =
        error instanceof BadRequestException
          ? error.message
          : 'Gateway temporarily unavailable or request outcome uncertain; reconciliation scheduled';
      if (error instanceof BadRequestException) await this.fail(id, message, token);
      await this.prisma.bookingRefund.updateMany({
        where: { id, leaseToken: token },
        data: { failureReason: message },
      });
      this.logger.warn({ refundId: id, message });
    } finally {
      await this.prisma.bookingRefund.updateMany({
        where: { id, leaseToken: token },
        data: { leaseToken: null, leaseUntil: null, nextCheckAt: new Date(Date.now() + 60_000) },
      });
    }
  }

  private async fail(id: string, reason: string, token: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.bookingRefund.updateMany({
        where: { id, leaseToken: token, status: { not: 'PROCESSED' } },
        data: { status: 'FAILED', failureReason: reason.slice(0, 500) },
      });
      if (changed.count) {
        const row = await tx.bookingRefund.findUniqueOrThrow({ where: { id } });
        await this.queue(tx, row.bookingId, id, 'FAILED');
      }
    });
  }

  private async queue(
    tx: Prisma.TransactionClient,
    bookingId: string,
    refundId: string,
    status: string,
  ): Promise<void> {
    await tx.refundNotificationOutbox.createMany({
      skipDuplicates: true,
      data: { key: `refund:${refundId}:${status}`, bookingId, refundId, status },
    });
  }

  private async applyProviderRefund(
    row: RefundRecord,
    attempt: RefundRecord['history'][number],
    provider: RazorpayRefund,
    finalRead: boolean,
    token: string,
    providerProcessedTotal = 0,
  ): Promise<void> {
    if (
      typeof provider.id !== 'string' ||
      !provider.id ||
      provider.payment_id !== row.providerPaymentId ||
      provider.amount !== attempt.amount ||
      provider.currency !== 'INR' ||
      (provider.receipt && provider.receipt !== attempt.receipt) ||
      !['pending', 'processed', 'failed'].includes(provider.status)
    )
      throw new BadRequestException('Refund provider reference, amount or currency mismatch');
    const status: RefundStatus =
      provider.status === 'failed'
        ? 'FAILED'
        : provider.status === 'processed' && finalRead
          ? 'PROCESSED'
          : 'INITIATED';
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bookings WHERE id=${row.bookingId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM payment_collections WHERE id=${row.collectionId}::uuid FOR UPDATE`;
      const current = await tx.bookingRefund.findUniqueOrThrow({ where: { id: row.id } });
      if (current.leaseToken !== token) return;
      if (current.status === 'PROCESSED') {
        // Speed updates remain useful after terminal processing; never demote the financial state.
        await tx.refundAttempt.update({
          where: { id: attempt.id },
          data: { speed: provider.speed_processed ?? provider.speed_requested ?? attempt.speed },
        });
        return;
      }
      const latest = await tx.refundAttempt.findFirst({
        where: { refundId: row.id },
        orderBy: { createdAt: 'desc' },
      });
      if (latest?.id !== attempt.id) return;
      await tx.refundAttempt.update({
        where: { id: attempt.id },
        data: {
          providerRefundId: provider.id,
          status,
          speed: provider.speed_processed ?? provider.speed_requested ?? 'normal',
          failureReason: provider.error_description?.slice(0, 500) ?? null,
        },
      });
      await tx.bookingRefund.update({
        where: { id: row.id },
        data: {
          status,
          initiatedAt: current.initiatedAt ?? new Date(),
          processedAt: status === 'PROCESSED' ? new Date() : null,
          failureReason:
            status === 'FAILED'
              ? (provider.error_description?.slice(0, 500) ?? 'Provider reported refund failure')
              : null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: `REFUND_${status}`,
          entityType: 'booking_refund',
          entityId: row.id,
          metadata: {
            providerRefundId: provider.id,
            amountPaise: provider.amount,
            providerProcessedTotalPaise: providerProcessedTotal,
            source: finalRead ? 'provider_reconciliation' : 'refund_creation',
          },
        },
      });
      if (status !== current.status) await this.queue(tx, row.bookingId, row.id, status);
      if (status === 'PROCESSED') {
        const processed = await tx.refundAttempt.aggregate({
          where: { refund: { collectionId: row.collectionId }, status: 'PROCESSED' },
          _sum: { amount: true },
        });
        if (
          Math.max(processed._sum.amount ?? 0, providerProcessedTotal) >=
          moneyToPaise(row.collection.amount)
        ) {
          await tx.paymentCollection.update({
            where: { id: row.collectionId },
            data: { status: 'REFUNDED' },
          });
          const otherOnline = await tx.paymentCollection.count({
            where: {
              bookingId: row.bookingId,
              method: 'ONLINE',
              status: 'PAID',
              id: { not: row.collectionId },
            },
          });
          if (!otherOnline)
            await tx.booking.update({
              where: { id: row.bookingId },
              data: { paymentStatus: 'REFUNDED' },
            });
        }
      }
    });
  }

  public async receiveEvent(
    eventId: string,
    event: { event: string; payload?: { refund?: { entity?: RazorpayRefund } } },
  ) {
    const entity = event.payload?.refund?.entity;
    if (
      !entity ||
      typeof entity.id !== 'string' ||
      typeof entity.payment_id !== 'string' ||
      !entity.id ||
      !entity.payment_id ||
      entity.id.length > 100 ||
      entity.payment_id.length > 100
    )
      throw new BadRequestException('Invalid refund webhook');
    await this.prisma.refundWebhookEvent.createMany({
      skipDuplicates: true,
      data: {
        id: eventId,
        eventType: event.event,
        providerRefundId: entity.id,
        providerPaymentId: entity.payment_id,
        receipt: typeof entity.receipt === 'string' ? entity.receipt.slice(0, 100) : null,
      },
    });
    // Only verified provider GETs drive final state; stale event payloads cannot regress it.
    await this.processEvent(eventId).catch(() =>
      this.logger.warn('Refund event persisted for retry'),
    );
    return { received: true };
  }

  private async processEvent(id: string): Promise<void> {
    const event = await this.prisma.refundWebhookEvent.findUniqueOrThrow({ where: { id } });
    if (event.processedAt) return;
    const attempt = await this.prisma.refundAttempt.findFirst({
      where: {
        OR: [
          { providerRefundId: event.providerRefundId },
          ...(event.receipt ? [{ receipt: event.receipt }] : []),
        ],
      },
      include: { refund: true },
    });
    if (!attempt || attempt.refund.providerPaymentId !== event.providerPaymentId) {
      await this.prisma.refundWebhookEvent.update({
        where: { id },
        data: {
          lastError: 'Unmatched refund/payment; awaiting reconciliation',
          nextCheckAt: new Date(Date.now() + 900_000),
        },
      });
      return;
    }
    // Wake the worker. If another worker owns the lease, leave this event pending.
    await this.reconcile(attempt.refundId);
    const fresh = await this.prisma.refundAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    if (fresh.providerRefundId === event.providerRefundId && fresh.status !== 'PENDING') {
      const refund = await this.prisma.bookingRefund.findUniqueOrThrow({
        where: { id: attempt.refundId },
      });
      if (!refund.leaseToken && !refund.failureReason)
        await this.prisma.refundWebhookEvent.update({
          where: { id },
          data: { processedAt: new Date(), lastError: null },
        });
      // A verified failed provider state is also a fully handled event.
      else if (refund.status === 'FAILED' || refund.status === 'PROCESSED')
        await this.prisma.refundWebhookEvent.update({
          where: { id },
          data: { processedAt: new Date() },
        });
    }
  }

  public async retry(id: string, user: AuthenticatedUser): Promise<void> {
    this.assertAdmin(user);
    const observed = await this.prisma.refundAttempt.findFirst({
      where: { refundId: id },
      orderBy: { createdAt: 'desc' },
    });
    const verified = observed?.providerRefundId
      ? await this.provider.getRefund(observed.providerRefundId)
      : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM booking_refunds WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.bookingRefund.findUniqueOrThrow({
        where: { id },
        include: { history: { orderBy: { createdAt: 'desc' } } },
      });
      if (
        row.status !== 'FAILED' ||
        row.amount === null ||
        row.amount <= 0 ||
        !row.providerPaymentId ||
        (row.leaseUntil && row.leaseUntil > new Date())
      )
        throw new BadRequestException('Only eligible failed refunds may be retried');
      const previous = row.history[0];
      // A fresh receipt is allowed ONLY after a known provider refund reached failed.
      if (previous?.providerRefundId) {
        if (
          !verified ||
          previous.id !== observed?.id ||
          verified.id !== previous.providerRefundId ||
          verified.status !== 'failed' ||
          verified.payment_id !== row.providerPaymentId ||
          verified.amount !== previous.amount
        )
          throw new BadRequestException('Reconcile provider refund before retry');
        await tx.refundAttempt.create({
          data: {
            refundId: id,
            amount: previous.amount,
            receipt: `rf_${randomUUID().replace(/-/g, '')}`,
          },
        });
      }
      await tx.bookingRefund.update({
        where: { id },
        data: { status: 'PENDING', failureReason: null, nextCheckAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'ADMIN_REFUND_RETRY',
          entityType: 'booking_refund',
          entityId: id,
        },
      });
    });
    await this.reconcile(id);
  }

  public async adminReconcile(id: string, user: AuthenticatedUser): Promise<void> {
    this.assertAdmin(user);
    const row = await this.prisma.bookingRefund.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Refund not found');
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'ADMIN_REFUND_RECONCILE',
        entityType: 'booking_refund',
        entityId: id,
      },
    });
    await this.reconcile(id);
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (!user.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN'))
      throw new ForbiddenException('Administrator required');
  }

  public async list(input: {
    search?: string;
    status?: RefundStatus;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.BookingRefundWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { booking: { bookingCode: { contains: input.search, mode: 'insensitive' } } },
              { booking: { guestName: { contains: input.search, mode: 'insensitive' } } },
              { booking: { lodge: { name: { contains: input.search, mode: 'insensitive' } } } },
              { providerPaymentId: { contains: input.search } },
              { history: { some: { providerRefundId: { contains: input.search } } } },
            ],
          }
        : {}),
    };
    const [items, totalItems, summary] = await Promise.all([
      this.prisma.bookingRefund.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.bookingRefund.count({ where }),
      this.prisma.bookingRefund.groupBy({ by: ['status'], _count: true, _sum: { amount: true } }),
    ]);
    return {
      items: items.map((row) => this.toAdmin(row)),
      totalItems,
      page: input.page,
      pageSize: input.pageSize,
      summary: summary.map((s) => ({
        status: s.status,
        count: s._count,
        amountPaise: s._sum.amount ?? 0,
      })),
    };
  }

  public async detail(id: string) {
    const row = await this.prisma.bookingRefund.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Refund not found');
    const [audits, events] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entityType: 'booking_refund', entityId: id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.refundWebhookEvent.findMany({
        where: { providerPaymentId: row.providerPaymentId ?? '' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { ...this.toAdmin(row), audits, events };
  }

  private toAdmin(row: RefundRecord) {
    return {
      id: row.id,
      reference: row.reference,
      bookingId: row.bookingId,
      bookingReference: row.booking.bookingCode,
      bookingStatus: row.booking.status,
      paymentStatus: resolvePaymentCollectionStatus(row.collection, row.booking),
      pilgrimName: row.booking.guestName,
      pilgrimUserId: row.booking.pilgrimUserId,
      lodgeName: row.booking.lodge.name,
      cancellationReason: row.reason,
      cancellationDetails: row.booking.cancellationPolicy,
      cancelledByUserId: row.booking.cancelledByUserId,
      originalPaymentId: row.providerPaymentId,
      originalAmountPaise: moneyToPaise(row.collection.amount),
      capturedAmountPaise: row.capturedAmount,
      amountPaise: row.amount,
      status: row.status,
      currency: row.currency,
      failureReason: row.failureReason,
      cancellationDate: row.booking.cancelledAt,
      initiatedAt: row.initiatedAt,
      processedAt: row.processedAt,
      history: row.history,
    };
  }

  public async deliverNotifications(): Promise<void> {
    const pending = await this.prisma.refundNotificationOutbox.findMany({
      where: { deliveredAt: null, nextCheckAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    for (const item of pending) {
      const claim = await this.prisma.refundNotificationOutbox.updateMany({
        where: {
          key: item.key,
          deliveredAt: null,
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        data: { leaseUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 } },
      });
      if (!claim.count) continue;
      try {
        if (item.status === 'CANCELLED') await this.events.bookingCancelled(item.bookingId);
        else if (item.status === 'ACCOUNTING_REVIEW') {
          const booking = await this.prisma.booking.findUniqueOrThrow({
            where: { id: item.bookingId },
          });
          for (const admin of await this.prisma.user.findMany({
            where: {
              roles: { hasSome: ['ADMIN', 'SUPER_ADMIN'] },
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          }))
            await this.notifications.create({
              dedupeKey: `${item.key}:${admin.id}`,
              recipientUserId: admin.id,
              recipientRole: 'ADMIN',
              type: 'SYSTEM',
              priority: 'HIGH',
              bookingId: item.bookingId,
              title: 'Cancelled booking settlement requires review',
              body: `Booking ${booking.bookingCode} has existing commission settlement allocations. Review the accounting adjustment; historical settlements have been preserved.`,
              data: { context: 'REFUND', bookingId: item.bookingId },
            });
        } else {
          const row = await this.prisma.bookingRefund.findUniqueOrThrow({
            where: { id: item.refundId! },
            include: { booking: true },
          });
          // Do not deliver a stale pending/initiated notice after a newer terminal state.
          if (row.status === item.status) {
            const amount = row.amount === null ? '' : `₹${(row.amount / 100).toFixed(2)}`;
            const title =
              item.status === 'INITIATED'
                ? 'Refund Initiated Successfully'
                : item.status === 'PROCESSED'
                  ? 'Refund Successfully Processed'
                  : item.status === 'FAILED'
                    ? 'Refund Requires Attention'
                    : 'Refund Processing';
            const body =
              item.status === 'INITIATED'
                ? `Your refund of ${amount} for booking ${row.booking.bookingCode} has been initiated. It is expected to be credited within 5–7 business days.`
                : REFUND_MESSAGES[row.status];
            await this.notifications.create({
              dedupeKey: item.key,
              bookingId: row.bookingId,
              lodgeId: row.booking.lodgeId,
              recipientUserId: row.booking.pilgrimUserId,
              recipientRole: 'PILGRIM',
              type: 'SYSTEM',
              priority: 'HIGH',
              title,
              body,
              data: {
                context: 'REFUND',
                bookingId: row.bookingId,
                refundId: row.id,
                status: row.status,
              },
            });
            if (item.status === 'FAILED')
              for (const admin of await this.prisma.user.findMany({
                where: {
                  roles: { hasSome: ['ADMIN', 'SUPER_ADMIN'] },
                  isActive: true,
                  deletedAt: null,
                },
                select: { id: true },
              })) {
                await this.notifications.create({
                  dedupeKey: `${item.key}:admin:${admin.id}`,
                  bookingId: row.bookingId,
                  recipientRole: 'ADMIN',
                  recipientUserId: admin.id,
                  type: 'SYSTEM',
                  title: 'Refund requires attention',
                  body: `Booking ${row.booking.bookingCode}: ${row.failureReason ?? 'Provider refund failure'}`,
                  data: { context: 'REFUND', refundId: row.id },
                });
              }
          }
        }
        await this.prisma.refundNotificationOutbox.update({
          where: { key: item.key },
          data: { deliveredAt: new Date(), leaseUntil: null },
        });
      } catch {
        await this.prisma.refundNotificationOutbox.update({
          where: { key: item.key },
          data: { leaseUntil: null, nextCheckAt: new Date(Date.now() + 60_000) },
        });
        this.logger.warn('Refund notification persisted for retry');
      }
    }
  }
}
