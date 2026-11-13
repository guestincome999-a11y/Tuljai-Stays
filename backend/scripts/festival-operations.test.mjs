import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
require('reflect-metadata');
const { Prisma } = require('@prisma/client');

const { ROLES_KEY } = require('../src/modules/auth/decorators/roles.decorator.ts');
const { RolesGuard } = require('../src/modules/auth/guards/roles.guard.ts');
const { calculateStayPrice } = require('../src/modules/bookings/booking-pricing.ts');
const { CatalogService } = require('../src/modules/catalog/catalog.service.ts');
const {
  FestivalOperationsController,
} = require('../src/modules/operations/festival-operations.controller.ts');
const {
  FestivalOperationsService,
} = require('../src/modules/operations/festival-operations.service.ts');
const { operationalDateRange } = require('../src/modules/operations/operational-dates.ts');
const { OperationsTelemetry } = require('../src/modules/operations/operations-telemetry.ts');

test('operational windows reject rollover and inverted date ranges', () => {
  for (const [start, end] of [
    ['bad', undefined],
    ['2026-02-30', '2026-03-03'],
    ['2026-11-12', '2026-11-12'],
    ['2026-12-01', '2026-11-12'],
  ])
    assert.throws(() => operationalDateRange(start, end));
  assert.deepEqual(operationalDateRange('2026-11-12', '2026-11-15'), {
    checkInDate: '2026-11-12',
    checkOutDate: '2026-11-15',
  });
});

test('festival controller requires an admin on the server; other roles cannot mutate operations', async () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, FestivalOperationsController), ['ADMIN']);
  const guard = new RolesGuard({ getAllAndOverride: () => ['ADMIN'] }, {});
  for (const role of ['PILGRIM', 'OWNER', 'STAFF'])
    assert.equal(
      await guard.canActivate({
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => ({ user: { roles: [role] } }) }),
      }),
      false,
    );
  for (const role of ['ADMIN', 'SUPER_ADMIN'])
    assert.equal(
      await guard.canActivate({
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => ({ user: { roles: [role] } }) }),
      }),
      true,
    );
});

const cards = [
  {
    id: 'open',
    name: 'Open stay',
    startingPrice: '1000',
    distanceFromTempleMeters: 200,
    amenitySlugs: ['parking'],
    propertyType: 'LODGE',
    averageRating: 4,
  },
  {
    id: 'closed',
    name: 'Closed stay',
    startingPrice: '800',
    distanceFromTempleMeters: 50,
    amenitySlugs: ['parking'],
    propertyType: 'LODGE',
    averageRating: 3,
  },
  {
    id: 'full',
    name: 'Full stay',
    startingPrice: '500',
    distanceFromTempleMeters: 100,
    amenitySlugs: [],
    propertyType: 'HOTEL',
    averageRating: 5,
  },
];
function catalogFixture(enabled) {
  const live = ['open', 'full'];
  const db = {
    lodge: { findMany: async () => live.map((id) => ({ id })) },
    featureFlag: { findUnique: async () => ({ enabled }) },
  };
  const service = new CatalogService(
    db,
    {},
    {
      lodgeAvailableCounts: async () =>
        new Map([
          ['open', 2],
          ['full', 0],
        ]),
    },
  );
  service.getAllCards = async () => cards;
  return service;
}
test('mode off preserves normal discovery, but even stale cached cards cannot show a disabled lodge', async () => {
  assert.deepEqual(
    (await catalogFixture(false).listLodges({})).items.map((lodge) => lodge.id),
    ['full', 'open'],
  );
});
test('mode on filters zero availability before pagination, retaining budget, distance, amenity and property filters', async () => {
  const service = catalogFixture(true);
  const result = await service.listLodges({
    minPrice: 900,
    maxPrice: 1100,
    maxDistance: 250,
    amenities: 'parking',
    propertyType: 'LODGE',
    sort: 'price',
    pageSize: 1,
  });
  assert.deepEqual(
    result.items.map((lodge) => lodge.id),
    ['open'],
  );
  assert.equal(result.totalItems, 1);
  assert.equal((await service.listLodges({ maxPrice: 400 })).items.length, 0);
});
test('explicit stay filters also validate availability during normal mode', async () => {
  assert.deepEqual(
    (
      await catalogFixture(false).listLodges({
        checkInDate: '2026-11-12',
        checkOutDate: '2026-11-13',
      })
    ).items.map((lodge) => lodge.id),
    ['open'],
  );
});

