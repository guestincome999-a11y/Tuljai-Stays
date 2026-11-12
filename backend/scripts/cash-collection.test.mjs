import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { PrismaPg } = require('@prisma/adapter-pg');
const { Prisma, PrismaClient } = require('@prisma/client');

const { getAdminBookingActivity } = require('../src/modules/bookings/admin-booking-activity.ts');
const {
  recordCashCollection,
  withCashCollection,
} = require('../src/modules/bookings/cash-collection.ts');
const { LodgeAccessService } = require('../src/modules/lodges/lodge-access.service.ts');

function fixture(overrides = {}, existing = []) {
  let booking = {
    id: 'booking',
    lodgeId: 'lodge',
    paymentStatus: 'PAY_AT_LODGE',
    status: 'CHECKED_IN',
    totalAmount: '1200.55',
    balanceAmount: '1200.55',
    ...overrides,
  };
  let rows = existing;
  let audits = 0;
  let writes = 0;
  let tail = Promise.resolve();
  let fail = false;
  const auditEntries = [];
  let ownerName = 'Lodge Owner One';
  const db = {
    lodgeOwner: { findUnique: async () => ({ ownerName }) },
    user: { findUnique: async () => ({ displayName: 'Account Name' }) },
    booking: {
      findFirst: async () => booking,
      update: async ({ data }) => {
        Object.assign(booking, data);
        return booking;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        audits++;
        auditEntries.push(data);
        return {};
      },
    },
    $queryRaw: async (strings) => {
      const sql = strings.join('?');
      if (sql.includes('SUM(amount)'))
        return [
          {
            amount: rows
              .filter((r) => r.status === 'PAID')
              .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0))
              .toString(),
            paidAt: rows.find((r) => r.status === 'PAID') ? new Date('2026-11-02T10:00:00Z') : null,
          },
        ];
      if (sql.includes('payment_collections')) return rows;
      return [{ id: booking.id }];
    },
    $executeRaw: async (strings, ...values) => {
      if (fail) throw new Error('Database unavailable');
      writes++;
      if (strings.join('?').includes('INSERT INTO'))
        rows.push({
          id: 'receipt',
          amount: values[1].toString(),
          status: 'PAID',
          provider: null,
          paidAt: values[3],
        });
      else
        Object.assign(rows[0], { amount: values[0].toString(), status: 'PAID', paidAt: values[1] });
      return 1;
    },
    $transaction(fn) {
      const run = tail.then(async () => {
        const snapshot = JSON.parse(JSON.stringify({ booking, rows, audits, writes }));
        try {
          return await fn(db);
        } catch (error) {
          ({ booking, rows, audits, writes } = snapshot);
          throw error;
        }
      });
      tail = run.catch(() => {});
      return run;
    },
  };
  const input = { bookingId: booking.id, actorUserId: 'owner', expectedAmount: '1200.55' };
  const access = async (lodgeId) => {
    assert.equal(lodgeId, 'lodge');
  };
  return {
    db,
    input,
    access,
    booking: () => booking,
    rows: () => rows,
    audits: () => audits,
    auditEntries,
    renameOwner: (value) => {
      ownerName = value;
    },
    writes: () => writes,
    fail: () => {
      fail = true;
    },
  };
}

test('cash receipt is idempotent, preserves payment method and reports server-confirmed collection', async () => {
  const f = fixture();
  assert.equal((await recordCashCollection(f.db, f.access, f.input)).changed, true);
  assert.equal((await recordCashCollection(f.db, f.access, f.input)).changed, false);
  assert.equal(f.rows().length, 1);
  assert.equal(f.audits(), 1);
  assert.equal(f.writes(), 1);
  assert.equal(f.booking().paymentStatus, 'PAY_AT_LODGE');
  assert.equal(f.booking().balanceAmount, 0);
  assert.ok((await withCashCollection(f.db, f.booking())).payAtLodgeCollectedAt);
});

