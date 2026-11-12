import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { deserialize, serialize } from 'node:v8';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const nest = require('@nestjs/common');
const ts = require('typescript');
const structuredClone = (value) => deserialize(serialize(value));
function load(path, imports) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
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
      require: (name) => {
        if (name in imports) return imports[name];
        throw new Error(`Unexpected dependency ${name}`);
      },
    },
  );
  return exports;
}
const { QrCheckinService } = load('modules/bookings/qr-checkin.service.ts', {
  'node:crypto': require('node:crypto'),
  '@nestjs/common': nest,
  '@tuljai/utils': { normalizePagination: () => ({}) },
});
const { GuestRegisterService } = load('modules/bookings/guest-register.service.ts', {
  '@nestjs/common': nest,
  '@tuljai/utils': { normalizePagination: () => ({}) },
});
const user = { id: 'owner', roles: ['OWNER'] };
const tokenId = '22222222-2222-4222-8222-222222222222';
const bookingId = '11111111-1111-4111-8111-111111111111';

// Models transactional serialization/rollback and conditional claims. This is a
// service regression test; it does not claim to exercise a live PostgreSQL server.
function fixture({
  status = 'QR_GENERATED',
  tokenStatus = 'ACTIVE',
  unauthorized = false,
  failRegister = false,
} = {}) {
  let booking = {
    id: bookingId,
    lodgeId: 'lodge',
    roomId: 'room',
    status,
    deletedAt: null,
    room: { status: 'AVAILABLE' },
    roomType: {},
    lodge: {},
    checkedInAt: null,
  };
  let token = {
    id: tokenId,
    bookingId,
    booking,
    status: tokenStatus,
    usedAt: tokenStatus === 'USED' ? new Date() : null,
    tokenVersion: 1,
    expiresAt: new Date('2099-01-01'),
  };
  let register = tokenStatus === 'USED' ? { id: 'register', bookingId, deletedAt: null } : null;
  let transitions = 0;
  let notifications = 0;
  let tail = Promise.resolve();
  let registers = 0;
  const writes = { create: async () => ({}) };
  const prisma = {
    bookingQrToken: {
      findFirst: async ({ where }) =>
        where.id === tokenId && where.bookingId === bookingId ? structuredClone(token) : null,
      findUnique: async ({ where }) =>
        where.tokenHash === createHash('sha256').update('legacy-token').digest('hex')
          ? structuredClone(token)
          : null,
      update: async () => ({}),
      updateMany: async ({ where, data }) => {
        if (where.status !== token.status || token.usedAt || token.expiresAt <= where.expiresAt.gt)
          return { count: 0 };
        Object.assign(token, data);
        return { count: 1 };
      },
    },
    booking: {
      updateMany: async ({ where, data }) => {
        if (!where.status.in.includes(booking.status) || where.roomId !== booking.roomId)
          return { count: 0 };
        Object.assign(booking, data);
        token.booking = booking;
        transitions++;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => structuredClone(booking),
    },
    guestRegister: { findUnique: async () => register },
    room: { update: async () => ({}) },
    roomStatusHistory: writes,
    bookingHistory: writes,
    qrScanLog: writes,
    $transaction: (fn) => {
      const run = tail.then(async () => {
        const snapshot = structuredClone({ booking, token, register, transitions });
        try {
          return await fn(prisma);
        } catch (error) {
          ({ booking, token, register, transitions } = snapshot);
          throw error;
        }
      });
      tail = run.catch(() => {});
      return run;
    },
  };
  const access = {
    assertCanManageLodge: async () => {
      if (unauthorized) throw new nest.ForbiddenException();
    },
  };
  const guest = {
    createFromBooking: async (_input, tx) => {
      assert.equal(tx, prisma);
      if (failRegister) throw new Error('Register persistence failed');
      register = { id: 'register', bookingId, deletedAt: null };
      registers++;
      return register;
    },
    getRegister: async () => register,
  };
  const service = new QrCheckinService(
    {},
    { getOwnerUnlockedBookingView: async () => structuredClone(booking) },
    { getOrThrow: () => 'test-only-signing-secret' },
    guest,
    access,
    {
      checkinCompleted: async () => {
        notifications++;
      },
      qrScanFailed() {},
    },
    prisma,
  );
  const payload = service.signQrDisplayPayload({
    bookingCode: 'TJS-123',
    bookingId,
    qrTokenId: tokenId,
    tokenVersion: 1,
    version: 1,
    expiresAt: '2099-01-01T00:00:00Z',
  });
  const dto = { qrPayload: payload, idempotencyKey: `checkin.${tokenId}`, deviceId: 'device' };
  return {
    service,
    dto,
    prisma,
    token: () => token,
    booking: () => booking,
    transitions: () => transitions,
    notifications: () => notifications,
    registers: () => registers,
  };
}

test('signed pilgrim QR checks in once; repeated request returns existing result', async () => {
  const f = fixture();
  assert.equal((await f.service.scanQr(f.dto, user, {})).scanResult, 'SUCCESS');
  assert.equal((await f.service.scanQr(f.dto, user, {})).scanResult, 'USED');
  assert.equal(f.transitions(), 1);
  assert.equal(f.registers(), 1);
  assert.equal(f.notifications(), 1);
});

test('simultaneous devices share one atomic transition and register', async () => {
  const f = fixture();
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      f.service.scanQr({ ...f.dto, deviceId: `device-${i}` }, user, {}),
    ),
  );
  assert.equal(results.filter((result) => result.scanResult === 'SUCCESS').length, 1);
  assert.equal(results.filter((result) => result.scanResult === 'USED').length, 7);
  assert.equal(f.transitions(), 1);
  assert.equal(f.registers(), 1);
  assert.equal(f.notifications(), 1);
});

