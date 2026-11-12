import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { buildBookingReportPdf } = require('../src/modules/operations/booking-report-pdf.ts');
const { OperationsService } = require('../src/modules/operations/operations.service.ts');
const { reportDateRange } = require('../src/modules/operations/report-range.ts');
const reporting = {};
runInNewContext(
  require('typescript').transpileModule(
    readFileSync(new URL('../../packages/shared/src/reporting.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: 1, target: 9 } },
  ).outputText,
  { exports: reporting, Date, Number },
);
const { indiaDate, reportPeriod, validReportRange, allReportPages } = reporting;

test('date-only ranges include the entire end date in IST, including month and year rollover', () => {
  const range = reportDateRange('2026-12-31', '2026-12-31');
  assert.equal(range.gte.toISOString(), '2026-12-30T18:30:00.000Z');
  assert.equal(range.lt.toISOString(), '2026-12-31T18:30:00.000Z');
  for (const dates of [
    ['2026-02-30', '2026-03-01'],
    ['2026-11-13', '2026-11-12'],
    ['bad', '2026-11-12'],
  ]) {
    assert.throws(() => reportDateRange(...dates));
    assert.equal(validReportRange({ startDate: dates[0], endDate: dates[1] }), false);
  }
  assert.equal(indiaDate(new Date('2026-11-11T19:00:00Z')), '2026-11-12');
  assert.equal(
    JSON.stringify(reportPeriod('lastMonth', new Date('2026-01-01T12:00:00Z'))),
    JSON.stringify({ startDate: '2025-12-01', endDate: '2025-12-31' }),
  );
});

test('report previews collect every page and propagate a later-page error', async () => {
  const calls = [];
  const rows = await allReportPages(async (page) => {
    calls.push(page);
    return { items: [page], totalPages: 3 };
  });
  assert.deepEqual(calls, [1, 2, 3]);
  assert.equal(JSON.stringify(rows), '[1,2,3]');
  await assert.rejects(
    allReportPages(async (page) => {
      if (page === 2) throw new Error('offline');
      return { items: [1], totalPages: 2 };
    }),
    /offline/,
  );
});

const row = {
  bookingCode: 'TJS-TEST-00001',
  guestName: 'Test Guest',
  lodgeName: 'Test Lodge',
  roomTypeName: 'Family room',
  lodgeId: 'assigned-lodge',
  checkInDate: '2026-11-11',
  checkOutDate: '2026-11-12',
  commissionAmount: '125.50',
  commissionRatePercent: '5',
  commissionType: 'PERCENTAGE',
  paymentMode: 'ONLINE',
  totalAmount: '2510',
  status: 'COMPLETED',
};
test('owner export preserves lodge scope across all pages and audits the export', async () => {
  const service = Object.create(OperationsService.prototype);
  const calls = [];
  const audits = [];
  service.getOwnerLodgeIds = async () => ['assigned-lodge'];
  service.listBookingReport = async (query, lodges) => {
    calls.push({ query, lodges });
    return { items: [{ ...row, bookingCode: `TJS-${query.page}` }], totalPages: 2 };
  };
  service.auditLogService = { create: async (value) => audits.push(value) };
  const result = await service.bookingReportPdf(
    {
      startDate: '2026-11-01',
      endDate: '2026-11-12',
      lodgeId: 'foreign-lodge',
      reportType: 'completed',
      page: 10,
      limit: 1,
    },
    { id: 'owner' },
    true,
  );
  assert.equal(result.bookingCount, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((call) => call.query.page),
    [1, 2],
  );
  assert.ok(calls.every((call) => call.query.limit === 500 && call.lodges[0] === 'assigned-lodge'));
  assert.match(result.filename, /completed-bookings-2026-11-01-to-2026-11-12\.pdf$/);
  assert.equal(Buffer.from(result.base64, 'base64').subarray(0, 5).toString(), '%PDF-');
  assert.equal(audits[0].action, 'OWNER_BOOKING_REPORT_EXPORTED');
  const where = service.buildBookingWhere({ lodgeId: 'foreign-lodge', reportType: 'completed' }, [
    'assigned-lodge',
  ]);
  assert.deepEqual(where.lodgeId, { in: [] });
  assert.deepEqual(where.AND, [{ status: { in: ['CHECKED_OUT', 'COMPLETED'] } }]);
});

test('missing export dates fail before reading bookings', async () => {
  const service = Object.create(OperationsService.prototype);
  service.listBookingReport = async () => assert.fail('must not read bookings');
  await assert.rejects(
    service.bookingReportPdf({}, { id: 'admin' }),
    /Choose a start and end date/,
  );
});

test('owner projections retain stored commission snapshots, payment method, and room name', async () => {
  let requested;
  const booking = {
    ...row,
    id: '11111111-1111-4111-8111-111111111111',
    checkInDate: new Date('2026-11-11'),
    checkOutDate: new Date('2026-11-12'),
    lodge: { name: row.lodgeName },
    roomType: { name: row.roomTypeName },
    paymentStatus: 'FULLY_PAID',
  };
  const db = {
    booking: {
      findMany: async (query) => {
        requested = query;
        return [booking];
      },
      count: async () => 1,
    },
    lodgeOwner: { findMany: async () => [{ lodgeId: row.lodgeId }] },
    $transaction: (queries) => Promise.all(queries),
    $queryRaw: async () => [
      {
        id: booking.id,
        commissionRatePercent: '5',
        commissionType: 'PERCENTAGE',
        commissionFixedAmount: '0',
        paymentMode: 'ONLINE',
      },
    ],
  };
  const service = new OperationsService({}, { isAdmin: () => false }, db, {});
  const result = await service.ownerBookingReport(
    { lodgeId: row.lodgeId, startDate: '2026-11-12', endDate: '2026-11-12' },
    { id: 'owner' },
  );
  assert.equal(result.items[0].commissionRatePercent, '5');
  assert.equal(result.items[0].commissionAmount, row.commissionAmount);
  assert.equal(result.items[0].paymentMode, 'ONLINE');
  assert.equal(result.items[0].roomTypeName, row.roomTypeName);
  assert.deepEqual(requested.where.lodgeId, { in: [row.lodgeId] });
  assert.equal(requested.where.createdAt.lt.toISOString(), '2026-11-12T18:30:00.000Z');
  assert.deepEqual(requested.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
});

test('multi-page PDF repeats its branding and table headers, and includes empty reports', async () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({ ...row, bookingCode: `TJS-${i}` }));
  const pdf = await buildBookingReportPdf(rows, '2026-11-01', '2026-11-12');
  const raw = pdf.toString('latin1');
  assert.match(raw, /\/MediaBox \[0 0 842 790\]/);
  assert.ok((raw.match(/\/Type \/Page\b/g) ?? []).length >= 3);
  assert.ok(pdf.length > 100_000);
  const empty = await buildBookingReportPdf([], '2026-11-01', '2026-11-12');
  assert.equal((empty.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length, 1);
});
