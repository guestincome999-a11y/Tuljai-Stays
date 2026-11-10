import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
require('tsconfig-paths').register({
  baseUrl: fileURLToPath(new URL('../../', import.meta.url)),
  paths: { '@tuljai/utils': ['packages/utils/src/index.ts'] },
});
const { NotificationsService } = require('../src/modules/notifications/notifications.service.ts');

function fixture() {
  const rows = [];
  const events = [];
  let beforeUpdate;
  const matches = (row, where) =>
    Object.entries(where ?? {}).every(([key, value]) => {
      if (key === 'OR') return value.some((clause) => matches(row, clause));
      if (key === 'id' && typeof value === 'object') return value.in.includes(row.id);
      return row[key] === value;
    });
  const prisma = {
    notification: {
      findFirst: async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
      findFirstOrThrow: async ({ where }) => {
        const row = rows.find((row) => matches(row, where));
        assert.ok(row);
        return { ...row };
      },
      findMany: async ({ where, select, skip = 0, take = rows.length }) =>
        rows
          .filter((row) => matches(row, where))
          .slice(skip, skip + take)
          .map((row) => (select ? { id: row.id } : { ...row })),
      count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
      updateMany: async ({ where, data }) => {
        beforeUpdate?.();
        beforeUpdate = undefined;
        const selected = rows.filter((row) => matches(row, where));
        selected.forEach((row) => Object.assign(row, data));
        return { count: selected.length };
      },
    },
    booking: { findMany: async () => [] },
    $transaction: async (queries, options) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      return Promise.all(queries);
    },
  };
  const service = new NotificationsService({}, prisma, {
    publishToUser: (...args) => events.push(args),
  });
  function add(userId, id) {
    rows.push({
      id,
      recipientUserId: userId,
      recipientRole: userId.startsWith('owner') ? 'OWNER' : 'PILGRIM',
      readAt: null,
      deletedAt: null,
      createdAt: new Date(),
      deliveredAt: null,
      failedAt: null,
      bookingId: null,
      body: 'Test',
      title: 'Test',
      type: 'SYSTEM',
      channel: 'IN_APP',
      priority: 'NORMAL',
      data: null,
      failureReason: null,
      lodgeId: null,
    });
  }
  for (const user of ['pilgrim-a', 'pilgrim-b', 'owner-a', 'owner-b'])
    for (let n = 1; n <= 3; n++) add(user, `${user}-${n}`);
  return {
    rows,
    service,
    events,
    add,
    set beforeUpdate(fn) {
      beforeUpdate = fn;
    },
  };
}

for (const role of ['pilgrim', 'owner']) {
  const user = { id: `${role}-a` };
  test(`${role} backend: single read persists, count=2, repeated requests retain original readAt`, async () => {
    const { service } = fixture();
    const first = await service.markRead(`${role}-a-1`, user);
    await service.markRead(`${role}-a-1`, user);
    const result = await service.listForUser({}, user);
    assert.equal(result.unreadCount, 2);
    assert.equal(result.items.find((row) => row.id === first.id).readAt, first.readAt);
    assert.equal((await service.unreadCount(user)).unreadCount, 2);
  });
  test(`${role} backend: bulk is scoped, retry-safe and excludes arrivals during write`, async () => {
    const f = fixture();
    const snapshot = await f.service.listForUser({}, user);
    f.beforeUpdate = () => f.add(user.id, 'new-arrival');
    await f.service.markAllRead(user, snapshot.unreadIds);
    await f.service.markAllRead(user, snapshot.unreadIds);
    assert.equal((await f.service.unreadCount(user)).unreadCount, 1);
    assert.equal(f.rows.find((row) => row.id === 'new-arrival').readAt, null);
    assert.ok(
      f.rows.filter((row) => row.recipientUserId !== user.id).every((row) => row.readAt === null),
    );
  });
  test(`${role} backend: legacy bulk freezes IDs before update and empty selection is a no-op`, async () => {
    const f = fixture();
    f.beforeUpdate = () => f.add(user.id, 'new-arrival');
    await f.service.markAllRead(user);
    await f.service.markAllRead(user, []);
    assert.equal((await f.service.unreadCount(user)).unreadCount, 1);
  });
  test(`${role} backend: same-role and cross-role ownership isolation`, async () => {
    const { service } = fixture();
    const foreign = [`${role}-b-1`, `${role === 'pilgrim' ? 'owner' : 'pilgrim'}-a-1`];
    for (const id of foreign) await assert.rejects(service.markRead(id, user), /cannot access/);
    await service.markAllRead(user, foreign);
    assert.equal((await service.unreadCount(user)).unreadCount, 3);
    await assert.rejects(service.markRead('missing', user), /not found/);
  });
  test(`${role} backend: concurrent sessions converge and notify only the recipient`, async () => {
    const { service, events } = fixture();
    await Promise.all([
      service.markRead(`${role}-a-1`, user),
      service.markRead(`${role}-a-2`, user),
    ]);
    const one = await service.listForUser({}, user);
    const two = await service.listForUser({}, user);
    assert.equal(one.unreadCount, 1);
    assert.deepEqual(one.unreadIds, two.unreadIds);
    assert.ok(
      events.every(
        ([recipient, event]) => recipient === user.id && event === 'notification:unread-count',
      ),
    );
  });
}

