import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const structuredClone = (value) => JSON.parse(JSON.stringify(value));

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');

const { RolesGuard } = require('../src/modules/auth/guards/roles.guard.ts');
const { BookingsService } = require('../src/modules/bookings/bookings.service.ts');
const {
  LodgeCommissionFinanceService,
} = require('../src/modules/lodges/commission-finance.service.ts');
const { NotificationsService } = require('../src/modules/notifications/notifications.service.ts');
const { FinanceAdminService } = require('../src/modules/payments/finance-admin.service.ts');
const {
  resolvePaymentCollectionStatus,
  recordUncapturedPaymentOutcome,
} = require('../src/modules/payments/payment-collection-status.ts');
const { PaymentsService } = require('../src/modules/payments/payments.service.ts');
const {
  RazorpayProvider,
  RazorpayOrderRejectedException,
} = require('../src/modules/payments/providers/razorpay.provider.ts');
const {
  DEFAULT_CANCELLATION_POLICY,
  refundPercent,
  moneyToPaise,
  parseCancellationPolicy,
} = require('../src/modules/payments/refund-policy.ts');
const { RefundsService } = require('../src/modules/payments/refunds.service.ts');

test('India calendar policy, decimal paise and malformed settings', () => {
  const arrival = new Date('2026-11-14');
  for (const [time, percent] of [
    ['2026-11-10T18:29:59Z', 100],
    ['2026-11-10T18:30:00Z', 90],
    ['2026-11-12T18:29:59Z', 90],
    ['2026-11-12T18:30:00Z', 80],
    ['2026-11-14T10:00:00Z', 80],
  ])
    assert.equal(refundPercent(DEFAULT_CANCELLATION_POLICY, arrival, new Date(time)), percent);
  assert.equal(moneyToPaise('1234.56'), 123456);
  assert.throws(() => moneyToPaise('1.001'));
  assert.throws(() => parseCancellationPolicy({ configured: true, tiers: [null] }));
  assert.throws(() =>
    parseCancellationPolicy({
      configured: true,
      tiers: [{ daysBeforeCheckIn: 0, refundPercent: 101 }],
    }),
  );
});

test('payment labels preserve captured receipts and resolve failed/cancelled pending records', () => {
  for (const [status, bookingStatus, paymentStatus, expected] of [
    ['PENDING', 'CANCELLED', 'PENDING', 'CANCELLED'],
    ['PENDING', 'REJECTED', 'PAY_AT_LODGE', 'CANCELLED'],
    ['PENDING', 'ACCEPTED', 'FAILED', 'FAILED'],
    ['FAILED', 'CANCELLED', 'FAILED', 'FAILED'],
    ['PAID', 'CANCELLED', 'FULLY_PAID', 'PAID'],
    ['REFUNDED', 'CANCELLED', 'REFUNDED', 'REFUNDED'],
    ['PENDING', 'PENDING_OWNER_APPROVAL', 'PENDING', 'PENDING'],
  ])
    assert.equal(
      resolvePaymentCollectionStatus(
        { status, method: 'ONLINE' },
        { status: bookingStatus, paymentStatus },
      ),
      expected,
    );
});

test('Razorpay webhook signature uses the exact raw body', () => {
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = 'unit-test-webhook-secret';
  try {
    const provider = new RazorpayProvider();
    const raw = Buffer.from('{ "event": "refund.created" }');
    const signature = createHmac('sha256', 'unit-test-webhook-secret').update(raw).digest('hex');
    assert.equal(provider.verifyWebhook(raw, signature), true);
    assert.equal(
      provider.verifyWebhook(Buffer.from(JSON.stringify(JSON.parse(raw.toString()))), signature),
      false,
    );
    assert.equal(provider.verifyWebhook(raw, 'bad'), false);
    assert.equal(provider.verifyWebhook(raw, undefined), false);
  } finally {
    if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
  }
});

