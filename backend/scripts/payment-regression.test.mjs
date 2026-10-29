import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { Prisma } = require('@prisma/client');

const { calculateStayPrice } = require('../src/modules/bookings/booking-pricing.ts');
const { BookingsService } = require('../src/modules/bookings/bookings.service.ts');
const { OperationsService } = require('../src/modules/operations/operations.service.ts');
const { PaymentsService } = require('../src/modules/payments/payments.service.ts');
const { RazorpayProvider } = require('../src/modules/payments/providers/razorpay.provider.ts');

const date = (value) => new Date(`${value}T00:00:00.000Z`);
const user = { id: 'pilgrim', roles: ['PILGRIM'], isActive: true, phoneNumber: null };

test('pricing sums ordinary and explicit festival/date prices with decimal precision', async () => {
  const db = {
    roomPricing: {
      findMany: async () => [
        { date: date('2026-11-02'), price: new Prisma.Decimal('2500.25') },
        { date: date('2026-11-03'), price: new Prisma.Decimal('1200.50') },
      ],
    },
  };
  assert.equal(
    (
      await calculateStayPrice(
        db,
        'type',
        new Prisma.Decimal('999.99'),
        date('2026-11-01'),
        date('2026-11-04'),
      )
    ).toString(),
    '4700.74',
  );
  assert.equal(
    (
      await calculateStayPrice(
        { roomPricing: { findMany: async () => [] } },
        'type',
        new Prisma.Decimal('999.99'),
        date('2026-11-01'),
        date('2026-11-04'),
      )
    ).toString(),
    '2999.97',
  );
  await assert.rejects(
    calculateStayPrice(db, 'type', new Prisma.Decimal(1), date('2026-11-02'), date('2026-11-01')),
  );
});

test('webhook signatures use exact raw bytes and reject tampering or malformed hex', () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-webhook-test-secret';
  const provider = new RazorpayProvider();
  const raw = Buffer.from('{ "event": "payment.captured" }');
  const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
  assert.equal(provider.verifyWebhook(raw, signature), true);
  assert.equal(
    provider.verifyWebhook(Buffer.from('{"event":"payment.captured"}'), signature),
    false,
  );
  assert.equal(provider.verifyWebhook(raw, 'not-hex'), false);
  assert.equal(provider.verifyWebhook(raw, undefined), false);
});

test('festival fallback uses inclusive configured dates and explicit prices still win', async () => {
  const db = {
    roomPricing: {
      findMany: async () => [{ date: date('2026-11-03'), price: new Prisma.Decimal('2500.25') }],
    },
    systemSetting: {
      findMany: async () => [
        { key: 'festival_start_date', value: '2026-11-02' },
        { key: 'festival_end_date', value: '2026-11-03' },
      ],
    },
  };
  const total = await calculateStayPrice(
    db,
    'type',
    new Prisma.Decimal('999.99'),
    date('2026-11-01'),
    date('2026-11-05'),
    new Prisma.Decimal('1200.50'),
  );
  assert.equal(total.toString(), '5700.73'); // ordinary + festival + override + ordinary
  const boundary = await calculateStayPrice(
    db,
    'type',
    new Prisma.Decimal('999.99'),
    date('2026-11-02'),
    date('2026-11-04'),
    new Prisma.Decimal('1200.50'),
  );
  assert.equal(boundary.toString(), '3700.75');
});

test('blank festival window uses base rate; incomplete or invalid windows fail visibly', async () => {
  const db = {
    roomPricing: { findMany: async () => [] },
    systemSetting: { findMany: async () => [] },
  };
  assert.equal(
    (
      await calculateStayPrice(
        db,
        'type',
        new Prisma.Decimal(100),
        date('2026-11-01'),
        date('2026-11-03'),
        new Prisma.Decimal(500),
      )
    ).toString(),
    '200',
  );
  for (const settings of [
    [{ key: 'festival_start_date', value: '2026-11-01' }],
    [
      { key: 'festival_start_date', value: '2026-02-30' },
      { key: 'festival_end_date', value: '2026-03-03' },
    ],
    [
      { key: 'festival_start_date', value: '2026-11-03' },
      { key: 'festival_end_date', value: '2026-11-01' },
    ],
  ]) {
    await assert.rejects(
      calculateStayPrice(
        { ...db, systemSetting: { findMany: async () => settings } },
        'type',
        new Prisma.Decimal(100),
        date('2026-11-01'),
        date('2026-11-03'),
        new Prisma.Decimal(500),
      ),
      /Festival pricing dates are invalid/,
    );
  }
});