test('Push token registration deactivates the previous account without affecting other apps/tokens', async () => {
  const { AuthService } = require('../src/modules/auth/auth.service.ts');
  const records = [
    { userId: 'old', deviceId: 'phone', appType: 'PILGRIM_APP', fcmToken: 'token', isActive: true },
    {
      userId: 'new',
      deviceId: 'other-phone',
      appType: 'PILGRIM_APP',
      fcmToken: 'token',
      isActive: true,
    },
    { userId: 'new', deviceId: 'phone', appType: 'PILGRIM_APP', fcmToken: 'token', isActive: true },
    { userId: 'old', deviceId: 'phone', appType: 'OWNER_APP', fcmToken: 'token', isActive: true },
    {
      userId: 'old',
      deviceId: 'different-phone',
      appType: 'PILGRIM_APP',
      fcmToken: 'different-token',
      isActive: true,
    },
  ];
  function matches(record, where) {
    return Object.entries(where).every(([key, value]) =>
      key === 'NOT' ? !matches(record, value) : record[key] === value,
    );
  }
  const service = Object.create(AuthService.prototype);
  service.prisma = {
    deviceToken: {
      updateMany: async ({ where, data }) => {
        records.filter((r) => matches(r, where)).forEach((r) => Object.assign(r, data));
      },
      upsert: async ({ where, update }) => {
        Object.assign(
          records.find((r) => matches(r, where.userId_deviceId_appType)),
          update,
        );
      },
    },
  };
  await service.saveDeviceToken('new', {
    deviceId: 'phone',
    appType: 'PILGRIM_APP',
    fcmToken: 'token',
    platform: 'ANDROID',
  });
  assert.deepEqual(
    records.map((r) => r.isActive),
    [false, false, true, true, true],
  );
});

test('FCM alert uses a stable notification identity and cannot restore a delayed badge count', async () => {
  const { FcmService } = require('../src/modules/notifications/providers/fcm.service.ts');
  const service = Object.create(FcmService.prototype);
  let sent;
  service.getMessagingClient = () => ({
    send: async (message) => {
      sent = message;
      return 'provider-id';
    },
  });
  const result = await service.sendToToken({
    badge: 3,
    body: 'body',
    title: 'title',
    fcmToken: 'test-token',
    data: { notificationId: 'stable-id', type: 'SYSTEM' },
  });
  assert.equal(result.success, true);
  assert.equal(sent.android.notification.tag, 'stable-id');
  assert.equal(sent.apns.headers['apns-collapse-id'], 'stable-id');
  assert.equal(sent.apns.payload.aps.badge, undefined);
  assert.equal(sent.android.notification.notificationCount, undefined);
});

test('One account with both app roles cannot read or bulk-update the other app records', async () => {
  const f = fixture();
  f.add('dual-account', 'pilgrim-notice');
  f.add('dual-account', 'owner-notice');
  f.rows.find((r) => r.id === 'owner-notice').recipientRole = 'OWNER';
  const pilgrim = { id: 'dual-account', appType: 'PILGRIM_APP' };
  const owner = { id: 'dual-account', appType: 'OWNER_APP' };
  assert.deepEqual((await f.service.listForUser({}, pilgrim)).unreadIds, ['pilgrim-notice']);
  assert.deepEqual((await f.service.listForUser({}, owner)).unreadIds, ['owner-notice']);
  await assert.rejects(f.service.markRead('owner-notice', pilgrim), /cannot access/);
  await assert.rejects(f.service.markRead('pilgrim-notice', owner), /cannot access/);
  await f.service.markAllRead(pilgrim, ['owner-notice', 'pilgrim-notice']);
  assert.equal((await f.service.unreadCount(pilgrim)).unreadCount, 0);
  assert.equal((await f.service.unreadCount(owner)).unreadCount, 1);
});