test('simultaneous collection requests write one receipt and audit', async () => {
  const f = fixture();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => recordCashCollection(f.db, f.access, f.input)),
  );
  assert.equal(results.filter((r) => r.changed).length, 1);
  assert.equal(f.rows().length, 1);
  assert.equal(f.audits(), 1);
});

test('collection confirmation saves the owner name and event time once; retry does not change them', async () => {
  const f = fixture();
  const before = Date.now();
  await recordCashCollection(f.db, f.access, f.input);
  const metadata = f.auditEntries[0].metadata;
  assert.equal(metadata.collectorName, 'Lodge Owner One');
  assert.ok(
    Date.parse(metadata.collectedAt) >= before && Date.parse(metadata.collectedAt) <= Date.now(),
  );
  assert.equal(f.rows()[0].paidAt.toISOString(), metadata.collectedAt);
  f.renameOwner('Renamed Owner');
  await recordCashCollection(f.db, f.access, f.input);
  assert.equal(f.auditEntries.length, 1);
  assert.equal(f.auditEntries[0].metadata.collectorName, 'Lodge Owner One');
  assert.equal(f.rows()[0].paidAt.toISOString(), metadata.collectedAt);
});

test('pending cash receipt is updated rather than duplicated', async () => {
  const f = fixture({}, [{ id: 'pending', amount: '1200.55', status: 'PENDING', provider: null }]);
  await recordCashCollection(f.db, f.access, f.input);
  assert.equal(f.rows().length, 1);
  assert.equal(f.rows()[0].id, 'pending');
  assert.equal(f.rows()[0].status, 'PAID');
});

for (const overrides of [
  { paymentStatus: 'FULLY_PAID' },
  { paymentStatus: 'ADVANCE_PAID' },
  { status: 'CANCELLED' },
  { status: 'QR_GENERATED' },
  { status: 'CHECKED_OUT' },
]) {
  test(`ineligible booking ${JSON.stringify(overrides)} cannot be collected`, async () => {
    const f = fixture(overrides);
    await assert.rejects(recordCashCollection(f.db, f.access, f.input));
    assert.equal(f.writes(), 0);
    assert.equal(f.audits(), 0);
  });
}

test('unauthorized owner and changed amount cannot record a receipt', async () => {
  const f = fixture();
  await assert.rejects(
    recordCashCollection(
      f.db,
      async () => {
        throw new Error('Forbidden');
      },
      f.input,
    ),
    /Forbidden/,
  );
  await assert.rejects(
    recordCashCollection(f.db, f.access, { ...f.input, expectedAmount: '1200.54' }),
    /Amount changed/,
  );
  assert.equal(f.writes(), 0);
  assert.equal(f.audits(), 0);
});

test('partial payments and refunds require review instead of another full receipt', async () => {
  for (const row of [
    { status: 'PAID', amount: '100' },
    { status: 'REFUNDED', amount: '1200.55' },
  ]) {
    const f = fixture({}, [{ id: 'existing', provider: null, ...row }]);
    await assert.rejects(recordCashCollection(f.db, f.access, f.input), /existing adjustments/);
    assert.equal(f.writes(), 0);
  }
});

test('failed persistence does not mark payment collected', async () => {
  const f = fixture();
  f.fail();
  await assert.rejects(recordCashCollection(f.db, f.access, f.input), /Database unavailable/);
  assert.equal(f.booking().balanceAmount, '1200.55');
  assert.equal(f.audits(), 0);
  assert.equal(f.rows().length, 0);
});

test('unpaid and online bookings never get a cash-paid indicator', async () => {
  const f = fixture();
  assert.equal((await withCashCollection(f.db, f.booking())).payAtLodgeCollectedAt, null);
  const online = { ...f.booking(), paymentStatus: 'FULLY_PAID' };
  assert.equal(
    await withCashCollection(
      {
        $queryRaw: () => {
          throw new Error('Unexpected query');
        },
      },
      online,
    ),
    online,
  );
});

