import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, Prisma } = require('@prisma/client');
const { Client } = require('pg');

const {
  BookingAvailabilityService,
} = require('../src/modules/bookings/booking-availability.service.ts');
const { BookingLocksService } = require('../src/modules/bookings/booking-locks.service.ts');
const { BookingsService } = require('../src/modules/bookings/bookings.service.ts');
const {
  createIdempotentPaymentOrder,
} = require('../src/modules/payments/payment-order-idempotency.ts');
const { PaymentsService } = require('../src/modules/payments/payments.service.ts');
const { RoomsService } = require('../src/modules/rooms/rooms.service.ts');

test(
  'PostgreSQL booking, recovery and rollback integration',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120_000 },
  async (t) => {
    const url = new URL(process.env.TEST_DATABASE_URL);
    assert.ok(
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
      'Only loopback test databases are allowed',
    );
    assert.match(
      url.pathname,
      /^\/tuljai_test_[a-zA-Z0-9_]+$/,
      'Use a new, empty tuljai_test_* database',
    );
    const connection = new Client({ connectionString: url.href });
    await connection.connect();
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
    const db2 = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
    try {
      const existing = await connection.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'",
      );
      assert.equal(existing.rows[0].n, 0, 'Refusing to initialize a nonempty database');
      const migrationRoot = new URL('../prisma/migrations/', import.meta.url);
      for (const entry of readdirSync(migrationRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name))) {
        try {
          if (
            entry.name === '20260821123000_add_review_owner_responses' &&
            !process.env.CHECK_MIGRATION_HISTORY
          )
            continue; // Already created by platform_phase_foundations.
          const sql = readFileSync(new URL(`${entry.name}/migration.sql`, migrationRoot), 'utf8');
          // The source files with real live checksums have been restored exactly.
          // Remaining historical assumptions are adapted only in this fixture;
          // CHECK_MIGRATION_HISTORY=1 replays every byte without those adaptations.
          if (
            entry.name === '20260819090000_sync_online_payment_setting' &&
            !process.env.CHECK_MIGRATION_HISTORY
          ) {
            // This historical data migration expects the application's seed to have run.
            await connection.query(
              `INSERT INTO system_settings (id, key, value, updated_at) VALUES (gen_random_uuid(), 'enable_online_payments', 'false'::jsonb, CURRENT_TIMESTAMP)`,
            );
          }
          await connection.query(sql);
        } catch (error) {
          throw new Error(`Migration ${entry.name} failed: ${error.message}`, { cause: error });
        }
      }
      const config = { get: (_key, fallback) => fallback };
      const notifications = new Proxy({}, { get: () => async () => undefined });
      const access = {
        isAdmin: (user) => user.roles.includes('ADMIN'),
        assertCanManageLodge: async () => undefined,
      };
      const guestProof = { assertOwnedUpload: async () => undefined };
      const service = (client) =>
        new BookingsService(
          {},
          new BookingAvailabilityService(client),
          {},
          config,
          guestProof,
          access,
          notifications,
          client,
        );
      const a = service(db);
      const b = service(db2);
      async function fixture(roomCount = 2) {
        const user = await db.user.create({ data: {} });
        const city = await db.city.create({
          data: { name: 'Test city', slug: randomUUID(), state: 'MH', country: 'IN' },
        });
        const lodge = await db.lodge.create({
          data: {
            cityId: city.id,
            name: 'Test lodge',
            slug: randomUUID(),
            propertyType: 'LODGE',
            primaryPhone: '+919999999999',
            status: 'VERIFIED',
            verificationStatus: 'VERIFIED',
          },
        });
        const roomType = await db.roomType.create({
          data: {
            lodgeId: lodge.id,
            name: 'Test room',
            slug: randomUUID(),
            basePrice: 1000,
            capacityAdults: 2,
            capacityChildren: 1,
            totalRooms: roomCount,
          },
        });
        for (let i = 0; i < roomCount; i += 1)
          await db.room.create({
            data: { lodgeId: lodge.id, roomTypeId: roomType.id, roomNumber: `${i + 1}` },
          });
        const lock = await db.bookingLock.create({
          data: {
            lodgeId: lodge.id,
            roomTypeId: roomType.id,
            pilgrimUserId: user.id,
            lockCode: randomUUID(),
            checkInDate: new Date('2026-12-01'),
            checkOutDate: new Date('2026-12-03'),
            expiresAt: new Date(Date.now() + 600_000),
            providerOrderId: `order_${randomUUID()}`,
            orderAmount: 2000,
          },
        });
        const dto = {
          lockCode: lock.lockCode,
          paymentMethod: 'ONLINE',
          checkoutDateFlexible: false,
          guestName: 'Synthetic guest',
          guestPhone: '+919999999999',
          numberOfAdults: 1,
          numberOfChildren: 0,
          guestIdProofStoragePath: 'synthetic/test.pdf',
          guestIdProofMimeType: 'application/pdf',
          guestIdProofOriginalName: 'test.pdf',
          guestIdProofSizeBytes: 10,
        };
        const actor = { id: user.id, roles: ['PILGRIM'], isActive: true, phoneNumber: null };
        const payment = {
          providerOrderId: lock.providerOrderId,
          providerPaymentId: `pay_${randomUUID()}`,
          currency: 'INR',
          amount: 200000,
        };
        await db.paymentIntent.create({
          data: {
            lockCode: lock.lockCode,
            pilgrimUserId: user.id,
            providerOrderId: lock.providerOrderId,
            amount: 2000,
            guestDetails: dto,
          },
        });
        return { user: actor, dto, payment, lock, roomType, lodge };
      }

      await t.test(
        'two separate connections confirming one hold create one booking and one collection',
        async () => {
          const f = await fixture();
          const [first, second] = await Promise.all([
            a.createPrepaidBooking(f.dto, f.user, f.payment),
            b.createPrepaidBooking(f.dto, f.user, f.payment),
          ]);
          assert.equal(first.id, second.id);
          assert.equal(await db.booking.count({ where: { sourceLockId: f.lock.id } }), 1);
          const collections = await connection.query(
            'SELECT count(*)::int AS n FROM payment_collections WHERE booking_id=$1',
            [first.id],
          );
          assert.equal(collections.rows[0].n, 1);
          // Simulate a lost response after commit, then a different instance retry.
          assert.equal((await b.createPrepaidBooking(f.dto, f.user, f.payment)).id, first.id);
        },
      );

      await t.test(
        'two distinct payment attempts competing for the last room never oversell',
        async () => {
          const f = await fixture(1);
          const other = await db.bookingLock.create({
            data: {
              lodgeId: f.lodge.id,
              roomTypeId: f.roomType.id,
              pilgrimUserId: f.user.id,
              lockCode: randomUUID(),
              checkInDate: f.lock.checkInDate,
              checkOutDate: f.lock.checkOutDate,
              expiresAt: f.lock.expiresAt,
              providerOrderId: `order_${randomUUID()}`,
              orderAmount: 2000,
            },
          });
          const results = await Promise.allSettled([
            a.createPrepaidBooking(f.dto, f.user, f.payment),
            b.createPrepaidBooking({ ...f.dto, lockCode: other.lockCode }, f.user, {
              ...f.payment,
              providerOrderId: other.providerOrderId,
              providerPaymentId: `pay_${randomUUID()}`,
            }),
          ]);
          assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
          assert.equal(await db.booking.count({ where: { lodgeId: f.lodge.id } }), 1);
        },
      );

      await t.test(
        'failure after payment insert rolls back booking, collection, room and hold',
        async () => {
          const f = await fixture();
          const broken = new Proxy(db, {
            get(target, key) {
              if (key === '$transaction')
                return (fn) =>
                  db.$transaction((tx) =>
                    fn(
                      new Proxy(tx, {
                        get(inner, field) {
                          if (field === 'auditLog')
                            return {
                              create: async () => {
                                throw new Error('INJECTED_AUDIT_FAILURE');
                              },
                            };
                          return inner[field];
                        },
                      }),
                    ),
                  );
              return target[key];
            },
          });
          await assert.rejects(
            service(broken).createPrepaidBooking(f.dto, f.user, f.payment),
            /INJECTED_AUDIT_FAILURE/,
          );
          assert.equal(await db.booking.count({ where: { sourceLockId: f.lock.id } }), 0);
          assert.equal(
            (await db.bookingLock.findUnique({ where: { id: f.lock.id } })).status,
            'ACTIVE',
          );
          assert.equal(
            await db.room.count({ where: { lodgeId: f.lodge.id, status: 'CONFIRMED' } }),
            0,
          );
          assert.equal(
            (
              await connection.query(
                'SELECT count(*)::int AS n FROM payment_collections WHERE provider_payment_id=$1',
                [f.payment.providerPaymentId],
              )
            ).rows[0].n,
            0,
          );
        },
      );

      await t.test(
        'client and server recovery racing each other return one logical booking',
        async () => {
          const f = await fixture();
          const gateway = {
            getOrderPayments: async () => [
              {
                id: f.payment.providerPaymentId,
                order_id: f.payment.providerOrderId,
                currency: 'INR',
                amount: 200000,
                captured: true,
                status: 'captured',
              },
            ],
          };
          const payments = new PaymentsService({}, b, db2, gateway, notifications, notifications);
          await Promise.all([
            a.createPrepaidBooking(f.dto, f.user, f.payment),
            payments.reconcileOrder(f.payment.providerOrderId),
          ]);
          const intent = await db.paymentIntent.findUnique({
            where: { lockCode: f.lock.lockCode },
          });
          assert.equal(intent.status, 'CONFIRMED');
          assert.equal(intent.guestDetails, null);
          assert.equal(await db.booking.count({ where: { sourceLockId: f.lock.id } }), 1);
        },
      );

      await t.test('pay-at-lodge uses per-date prices and retries the consumed hold', async () => {
        const f = await fixture();
        await db.bookingLock.update({ where: { id: f.lock.id }, data: { providerOrderId: null } });
        await db.roomPricing.create({
          data: {
            roomTypeId: f.roomType.id,
            date: new Date('2026-12-02'),
            price: new Prisma.Decimal('2500.25'),
            priceType: 'FESTIVAL',
          },
        });
        const booking = await a.createBooking({ ...f.dto, paymentMethod: 'PAY_AT_LODGE' }, f.user);
        assert.equal(booking.totalAmount, '3500.25');
        assert.equal(
          (await b.createBooking({ ...f.dto, paymentMethod: 'PAY_AT_LODGE' }, f.user)).id,
          booking.id,
        );
      });

      await t.test('concurrent holds for the final room admit only one', async () => {
        const f = await fixture(1);
        await db.bookingLock.update({ where: { id: f.lock.id }, data: { status: 'RELEASED' } });
        const locks = (client) =>
          new BookingLocksService(
            { create: async () => undefined },
            new BookingAvailabilityService(client),
            config,
            client,
          );
        const dto = {
          lodgeId: f.lodge.id,
          roomTypeId: f.roomType.id,
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-03',
        };
        const results = await Promise.allSettled([
          locks(db).createLock(dto, f.user),
          locks(db2).createLock(dto, f.user),
        ]);
        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      });

      await t.test('a manual reservation prevents prepaid room allocation', async () => {
        const f = await fixture(1);
        const room = await db.room.findFirst({ where: { lodgeId: f.lodge.id } });
        await db.roomAvailability.create({
          data: {
            roomId: room.id,
            date: f.lock.checkInDate,
            status: 'RESERVED',
            reason: 'synthetic manual booking',
          },
        });
        await assert.rejects(
          a.createPrepaidBooking(f.dto, f.user, f.payment),
          /ROOM_UNAVAILABLE_AFTER_PAYMENT/,
        );
      });

      await t.test('manual and prepaid writers use the same inventory lock', async () => {
        const f = await fixture(1);
        const room = await db.room.findFirst({ where: { lodgeId: f.lodge.id } });
        const rooms = new RoomsService(
          { create: async () => undefined },
          new BookingAvailabilityService(db2),
          { invalidate: () => undefined },
          access,
          notifications,
          db2,
          notifications,
        );
        const results = await Promise.allSettled([
          a.createPrepaidBooking(f.dto, f.user, f.payment),
          rooms.createManualBooking(
            room.id,
            {
              checkInDate: '2026-12-01',
              checkOutDate: '2026-12-03',
              guestName: 'Synthetic guest',
              guestPhone: '+919999999999',
            },
            f.user,
          ),
        ]);
        assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      });

      await t.test(
        'duplicate client confirmations persist one paid collection and return the original booking',
        async () => {
          const f = await fixture();
          const gateway = {
            verifyPayment: async () => ({ verified: true }),
            getPayment: async () => ({
              id: f.payment.providerPaymentId,
              order_id: f.payment.providerOrderId,
              amount: f.payment.amount,
              currency: 'INR',
              captured: true,
              status: 'captured',
            }),
          };
          const paymentsA = new PaymentsService({}, a, db, gateway, notifications, notifications);
          const paymentsB = new PaymentsService({}, b, db2, gateway, notifications, notifications);
          const input = {
            orderId: f.payment.providerOrderId,
            paymentId: f.payment.providerPaymentId,
            signature: 'synthetic',
          };
          const [one, two] = await Promise.all([
            paymentsA.confirmPrepaidBooking(f.dto, f.user, input),
            paymentsB.confirmPrepaidBooking(f.dto, f.user, input),
          ]);
          assert.equal(one.id, two.id);
          assert.equal((await paymentsB.confirmPrepaidBooking(f.dto, f.user, input)).id, one.id);
          assert.equal(
            (
              await connection.query(
                'SELECT count(*)::int AS n FROM payment_collections WHERE provider_payment_id=$1',
                [input.paymentId],
              )
            ).rows[0].n,
            1,
          );
        },
      );

      await t.test(
        'legacy booking-first verification is idempotent across connections',
        async () => {
          const f = await fixture();
          await db.paymentIntent.delete({ where: { lockCode: f.lock.lockCode } });
          await db.bookingLock.update({
            where: { id: f.lock.id },
            data: { providerOrderId: null },
          });
          const booking = await a.createBooking(f.dto, f.user);
          await connection.query(
            'UPDATE payment_collections SET provider_order_id=$1 WHERE booking_id=$2',
            [f.payment.providerOrderId, booking.id],
          );
          await db.paymentIntent.create({
            data: {
              lockCode: `legacy:${booking.id}`,
              pilgrimUserId: f.user.id,
              providerOrderId: f.payment.providerOrderId,
              amount: 2000,
              bookingId: booking.id,
            },
          });
          const gateway = {
            verifyPayment: async () => ({ verified: true }),
            getPayment: async () => ({
              id: f.payment.providerPaymentId,
              order_id: f.payment.providerOrderId,
              amount: f.payment.amount,
              currency: 'INR',
              captured: true,
              status: 'captured',
            }),
          };
          const paymentsA = new PaymentsService({}, a, db, gateway, notifications, notifications);
          const paymentsB = new PaymentsService({}, b, db2, gateway, notifications, notifications);
          const input = {
            orderId: f.payment.providerOrderId,
            paymentId: f.payment.providerPaymentId,
            signature: 'synthetic',
          };
          const [one, two] = await Promise.all([
            paymentsA.verifyBookingPayment(booking.id, f.user.id, input),
            paymentsB.verifyBookingPayment(booking.id, f.user.id, input),
          ]);
          assert.equal(one.roomId, two.roomId);
          assert.equal(
            await db.bookingHistory.count({
              where: { bookingId: booking.id, action: 'BOOKING_ACCEPTED' },
            }),
            1,
          );
        },
      );

      await t.test(
        'admin price/status saves persist and invalidate the catalogue; failures roll back',
        async () => {
          const f = await fixture();
          let invalidations = 0;
          const events = [];
          const realtime = {
            publishToLodge: (...args) => events.push(args),
            publishToRole: (...args) => events.push(args),
          };
          const rooms = new RoomsService(
            {},
            new BookingAvailabilityService(db),
            {
              invalidate: () => {
                invalidations += 1;
              },
            },
            access,
            notifications,
            db,
            realtime,
          );
          const updated = await rooms.updateRoomType(
            f.roomType.id,
            { basePrice: 1234, totalRooms: 0 },
            f.user,
          );
          assert.equal(updated.basePrice, '1234');
          assert.equal(
            Number((await db.roomType.findUnique({ where: { id: f.roomType.id } })).basePrice),
            1234,
          );
          assert.equal(invalidations, 1);
          assert.equal(events.filter((event) => event[1] === 'lodge:catalog-updated').length, 2);
          const room = await db.room.findFirst({ where: { lodgeId: f.lodge.id } });
          await rooms.updateRoomStatus(room.id, { status: 'BLOCKED' }, f.user);
          assert.equal((await db.room.findUnique({ where: { id: room.id } })).status, 'BLOCKED');
          assert.equal(
            (
              await new BookingAvailabilityService(db2).getAvailability(
                f.lodge.id,
                f.roomType.id,
                '2026-12-01',
                '2026-12-03',
                { excludeLockId: f.lock.id },
              )
            ).availableRoomCount,
            1,
          );
          const broken = new Proxy(db, {
            get(target, key) {
              if (key === '$transaction')
                return (fn) =>
                  db.$transaction((tx) =>
                    fn(
                      new Proxy(tx, {
                        get(inner, field) {
                          if (field === 'auditLog')
                            return {
                              create: async () => {
                                throw new Error('INJECTED_SAVE_FAILURE');
                              },
                            };
                          return inner[field];
                        },
                      }),
                    ),
                  );
              return target[key];
            },
          });
          const failing = new RoomsService(
            {},
            new BookingAvailabilityService(broken),
            {
              invalidate: () => {
                invalidations += 1;
              },
            },
            access,
            notifications,
            broken,
            realtime,
          );
          await assert.rejects(
            failing.updateRoomType(f.roomType.id, { basePrice: 9999 }, f.user),
            /INJECTED_SAVE_FAILURE/,
          );
          assert.equal(
            Number((await db.roomType.findUnique({ where: { id: f.roomType.id } })).basePrice),
            1234,
          );
          await rooms.updateRoomType(f.roomType.id, { basePrice: 1500 }, f.user);
          assert.equal(
            Number((await db.roomType.findUnique({ where: { id: f.roomType.id } })).basePrice),
            1500,
          );
        },
      );

      await t.test('availability query count stays bounded as room count grows', async () => {
        const f = await fixture(10);
        const measured = new PrismaClient({
          adapter: new PrismaPg({ connectionString: url.href }),
          log: [{ emit: 'event', level: 'query' }],
        });
        let queries = 0;
        measured.$on('query', () => {
          queries += 1;
        });
        try {
          await new BookingAvailabilityService(measured).getAvailability(
            f.lodge.id,
            f.roomType.id,
            '2026-12-01',
            '2026-12-03',
            { excludeLockId: f.lock.id },
          );
          const after = queries;
          assert.ok(after <= 6, `Expected at most six queries, saw ${after}`);
          let before = null;
          // Optional locally supplied historical source; CI needs no Git history or extra package.
          if (process.env.BASELINE_AVAILABILITY_SOURCE) {
            const ts = require('typescript');
            const filename = fileURLToPath(
              new URL('../src/modules/bookings/baseline-availability.ts', import.meta.url),
            );
            const baseline = new Module(filename);
            baseline.filename = filename;
            baseline.paths = Module._nodeModulePaths(
              fileURLToPath(new URL('../src/modules/bookings/', import.meta.url)),
            );
            baseline._compile(
              ts.transpileModule(readFileSync(process.env.BASELINE_AVAILABILITY_SOURCE, 'utf8'), {
                compilerOptions: {
                  module: ts.ModuleKind.CommonJS,
                  target: ts.ScriptTarget.ES2022,
                  experimentalDecorators: true,
                  emitDecoratorMetadata: true,
                },
              }).outputText,
              filename,
            );
            queries = 0;
            await new baseline.exports.BookingAvailabilityService(measured).getAvailability(
              f.lodge.id,
              f.roomType.id,
              '2026-12-01',
              '2026-12-03',
              { excludeLockId: f.lock.id },
            );
            before = queries;
            assert.ok(before > after);
          }
          console.info('availability_queries_10_rooms', { before, after });
        } finally {
          await measured.$disconnect();
        }
      });

      await t.test(
        'historical holds are backfilled without inventing guests; captured funds require review',
        async () => {
          const f = await fixture();
          await db.paymentIntent.delete({ where: { lockCode: f.lock.lockCode } });
          const migration = readFileSync(
            new URL(
              '../prisma/migrations/20261028180000_payment_recovery/migration.sql',
              import.meta.url,
            ),
            'utf8',
          );
          const backfill = migration
            .slice(migration.indexOf('-- Refuse ambiguous'))
            .replace(/COMMIT;\s*$/, '');
          await connection.query(backfill);
          const restored = await db.paymentIntent.findUnique({
            where: { providerOrderId: f.payment.providerOrderId },
          });
          assert.equal(restored.guestDetails, null);
          const gateway = {
            getOrderPayments: async () => [
              {
                id: f.payment.providerPaymentId,
                order_id: f.payment.providerOrderId,
                amount: f.payment.amount,
                currency: 'INR',
                captured: true,
                status: 'captured',
              },
            ],
          };
          const payments = new PaymentsService({}, a, db, gateway, notifications, notifications);
          await payments.reconcileOrder(f.payment.providerOrderId);
          assert.equal(
            (await db.paymentIntent.findUnique({ where: { id: restored.id } })).status,
            'RECOVERY_REQUIRED',
          );
          assert.equal(await db.booking.count({ where: { sourceLockId: f.lock.id } }), 0);
        },
      );

      await t.test(
        'a failed gateway attempt resumes the same stored order rather than creating a new charge',
        async () => {
          const f = await fixture();
          const gateway = {
            getOrderPayments: async () => [
              {
                id: 'pay_failed',
                order_id: f.payment.providerOrderId,
                captured: false,
                status: 'failed',
              },
            ],
          };
          const payments = new PaymentsService({}, a, db, gateway, notifications, notifications);
          const status = await payments.paymentStatus(f.payment.providerOrderId, f.user);
          assert.equal(status.status, 'PENDING');
          assert.equal(status.retryCheckout.order.orderId, f.payment.providerOrderId);
          assert.equal(status.retryCheckout.order.amount, 200000);
          assert.equal(status.retryCheckout.guestDetails.lockCode, f.dto.lockCode);
          assert.equal(await db.booking.count({ where: { sourceLockId: f.lock.id } }), 0);
        },
      );

      await t.test(
        'captured payment after hold expiry is durable and requires review, without overselling or a fake refund',
        async () => {
          const f = await fixture(1);
          await db.bookingLock.update({
            where: { id: f.lock.id },
            data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 1000) },
          });
          const gateway = {
            getOrderPayments: async () => [
              {
                id: f.payment.providerPaymentId,
                order_id: f.payment.providerOrderId,
                amount: f.payment.amount,
                currency: 'INR',
                captured: true,
                status: 'captured',
              },
            ],
            refundPayment: () => assert.fail('No automatic untracked refund'),
          };
          const payments = new PaymentsService({}, a, db, gateway, notifications, notifications);
          await payments.reconcileOrder(f.payment.providerOrderId);
          const status = await payments.paymentStatus(f.payment.providerOrderId, f.user);
          assert.equal(status.status, 'RECOVERY_REQUIRED');
          assert.equal(status.retryCheckout, null);
          const intent = await db.paymentIntent.findUnique({
            where: { lockCode: f.lock.lockCode },
          });
          assert.equal(intent.providerPaymentId, f.payment.providerPaymentId);
          assert.equal(await db.booking.count({ where: { sourceLockId: f.lock.id } }), 0);
        },
      );
      await t.test(
        'accepted booking views hide pilgrim contact and documents from an owner',
        async () => {
          const f = await fixture();
          const booking = await a.createPrepaidBooking(f.dto, f.user, f.payment);
          const owner = await db.user.create({ data: { roles: ['OWNER'] } });
          const view = await a.getBookingById(booking.id, {
            id: owner.id,
            roles: ['OWNER'],
            isActive: true,
            phoneNumber: null,
          });
          assert.equal(view.guestPhone, null);
          assert.equal(view.guestEmail, null);
          assert.equal(view.guests[0].idProofStoragePath, null);
          const ownView = await a.getBookingById(booking.id, f.user);
          assert.equal(ownView.guestPhone, f.dto.guestPhone);
        },
      );
      await t.test(
        'concurrent order creation reuses one durable order and rejects expired holds',
        async () => {
          const f = await fixture();
          await db.paymentIntent.delete({ where: { lockCode: f.lock.lockCode } });
          await db.bookingLock.update({
            where: { id: f.lock.id },
            data: { providerOrderId: null, orderAmount: null },
          });
          await connection.query(
            `UPDATE system_settings SET value='true'::jsonb WHERE key='enable_online_payments'`,
          );
          let orders = 0;
          const gateway = {
            createPayment: async ({ amount, currency }) => {
              orders += 1;
              return { orderId: 'order_one_' + randomUUID(), amount, currency };
            },
          };
          const makePayments = (client, bookings) =>
            new PaymentsService(
              new BookingLocksService({}, new BookingAvailabilityService(client), config, client),
              bookings,
              client,
              gateway,
              notifications,
              notifications,
            );
          const firstService = makePayments(db, a);
          const secondService = makePayments(db2, b);
          const [one, two] = await Promise.all([
            firstService.createPrepaidOrder(f.dto.lockCode, f.user),
            secondService.createPrepaidOrder(f.dto.lockCode, f.user),
          ]);
          assert.equal(orders, 1);
          assert.equal(one.orderId, two.orderId);
          assert.equal(await db.paymentIntent.count({ where: { lockCode: f.lock.lockCode } }), 1);
          await db.bookingLock.update({
            where: { id: f.lock.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
          await assert.rejects(
            firstService.createPrepaidOrder(f.dto.lockCode, f.user),
            /invalid or expired/,
          );
        },
      );

      await t.test(
        'review, QR and report projections return display names while retaining correlation IDs',
        async () => {
          const { OperationsService } = require('../src/modules/operations/operations.service.ts');
          const { ReviewsService } = require('../src/modules/reviews/reviews.service.ts');
          const { QrCheckinService } = require('../src/modules/bookings/qr-checkin.service.ts');
          const f = await fixture();
          const booking = await a.createPrepaidBooking(f.dto, f.user, f.payment);
          await db.user.update({
            where: { id: f.user.id },
            data: { displayName: 'Synthetic display name' },
          });
          const review = await db.review.create({
            data: {
              bookingId: booking.id,
              lodgeId: f.lodge.id,
              roomTypeId: f.roomType.id,
              pilgrimUserId: f.user.id,
              rating: 5,
              status: 'PUBLISHED',
            },
          });
          const reviews = new ReviewsService({}, access, notifications, db);
          const rows = await reviews.listAdmin({});
          const projection = rows.items.find((row) => row.id === review.id);
          assert.equal(projection.lodgeName, 'Test lodge');
          assert.equal(projection.guestDisplayName, 'Synthetic display name');
          assert.equal(projection.lodgeId, f.lodge.id);
          await db.qrScanLog.create({
            data: { bookingId: booking.id, lodgeId: f.lodge.id, result: 'SUCCESS' },
          });
          const scans = Object.create(QrCheckinService.prototype);
          scans.prisma = db;
          scans.lodgeAccessService = access;
          const logs = await scans.listOwnerScanLogs(
            { lodgeId: f.lodge.id },
            { ...f.user, roles: ['ADMIN'] },
          );
          assert.equal(logs.items[0].lodgeName, 'Test lodge');
          assert.equal(logs.items[0].bookingCode, booking.bookingCode);
          const operations = new OperationsService(
            { create: async () => undefined },
            access,
            db,
            notifications,
          );
          const report = await operations.bookingReport({ lodgeId: f.lodge.id }, f.user.id);
          assert.equal(report.items[0].lodgeName, 'Test lodge');
          assert.equal(report.items[0].lodgeId, f.lodge.id);
        },
      );
      await t.test(
        'festival quote, Razorpay order, booking, collection and pay-at-lodge totals reconcile',
        async () => {
          for (const [key, value] of [
            ['festival_start_date', '2026-12-02'],
            ['festival_end_date', '2026-12-02'],
          ]) {
            await db.systemSetting.upsert({
              where: { key },
              create: { key, value },
              update: { value },
            });
          }
          const f = await fixture();
          await db.roomType.update({ where: { id: f.roomType.id }, data: { festivalPrice: 2500 } });
          await db.paymentIntent.delete({ where: { lockCode: f.lock.lockCode } });
          await db.bookingLock.update({
            where: { id: f.lock.id },
            data: { providerOrderId: null, orderAmount: null },
          });
          await connection.query(
            `UPDATE system_settings SET value='true'::jsonb WHERE key='enable_online_payments'`,
          );
          const quote = await new BookingAvailabilityService(db).getAvailability(
            f.lodge.id,
            f.roomType.id,
            '2026-12-01',
            '2026-12-03',
            { excludeLockId: f.lock.id },
          );
          assert.equal(quote.priceSummary.totalAmount, '3500');
          let gatewayAmount = null;
          let orderId = null;
          const paymentId = 'pay_festival_' + randomUUID();
          const gateway = {
            createPayment: async ({ amount, currency }) => {
              gatewayAmount = amount;
              orderId = 'order_festival_' + randomUUID();
              return { orderId, amount, currency };
            },
            verifyPayment: async () => ({ verified: true }),
            getPayment: async () => ({
              id: paymentId,
              order_id: orderId,
              amount: gatewayAmount,
              currency: 'INR',
              captured: true,
              status: 'captured',
            }),
          };
          const payments = new PaymentsService(
            new BookingLocksService({}, new BookingAvailabilityService(db), config, db),
            a,
            db,
            gateway,
            notifications,
            notifications,
          );
          const order = await payments.createPrepaidOrder(f.dto.lockCode, f.user);
          assert.equal(order.amount, 350000);
          await payments.preparePrepaidIntent(f.dto, f.user);
          const booking = await payments.confirmPrepaidBooking(f.dto, f.user, {
            orderId,
            paymentId,
            signature: 'synthetic',
          });
          assert.equal(booking.totalAmount, '3500');
          const collection = await connection.query(
            'SELECT amount::text AS amount FROM payment_collections WHERE booking_id=$1',
            [booking.id],
          );
          assert.equal(Number(collection.rows[0].amount), 3500);
          const cash = await fixture();
          await db.roomType.update({
            where: { id: cash.roomType.id },
            data: { festivalPrice: 2500 },
          });
          await db.bookingLock.update({
            where: { id: cash.lock.id },
            data: { providerOrderId: null },
          });
          const cashBooking = await a.createBooking(
            { ...cash.dto, paymentMethod: 'PAY_AT_LODGE' },
            cash.user,
          );
          assert.equal(cashBooking.totalAmount, '3500');
        },
      );
      await t.test(
        'an expired uncertain checkout surfaces recovery instead of remaining silently pending',
        async () => {
          const f = await fixture();
          await db.bookingLock.update({
            where: { id: f.lock.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
          const payments = new PaymentsService(
            {},
            a,
            db,
            { getOrderPayments: async () => [] },
            notifications,
            notifications,
          );
          const status = await payments.paymentStatus(f.payment.providerOrderId, f.user);
          assert.equal(status.status, 'RECOVERY_REQUIRED');
          assert.equal(status.retryCheckout, null);
        },
      );
      await t.test(
        'concurrent replay keys hold one room and reject changed dates or ended attempts',
        async () => {
          const f = await fixture(1);
          await db.bookingLock.update({ where: { id: f.lock.id }, data: { status: 'RELEASED' } });
          const locks = (client) =>
            new BookingLocksService({}, new BookingAvailabilityService(client), config, client);
          const dto = {
            lodgeId: f.lodge.id,
            roomTypeId: f.roomType.id,
            checkInDate: '2026-12-01',
            checkOutDate: '2026-12-03',
          };
          const key = randomUUID();
          const [first, replay] = await Promise.all([
            locks(db).createLock(dto, f.user, key),
            locks(db2).createLock(dto, f.user, key),
          ]);
          assert.equal(first.id, replay.id);
          assert.equal(
            await db.bookingLock.count({
              where: { checkoutAttemptKey: key, pilgrimUserId: f.user.id },
            }),
            1,
          );
          await assert.rejects(
            locks(db).createLock({ ...dto, checkOutDate: '2026-12-04' }, f.user, key),
            /different booking details/,
          );
          await locks(db).releaseLock(first.lockCode, f.user);
          await assert.rejects(locks(db).createLock(dto, f.user, key), /checkout attempt ended/);
        },
      );

      await t.test(
        'hold retry after an accepted gateway order times out reuses one hold and one order',
        async () => {
          const f = await fixture(1);
          await db.bookingLock.update({ where: { id: f.lock.id }, data: { status: 'RELEASED' } });
          await connection.query(
            "UPDATE payment_settings SET online_payments_enabled=true, provider='RAZORPAY', display_status='ACTIVE'",
          );
          let gatewayOrder = null;
          let writes = 0;
          const provider = {
            createPayment: async ({ amount, currency, receipt }) => {
              writes += 1;
              gatewayOrder = { id: `order_${randomUUID()}`, amount, currency, receipt };
              throw new Error('Gateway timeout after acceptance');
            },
            getOrdersByReceipt: async () => (gatewayOrder ? [gatewayOrder] : []),
          };
          const payments = (client) =>
            new PaymentsService(
              new BookingLocksService({}, new BookingAvailabilityService(client), config, client),
              service(client),
              client,
              provider,
              notifications,
              notifications,
            );
          const dto = {
            lodgeId: f.lodge.id,
            roomTypeId: f.roomType.id,
            checkInDate: '2026-12-01',
            checkOutDate: '2026-12-03',
          };
          const key = randomUUID();
          await assert.rejects(payments(db).createPrepaidHold(dto, f.user, key), /Gateway timeout/);
          const held = await db.bookingLock.findUnique({
            where: {
              pilgrimUserId_checkoutAttemptKey: {
                pilgrimUserId: f.user.id,
                checkoutAttemptKey: key,
              },
            },
          });
          assert.equal(held.status, 'ACTIVE');
          const recovered = await payments(db2).createPrepaidHold(dto, f.user, key);
          assert.equal(recovered.orderId, gatewayOrder.id);
          assert.equal(recovered.lockCode, held.lockCode);
          assert.equal(
            (await payments(db).createPrepaidHold(dto, f.user, key)).orderId,
            recovered.orderId,
          );
          assert.equal(writes, 1);
          assert.equal(await db.paymentIntent.count({ where: { lockCode: held.lockCode } }), 1);
        },
      );

      await t.test('separate database connections claim one gateway order creation', async () => {
        let writes = 0;
        let gatewayOrder = null;
        const provider = {
          createPayment: async ({ amount, currency, receipt }) => {
            writes += 1;
            gatewayOrder = { id: `order_${randomUUID()}`, amount, currency, receipt };
            return {
              orderId: gatewayOrder.id,
              amount,
              currency,
              provider: 'RAZORPAY',
              status: 'CREATED',
            };
          },
          getOrdersByReceipt: async () => (gatewayOrder ? [gatewayOrder] : []),
        };
        const reference = `hold:${randomUUID()}`;
        const input = { amount: 10000, currency: 'INR', bookingId: reference, receipt: reference };
        const results = await Promise.allSettled([
          createIdempotentPaymentOrder(db, provider, reference, input),
          createIdempotentPaymentOrder(db2, provider, reference, input),
        ]);
        for (const result of results) {
          if (result.status === 'fulfilled') assert.equal(result.value.orderId, gatewayOrder.id);
          else assert.match(result.reason.message, /pending verification/);
        }
        assert.equal(writes, 1);
        assert.equal(
          (await createIdempotentPaymentOrder(db2, provider, reference, input)).orderId,
          gatewayOrder.id,
        );
      });
    } finally {
      await db.$disconnect();
      await db2.$disconnect();
      await connection.end();
    }
  },
);
