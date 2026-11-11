import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { recognizeQr } = require('../../apps/owner-app/src/features/checkin/scan-operation.ts');
const { BookingDeliveryService } = require('../src/modules/bookings/booking-delivery.service.ts');
const passModule = require('../src/modules/bookings/booking-pass.ts');
const { deliveryFailure, retryDelayMs } = require('../src/modules/bookings/confirmation-outbox.ts');
const { QrCheckinService } = require('../src/modules/bookings/qr-checkin.service.ts');
const {
  NotificationEventsService,
} = require('../src/modules/notifications/notification-events.service.ts');
const { EmailService, isEmailRecipient } = require('../src/shared/email/email.service.ts');

test('public inventory synchronization does not disclose booking or pilgrim information', () => {
  const events = [];
  const service = new NotificationEventsService(
    {},
    {},
    {
      publishToRole: (role, event, payload) => events.push({ role, event, payload }),
      publishToCity: (_city, event, payload) => events.push({ role: 'CITY', event, payload }),
      publishToUser: () => {},
      publishToLodge: () => {},
    },
  );
  service.bookingCommitted({
    id: 'private-booking',
    pilgrimUserId: 'private-pilgrim',
    cityId: 'city',
    lodgeId: 'lodge',
    roomTypeId: 'type',
    status: 'ACCEPTED',
  });
  for (const event of events.filter((entry) => ['PILGRIM', 'CITY'].includes(entry.role)))
    assert.deepEqual(event.payload, { lodgeId: 'lodge', roomTypeId: 'type' });
});

test(
  'a slow email provider cannot delay notification jobs arriving in a later worker tick',
  { timeout: 2000 },
  async () => {
    const previous = process.env.BOOKING_EMAIL_ENABLED;
    process.env.BOOKING_EMAIL_ENABLED = 'true';
    let release,
      notifications = 0,
      tick = 0;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const worker = new BookingDeliveryService(
      {
        bookingDeliveryJob: {
          updateMany: async () => ({ count: 0 }),
          findMany: async ({ where }) =>
            where.type === 'CONFIRMATION_EMAIL'
              ? [{ id: 'slow-mail', type: 'CONFIRMATION_EMAIL' }]
              : tick > 0
                ? [{ id: 'new-alert', type: 'CONFIRMATION_EVENTS' }]
                : [],
        },
      },
      {},
      {},
      {},
    );
    worker.claimAndProcess = async (job) => {
      if (job.type === 'CONFIRMATION_EMAIL') await gate;
      else notifications++;
    };
    try {
      await worker.drain();
      tick++;
      await worker.drain();
      assert.equal(notifications, 1);
    } finally {
      release();
      await worker.onModuleDestroy();
      if (previous === undefined) delete process.env.BOOKING_EMAIL_ENABLED;
      else process.env.BOOKING_EMAIL_ENABLED = previous;
    }
  },
);

test('older email backlog cannot consume the bounded notification intake', async () => {
  const previous = process.env.BOOKING_EMAIL_ENABLED;
  process.env.BOOKING_EMAIL_ENABLED = 'true';
  const processed = [];
  const backlog = [
    ...Array.from({ length: 30 }, (_, id) => ({ id: `mail-${id}`, type: 'CONFIRMATION_EMAIL' })),
    { id: 'new-alert', type: 'CONFIRMATION_EVENTS' },
  ];
  const worker = new BookingDeliveryService(
    {
      bookingDeliveryJob: {
        updateMany: async () => ({ count: 0 }),
        findMany: async ({ where, take }) =>
          backlog.filter((job) => !where.type || job.type === where.type).slice(0, take),
      },
    },
    {},
    {},
    {},
  );
  worker.claimAndProcess = async (job) => { processed.push(job.id); };
  try {
    await worker.drain();
    await worker.onModuleDestroy();
    assert.ok(processed.includes('new-alert'));
    assert.equal(processed.filter((id) => id.startsWith('mail-')).length, 4);
  } finally {
    if (previous === undefined) delete process.env.BOOKING_EMAIL_ENABLED;
    else process.env.BOOKING_EMAIL_ENABLED = previous;
  }
});

const details = {
  bookingCode: 'TJS-PREVIEW-ONLY',
  guestName: 'अनघा पाटील / Preview Guest',
  lodgeName: 'Preview Pilgrim Lodge',
  address: 'Preview accommodation address, Tuljapur, Maharashtra',
  checkIn: '2026-12-01 at 12:00',
  checkOut: '2026-12-03 at 10:00',
  room: 'Family Room - Room 12',
  guests: 3,
  amount: 'INR 2,000.00',
  paymentStatus: 'FULLY PAID',
  paymentMethod: 'Online - Razorpay',
  instructions:
    'Bring your original photo ID and this booking pass.\nFollow the lodge check-in and guest policies.',
  support: 'Preview only. Open your booking in Tuljai Stays for assistance.',
  qrPayload: '',
};
const body = {
  bookingCode: 'TJS-PREVIEW-ONLY',
  bookingId: '11111111-1111-4111-8111-111111111111',
  qrTokenId: '22222222-2222-4222-8222-222222222222',
  tokenVersion: 1,
  version: 1,
  expiresAt: '2099-12-31T00:00:00.000Z',
};
const qrService = new QrCheckinService(
  {},
  {},
  { getOrThrow: () => 'synthetic-qr-secret' },
  {},
  {},
  {},
  {},
);