test(
  'real PostgreSQL concurrent cash receipts, amount safety and owner authorization',
  { skip: !process.env.TEST_CASH_DATABASE_URL },
  async () => {
    const url = new URL(process.env.TEST_CASH_DATABASE_URL);
    assert.equal(url.hostname, '127.0.0.1');
    assert.match(url.pathname, /^\/tuljai_test_/);
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
    try {
      const member = await db.lodgeOwner.findFirstOrThrow({
        where: { isActive: true },
        include: { lodge: true },
      });
      const guest = await db.user.findFirstOrThrow({ where: { roles: { has: 'PILGRIM' } } });
      const roomType = await db.roomType.findFirstOrThrow({ where: { lodgeId: member.lodgeId } });
      const booking = await db.booking.create({
        data: {
          bookingCode: `CASH-REVIEW-${randomUUID()}`,
          lodgeId: member.lodgeId,
          cityId: member.lodge.cityId,
          roomTypeId: roomType.id,
          pilgrimUserId: guest.id,
          status: 'CHECKED_IN',
          paymentStatus: 'PAY_AT_LODGE',
          guestName: 'Local cash receipt test',
          guestPhone: '+919999000099',
          numberOfAdults: 1,
          numberOfChildren: 0,
          totalGuests: 1,
          checkInDate: new Date(),
          checkOutDate: new Date(Date.now() + 86400000),
          totalAmount: '1200.55',
          balanceAmount: '1200.55',
        },
      });
      const access = new LodgeAccessService(db);
      const owner = { id: member.userId, roles: ['OWNER'] };
      const authorize = (id) => access.assertCanManageLodge(owner, id);
      const input = { bookingId: booking.id, actorUserId: owner.id, expectedAmount: '1200.55' };
      await assert.rejects(
        recordCashCollection(
          db,
          (id) => access.assertCanManageLodge({ id: guest.id, roles: ['OWNER'] }, id),
          input,
        ),
      );
      await assert.rejects(
        recordCashCollection(db, authorize, { ...input, expectedAmount: '1200.54' }),
      );
      const results = await Promise.all(
        Array.from({ length: 6 }, () => recordCashCollection(db, authorize, input)),
      );
      assert.equal(results.filter((r) => r.changed).length, 1);
      const receipts =
        await db.$queryRaw`SELECT id, amount::text, status FROM payment_collections WHERE booking_id = ${booking.id}::uuid`;
      assert.equal(receipts.length, 1);
      assert.equal(receipts[0].amount, '1200.55');
      assert.equal(receipts[0].status, 'PAID');
      const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.equal(fresh.paymentStatus, 'PAY_AT_LODGE');
      assert.equal(fresh.balanceAmount.toString(), '0');
      assert.equal(
        await db.auditLog.count({
          where: { entityId: booking.id, action: 'PAY_AT_LODGE_COLLECTED' },
        }),
        1,
      );
      assert.ok(
        (
          await withCashCollection(db, {
            id: booking.id,
            paymentStatus: 'PAY_AT_LODGE',
            totalAmount: '1200.55',
          })
        ).payAtLodgeCollectedAt,
      );
      const activity = await getAdminBookingActivity(db, {
        id: booking.id,
        lodgeId: member.lodgeId,
        createdAt: booking.createdAt.toISOString(),
        checkedInAt: null,
        checkedOutAt: null,
      });
      const cashEvents = activity.filter((item) => item.paymentMethod === 'PAY_AT_LODGE');
      assert.equal(cashEvents.length, 1);
      assert.equal(cashEvents[0].amount, '1200.55');
      assert.equal(cashEvents[0].title, `Payment Collected by ${member.ownerName}`);
      assert.equal(cashEvents[0].actorName, member.ownerName);
      assert.ok(Number.isFinite(Date.parse(cashEvents[0].timestamp)));
    } finally {
      await db.$disconnect();
    }
  },
);