test('disabling mode restores base pricing; explicit nightly overrides remain authoritative', async () => {
  const db = {
    roomPricing: {
      findMany: async () => [{ date: new Date('2026-11-13'), price: new Prisma.Decimal(80) }],
    },
    featureFlag: { findUnique: async () => ({ enabled: false }) },
    systemSetting: {
      findMany: () => assert.fail('disabled festival must not apply its pricing window'),
    },
  };
  assert.equal(
    (
      await calculateStayPrice(
        db,
        'type',
        new Prisma.Decimal(100),
        new Date('2026-11-12'),
        new Date('2026-11-14'),
        new Prisma.Decimal(500),
      )
    ).toString(),
    '180',
  );
});

test('payment recovery leases pending verification and delegates to gateway reads, never order/charge creation', async () => {
  let status = 'PENDING';
  let lease = false;
  let reads = 0;
  const audits = [];
  const db = {
    paymentIntent: {
      findUniqueOrThrow: async () => ({
        id: 'intent',
        providerOrderId: 'order',
        status,
        attempts: 0,
      }),
      updateMany: async () => {
        if (lease) return { count: 0 };
        lease = true;
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        audits.push(data);
      },
    },
    $transaction: async (fn) => fn(db),
  };
  const service = new FestivalOperationsService(
    db,
    {},
    {},
    {},
    { publishToRole() {} },
    {
      reconcileOrder: async () => {
        reads++;
      },
    },
  );
  const results = await Promise.allSettled([
    service.retryPayment('intent', 'Gateway status delayed', 'admin'),
    service.retryPayment('intent', 'Gateway status delayed', 'admin'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(reads, 1);
  assert.equal(audits.length, 1);
  status = 'CONFIRMED';
  await assert.rejects(
    service.retryPayment('intent', 'Review confirmation', 'admin'),
    /Only pending/,
  );
  status = 'RECOVERY_REQUIRED';
  await assert.rejects(
    service.retryPayment('intent', 'Review paid allocation', 'admin'),
    /Only pending/,
  );
});

test('manual recovery rejects identity mismatch before invoking the check-in service', async () => {
  let checks = 0;
  const audits = [];
  const db = {
    booking: {
      findFirst: async ({ where }) => {
        assert.deepEqual(where, { bookingCode: 'TJS-PASS', deletedAt: null });
        return {
          id: 'booking',
          bookingCode: 'TJS-PASS',
          guestPhone: '+919999999999',
          status: 'QR_GENERATED',
        };
      },
    },
    auditLog: { create: async ({ data }) => audits.push(data) },
  };
  const service = new FestivalOperationsService(
    db,
    {},
    {},
    {},
    { publishToRole() {} },
    {},
    {},
    {},
    {
      verifyManualCheckin: async () => {
        checks++;
        return { booking: { id: 'booking', status: 'CHECKED_IN' } };
      },
    },
  );
  const dto = {
    bookingCode: 'TJS-PASS',
    guestPhone: '8888888888',
    reason: 'Camera failure with verified physical ID',
  };
  await assert.rejects(service.manualCheckin(dto, { id: 'admin' }), /identity/);
  assert.equal(checks, 0);
  await service.manualCheckin({ ...dto, guestPhone: '9999999999' }, { id: 'admin' });
  assert.equal(checks, 1);
  assert.deepEqual(
    audits.map((a) => a.action),
    ['FESTIVAL_MANUAL_CHECKIN_REQUESTED', 'FESTIVAL_MANUAL_CHECKIN_COMPLETED'],
  );
});

test('manual check-in validates a printed booking reference without requiring an internal UUID', async () => {
  const { plainToInstance } = require('class-transformer');
  const { validate } = require('class-validator');
  const { ManualCheckinDto } = require('../src/modules/operations/dto/festival-operations.dto.ts');
  const input = {
    bookingCode: 'TJS-PASS',
    guestPhone: '9999999999',
    reason: 'Physical guest identification verified',
  };
  assert.deepEqual(await validate(plainToInstance(ManualCheckinDto, input)), []);
  const uuid = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(
    await validate(plainToInstance(ManualCheckinDto, { ...input, bookingId: uuid })),
    [],
  );
  assert.ok(
    (await validate(plainToInstance(ManualCheckinDto, { ...input, bookingId: 'TJS-PASS' }))).some(
      (error) => error.property === 'bookingId',
    ),
  );
});

test('legacy manual check-in callers must match both their UUID and printed booking code', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const db = {
    booking: {
      findFirst: async ({ where }) => {
        assert.deepEqual(where, { bookingCode: 'TJS-PASS', deletedAt: null, id });
        return null;
      },
    },
  };
  const service = new FestivalOperationsService(db);
  await assert.rejects(
    service.manualCheckin(
      {
        bookingId: id,
        bookingCode: ' TJS-PASS ',
        guestPhone: '9999999999',
        reason: 'Check a mismatched booking identity',
      },
      { id: 'admin' },
    ),
    /identity/,
  );
});

test('telemetry reports observed errors and bounded route summaries, and expires old counters', () => {
  const metrics = new OperationsTelemetry();
  metrics.record('POST /api/bookings', 100, 409, true);
  metrics.record('GET /api/catalog/lodges', 20, 200, false);
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.requests, 2);
  assert.equal(snapshot.errors, 1);
  assert.equal(snapshot.failedBookingRequests, 1);
  assert.equal(snapshot.averageLatencyMs, 60);
  metrics.buckets[0].minute -= 10;
  assert.equal(metrics.snapshot().requests, 0);
});

test('realtime diagnostics record actual publisher failures without exposing payloads', () => {
  const { RealtimeGateway } = require('../src/modules/realtime/realtime.gateway.ts');
  const gateway = new RealtimeGateway({}, {}, {});
  gateway.logger.error = () => {};
  gateway.server = { to: () => ({ emit() {} }) };
  gateway.emitToRoom('role:PILGRIM', 'lodge:catalog-updated', { lodgeId: 'local-fixture' });
  assert.ok(gateway.getDeliveryDiagnostics().lastPublishedAt);
  gateway.server = {
    to: () => {
      throw new Error('sensitive transport detail');
    },
  };
  gateway.emitToRoom('role:PILGRIM', 'lodge:catalog-updated', { lodgeId: 'local-fixture' });
  const diagnostics = gateway.getDeliveryDiagnostics();
  assert.equal(diagnostics.failures.length, 1);
  assert.deepEqual(Object.keys(diagnostics.failures[0]).sort(), ['at', 'event']);
});

test('lodge closure returns after its durable inbox write even when push delivery is slow', async () => {
  const before = {
    id: 'lodge',
    name: 'Local lodge',
    isActive: true,
    operationsReason: null,
    ownerUserId: 'owner',
    updatedAt: new Date('2026-11-01'),
    status: 'VERIFIED',
    verificationStatus: 'VERIFIED',
  };
  let persisted = false,
    finishDelivery;
  const db = {
    $queryRaw: async () => [],
    lodge: {
      findFirstOrThrow: async () => before,
      update: async ({ data }) => ({ ...before, ...data }),
    },
    lodgeOwner: { findMany: async () => [] },
    notification: {
      createMany: async () => {
        persisted = true;
      },
    },
    auditLog: { create: async () => ({}) },
    $transaction: async (fn) => fn(db),
  };
  const service = new FestivalOperationsService(
    db,
    {},
    { invalidate() {} },
    {},
    { publishToRole() {}, publishToLodge() {}, publishToUser() {} },
    {},
    {
      create: () => {
        assert.equal(persisted, true);
        return new Promise((resolve) => {
          finishDelivery = resolve;
        });
      },
    },
  );
  const result = await service.updateLodge(
    'lodge',
    {
      isActive: false,
      reason: 'Maintenance',
      detail: 'Keep critical closure fast',
      expectedUpdatedAt: before.updatedAt.toISOString(),
      checkInDate: '2026-11-12',
      checkOutDate: '2026-11-13',
    },
    'admin',
  );
  assert.equal(result.isActive, false);
  assert.equal(persisted, true);
  finishDelivery({});
});