test('opaque QR conceals IDs, validates through the shared resolver, rejects tampering, and remains queueable offline', async () => {
  const payload = qrService.signQrDisplayPayload(body, true);
  assert.equal(payload.includes(body.bookingId), false);
  assert.equal(payload.includes(Buffer.from(JSON.stringify(body)).toString('base64url')), false);
  assert.deepEqual(qrService.verifyQrDisplayPayload(payload), body);
  assert.equal(qrService.verifyQrDisplayPayload(`${payload.slice(0, -5)}AAAAA`), null);
  assert.equal(
    qrService.verifyQrDisplayPayload(
      qrService.signQrDisplayPayload({ ...body, expiresAt: '2000-01-01' }, true),
    ),
    null,
  );
  const recognition = recognizeQr(payload);
  assert.ok(recognition);
  assert.equal(recognition.bookingId, '');
  assert.equal(recognizeQr(payload).key, recognition.key);
  qrService.prisma = {
    bookingQrToken: {
      findFirst: async ({ where }) => {
        assert.equal(where.id, body.qrTokenId);
        assert.equal(where.bookingId, body.bookingId);
        return { id: where.id };
      },
    },
  };
  assert.equal(
    (await qrService.resolveQrTokenFromScanDto({ qrPayload: payload })).id,
    body.qrTokenId,
  );
  assert.equal(
    await qrService.resolveQrTokenFromScanDto({ qrPayload: payload, bookingId: 'other' }),
    null,
  );
  assert.deepEqual(qrService.verifyQrDisplayPayload(qrService.signQrDisplayPayload(body)), body);
  details.qrPayload = payload;
});

test('professional PDF and email contain only booking details; QR survives PNG encode/decode', async () => {
  const { pdf, qr } = await passModule.generateBookingPass(details);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const png = require('pngjs').PNG.sync.read(qr);
  const decoded = require('jsqr')(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded.data, details.qrPayload);
  const email = passModule.confirmationEmail({
    ...details,
    guestName: '<script>alert(1)</script>',
    bookingUrl: 'javascript:alert(1)',
  });
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.ok(!email.html.includes('javascript:'));
  assert.ok(email.text.includes('Rooms: 1'));
  assert.ok(email.html.includes('cid:booking-qr'));
  if (process.env.BOOKING_PASS_PREVIEW_DIR) {
    mkdirSync(process.env.BOOKING_PASS_PREVIEW_DIR, { recursive: true });
    writeFileSync(join(process.env.BOOKING_PASS_PREVIEW_DIR, 'booking-pass-preview.pdf'), pdf);
    writeFileSync(
      join(process.env.BOOKING_PASS_PREVIEW_DIR, 'booking-email-preview.html'),
      passModule.confirmationEmail(details).html,
    );
  }
});

test('strict email submission validates recipients, reports provider acceptance, and propagates failures', async () => {
  for (const bad of [
    'x',
    'a@example.com\r\nBcc: other@example.com',
    'a@example.com,b@example.com',
    '<a@example.com>',
  ])
    assert.equal(isEmailRecipient(bad), false);
  assert.equal(isEmailRecipient('test@example.com'), true);
  const email = new EmailService({ get: () => undefined, getOrThrow: () => 'test@example.com' });
  await assert.rejects(email.submit({ to: 'invalid' }), /Invalid recipient/);
  await assert.rejects(email.submit({ to: 'test@example.com' }), /not configured/);
  email.transporter = {
    sendMail: async () => ({ accepted: ['test@example.com'], messageId: 'provider-id' }),
  };
  assert.equal((await email.submit({ to: 'test@example.com' })).messageId, 'provider-id');
  email.transporter = {
    sendMail: async () => {
      throw Object.assign(new Error('temporary'), { responseCode: 421 });
    },
  };
  await assert.rejects(email.submit({ to: 'test@example.com' }), /temporary/);
});

test('retry backoff is bounded; ambiguous SMTP submission is never automatically resent', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map(retryDelayMs),
    [30000, 60000, 120000, 240000, 480000, 960000],
  );
  assert.equal(retryDelayMs(100), 3600000);
  assert.equal(deliveryFailure({ responseCode: 421 }).permanent, false);
  assert.equal(deliveryFailure({ responseCode: 550 }).permanent, true);
  assert.equal(deliveryFailure({ code: 'EAUTH' }).uncertain, false);
  assert.equal(
    deliveryFailure({ code: 'ETIMEDOUT', command: 'DATA' }).reason,
    'SUBMISSION_UNKNOWN',
  );
});

