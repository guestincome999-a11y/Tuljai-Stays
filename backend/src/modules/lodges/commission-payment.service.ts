import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuthenticatedUser,
  CommissionPaymentRecord,
  CommissionPaymentDetail,
} from '@tuljai/types';

import {
  RazorpayProvider,
  RazorpayOrderRejectedException,
} from '../payments/providers/razorpay.provider';
import { PrismaService } from '../prisma/prisma.service';

import { allocateCommissionFIFO } from './commission-allocation';
import { LodgeAccessService } from './lodge-access.service';

// Online commission is collected through revenue offsets, never charged again at checkout.
export const onlineCommission = Prisma.sql`EXISTS (SELECT 1 FROM payment_collections pc
  WHERE pc.booking_id=b.id AND pc.method='ONLINE' AND pc.status='PAID')`;
export const offlineCommission = Prisma.sql`(b.payment_status::text='PAY_AT_LODGE' OR EXISTS (
  SELECT 1 FROM payment_collections pc WHERE pc.booking_id=b.id AND pc.method<>'ONLINE' AND pc.status='PAID'))
  AND NOT (${onlineCommission})`;
export const dueCommission = Prisma.sql`GREATEST(l.commission_amount - COALESCE((SELECT SUM(a.amount)
  FROM lodge_commission_settlement_allocations a WHERE a.ledger_id=l.id),0),0)`;

export const outstandingCommissionPaise = (
  lodgeId: string | Prisma.Sql,
) => Prisma.sql`(SELECT COALESCE(SUM(${dueCommission})*100,0)::float8
  FROM lodge_commission_ledger l JOIN bookings b ON b.id=l.booking_id WHERE l.lodge_id=${typeof lodgeId === 'string' ? Prisma.sql`${lodgeId}::uuid` : lodgeId}
  AND l.status='OUTSTANDING' AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text) AND ${offlineCommission})`;

export const commissionPaymentSelect = Prisma.sql`SELECT p.id, p.owner_id AS "ownerId", COALESCE(u.display_name,'Owner') AS "ownerName",
  p.lodge_id AS "lodgeId", lo.name AS "lodgeName", p.amount_paise AS "amountPaise", p.currency, p.status,
  p.payment_type AS "paymentType",p.outstanding_before_paise::float8 AS "outstandingBeforePaise",p.remaining_after_paise::float8 AS "remainingAfterPaise",
  ${outstandingCommissionPaise(Prisma.sql`p.lodge_id`)} AS "currentOutstandingPaise",
  p.order_id AS "orderId", p.payment_id AS "paymentId", p.method, p.settlement_id AS "settlementId",
  to_char(p.verified_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "verifiedAt", to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt", to_char(p.last_checked_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "lastCheckedAt",
  to_char(p.webhook_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "webhookAt" FROM commission_payments p JOIN users u ON u.id=p.owner_id JOIN lodges lo ON lo.id=p.lodge_id`;

