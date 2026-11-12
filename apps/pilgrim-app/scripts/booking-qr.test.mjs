import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const encoder = createRequire(require.resolve('react-native-qrcode-svg'))('qrcode');
function load(path, dependencies = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
      },
    }).outputText,
    {
      exports,
      Buffer,
      Date,
      Intl,
      require(name) {
        assert.ok(name in dependencies, `Unexpected dependency ${name}`);
        return dependencies[name];
      },
    },
  );
  return exports;
}
const { canViewBookingQr, isCurrentBookingQr } = load('../src/pilgrim-ui/booking-pass-policy.ts');
const now = Date.parse('2026-10-29T10:00:00Z');
const booking = {
  id: 'c225175c-73fd-47ce-86e3-4de127fa1491',
  bookingCode: 'TS-TEST-101',
  status: 'confirmed',
  qrReady: true,
  paymentStatus: 'Paid',
  checkOutDate: '2026-11-02',
};
const payload = {
  bookingId: booking.id,
  bookingCode: booking.bookingCode,
  status: 'ACTIVE',
  expiresAt: '2026-11-02T18:29:59Z',
  qrPayload: 'server-signed',
};

test('only confirmed eligible stays can display a check-in QR', () => {
  assert.equal(canViewBookingQr(booking, now), true);
  assert.equal(canViewBookingQr({ ...booking, paymentStatus: 'Pay at lodge' }, now), true);
  for (const status of ['pending', 'cancelled', 'completed', 'checked-in'])
    assert.equal(canViewBookingQr({ ...booking, status }, now), false);
  for (const paymentStatus of ['Payment pending', 'Payment failed', 'Refunded'])
    assert.equal(canViewBookingQr({ ...booking, paymentStatus }, now), false);
  assert.equal(canViewBookingQr({ ...booking, qrReady: false }, now), false);
});
test('checkout boundary uses India time and malformed dates fail closed', () => {
  assert.equal(canViewBookingQr(booking, Date.parse('2026-11-02T18:29:58Z')), true);
  assert.equal(canViewBookingQr(booking, Date.parse('2026-11-02T18:30:00Z')), false);
  assert.equal(canViewBookingQr({ ...booking, checkOutDate: 'bad date' }, now), false);
});
test('identity, cancellation, revocation and expiry are checked before render/export', () => {
  assert.equal(isCurrentBookingQr(payload, booking, now), true);
  for (const patch of [
    { bookingId: 'other-stay' },
    { bookingCode: 'other-reference' },
    { status: 'USED' },
    { status: 'REVOKED' },
    { expiresAt: '2020-01-01' },
    { expiresAt: 'bad date' },
    { qrPayload: '' },
  ])
    assert.equal(isCurrentBookingQr({ ...payload, ...patch }, booking, now), false);
  assert.equal(isCurrentBookingQr(payload, { ...booking, status: 'cancelled' }, now), false);
  assert.equal(isCurrentBookingQr(payload, undefined, now), false);
});
const { selectPassBooking } = load('../src/pilgrim-ui/booking-selection.ts');
test('an explicit cancelled or missing booking never falls back to another valid pass', () => {
  const cancelled = { ...booking, id: 'cancelled-stay', status: 'cancelled' };
  const records = [booking, cancelled];
  assert.equal(selectPassBooking(records, cancelled.id, new Date(now)).id, cancelled.id);
  assert.equal(selectPassBooking(records, 'missing-stay', new Date(now)), undefined);
  assert.equal(selectPassBooking(records, undefined, new Date(now)).id, booking.id);
});

const { QrCheckinService } = load('../../../backend/src/modules/bookings/qr-checkin.service.ts', {
  'node:crypto': crypto,
  '@nestjs/common': { Injectable: () => (target) => target },
  '@prisma/client': {},
  '@tuljai/utils': {},
});
const service = new QrCheckinService(
  {},
  {},
  { getOrThrow: () => 'synthetic-test-key-not-a-production-secret' },
  {},
  {},
  {},
  {},
);
const body = {
  bookingCode: booking.bookingCode,
  bookingId: booking.id,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  qrTokenId: '7bd99cc0-dbf2-4a40-a49f-5ab0881c8ff9',
  tokenVersion: 1,
  version: 1,
};

test('server-signed payload survives PNG encode/decode and owner verification', async () => {
  const signed = service.signQrDisplayPayload(body);
  const png = PNG.sync.read(
    await encoder.toBuffer(signed, {
      type: 'png',
      errorCorrectionLevel: 'M',
      width: 1440,
      margin: 4,
    }),
  );
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded, 'PNG must be scannable');
  assert.equal(decoded.data, signed);
  const verified = service.verifyQrDisplayPayload(decoded.data);
  assert.equal(verified.bookingId, booking.id);
  assert.equal(verified.bookingCode, booking.bookingCode);
  assert.equal(verified.qrTokenId, body.qrTokenId);
  assert.deepEqual(Object.keys(verified).sort(), Object.keys(body).sort());
  assert.equal(
    service.verifyQrDisplayPayload(`${signed.slice(0, -1)}${signed.endsWith('A') ? 'B' : 'A'}`),
    null,
  );
  assert.equal(
    service.verifyQrDisplayPayload(
      service.signQrDisplayPayload({ ...body, expiresAt: '2020-01-01T00:00:00Z' }),
    ),
    null,
  );
});
test('owner resolver uses the signed booking/token and rejects another booking ID', async () => {
  let requested;
  service.prisma = {
    bookingQrToken: {
      findFirst: async (input) => {
        requested = input.where;
        return { id: body.qrTokenId };
      },
    },
  };
  const signed = service.signQrDisplayPayload(body);
  assert.equal(
    await service.resolveQrTokenFromScanDto({ qrPayload: signed, bookingId: 'wrong-booking' }),
    null,
  );
  assert.equal(
    (await service.resolveQrTokenFromScanDto({ qrPayload: signed, bookingId: body.bookingId })).id,
    body.qrTokenId,
  );
  assert.equal(requested.bookingId, body.bookingId);
  assert.equal(requested.id, body.qrTokenId);
  assert.equal(requested.tokenVersion, 1);
});