test(
  'PostgreSQL cancellation/refund lifecycle with mocked Razorpay only',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 180000 },
  async (t) => {
    const base = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(
      ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname),
      'Loopback test databases only',
    );
    assert.match(base.pathname, /^\/tuljai_test_[a-zA-Z0-9_]+$/);
    const name = `tuljai_test_refunds_${randomUUID().replace(/-/g, '')}`;
    const admin = new Client({ connectionString: base.href });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(base);
    url.pathname = `/${name}`;
    const sql = new Client({ connectionString: url.href });
    await sql.connect();
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
    const db2 = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
    try {
      const root = new URL('../prisma/migrations/', import.meta.url);
      for (const folder of readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))) {
        // Same two historical fixture accommodations as the existing booking integration suite.
        if (folder.name === '20260821123000_add_review_owner_responses') continue;
        if (folder.name === '20260819090000_sync_online_payment_setting')
          await sql.query(
            "INSERT INTO system_settings(id,key,value,updated_at) VALUES(gen_random_uuid(),'enable_online_payments','false',now())",
          );
        await sql.query(readFileSync(new URL(`${folder.name}/migration.sql`, root), 'utf8'));
      }
      const noop = new Proxy({}, { get: () => async () => undefined });
      const bookings = (client) =>
        new BookingsService(
          noop,
          {},
          noop,
          { get: (_key, fallback) => fallback },
          {},
          { isAdmin: (u) => u.roles.includes('ADMIN') },
          noop,
          client,
        );
      async function fixture({
        days = 5,
        method = 'ONLINE',
        paymentStatus = 'FULLY_PAID',
        providerStatus = 'captured',
        amount = '1000.55',
        commission = false,
      } = {}) {
        const user = await db.user.create({
          data: { roles: ['PILGRIM'], displayName: 'Refund test pilgrim' },
        });
        const administrator = await db.user.create({
          data: { roles: ['ADMIN'], displayName: 'Refund test admin' },
        });
        const city = await db.city.create({
          data: { name: 'Test', slug: randomUUID(), state: 'MH', country: 'IN' },
        });
        const lodge = await db.lodge.create({
          data: {
            cityId: city.id,
            name: 'Refund test lodge',
            slug: randomUUID(),
            propertyType: 'LODGE',
            primaryPhone: '+919999999999',
          },
        });
        if (commission)
          await sql.query(
            `INSERT INTO lodge_commission_settings(lodge_id,commission_enabled,commission_rate_percent,effective_from)
          VALUES($1,true,20,now()) ON CONFLICT(lodge_id) DO UPDATE SET commission_enabled=true,commission_rate_percent=20,effective_from=now()`,
            [lodge.id],
          );
        const roomType = await db.roomType.create({
          data: {
            lodgeId: lodge.id,
            name: 'Room',
            slug: randomUUID(),
            basePrice: amount,
            capacityAdults: 2,
            capacityChildren: 0,
            totalRooms: 1,
          },
        });
        const room = await db.room.create({
          data: {
            lodgeId: lodge.id,
            roomTypeId: roomType.id,
            roomNumber: '1',
            status: 'CONFIRMED',
          },
        });
        const indiaToday = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
        const checkInDate = new Date(Date.parse(indiaToday) + days * 86400000);
        const checkOutDate = new Date(checkInDate.getTime() + 86400000);
        const booking = await db.booking.create({
          data: {
            bookingCode: randomUUID(),
            pilgrimUserId: user.id,
            cityId: city.id,
            lodgeId: lodge.id,
            roomTypeId: roomType.id,
            roomId: room.id,
            status: 'ACCEPTED',
            guestName: 'Refund test pilgrim',
            guestPhone: '+919999999999',
            numberOfAdults: 1,
            numberOfChildren: 0,
            totalGuests: 1,
            checkInDate,
            checkOutDate,
            totalAmount: amount,
            paymentStatus,
          },
        });
        let paymentId = `pay_${randomUUID()}`;
        const orderId = `order_${randomUUID()}`;
        const collection = await db.paymentCollection.create({
          data: {
            bookingId: booking.id,
            method,
            provider: method === 'ONLINE' ? 'RAZORPAY' : null,
            amount,
            status:
              providerStatus === 'failed'
                ? 'FAILED'
                : providerStatus === 'authorized'
                  ? 'PENDING'
                  : 'PAID',
            providerPaymentId: method === 'ONLINE' ? paymentId : null,
            providerOrderId: method === 'ONLINE' ? orderId : null,
          },
        });
        const providerRefunds = [];
        let writes = 0,
          mode = 'ok',
          status = providerStatus,
          notificationFailure = false;
        const provider = {
          getPayment: async () => ({
            id: paymentId,
            order_id: orderId,
            amount: moneyToPaise(amount),
            currency: 'INR',
            status,
            captured: ['captured', 'refunded'].includes(status),
            method: 'upi',
            amount_refunded: providerRefunds
              .filter((r) => r.status === 'processed')
              .reduce((s, r) => s + r.amount, 0),
          }),
          getOrderPayments: async () => [await provider.getPayment()],
          getPaymentRefunds: async () => structuredClone(providerRefunds),
          getRefund: async (id) => structuredClone(providerRefunds.find((r) => r.id === id)),
          createRefund: async (id, input) => {
            writes++;
            assert.equal(id, paymentId);
            const duplicate = providerRefunds.find((r) => r.receipt === input.receipt);
            if (duplicate) return structuredClone(duplicate);
            if (mode === 'reject')
              throw new RazorpayOrderRejectedException('Insufficient provider balance');
            if (mode === 'timeoutBefore') throw new Error('Network timeout before acceptance');
            const r = {
              id: `rfnd_${randomUUID()}`,
              payment_id: paymentId,
              amount: input.amount,
              currency: 'INR',
              status: mode === 'immediateProcessed' ? 'processed' : 'pending',
              receipt: input.receipt,
              speed_requested: 'normal',
            };
            providerRefunds.push(r);
            if (mode === 'timeoutAfter') throw new Error('Network timeout after acceptance');
            return structuredClone(r);
          },
          verifyWebhook: (body, signature) =>
            signature === createHmac('sha256', 'mock-webhook-only').update(body).digest('hex'),
        };
        const notify = {
          create: async (input) => {
            if (notificationFailure) throw new Error('Push unavailable');
            return realNotifications.create(input);
          },
        };
        const realNotifications = new NotificationsService({ sendPushToUser: async () => {} }, db, {
          publishToUser: () => {},
          publishToRole: () => {},
        });
        const cancellationEvents = {
          bookingCancelled: async () => {
            if (notificationFailure) throw new Error('Notification unavailable');
            await realNotifications.create({
              dedupeKey: `cancel:${booking.id}`,
              recipientUserId: user.id,
              recipientRole: 'PILGRIM',
              bookingId: booking.id,
              title: 'Cancelled',
              body: 'Cancelled',
              type: 'BOOKING_CANCELLED',
            });
          },
        };
        const refunds = new RefundsService(db, provider, notify, cancellationEvents);
        const refunds2 = new RefundsService(db2, provider, notify, cancellationEvents);
        const actor = { id: user.id, roles: ['PILGRIM'] },
          adminActor = { id: administrator.id, roles: ['ADMIN'] };
        const cancel = () =>
          bookings(db).cancelBooking(
            booking.id,
            { reason: 'Change of plans', confirmed: true },
            actor,
          );
        const ledger = () =>
          db.bookingRefund.findFirstOrThrow({
            where: { bookingId: booking.id },
            include: { history: { orderBy: { createdAt: 'asc' } } },
          });
        return {
          booking,
          collection,
          room,
          user,
          adminActor,
          actor,
          provider,
          refunds,
          refunds2,
          providerRefunds,
          cancel,
          ledger,
          writes: () => writes,
          setMode: (m) => (mode = m),
          setPayment: (s, id) => {
            status = s;
            if (id) paymentId = id;
          },
          setNotificationFailure: (v) => (notificationFailure = v),
        };
      }
      async function initiate(f) {
        await f.cancel();
        const r = await f.ledger();
        await f.refunds.reconcile(r.id);
        return f.ledger();
      }
      await t.test(
        'successful pilgrim full refund; API acceptance does not mark processed',
        async () => {
          const f = await fixture();
          f.setMode('immediateProcessed');
          let r = await initiate(f);
          assert.equal(r.amount, 100055);
          assert.equal(r.status, 'INITIATED');
          assert.equal(f.writes(), 1);
          await f.refunds.reconcile(r.id);
          r = await f.ledger();
          assert.equal(r.status, 'PROCESSED');
          assert.equal(
            (await db.booking.findUnique({ where: { id: f.booking.id } })).paymentStatus,
            'REFUNDED',
          );
        },
      );
      await t.test('partial refunds: 10% fee 2–3 days; 20% fee 0–1 days', async () => {
        for (const [days, amount] of [
          [3, 90049],
          [2, 90049],
          [1, 80044],
          [0, 80044],
        ]) {
          const f = await fixture({ days });
          const r = await initiate(f);
          assert.equal(r.amount, amount);
          assert.equal(r.status, 'INITIATED');
        }
      });
      await t.test('admin room-full cancellation has full refund and actor audit', async () => {
        const f = await fixture({ days: 0 });
        await bookings(db).cancelBooking(
          f.booking.id,
          { confirmed: true, reason: 'Room Full' },
          f.adminActor,
        );
        let r = await f.ledger();
        await f.refunds.reconcile(r.id);
        r = await f.ledger();
        assert.equal(r.amount, 100055);
        assert.equal(
          (await db.booking.findUnique({ where: { id: f.booking.id } })).cancelledByUserId,
          f.adminActor.id,
        );
        assert.equal(
          await db.auditLog.count({
            where: { entityId: f.booking.id, action: 'BOOKING_CANCELLED_BY_ADMIN' },
          }),
          1,
        );
      });
      await t.test('Pay-at-Lodge cancellation never calls Razorpay', async () => {
        const f = await fixture({ method: 'PAY_AT_LODGE', paymentStatus: 'PAY_AT_LODGE' });
        await f.cancel();
        assert.equal(await db.bookingRefund.count({ where: { bookingId: f.booking.id } }), 0);
        assert.equal(f.writes(), 0);
      });
      await t.test('failed payment creates no provider refund', async () => {
        const f = await fixture({ providerStatus: 'failed', paymentStatus: 'FAILED' });
        const r = await initiate(f);
        assert.equal(r.status, 'NOT_REQUIRED');
        assert.equal(f.writes(), 0);
      });
      await t.test('reversed uncaptured authorization needs no refund API call', async () => {
        const f = await fixture({ providerStatus: 'authorized', paymentStatus: 'PENDING' });
        const read = f.provider.getPayment;
        f.provider.getPayment = async () => ({
          ...(await read()),
          status: 'refunded',
          captured: false,
        });
        assert.equal((await initiate(f)).status, 'NOT_REQUIRED');
        assert.equal(f.writes(), 0);
      });
      await t.test(
        'captured webhook reopens a cancelled failed-payment attempt without reactivating booking',
        async () => {
          const f = await fixture({ providerStatus: 'failed', paymentStatus: 'FAILED' });
          let r = await initiate(f);
          assert.equal(r.status, 'NOT_REQUIRED');
          const latePaymentId = `pay_${randomUUID()}`;
          f.setPayment('captured', latePaymentId);
          const payments = new PaymentsService({}, {}, db, f.provider, {}, {}, f.refunds);
          const raw = Buffer.from(
            JSON.stringify({
              event: 'payment.captured',
              payload: {
                payment: {
                  entity: {
                    id: latePaymentId,
                    order_id: f.collection.providerOrderId,
                  },
                },
              },
            }),
          );
          const signature = createHmac('sha256', 'mock-webhook-only').update(raw).digest('hex');
          await payments.receiveWebhook(raw, signature, `evt_late_capture_${randomUUID()}`);
          r = await f.ledger();
          assert.equal(r.status, 'PENDING');
          await f.refunds.reconcile(r.id);
          assert.equal(f.writes(), 1);
          assert.equal(
            (await db.booking.findUnique({ where: { id: f.booking.id } })).status,
            'CANCELLED',
          );
        },
      );
      await t.test(
        'authorized payment is never captured to refund; later capture reconciles safely',
        async () => {
          const f = await fixture({ providerStatus: 'authorized', paymentStatus: 'PENDING' });
          let r = await initiate(f);
          assert.equal(r.status, 'PENDING');
          assert.equal(f.writes(), 0);
          f.setPayment('captured');
          await f.refunds.reconcile(r.id);
          assert.equal(f.writes(), 1);
          assert.equal(
            (await db.booking.findUnique({ where: { id: f.booking.id } })).status,
            'CANCELLED',
          );
        },
      );
      await t.test(
        'duplicate and simultaneous cancellations commit one inventory release/history/outbox/refund',
        async () => {
          const f = await fixture();
          await Promise.all([
            f.cancel(),
            bookings(db2).cancelBooking(
              f.booking.id,
              { reason: 'Room Full', confirmed: true },
              f.adminActor,
            ),
            f.cancel(),
          ]);
          let r = await f.ledger();
          await Promise.all([f.refunds.reconcile(r.id), f.refunds2.reconcile(r.id)]);
          assert.equal(f.writes(), 1);
          assert.equal(await db.bookingRefund.count({ where: { bookingId: f.booking.id } }), 1);
          assert.equal(
            await db.bookingHistory.count({
              where: { bookingId: f.booking.id, toStatus: 'CANCELLED' },
            }),
            1,
          );
          assert.equal(
            await db.refundNotificationOutbox.count({
              where: { bookingId: f.booking.id, status: 'CANCELLED' },
            }),
            1,
          );
          assert.equal(
            (await db.room.findUnique({ where: { id: f.room.id } })).status,
            'AVAILABLE',
          );
          assert.equal(
            await db.roomStatusHistory.count({
              where: { bookingId: f.booking.id, toStatus: 'AVAILABLE' },
            }),
            1,
          );
        },
      );
      await t.test(
        'timeout after acceptance reconciles existing receipt; restart does not POST twice',
        async () => {
          const f = await fixture();
          f.setMode('timeoutAfter');
          let r = await initiate(f);
          assert.equal(r.status, 'PENDING');
          assert.equal(r.history.length, 1);
          await f.refunds2.reconcile(r.id);
          r = await f.ledger();
          assert.equal(r.status, 'INITIATED');
          assert.equal(f.writes(), 1);
        },
      );
      await t.test(
        'timeout before acceptance reconciles first and reuses identical receipt',
        async () => {
          const f = await fixture();
          f.setMode('timeoutBefore');
          let r = await initiate(f);
          const receipt = r.history[0].receipt;
          f.setMode('ok');
          await f.refunds2.reconcile(r.id);
          r = await f.ledger();
          assert.equal(r.history.length, 1);
          assert.equal(r.history[0].receipt, receipt);
          assert.equal(f.providerRefunds[0].receipt, receipt);
        },
      );
      await t.test('provider rejection surfaces failed refund and audited retry', async () => {
        const f = await fixture();
        f.setMode('reject');
        let r = await initiate(f);
        assert.equal(r.status, 'FAILED');
        f.setMode('ok');
        await f.refunds.retry(r.id, f.adminActor);
        r = await f.ledger();
        assert.equal(r.status, 'INITIATED');
        assert.equal(r.history.length, 1);
        assert.equal(
          await db.auditLog.count({ where: { entityId: r.id, action: 'ADMIN_REFUND_RETRY' } }),
          1,
        );
      });
      await t.test('duplicate, failed, processed and out-of-order signed webhooks', async () => {
        const f = await fixture();
        let r = await initiate(f);
        const payments = new PaymentsService({}, {}, db, f.provider, {}, {}, f.refunds);
        const event = async (type, id) => {
          const body = Buffer.from(
            JSON.stringify({
              event: type,
              payload: { refund: { entity: f.providerRefunds.at(-1) } },
            }),
          );
          const sig = createHmac('sha256', 'mock-webhook-only').update(body).digest('hex');
          return payments.receiveWebhook(body, sig, id);
        };
        await assert.rejects(payments.receiveWebhook(Buffer.from('{}'), 'bad', 'bad'));
        await event('refund.created', 'evt_created');
        await event('refund.created', 'evt_created');
        assert.equal(await db.refundWebhookEvent.count({ where: { id: 'evt_created' } }), 1);
        f.providerRefunds[0].status = 'failed';
        await event('refund.failed', 'evt_failed');
        assert.equal((await f.ledger()).status, 'FAILED');
        await f.refunds.retry(r.id, f.adminActor);
        r = await f.ledger();
        assert.equal(r.history.length, 2);
        f.providerRefunds.at(-1).status = 'processed';
        await event('refund.processed', 'evt_processed');
        assert.equal((await f.ledger()).status, 'PROCESSED');
        f.providerRefunds.at(-1).speed_processed = 'normal';
        await event('refund.speed_changed', 'evt_speed');
        await event('refund.created', 'evt_late');
        assert.equal((await f.ledger()).status, 'PROCESSED');
        assert.equal(f.writes(), 2);
      });
      await t.test(
        'notification failures preserve cancellation and durable retry, duplicate notices collapse',
        async () => {
          const f = await fixture();
          f.setNotificationFailure(true);
          let r = await initiate(f);
          await f.refunds.deliverNotifications();
          assert.equal(
            (await db.booking.findUnique({ where: { id: f.booking.id } })).status,
            'CANCELLED',
          );
          assert.ok(
            await db.refundNotificationOutbox.count({
              where: { bookingId: f.booking.id, deliveredAt: null },
            }),
          );
          f.setNotificationFailure(false);
          await db.refundNotificationOutbox.updateMany({
            where: { bookingId: f.booking.id },
            data: { nextCheckAt: new Date(0) },
          });
          await f.refunds.deliverNotifications();
          await db.refundNotificationOutbox.updateMany({
            where: { bookingId: f.booking.id },
            data: { deliveredAt: null, nextCheckAt: new Date(0) },
          });
          await f.refunds.deliverNotifications();
          assert.equal(
            await db.notification.count({
              where: {
                recipientUserId: f.user.id,
                bookingId: f.booking.id,
                type: 'BOOKING_CANCELLED',
              },
            }),
            1,
          );
          assert.equal(
            await db.notification.count({ where: { dedupeKey: `refund:${r.id}:INITIATED` } }),
            1,
          );
        },
      );
      await t.test(
        'prior partial refund reduces remaining entitlement; no refund above captured amount',
        async () => {
          const f = await fixture({ days: 2 });
          f.providerRefunds.push({
            id: 'rfnd_external',
            payment_id: f.collection.providerPaymentId,
            amount: 50000,
            currency: 'INR',
            status: 'processed',
            receipt: 'external',
          });
          const r = await initiate(f);
          assert.equal(r.amount, 40049);
          assert.ok(f.providerRefunds.reduce((sum, p) => sum + p.amount, 0) <= 100055);
          const g = await fixture();
          g.providerRefunds.push({
            id: 'invalid',
            payment_id: g.collection.providerPaymentId,
            amount: 100056,
            currency: 'INR',
            status: 'pending',
          });
          assert.equal((await initiate(g)).status, 'FAILED');
          assert.equal(g.writes(), 0);
        },
      );
      await t.test(
        'ownership, confirmation, owner permissions and admin operational deductions',
        async () => {
          const f = await fixture();
          await assert.rejects(
            bookings(db).cancelBooking(
              f.booking.id,
              { reason: 'X', confirmed: true },
              { id: randomUUID(), roles: ['PILGRIM'] },
            ),
            /cannot cancel/,
          );
          await assert.rejects(
            bookings(db).cancelBooking(f.booking.id, { reason: 'X', confirmed: false }, f.actor),
            /Confirm/,
          );
          await assert.rejects(
            bookings(db).cancelBooking(
              f.booking.id,
              { reason: 'X', confirmed: true },
              { ...f.actor, roles: ['OWNER'] },
            ),
            /cannot cancel/,
          );
          await assert.rejects(
            bookings(db).cancelBooking(
              f.booking.id,
              { reason: 'Room Full', confirmed: true, deductionPaise: 10 },
              f.adminActor,
            ),
            /full refund/,
          );
          const guard = new RolesGuard({ getAllAndOverride: () => ['ADMIN'] }, db);
          assert.equal(
            await guard.canActivate({
              getHandler: () => {},
              getClass: () => {},
              switchToHttp: () => ({
                getRequest: () => ({ user: { ...f.actor, roles: ['OWNER'] } }),
              }),
            }),
            false,
          );
        },
      );
      await t.test(
        'support deduction requires correct pilgrim ticket and remains auditable',
        async () => {
          const f = await fixture();
          const ticket = randomUUID();
          await sql.query(
            "INSERT INTO support_tickets(id,requester_user_id,requester_role,subject,category) VALUES($1,$2,'PILGRIM','Cancel booking','BOOKING')",
            [ticket, f.user.id],
          );
          await bookings(db).cancelBooking(
            f.booking.id,
            {
              reason: 'Pilgrim Support Request',
              confirmed: true,
              supportTicketId: ticket,
              deductionPaise: 12345,
              deductionReason: 'Pilgrim requested deduction',
            },
            f.adminActor,
          );
          const r = await f.ledger();
          assert.equal(r.amount, 87710);
          assert.equal(
            (await db.booking.findUnique({ where: { id: f.booking.id } })).cancellationPolicy
              .deductionPaise,
            12345,
          );
        },
      );
      await t.test(
        'transaction rollback loses neither inventory nor committed refund request',
        async () => {
          const f = await fixture();
          const original = await db.booking.findUnique({ where: { id: f.booking.id } });
          await sql.query(
            `CREATE FUNCTION fail_refund_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END; $$; CREATE TRIGGER test_refund_failure BEFORE INSERT ON booking_refunds FOR EACH ROW EXECUTE FUNCTION fail_refund_test();`,
          );
          await assert.rejects(f.cancel());
          await sql.query(
            'DROP TRIGGER test_refund_failure ON booking_refunds; DROP FUNCTION fail_refund_test()',
          );
          assert.equal(
            (await db.booking.findUnique({ where: { id: f.booking.id } })).status,
            original.status,
          );
          assert.equal(
            (await db.room.findUnique({ where: { id: f.room.id } })).status,
            'CONFIRMED',
          );
          assert.equal(await db.bookingRefund.count({ where: { bookingId: f.booking.id } }), 0);
        },
      );
      await t.test('policy snapshot is preserved when admin changes future policy', async () => {
        const f = await fixture({ days: 2 });
        await db.systemSetting.update({
          where: { key: 'booking_cancellation_policy' },
          data: {
            value: { configured: true, tiers: [{ daysBeforeCheckIn: 0, refundPercent: 50 }] },
          },
        });
        assert.equal((await initiate(f)).amount, 90049);
        await db.systemSetting.update({
          where: { key: 'booking_cancellation_policy' },
          data: { value: DEFAULT_CANCELLATION_POLICY },
        });
      });
      await t.test(
        'finance excludes cancelled revenue and prevents owner commission settlement',
        async () => {
          const f = await fixture();
          await initiate(f);
          assert.equal(
            await sql
              .query('SELECT * FROM lodge_commission_ledger WHERE booking_id=$1', [f.booking.id])
              .then((r) => r.rowCount),
            0,
          );
          const finance = new LodgeCommissionFinanceService(
            {},
            { isAdmin: () => true, assertLodgeExists: async () => undefined },
            db,
          );
          const report = await finance.getReport(f.booking.lodgeId);
          assert.equal(Number(report.summary.bookingRevenue), 0);
          await assert.rejects(
            finance.createSettlement(
              f.booking.lodgeId,
              { amount: 1, paymentMethod: 'BANK' },
              f.adminActor.id,
            ),
            /exceeds/,
          );
          await assert.rejects(
            db.booking.update({ where: { id: f.booking.id }, data: { status: 'COMPLETED' } }),
            /Cancelled bookings cannot be reactivated/,
          );
        },
      );
      await t.test(
        'unique provider refund IDs, notification keys, RLS and captured amount database constraint',
        async () => {
          const f = await fixture();
          const r = await initiate(f);
          await assert.rejects(
            db.bookingRefund.update({ where: { id: r.id }, data: { amount: 100056 } }),
          );
          await assert.rejects(
            db.refundAttempt.create({
              data: {
                refundId: r.id,
                receipt: 'duplicate-provider',
                amount: 1,
                providerRefundId: r.history[0].providerRefundId,
              },
            }),
          );
          const rls = await sql.query(
            "SELECT count(*)::int AS n FROM pg_class WHERE relname IN ('booking_refunds','refund_attempts','refund_webhook_events','refund_notification_outbox') AND relrowsecurity",
          );
          assert.equal(rls.rows[0].n, 4);
          const role = `refund_client_${randomUUID().replace(/-/g, '')}`;
          await sql.query(
            `CREATE ROLE "${role}" NOLOGIN; GRANT USAGE ON SCHEMA public TO "${role}"; GRANT SELECT ON booking_refunds,refund_attempts,refund_webhook_events,refund_notification_outbox TO "${role}"`,
          );
          try {
            await sql.query(`BEGIN; SET LOCAL ROLE "${role}"`);
            for (const table of [
              'booking_refunds',
              'refund_attempts',
              'refund_webhook_events',
              'refund_notification_outbox',
            ])
              assert.equal(
                (await sql.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,
                0,
              );
          } finally {
            await sql.query('ROLLBACK');
            await sql.query(
              `REVOKE ALL ON booking_refunds,refund_attempts,refund_webhook_events,refund_notification_outbox FROM "${role}"; REVOKE ALL ON SCHEMA public FROM "${role}"; DROP ROLE "${role}"`,
            );
          }
        },
      );
      await t.test(
        'existing online commission eligibility is preserved and cancellation voids only unallocated ledger',
        async () => {
          const f = await fixture({ commission: true });
          const finance = new LodgeCommissionFinanceService(
            noop,
            { isAdmin: () => true, assertLodgeExists: async () => undefined },
            db,
          );
          assert.ok(Number((await finance.getReport(f.booking.lodgeId)).summary.outstanding) > 0);
          await initiate(f);
          const ledger = await sql.query(
            'SELECT status FROM lodge_commission_ledger WHERE booking_id=$1',
            [f.booking.id],
          );
          assert.equal(ledger.rows[0].status, 'VOIDED');
          assert.equal(Number((await finance.getReport(f.booking.lodgeId)).summary.outstanding), 0);
        },
      );
      await t.test(
        'settled commission history is retained and flagged for explicit adjustment after cancellation',
        async () => {
          const f = await fixture({ commission: true });
          const finance = new LodgeCommissionFinanceService(
            noop,
            { isAdmin: () => true, assertLodgeExists: async () => undefined },
            db,
          );
          await finance.createSettlement(
            f.booking.lodgeId,
            { amount: 10, paymentMethod: 'TEST' },
            f.adminActor.id,
          );
          await f.cancel();
          const booking = await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
          assert.equal(booking.cancellationPolicy.settledCommissionReview.length, 1);
          assert.equal(
            await db.refundNotificationOutbox.count({
              where: { bookingId: f.booking.id, status: 'ACCOUNTING_REVIEW' },
            }),
            1,
          );
          assert.equal(Number((await finance.getReport(f.booking.lodgeId)).summary.outstanding), 0);
          assert.equal(
            Number(
              (
                await sql.query(
                  'SELECT SUM(a.amount)::text AS amount FROM lodge_commission_settlement_allocations a INNER JOIN lodge_commission_ledger l ON l.id=a.ledger_id WHERE l.booking_id=$1',
                  [f.booking.id],
                )
              ).rows[0].amount,
            ),
            10,
          );
          await assert.rejects(
            finance.createSettlement(
              f.booking.lodgeId,
              { amount: 1, paymentMethod: 'TEST' },
              f.adminActor.id,
            ),
            /exceeds/,
          );
        },
      );
      await t.test(
        'existing refunds covering entitlement never create an extra refund; pending prior refunds are reconciled',
        async () => {
          const f = await fixture();
          f.providerRefunds.push({
            id: 'prior-full',
            payment_id: f.collection.providerPaymentId,
            amount: 100055,
            currency: 'INR',
            status: 'processed',
          });
          assert.equal((await initiate(f)).status, 'NOT_REQUIRED');
          assert.equal(f.writes(), 0);
          const g = await fixture();
          g.providerRefunds.push({
            id: 'prior-pending',
            payment_id: g.collection.providerPaymentId,
            amount: 100055,
            currency: 'INR',
            status: 'pending',
          });
          const r = await initiate(g);
          assert.equal(r.status, 'PENDING');
          assert.equal(g.writes(), 0);
          g.providerRefunds[0].status = 'failed';
          await g.refunds.reconcile(r.id);
          assert.equal(g.writes(), 1);
        },
      );
      await t.test(
        'Admin Razorpay rows, status filters and totals agree on actual failed/cancelled payments',
        async () => {
          const finance = new FinanceAdminService(db);
          const cancelled = await fixture({
            providerStatus: 'authorized',
            paymentStatus: 'PENDING',
          });
          await cancelled.cancel();
          const failed = await fixture({ providerStatus: 'failed', paymentStatus: 'FAILED' });
          await db.paymentCollection.update({
            where: { id: failed.collection.id },
            data: { status: 'PENDING' },
          });
          const paid = await fixture();
          await paid.cancel();
          for (const [f, status] of [
            [cancelled, 'CANCELLED'],
            [failed, 'FAILED'],
            [paid, 'PAID'],
          ]) {
            const result = await finance.listPayments({
              page: 1,
              pageSize: 20,
              search: f.booking.bookingCode,
              status,
              method: 'ONLINE',
            });
            assert.equal(result.totalItems, 1);
            assert.equal(result.items[0].status, status);
            assert.equal(result.statusCounts.find((s) => s.status === status).count, 1);
            assert.equal(result.statusCounts.find((s) => s.status === 'PENDING').count, 0);
            if (status === 'CANCELLED' || status === 'PAID')
              assert.equal(result.items[0].bookingStatus, 'CANCELLED');
          }
          const detail = await paid.refunds.detail((await paid.ledger()).id);
          assert.equal(detail.paymentStatus, 'PAID');
          assert.equal(detail.status, 'PENDING');
          assert.equal(detail.bookingStatus, 'CANCELLED');
        },
      );
      await t.test(
        'verified failed attempts synchronize collections without demoting captured or authorized payments',
        async () => {
          const f = await fixture({ providerStatus: 'failed', paymentStatus: 'PENDING' });
          await db.paymentCollection.update({
            where: { id: f.collection.id },
            data: { status: 'PENDING' },
          });
          await db.paymentIntent.create({
            data: {
              lockCode: `legacy:${f.booking.id}`,
              pilgrimUserId: f.user.id,
              providerOrderId: f.collection.providerOrderId,
              amount: f.collection.amount,
              bookingId: f.booking.id,
            },
          });
          const payments = new PaymentsService({}, {}, db, f.provider, {}, {}, f.refunds);
          const failedPayment = await f.provider.getPayment();
          f.provider.getOrderPayments = async () => [
            failedPayment,
            { ...failedPayment, id: 'pay_authorized', status: 'authorized' },
          ];
          await payments.reconcileOrder(f.collection.providerOrderId);
          assert.equal(
            (await db.paymentCollection.findUniqueOrThrow({ where: { id: f.collection.id } }))
              .status,
            'PENDING',
          );
          f.provider.getOrderPayments = async () => [failedPayment];
          await payments.reconcileOrder(f.collection.providerOrderId);
          assert.equal(
            (await db.paymentCollection.findUniqueOrThrow({ where: { id: f.collection.id } }))
              .status,
            'FAILED',
          );
          assert.equal(
            (await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paymentStatus,
            'FAILED',
          );
          f.provider.getOrderPayments = async () => [
            { ...failedPayment, id: 'pay_retry_authorized', status: 'authorized' },
          ];
          await payments.reconcileOrder(f.collection.providerOrderId);
          assert.equal(
            (await db.paymentCollection.findUniqueOrThrow({ where: { id: f.collection.id } }))
              .status,
            'PENDING',
          );
          assert.equal(
            (await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paymentStatus,
            'PENDING',
          );
          await db.paymentCollection.update({
            where: { id: f.collection.id },
            data: { status: 'PAID' },
          });
          await db.booking.update({
            where: { id: f.booking.id },
            data: { paymentStatus: 'FULLY_PAID' },
          });
          await recordUncapturedPaymentOutcome(db, f.collection.providerOrderId, 'FAILED');
          assert.equal(
            (await db.paymentCollection.findUniqueOrThrow({ where: { id: f.collection.id } }))
              .status,
            'PAID',
          );
          assert.equal(
            (await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paymentStatus,
            'FULLY_PAID',
          );
        },
      );
    } finally {
      await db.$disconnect();
      await db2.$disconnect();
      await sql.end();
      await admin.query(`DROP DATABASE "${name}"`);
      await admin.end();
    }
  },
);