@Injectable()
export class CommissionPaymentService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly access: LodgeAccessService,
    private readonly gateway: RazorpayProvider,
  ) {}

  public async detail(id: string, user?: AuthenticatedUser): Promise<CommissionPaymentDetail> {
    const rows = await this.prisma.$queryRaw<CommissionPaymentRecord[]>(
      Prisma.sql`${commissionPaymentSelect} WHERE p.id=${id}::uuid`,
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Commission payment not found');
    if (user) await this.access.assertCanManageLodge(user, row.lodgeId);
    const bookings = await this.prisma.$queryRaw<CommissionPaymentDetail['bookings']>(Prisma.sql`
      SELECT i.ledger_id AS "ledgerId", l.booking_id AS "bookingId", b.booking_code AS "bookingCode", i.amount_paise AS "amountPaise",
        COALESCE(i.due_before_paise,i.amount_paise) AS "dueBeforePaise",(l.commission_amount*100)::float8 AS "commissionPaise",
        ((l.commission_amount-${dueCommission})*100)::float8 AS "totalPaidPaise",(${dueCommission}*100)::float8 AS "remainingPaise"
      FROM commission_payment_items i JOIN lodge_commission_ledger l ON l.id=i.ledger_id JOIN bookings b ON b.id=l.booking_id
      WHERE i.payment_id=${id}::uuid ORDER BY b.created_at, b.id`);
    return { ...row, bookings };
  }

  private async lockLodge(tx: Prisma.TransactionClient, lodgeId: string) {
    // Match cancellation/revenue settlement lock ordering: booking, lodge, ledger.
    await tx.$queryRaw`SELECT b.id FROM bookings b JOIN lodge_commission_ledger l ON l.booking_id=b.id
      WHERE l.lodge_id=${lodgeId}::uuid ORDER BY b.id FOR UPDATE OF b`;
    await tx.$queryRaw`SELECT id FROM lodges WHERE id=${lodgeId}::uuid FOR UPDATE`;
  }

  public async create(
    lodgeId: string,
    user: AuthenticatedUser,
    expectedPaise: number,
    paymentMode: 'FULL' | 'PARTIAL' = 'FULL',
  ) {
    if (
      !Number.isSafeInteger(expectedPaise) ||
      expectedPaise <= 0 ||
      expectedPaise > 2147483647 ||
      !['FULL', 'PARTIAL'].includes(paymentMode)
    )
      throw new BadRequestException('Enter a valid positive INR amount.');
    await this.access.assertCanManageLodge(user, lodgeId);
    const id = await this.prisma.$transaction(async (tx) => {
      await this.lockLodge(tx, lodgeId);
      const active = await tx.$queryRaw<
        { id: string; amount: number }[]
      >`SELECT id,amount_paise AS amount FROM commission_payments
        WHERE lodge_id=${lodgeId}::uuid AND status IN ('PENDING','FAILED','CANCELLED','RECOVERY_REQUIRED')`;
      if (active[0]) {
        if (active[0].amount !== expectedPaise)
          throw new ConflictException(
            'An existing order must be resumed for its original amount. Refresh the payment summary.',
          );
        const reserved = await tx.$queryRaw<
          { eligible: boolean; due: number; reserved: number; expectedDue: number }[]
        >(Prisma.sql`
          SELECT (l.status='OUTSTANDING' AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text) AND ${offlineCommission}) AS eligible,
            (${dueCommission}*100)::integer AS due,i.amount_paise AS reserved,COALESCE(i.due_before_paise,i.amount_paise) AS "expectedDue" FROM commission_payment_items i
          JOIN lodge_commission_ledger l ON l.id=i.ledger_id JOIN bookings b ON b.id=l.booking_id
          WHERE i.payment_id=${active[0].id}::uuid ORDER BY b.id FOR UPDATE OF l`);
        if (
          !reserved.length ||
          reserved.some(
            (item) => !item.eligible || item.due !== item.expectedDue || item.reserved > item.due,
          ) ||
          reserved.reduce((sum, item) => sum + item.reserved, 0) !== active[0].amount
        ) {
          await tx.$executeRaw`UPDATE commission_payments SET status='RECOVERY_REQUIRED',updated_at=now() WHERE id=${active[0].id}::uuid`;
          await tx.auditLog.create({
            data: {
              action: 'COMMISSION_PAYMENT_BALANCE_CHANGED',
              actorUserId: user.id,
              entityType: 'commission_payment',
              entityId: active[0].id,
              metadata: { lodgeId },
            },
          });
          return active[0].id;
        }
        await tx.$executeRaw`UPDATE commission_payments SET status='PENDING' WHERE id=${active[0].id}::uuid AND status IN ('FAILED','CANCELLED')`;
        return active[0].id;
      }
      const items = await tx.$queryRaw<{ id: string; paise: number }[]>(Prisma.sql`
        SELECT l.id, (${dueCommission}*100)::integer AS paise FROM lodge_commission_ledger l JOIN bookings b ON b.id=l.booking_id
        WHERE l.lodge_id=${lodgeId}::uuid AND l.status='OUTSTANDING' AND b.deleted_at IS NULL
          AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text) AND ${offlineCommission}
          AND ${dueCommission}>0 ORDER BY l.eligible_at,l.created_at,l.id FOR UPDATE OF l`);
      const total = items.reduce((sum, item) => sum + item.paise, 0);
      if (!total || !Number.isSafeInteger(total))
        throw new BadRequestException('No payable commission or amount outside supported range');
      if (paymentMode === 'FULL' && total !== expectedPaise)
        throw new ConflictException('Commission balance changed. Refresh the payment summary.');
      const plan = allocateCommissionFIFO(items, expectedPaise);
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`INSERT INTO commission_payments(owner_id,lodge_id,amount_paise,payment_type,outstanding_before_paise)
        VALUES (${user.id}::uuid,${lodgeId}::uuid,${expectedPaise},${plan.paymentType},${total}) RETURNING id`;
      const paymentId = rows[0]!.id;
      await tx.$executeRaw(Prisma.sql`INSERT INTO commission_payment_items(payment_id,ledger_id,amount_paise,due_before_paise) VALUES
        ${Prisma.join(plan.allocations.map((item) => Prisma.sql`(${paymentId}::uuid,${item.id}::uuid,${item.paise},${item.dueBeforePaise})`))}`);
      await tx.auditLog.create({
        data: {
          action: 'COMMISSION_PAYMENT_CREATED',
          actorUserId: user.id,
          entityType: 'commission_payment',
          entityId: paymentId,
          metadata: {
            lodgeId,
            amountPaise: expectedPaise,
            paymentType: plan.paymentType,
            outstandingBeforePaise: total,
            bookings: plan.allocations.length,
          },
        },
      });
      return paymentId;
    });
    await this.ensureOrder(id);
    return { ...(await this.detail(id, user)), keyId: process.env.RAZORPAY_KEY_ID?.trim() };
  }

  private async ensureOrder(id: string) {
    // A durable dispatch timestamp prevents concurrent requests from creating multiple orders.
    const claimed = await this.prisma.$queryRaw<
      { amount: number }[]
    >`UPDATE commission_payments SET last_checked_at=now(),updated_at=now()
      WHERE id=${id}::uuid AND order_id IS NULL AND last_checked_at IS NULL AND status='PENDING' RETURNING amount_paise AS amount`;
    if (claimed[0]) {
      try {
        const order = await this.gateway.createPayment({
          amount: claimed[0].amount,
          currency: 'INR',
          bookingId: id,
          receipt: id,
        });
        await this.prisma
          .$executeRaw`UPDATE commission_payments SET order_id=${order.orderId},updated_at=now() WHERE id=${id}::uuid AND order_id IS NULL`;
      } catch (error) {
        // Only a definitive provider rejection or local credential preflight permits another dispatch.
        // Network timeouts and persistence failures retain the dispatch marker for receipt recovery.
        if (
          error instanceof RazorpayOrderRejectedException ||
          (error instanceof Error &&
            ['Razorpay key is not configured', 'Razorpay secret is not configured'].includes(
              error.message,
            ))
        )
          await this.prisma
            .$executeRaw`UPDATE commission_payments SET last_checked_at=NULL WHERE id=${id}::uuid AND order_id IS NULL`;
        throw error;
      }
    } else {
      const row = await this.detail(id);
      if (!row.orderId && row.status === 'PENDING') {
        const orders = await this.gateway.getOrdersByReceipt(id);
        if (
          orders.length === 1 &&
          orders[0]!.amount === row.amountPaise &&
          orders[0]!.currency === 'INR'
        )
          await this.prisma
            .$executeRaw`UPDATE commission_payments SET order_id=${orders[0]!.id},updated_at=now() WHERE id=${id}::uuid AND order_id IS NULL`;
        await this.prisma
          .$executeRaw`UPDATE commission_payments SET last_checked_at=now() WHERE id=${id}::uuid`;
        // An empty receipt lookup is not proof that a timed-out gateway write failed. Never repost it.
      }
    }
  }

  public async verify(
    id: string,
    user: AuthenticatedUser,
    input: { orderId: string; paymentId: string; signature: string },
  ) {
    const row = await this.detail(id, user);
    if (row.orderId !== input.orderId)
      throw new BadRequestException('Order does not belong to this payment');
    if (!(await this.gateway.verifyPayment(input)).verified)
      throw new BadRequestException('Invalid payment signature');
    await this.reconcile(id);
    return this.detail(id, user);
  }

  public async reconcile(id: string) {
    await this.ensureOrder(id);
    const row = await this.detail(id);
    if (!row.orderId || row.status === 'SUCCESSFUL' || row.status === 'RECOVERY_REQUIRED') return;
    const payments = await this.gateway.getOrderPayments(row.orderId);
    const captured = payments.filter((p) => p.status === 'captured' && p.captured);
    await this.prisma
      .$executeRaw`UPDATE commission_payments SET last_checked_at=now() WHERE id=${id}::uuid`;
    if (!captured.length) {
      if (payments.length && payments.every((p) => p.status === 'failed'))
        await this.prisma
          .$executeRaw`UPDATE commission_payments SET status='FAILED',payment_id=${payments[payments.length - 1]!.id},method=${payments[payments.length - 1]!.method ?? null},updated_at=now()
            WHERE id=${id}::uuid AND status IN ('PENDING','FAILED','CANCELLED')`;
      return; // Retry reuses the same order; failed attempts never release the reservation.
    }
    const payment = captured[0]!;
    await this.prisma.$transaction(async (tx) => {
      await this.lockLodge(tx, row.lodgeId);
      const locked = await tx.$queryRaw<
        { status: string }[]
      >`SELECT status FROM commission_payments WHERE id=${id}::uuid FOR UPDATE`;
      if (locked[0]?.status === 'SUCCESSFUL' || locked[0]?.status === 'RECOVERY_REQUIRED') return;
      const items = await tx.$queryRaw<
        { id: string; reserved: number; due: number; eligible: boolean; expectedDue: number }[]
      >(Prisma.sql`
        SELECT l.id, i.amount_paise AS reserved, (${dueCommission}*100)::integer AS due,COALESCE(i.due_before_paise,i.amount_paise) AS "expectedDue",
          (l.status='OUTSTANDING' AND b.deleted_at IS NULL AND public.tuljai_commission_is_eligible(b.status::text,b.payment_status::text) AND ${offlineCommission}) AS eligible
        FROM commission_payment_items i JOIN lodge_commission_ledger l ON l.id=i.ledger_id JOIN bookings b ON b.id=l.booking_id
        WHERE i.payment_id=${id}::uuid ORDER BY b.id FOR UPDATE OF l`);
      const valid =
        captured.length === 1 &&
        payment.amount === row.amountPaise &&
        payment.currency === 'INR' &&
        payment.order_id === row.orderId &&
        !payment.amount_refunded &&
        items.length > 0 &&
        items.every((i) => i.eligible && i.due === i.expectedDue && i.reserved <= i.due) &&
        items.reduce((sum, i) => sum + i.reserved, 0) === row.amountPaise;
      if (!valid) {
        await tx.$executeRaw`UPDATE commission_payments SET status='RECOVERY_REQUIRED',payment_id=${payment.id},updated_at=now() WHERE id=${id}::uuid`;
        await tx.auditLog.create({
          data: {
            action: 'COMMISSION_PAYMENT_RECOVERY_REQUIRED',
            entityType: 'commission_payment',
            entityId: id,
            metadata: { orderId: row.orderId },
          },
        });
        return;
      }
      const settlement = await tx.$queryRaw<
        { id: string }[]
      >`INSERT INTO lodge_commission_settlements
        (lodge_id,amount,payment_method,reference,notes,settled_by_user_id) VALUES
        (${row.lodgeId}::uuid,${row.amountPaise}/100.0,'RAZORPAY',${payment.id},'Verified owner commission collection',${row.ownerId}::uuid) RETURNING id`;
      await tx.$executeRaw`INSERT INTO lodge_commission_settlement_allocations(settlement_id,ledger_id,amount)
        SELECT ${settlement[0]!.id}::uuid,ledger_id,amount_paise/100.0 FROM commission_payment_items WHERE payment_id=${id}::uuid`;
      await tx.$executeRaw(Prisma.sql`UPDATE lodge_commission_ledger l SET
        status=CASE WHEN ${dueCommission}=0 THEN 'SETTLED' ELSE 'OUTSTANDING' END,
        settled_at=CASE WHEN ${dueCommission}=0 THEN now() ELSE NULL END,updated_at=now()
        WHERE l.id IN (SELECT ledger_id FROM commission_payment_items WHERE payment_id=${id}::uuid)`);
      const remaining = await tx.$queryRaw<{ paise: number }[]>(
        Prisma.sql`SELECT ${outstandingCommissionPaise(row.lodgeId)} AS paise`,
      );
      await tx.$executeRaw`UPDATE commission_payments SET status='SUCCESSFUL',payment_id=${payment.id},method=${payment.method ?? null},remaining_after_paise=${remaining[0]!.paise},
        verified_at=now(),updated_at=now(),settlement_id=${settlement[0]!.id}::uuid WHERE id=${id}::uuid`;
      await tx.auditLog.create({
        data: {
          action: 'COMMISSION_PAYMENT_VERIFIED',
          actorUserId: row.ownerId,
          entityType: 'commission_payment',
          entityId: id,
          metadata: {
            amountPaise: row.amountPaise,
            orderId: row.orderId,
            paymentId: payment.id,
            settlementId: settlement[0]!.id,
          },
        },
      });
      await tx.notification.create({
        data: {
          dedupeKey: `commission-payment:${id}`,
          recipientUserId: row.ownerId,
          recipientRole: 'OWNER',
          lodgeId: row.lodgeId,
          title: 'Commission payment received',
          body: `Your commission payment of INR ${(row.amountPaise / 100).toFixed(2)} has been verified. Reference: ${id}`,
          type: 'SYSTEM',
          data: { context: 'PAYMENT', commissionPaymentId: id },
        },
      });
    });
  }

  public async receiveVerifiedWebhook(orderId: string) {
    const rows = await this.prisma.$queryRaw<
      { id: string }[]
    >`UPDATE commission_payments SET webhook_at=now()
      WHERE order_id=${orderId} RETURNING id`;
    if (!rows[0]) return false;
    await this.reconcile(rows[0].id);
    return true;
  }

  public async reconcilePending() {
    const rows = await this.prisma.$queryRaw<
      { id: string }[]
    >`SELECT id FROM commission_payments WHERE status IN ('PENDING','FAILED','CANCELLED')
      AND (last_checked_at IS NULL OR last_checked_at < now()-interval '30 seconds') ORDER BY last_checked_at NULLS FIRST LIMIT 20`;
    await Promise.allSettled(rows.map((row) => this.reconcile(row.id)));
  }

  public async cancelled(id: string, user: AuthenticatedUser) {
    await this.detail(id, user);
    await this.reconcile(id);
    // This is a checkout dismissal, not proof that the bank cannot capture later. Keep the order reserved.
    await this.prisma
      .$executeRaw`UPDATE commission_payments SET status='CANCELLED',updated_at=now() WHERE id=${id}::uuid AND status='PENDING'`;
    return this.detail(id, user);
  }
}