test('register failure rolls back booking transition and token claim', async () => {
  const f = fixture({ failRegister: true });
  await assert.rejects(f.service.scanQr(f.dto, user, {}), /Register persistence failed/);
  assert.equal(f.token().status, 'ACTIVE');
  assert.equal(f.booking().status, 'QR_GENERATED');
  assert.equal(f.transitions(), 0);
});

for (const tokenStatus of ['ACTIVE', 'USED']) {
  test(`cross-lodge owner rejected before ${tokenStatus} token processing or disclosure`, async () => {
    const f = fixture({
      tokenStatus,
      status: tokenStatus === 'USED' ? 'CHECKED_IN' : 'QR_GENERATED',
      unauthorized: true,
    });
    await assert.rejects(f.service.scanQr(f.dto, user, {}), (error) => error.getStatus() === 403);
    assert.equal(f.transitions(), 0);
  });
}
for (const status of ['CANCELLED', 'CHECKED_OUT', 'COMPLETED', 'REJECTED']) {
  test(`booking ${status} cannot check in`, async () => {
    const f = fixture({ status });
    await assert.rejects(f.service.scanQr(f.dto, user, {}));
    assert.equal(f.transitions(), 0);
  });
}
test('tampered or expired signature, unknown token and mismatched idempotency key rejected', async () => {
  const f = fixture();
  for (const dto of [
    { ...f.dto, qrPayload: f.dto.qrPayload.replace('tjsqr', 'invalid') },
    {
      ...f.dto,
      qrPayload: f.service.signQrDisplayPayload({
        bookingCode: 'TJS-123',
        bookingId,
        qrTokenId: tokenId,
        tokenVersion: 1,
        version: 1,
        expiresAt: '2020-01-01T00:00:00Z',
      }),
    },
    {
      ...f.dto,
      qrPayload: f.service.signQrDisplayPayload({
        bookingCode: 'TJS-123',
        bookingId,
        qrTokenId: '33333333-3333-4333-8333-333333333333',
        tokenVersion: 1,
        version: 1,
        expiresAt: '2099-01-01T00:00:00Z',
      }),
    },
    { ...f.dto, idempotencyKey: 'other-operation' },
  ])
    await assert.rejects(f.service.scanQr(dto, user, {}));
  assert.equal(f.transitions(), 0);
});
test('legacy raw-token API remains compatible', async () => {
  const f = fixture();
  assert.equal((await f.service.scanQr({ token: 'legacy-token' }, user, {})).scanResult, 'SUCCESS');
});
test('register service uses supplied transaction for register and audit writes', async () => {
  let upsert;
  let audit;
  const tx = {
    guestRegister: {
      upsert: async (input) => {
        upsert = input;
        return { id: 'register' };
      },
    },
    registerAuditLog: {
      create: async (input) => {
        audit = input;
      },
    },
  };
  const service = new GuestRegisterService({}, {}, {}, {});
  service.toGuestRegister = (row) => row;
  await service.createFromBooking(
    {
      actorUserId: 'owner',
      qrTokenId: tokenId,
      booking: { id: bookingId, checkOutDate: new Date() },
    },
    tx,
  );
  assert.equal(upsert.where.bookingId, bookingId);
  assert.equal(upsert.create.registerCode, `REG-${bookingId}`);
  assert.equal(audit.data.guestRegisterId, 'register');
});