test('client signature rejects wrong payment and wrong order', async () => {
  process.env.RAZORPAY_KEY_SECRET = 'synthetic-client-test-secret';
  const provider = new RazorpayProvider();
  const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update('order_test|pay_test')
    .digest('hex');
  assert.equal(
    (await provider.verifyPayment({ orderId: 'order_test', paymentId: 'pay_test', signature }))
      .verified,
    true,
  );
  assert.equal(
    (await provider.verifyPayment({ orderId: 'order_other', paymentId: 'pay_test', signature }))
      .verified,
    false,
  );
});

test('a simultaneous unauthorized callback cannot join another users in-flight work', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const provider = {
    verifyPayment: async ({ signature }) => {
      if (signature === 'valid') {
        await gate;
        return { verified: true };
      }
      return { verified: false };
    },
  };
  const prisma = { $queryRaw: async () => [{ booking_id: 'original' }] };
  const bookings = { getBookingById: async () => ({ id: 'original' }) };
  const service = new PaymentsService({}, bookings, prisma, provider, {}, {});
  const first = service.confirmPrepaidBooking({ paymentMethod: 'ONLINE' }, user, {
    orderId: 'order_test',
    paymentId: 'pay_test',
    signature: 'valid',
  });
  await assert.rejects(
    service.confirmPrepaidBooking(
      { paymentMethod: 'ONLINE' },
      { ...user, id: 'attacker' },
      { orderId: 'order_test', paymentId: 'pay_test', signature: 'invalid' },
    ),
    /verification failed/,
  );
  release();
  assert.equal((await first).id, 'original');
});

test('payment status is scoped to the caller before gateway reads', async () => {
  let read = false;
  const service = new PaymentsService(
    {},
    {},
    { paymentIntent: { findFirst: async () => null } },
    {
      getOrderPayments: async () => {
        read = true;
      },
    },
    {},
    {},
  );
  await assert.rejects(service.paymentStatus('someone-elses-order', user), /not found/);
  assert.equal(read, false);
});

test('confirmation survives another instance committing while the gateway read is in flight', async () => {
  const intent = {
    status: 'CONFIRMED',
    bookingId: 'original',
    pilgrimUserId: user.id,
    lockCode: 'lock',
    amount: new Prisma.Decimal(100),
    currency: 'INR',
    guestDetails: null,
  };
  const prisma = {
    $queryRaw: async () => [],
    paymentIntent: { findUniqueOrThrow: async () => intent },
  };
  const provider = {
    verifyPayment: async () => ({ verified: true }),
    getPayment: async () => ({
      id: 'pay_test',
      order_id: 'order_test',
      amount: 10000,
      currency: 'INR',
      captured: true,
      status: 'captured',
    }),
  };
  const service = new PaymentsService(
    {},
    {
      getBookingById: async () => ({ id: 'original' }),
      createPrepaidBooking: () => assert.fail('temporary guest details have already been cleared'),
    },
    prisma,
    provider,
    {},
    {},
  );
  service.preparePrepaidIntent = async () => ({ ready: true });
  const booking = await service.confirmPrepaidBooking(
    { lockCode: 'lock', paymentMethod: 'ONLINE' },
    user,
    { orderId: 'order_test', paymentId: 'pay_test', signature: 'synthetic' },
  );
  assert.equal(booking.id, 'original');
});

test('duplicate captured and delayed failed webhooks never demote a confirmed intent', async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-webhook-test-secret';
  const inbox = new Map();
  const intent = { status: 'CONFIRMED' };
  const tx = {
    paymentWebhookEvent: {
      createMany: async ({ data }) => {
        if (!inbox.has(data.id)) inbox.set(data.id, data);
      },
    },
    paymentIntent: {
      updateMany: async ({ where, data }) => {
        if (intent.status === where.status) Object.assign(intent, data);
      },
    },
  };
  const service = new PaymentsService(
    {},
    {},
    { $transaction: async (fn) => fn(tx) },
    new RazorpayProvider(),
    {},
    {},
  );
  for (const [id, event] of [
    ['evt1', 'payment.captured'],
    ['evt1', 'payment.captured'],
    ['evt2', 'payment.failed'],
  ]) {
    const raw = Buffer.from(
      JSON.stringify({
        event,
        payload: { payment: { entity: { id: 'pay_test', order_id: 'order_test' } } },
      }),
    );
    const sig = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    await service.receiveWebhook(raw, sig, id);
  }
  assert.equal(inbox.size, 2);
  assert.equal(intent.status, 'CONFIRMED');
  await assert.rejects(service.receiveWebhook(Buffer.from('{}'), 'bad', 'evt3'), /signature/);
});