function workerFixture({
  type = 'CONFIRMATION_EMAIL',
  status = 'ACCEPTED',
  recipient = 'controlled@example.com',
  emailFailure,
  pdfFailure = false,
  attempts = 0,
} = {}) {
  const row = {
    id: 'job',
    bookingId: 'booking',
    type,
    operation: 'initial',
    recipient,
    status: 'PENDING',
    attempts,
    leaseToken: null,
  };
  const booking = {
    bookingCode: 'TJS-TEST',
    id: 'booking',
    pilgrimUserId: 'pilgrim',
    guestName: 'Guest',
    status,
    checkInDate: new Date('2026-12-01'),
    checkOutDate: new Date('2026-12-03'),
    paymentStatus: 'FULLY_PAID',
    totalAmount: 1000,
    totalGuests: 2,
    lodge: { name: 'Lodge', address: null },
    roomType: { name: 'Room' },
  };
  let sends = 0,
    notifications = 0;
  const matches = (where) =>
    Object.entries(where).every(([key, value]) =>
      value && typeof value === 'object'
        ? 'gt' in value
          ? row[key] > value.gt
          : 'lt' in value
            ? row[key] < value.lt
            : value.in.includes(row[key])
        : row[key] === value,
    );
  const prisma = {
    bookingDeliveryJob: {
      updateMany: async ({ where, data }) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(row, data, {
          attempts: data.attempts?.increment
            ? row.attempts + data.attempts.increment
            : row.attempts,
        });
        return { count: 1 };
      },
    },
    booking: { findUnique: async () => booking },
  };
  const worker = new BookingDeliveryService(
    prisma,
    {
      submit: async () => {
        sends++;
        if (emailFailure) throw emailFailure;
        return { messageId: 'accepted-id' };
      },
    },
    {
      getQrMetadata: async () => {
        if (pdfFailure) throw new Error('PDF inputs unavailable');
        return { qrPayload: details.qrPayload };
      },
    },
    {
      bookingCommitted: () => {},
      bookingAccepted: async () => {
        notifications++;
      },
      prepaidBookingConfirmed: async () => {
        notifications++;
      },
      bookingPaymentConfirmed: async () => {
        notifications++;
      },
    },
  );
  return { row, worker, sends: () => sends, notifications: () => notifications };
}

test('duplicate worker execution submits exactly once under the lease and records accepted status', async () => {
  const f = workerFixture();
  await Promise.all([
    f.worker.claimAndProcess({ ...f.row }),
    f.worker.claimAndProcess({ ...f.row }),
  ]);
  assert.equal(f.sends(), 1);
  assert.equal(f.row.status, 'SENT');
  assert.equal(f.row.providerMessageId, 'accepted-id');
  assert.ok(f.row.sentAt);
});

for (const [name, options, expected, reason] of [
  ['temporary provider outage', { emailFailure: { responseCode: 421 } }, 'RETRYING', 'SMTP_421'],
  ['invalid recipient', { recipient: 'invalid' }, 'FAILED', 'INVALID_RECIPIENT'],
  ['PDF generation input failure', { pdfFailure: true }, 'RETRYING', 'PASS_OR_NOTIFICATION_FAILED'],
  [
    'ambiguous provider acceptance',
    { emailFailure: { code: 'ETIMEDOUT', command: 'DATA' } },
    'FAILED',
    'SUBMISSION_UNKNOWN',
  ],
  ['retry limit', { emailFailure: { responseCode: 421 }, attempts: 5 }, 'FAILED', 'SMTP_421'],
  ['cancelled booking', { status: 'CANCELLED' }, 'SKIPPED', 'BOOKING_NO_LONGER_ELIGIBLE'],
])
  test(`worker handles ${name} independently of booking state`, async () => {
    const f = workerFixture(options);
    await f.worker.claimAndProcess({ ...f.row });
    assert.equal(f.row.status, expected);
    assert.equal(f.row.lastError, reason);
    assert.equal(f.row.leaseToken, null);
  });

test('notification jobs execute independently from email jobs', async () => {
  const f = workerFixture({ type: 'CONFIRMATION_EVENTS' });
  await f.worker.claimAndProcess({ ...f.row });
  assert.equal(f.sends(), 0);
  assert.equal(f.notifications(), 3);
  assert.equal(f.row.status, 'SENT');
});

test('a PDF renderer exception retries without submitting mail or changing the booking', async () => {
  const original = passModule.generateBookingPass;
  passModule.generateBookingPass = async () => {
    throw new Error('Synthetic renderer failure');
  };
  try {
    const f = workerFixture();
    await f.worker.claimAndProcess({ ...f.row });
    assert.equal(f.sends(), 0);
    assert.equal(f.row.status, 'RETRYING');
    assert.equal(f.row.lastError, 'PASS_OR_NOTIFICATION_FAILED');
  } finally {
    passModule.generateBookingPass = original;
  }
});
