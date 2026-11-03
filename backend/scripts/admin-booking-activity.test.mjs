import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const ts = require('typescript');

const { getAdminBookingActivity } = require('../src/modules/bookings/admin-booking-activity.ts');
const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../../apps/admin-panel/src/bookings/booking-operations.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText,
  { exports },
);
const { buildBookingTimeline } = exports;
const at = (hour) => new Date(`2026-11-03T${String(hour).padStart(2, '0')}:00:00.000Z`);
const booking = {
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: at(1).toISOString(),
  updatedAt: at(23).toISOString(),
  checkedInAt: at(6).toISOString(),
  checkedOutAt: at(9).toISOString(),
  status: 'COMPLETED',
  paymentStatus: 'FULLY_PAID',
};
function fixture(history = [], tokens = [], receipts = [], audits = []) {
  let scoped = 0;
  const find = (rows) => async (args) => {
    assert.equal(args.where.bookingId ?? args.where.entityId, booking.id);
    scoped++;
    return rows;
  };
  return {
    db: {
      bookingHistory: { findMany: find(history) },
      bookingQrToken: { findMany: find(tokens) },
      auditLog: { findMany: find(audits) },
      $queryRaw: async (sql, id) => {
        assert.equal(id, booking.id);
        assert.match(sql.join('?'), /paid_at IS NOT NULL/);
        scoped++;
        return receipts;
      },
    },
    scoped: () => scoped,
  };
}
test('full booking lifecycle retains acceptance, QR reissues, check-in and payment timestamps after checkout', async () => {
  const event = (id, action, toStatus, hour) => ({
    id,
    action,
    toStatus,
    createdAt: at(hour),
    notes: null,
    actor: { displayName: 'Owner One' },
  });
  const f = fixture(
    [
      event('created', 'BOOKING_CREATED', 'PENDING_OWNER_APPROVAL', 1),
      event('accepted', 'BOOKING_ACCEPTED', 'ACCEPTED', 2),
      event('qr', 'QR_GENERATED', 'QR_GENERATED', 3),
      event('in', 'BOOKING_CHECKED_IN_BY_QR', 'CHECKED_IN', 6),
      event('out', 'BOOKING_CHECKED_OUT', 'CHECKED_OUT', 9),
      event('complete', 'ADMIN_STATUS_UPDATED', 'COMPLETED', 10),
    ],
    [
      { id: 'qr-one', createdAt: at(3) },
      { id: 'qr-two', createdAt: at(4) },
    ],
    [
      { id: 'online', method: 'ONLINE', amount: '300.00', paidAt: at(2), reference: null },
      {
        id: 'cash',
        method: 'PAY_AT_LODGE',
        amount: '900.00',
        paidAt: at(7),
        reference: 'owner-cash',
      },
    ],
    [{ metadata: { reference: 'owner-cash' }, actor: { displayName: 'Owner Two' } }],
  );
  const activity = await getAdminBookingActivity(f.db, booking);
  assert.equal(f.scoped(), 4);
  assert.equal(activity.filter((item) => item.title === 'QR generated').length, 1);
  assert.equal(activity.filter((item) => item.title === 'QR reissued').length, 1);
  assert.ok(
    activity.some(
      (item) => item.title === 'Booking accepted' && item.timestamp === at(2).toISOString(),
    ),
  );
  assert.equal(activity.filter((item) => item.title === 'Checked in').length, 1);
  assert.equal(activity.filter((item) => item.title === 'Checked out').length, 1);
  const cash = activity.find((item) => item.paymentMethod === 'PAY_AT_LODGE');
  assert.equal(cash.title, 'Payment collected at lodge');
  assert.equal(cash.amount, '900.00');
  assert.equal(cash.actorName, 'Owner Two');
  assert.equal(cash.timestamp, at(7).toISOString());
  const online = activity.find((item) => item.paymentMethod === 'ONLINE');
  assert.equal(online.title, 'Payment received online');
  assert.equal(online.timestamp, at(2).toISOString());
  assert.ok(activity.some((item) => item.title === 'Stay completed'));
  for (let i = 1; i < activity.length; i++)
    assert.ok(Date.parse(activity[i - 1].timestamp) <= Date.parse(activity[i].timestamp));
  const timeline = buildBookingTimeline({ ...booking, activity });
  assert.equal(timeline.length, activity.length);
  assert.equal(timeline.find((item) => item.id === cash.id).amount, '900.00');
});
test('payment status alone never invents a payment received event or an acceptance time', async () => {
  const activity = await getAdminBookingActivity(fixture().db, booking);
  assert.equal(activity.length, 3);
  assert.ok(activity.every((item) => !item.paymentMethod && item.timestamp !== booking.updatedAt));
  assert.equal(activity[0].title, 'Booked');
});
test('cancellation history uses its recorded timestamp and actor without losing QR issuance', async () => {
  const activity = await getAdminBookingActivity(
    fixture(
      [
        {
          id: 'cancel',
          action: 'BOOKING_CANCELLED_BY_PILGRIM',
          toStatus: 'CANCELLED',
          notes: 'Travel cancelled',
          createdAt: at(5),
          actor: { displayName: 'Pilgrim' },
        },
      ],
      [{ id: 'qr', createdAt: at(3) }],
    ).db,
    { ...booking, checkedInAt: null, checkedOutAt: null, status: 'CANCELLED' },
  );
  assert.equal(activity.length, 3);
  assert.equal(activity[2].title, 'Booking cancelled');
  assert.equal(activity[2].timestamp, at(5).toISOString());
  assert.equal(activity[2].description, 'Travel cancelled');
});
test('legacy admin responses show only known dates and do not mistake the owner deadline for an event', () => {
  const timeline = buildBookingTimeline({
    ...booking,
    ownerResponseDeadline: at(20).toISOString(),
  });
  assert.equal(timeline.length, 3);
  assert.ok(
    timeline.every(
      (item) => item.timestamp !== booking.updatedAt && item.timestamp !== at(20).toISOString(),
    ),
  );
});
test('empty recorded activity remains empty instead of fabricating lifecycle events', () => {
  assert.equal(buildBookingTimeline({ ...booking, activity: [] }).length, 0);
});