test('webhook storage failure is not acknowledged, allowing Razorpay to retry delivery', async () => {
  const service = new PaymentsService(
    {},
    {},
    {
      $transaction: async () => {
        throw new Error('Database unavailable');
      },
    },
    { verifyWebhook: () => true },
    {},
    {},
  );
  const raw = Buffer.from(
    JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test', order_id: 'order_test' } } },
    }),
  );
  await assert.rejects(
    service.receiveWebhook(raw, 'signature', 'evt_storage'),
    /Database unavailable/,
  );
});

test('signed webhook schedules captured payment recovery without an app callback', async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-recovery-test-secret';
  const intent = {
    id: 'intent',
    providerOrderId: 'order_test',
    pilgrimUserId: user.id,
    amount: new Prisma.Decimal(100),
    currency: 'INR',
    status: 'PENDING',
    guestDetails: { lockCode: 'lock', guestName: 'Test Guest' },
    attempts: 0,
    nextCheckAt: new Date(Date.now() + 3_600_000),
  };
  const inbox = new Map();
  const paymentIntent = {
    findUnique: async () => intent,
    findMany: async ({ where }) =>
      intent.status === where.status && intent.nextCheckAt <= where.nextCheckAt.lte
        ? [{ ...intent }]
        : [],
    updateMany: async ({ where, data }) => {
      if (where.status && intent.status !== where.status) return { count: 0 };
      if (where.nextCheckAt && intent.nextCheckAt !== where.nextCheckAt) return { count: 0 };
      Object.assign(intent, data, {
        attempts: data.attempts?.increment
          ? intent.attempts + data.attempts.increment
          : intent.attempts,
      });
      return { count: 1 };
    },
  };
  const prisma = {
    paymentIntent,
    $transaction: async (fn) =>
      fn({
        paymentIntent,
        paymentWebhookEvent: { createMany: async ({ data }) => inbox.set(data.id, data) },
      }),
  };
  const provider = new RazorpayProvider();
  provider.getOrderPayments = async () => [
    {
      id: 'pay_test',
      order_id: 'order_test',
      amount: 10000,
      currency: 'INR',
      status: 'captured',
      captured: true,
    },
  ];
  let confirmations = 0;
  const service = new PaymentsService(
    {},
    {
      createPrepaidBooking: async (details, caller, payment) => {
        assert.deepEqual(details, intent.guestDetails);
        assert.equal(caller.id, user.id);
        assert.equal(payment.providerPaymentId, 'pay_test');
        confirmations += 1;
        // The booking transaction owns this state transition in production.
        intent.status = 'CONFIRMED';
      },
    },
    prisma,
    provider,
    {},
    {},
  );
  const raw = Buffer.from(
    JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test', order_id: 'order_test' } } },
    }),
  );
  const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
  assert.deepEqual(await service.receiveWebhook(raw, signature, 'evt_recovery'), {
    received: true,
  });
  assert.equal(inbox.size, 1);
  assert.ok(intent.nextCheckAt <= new Date());
  await service.reconcilePending();
  assert.equal(intent.status, 'CONFIRMED');
  await service.reconcilePending();
  assert.equal(confirmations, 1);
});

test('authoritative gateway amount mismatch requires recovery, without a booking', async () => {
  const intent = {
    id: 'intent',
    providerOrderId: 'order_test',
    amount: new Prisma.Decimal(100),
    currency: 'INR',
    status: 'PENDING',
  };
  const prisma = {
    paymentIntent: {
      findUnique: async () => intent,
      updateMany: async ({ data }) => Object.assign(intent, data),
    },
  };
  const provider = {
    getOrderPayments: async () => [
      {
        id: 'pay_test',
        order_id: 'order_test',
        amount: 1,
        currency: 'INR',
        captured: true,
        status: 'captured',
      },
    ],
  };
  const service = new PaymentsService(
    {},
    { createPrepaidBooking: () => assert.fail('must not book') },
    prisma,
    provider,
    {},
    {},
  );
  await service.reconcileOrder('order_test');
  assert.equal(intent.status, 'RECOVERY_REQUIRED');
});

test('owner report filters intersect requested lodge with authorized lodges', () => {
  const where = OperationsService.prototype.buildBookingWhere.call({}, { lodgeId: 'other-lodge' }, [
    'owned-lodge',
  ]);
  assert.deepEqual(where.lodgeId, { in: [] });
});

test('lodge contact eligibility remains restricted to confirmed upcoming bookings', async () => {
  const service = Object.create(BookingsService.prototype);
  service.findBookingOrThrow = async () => ({
    pilgrimUserId: user.id,
    status: 'PENDING_OWNER_APPROVAL',
  });
  await assert.rejects(service.getLodgeContactForBooking('booking', user), /only available/);
});

test('invalidation during an in-flight catalogue read cannot repopulate stale cache', async () => {
  const { CatalogService } = require('../src/modules/catalog/catalog.service.ts');
  let release;
  let reads = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const db = {
    lodge: {
      findMany: async () => {
        reads += 1;
        if (reads === 1) await gate;
        return [];
      },
    },
    lodgePhoto: { findMany: async () => [] },
    roomType: { findMany: async () => [] },
    review: { groupBy: async () => [] },
  };
  const service = new CatalogService(db, {});
  const pending = service.getAllCards();
  service.invalidate();
  release();
  await pending;
  await service.getAllCards();
  assert.equal(reads, 2);
  await service.getAllCards();
  assert.equal(reads, 2);
});

test(
  'Fastify webhook route verifies the original bytes rather than serialized JSON',
  { timeout: 120_000 },
  async () => {
    const { Module } = require('@nestjs/common');
    const { NestFactory } = require('@nestjs/core');
    const { FastifyAdapter } = require('@nestjs/platform-fastify');
    const { PaymentsController } = require('../src/modules/payments/payments.controller.ts');
    process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-http-test-secret';
    const provider = new RazorpayProvider();
    const payments = {
      receiveWebhook: async (raw, signature) => {
        if (!provider.verifyWebhook(raw, signature)) {
          const { BadRequestException } = require('@nestjs/common');
          throw new BadRequestException('Invalid webhook signature');
        }
        return { received: true };
      },
    };
    class TestModule {}
    Module({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: payments },
        { provide: require('../src/modules/prisma/prisma.service.ts').PrismaService, useValue: {} },
      ],
    })(TestModule);
    const app = await NestFactory.create(TestModule, new FastifyAdapter(), {
      rawBody: true,
      logger: false,
      abortOnError: false,
    });
    try {
      await app.init();
      const server = app.getHttpAdapter().getInstance();
      await server.ready();
      const raw = '{ "event": "payment.captured" }';
      const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(raw)
        .digest('hex');
      const response = await server.inject({
        method: 'POST',
        url: '/payments/razorpay/webhook',
        headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
        payload: raw,
      });
      assert.equal(response.statusCode, 200);
      const rejected = await server.inject({
        method: 'POST',
        url: '/payments/razorpay/webhook',
        headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
        payload: '{"event":"payment.captured"}',
      });
      assert.equal(rejected.statusCode, 400);
    } finally {
      await app.close();
    }
  },
);

test('duplicate, stale and unversioned booking events cannot overwrite a newer booking snapshot', () => {
  const {
    applyRealtimeBookingEvent,
    mergeBackendBookingSnapshot,
  } = require('../../apps/pilgrim-app/src/pilgrim-ui/booking-state.ts');
  const current = {
    id: 'booking',
    status: 'cancelled',
    qrReady: false,
    updatedAt: '2026-11-01T12:00:00.000Z',
  };
  const older = {
    name: 'booking:accepted',
    receivedAt: Date.now(),
    payload: { status: 'ACCEPTED', updatedAt: '2026-11-01T11:00:00.000Z' },
  };
  assert.equal(applyRealtimeBookingEvent(current, older), current);
  assert.equal(applyRealtimeBookingEvent(current, { ...older, payload: {} }), current);
  assert.equal(
    applyRealtimeBookingEvent(current, { ...older, payload: { updatedAt: current.updatedAt } }),
    current,
  );
  assert.equal(
    mergeBackendBookingSnapshot(
      [current],
      [{ ...current, status: 'confirmed', updatedAt: older.payload.updatedAt }],
    )[0],
    current,
  );
  const pending = { ...current, status: 'pending', updatedAt: '2026-11-01T10:00:00.000Z' };
  assert.equal(applyRealtimeBookingEvent(pending, older).status, 'confirmed');
  assert.equal(
    applyRealtimeBookingEvent(pending, {
      ...older,
      payload: { status: 'CANCELLED', updatedAt: '2026-11-01T12:00:00.000Z' },
    }).status,
    'cancelled',
  );
});
