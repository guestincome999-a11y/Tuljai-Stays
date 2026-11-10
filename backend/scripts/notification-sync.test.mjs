import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';

import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(relative, overrides = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(
    module,
    module.exports,
    (name) => overrides[name] ?? require(name),
  );
  return module.exports;
}
const { createNotificationState } = load('../../packages/shared/src/notification-state.ts');
const { createNotificationBadgeWriter } = load('../../packages/shared/src/notification-badge.ts');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fixture(owner) {
  const rows = [1, 2, 3].map((n) => ({ id: String(n), recipientUserId: owner, readAt: null }));
  const disk = new Map();
  let offline = false;
  let loseResponse = false;
  let fetchGate = null;
  let markGate = null;
  let diskFailure = false;
  const batches = [];
  function client() {
    return createNotificationState({
      read: async (id) => disk.get(id) ?? null,
      write: async (id, value) => {
        if (diskFailure) throw new Error('Disk full');
        disk.set(id, value);
      },
      mark: async (ids) => {
        if (offline) throw new Error('Offline');
        batches.push(ids);
        if (markGate) await markGate.promise;
        rows.forEach((row) => {
          if (ids.includes(row.id) && row.recipientUserId === owner) row.readAt ??= 'server-read';
        });
        if (loseResponse) {
          loseResponse = false;
          throw new Error('Response lost after commit');
        }
        return { userId: owner };
      },
      fetch: async () => {
        if (offline) throw new Error('Offline');
        const items = globalThis.structuredClone(
          rows.filter((row) => row.recipientUserId === owner),
        );
        const unreadIds = items.filter((row) => !row.readAt).map((row) => row.id);
        if (fetchGate) {
          const gate = fetchGate;
          fetchGate = null;
          await gate.promise;
        }
        return {
          userId: owner,
          items,
          unreadIds,
          unreadCount: unreadIds.length,
          page: 1,
          pageSize: 30,
          totalItems: items.length,
          totalPages: 1,
        };
      },
    });
  }
  return {
    rows,
    disk,
    client,
    batches,
    set offline(v) {
      offline = v;
    },
    set loseResponse(v) {
      loseResponse = v;
    },
    set fetchGate(v) {
      fetchGate = v;
    },
    set markGate(v) {
      markGate = v;
    },
    set diskFailure(v) {
      diskFailure = v;
    },
  };
}

for (const app of ['Pilgrim', 'Owner']) {
  async function setup() {
    const f = fixture(app);
    const state = f.client();
    await state.activate(app);
    await state.refresh();
    assert.equal(state.getSnapshot().unreadCount, 3);
    return { f, state };
  }
  test(`${app}: individual read persists and repeated taps decrement only once`, async () => {
    const { f, state } = await setup();
    const counts = [];
    const unsubscribe = state.subscribe(() => counts.push(state.getSnapshot().unreadCount));
    await Promise.all([state.markRead('1'), state.markRead('1'), state.markRead('1')]);
    await state.refresh();
    assert.equal(state.getSnapshot().unreadCount, 2);
    assert.ok(state.getSnapshot().items.find((row) => row.id === '1').readAt);
    assert.ok(counts.every((count) => count === 2));
    assert.equal(f.batches.flat().filter((id) => id === '1').length, 1);
    unsubscribe();
  });
  test(`${app}: mark all stays zero after restart and remount`, async () => {
    const { f, state } = await setup();
    await state.markAllRead();
    const restarted = f.client();
    await restarted.activate(app);
    assert.equal(restarted.getSnapshot().unreadCount, 0);
    await restarted.refresh();
    assert.equal(restarted.getSnapshot().items.filter((row) => !row.readAt).length, 0);
  });
  test(`${app}: duplicate and delayed pushes reconcile, never increment`, async () => {
    const { f, state } = await setup();
    await state.markRead('1');
    await Promise.all(Array.from({ length: 8 }, () => state.refresh()));
    assert.equal(state.getSnapshot().unreadCount, 2);
    assert.equal(state.getSnapshot().items.length, 3);
    assert.equal(f.rows.length, 3);
  });
  test(`${app}: new notification during bulk mutation remains unread`, async () => {
    const { f, state } = await setup();
    const gate = deferred();
    f.markGate = gate;
    const reading = state.markAllRead();
    await tick();
    assert.equal(state.getSnapshot().unreadCount, 0);
    f.rows.push({ id: '4', recipientUserId: app, readAt: null });
    gate.resolve();
    await reading;
    assert.deepEqual(f.batches[0], ['1', '2', '3']);
    assert.equal(state.getSnapshot().unreadCount, 1);
    assert.equal(f.rows[3].readAt, null);
  });
  test(`${app}: two devices converge after simultaneous individual reads`, async () => {
    const { f, state } = await setup();
    const second = f.client();
    await second.activate(app);
    await second.refresh();
    await Promise.all([state.markRead('1'), second.markRead('2')]);
    await Promise.all([state.refresh(), second.refresh()]);
    assert.equal(state.getSnapshot().unreadCount, 1);
    assert.equal(second.getSnapshot().unreadCount, 1);
  });
  test(`${app}: offline journal survives restart and excludes new arrivals on retry`, async () => {
    const { f, state } = await setup();
    f.offline = true;
    await state.markAllRead();
    assert.equal(state.getSnapshot().unreadCount, 0);
    assert.equal(state.getSnapshot().pendingCount, 3);
    assert.match(state.getSnapshot().error, /sync/);
    const restarted = f.client();
    await restarted.activate(app);
    assert.equal(restarted.getSnapshot().unreadCount, 0);
    f.rows.push({ id: '4', recipientUserId: app, readAt: null });
    f.offline = false;
    await restarted.refresh();
    assert.equal(restarted.getSnapshot().unreadCount, 1);
    assert.equal(restarted.getSnapshot().pendingCount, 0);
  });
  test(`${app}: timeout after server commit safely retries`, async () => {
    const { f, state } = await setup();
    f.loseResponse = true;
    await state.markRead('1');
    assert.equal(state.getSnapshot().unreadCount, 2);
    assert.equal(state.getSnapshot().pendingCount, 1);
    await state.refresh();
    assert.equal(state.getSnapshot().unreadCount, 2);
    assert.equal(state.getSnapshot().pendingCount, 0);
  });
  test(`${app}: stale fetch cannot resurrect a pending read`, async () => {
    const { f, state } = await setup();
    const gate = deferred();
    f.fetchGate = gate;
    const fetching = state.refresh();
    await tick();
    const reading = state.markAllRead();
    await tick();
    assert.equal(state.getSnapshot().unreadCount, 0);
    const counts = [];
    state.subscribe(() => counts.push(state.getSnapshot().unreadCount));
    gate.resolve();
    await Promise.all([fetching, reading]);
    assert.ok(counts.every((count) => count === 0));
  });
  test(`${app}: account changes fence stale responses and isolate caches`, async () => {
    const { f, state } = await setup();
    const gate = deferred();
    f.fetchGate = gate;
    const fetching = state.refresh();
    await tick();
    await state.activate('someone-else');
    gate.resolve();
    await fetching;
    assert.deepEqual(state.getSnapshot().items, []);
    assert.equal(state.getSnapshot().unreadCount, 0);
    assert.equal(f.disk.has('someone-else'), false);
  });
  test(`${app}: disk failure rolls back optimistic action and reports failure`, async () => {
    const { f, state } = await setup();
    f.diskFailure = true;
    await state.markRead('1');
    assert.equal(state.getSnapshot().unreadCount, 3);
    assert.equal(state.getSnapshot().pendingCount, 0);
    assert.match(state.getSnapshot().error, /Could not save/);
    assert.equal(f.batches.length, 0);
  });
}

test('Native badge writes serialize and finish with latest count', async () => {
  const gate = deferred();
  const written = [];
  const sync = createNotificationBadgeWriter(async (count) => {
    if (count === 3) await gate.promise;
    written.push(count);
  });
  const first = sync(3);
  const last = sync(0, ['1', '2', '3']);
  gate.resolve();
  await Promise.all([first, last]);
  assert.deepEqual(written, [3, 0]);
});

for (const app of ['pilgrim', 'owner']) {
  test(`${app === 'pilgrim' ? 'Pilgrim' : 'Owner'} adapter: disk recovery, pagination, bulk selection and account isolation`, async () => {
    const files = new Map();
    const rows = Array.from({ length: 45 }, (_, n) => ({
      id: String(n),
      recipientUserId: 'account',
      readAt: null,
    }));
    const requests = [];
    let offline = false;
    const apiClient = {
      get: async (url, options) => {
        assert.equal(url, '/notifications');
        const unreadIds = rows.filter((r) => !r.readAt).map((r) => r.id);
        return {
          userId: 'account',
          items: rows.slice(0, options.params.limit).map((r) => ({ ...r })),
          unreadIds,
          unreadCount: unreadIds.length,
        };
      },
      post: async (url, body) => {
        assert.equal(url, '/notifications/read-all');
        if (offline) throw new Error('offline');
        requests.push(body.ids);
        rows.forEach((r) => {
          if (body.ids.includes(r.id)) r.readAt ??= 'read';
        });
        return { userId: 'account' };
      },
    };
    const fileSystem = {
      documentDirectory: 'file://sandbox/',
      getInfoAsync: async (path) => ({ exists: files.has(path) }),
      readAsStringAsync: async (path) => files.get(path),
      writeAsStringAsync: async (path, value) => {
        files.set(path, value);
      },
      moveAsync: async ({ from, to }) => {
        files.set(to, files.get(from));
        files.delete(from);
      },
    };
    const make = () =>
      load(`../../apps/${app}-app/src/features/notifications/notification-count-store.ts`, {
        '@tuljai/shared': {
          createNotificationState: (deps) =>
            createNotificationState({ ...deps, scheduleRetry: undefined }),
        },
        'expo-file-system/legacy': fileSystem,
        'react-native': { Platform: { OS: 'android' } },
        '../../api/client': { apiClient },
      }).notificationState;
    const client = make();
    await client.activate('account');
    await client.refresh();
    assert.equal(client.getSnapshot().unreadCount, 45);
    assert.equal(client.getSnapshot().items.length, app === 'pilgrim' ? 30 : 40);
    offline = true;
    await client.markAllRead();
    assert.equal(client.getSnapshot().unreadCount, 0);
    // Simulate termination inside the native replacement operation.
    const path = 'file://sandbox/notifications-v2-account.json';
    files.set(path + '.tmp', files.get(path));
    files.delete(path);
    const reopened = make();
    await reopened.activate('account');
    assert.equal(reopened.getSnapshot().pendingCount, 45);
    rows.push({ id: 'future', recipientUserId: 'account', readAt: null });
    offline = false;
    await reopened.refresh();
    assert.equal(reopened.getSnapshot().unreadCount, 1);
    assert.equal(requests[0].length, 45);
    await reopened.activate('other-account');
    assert.equal(reopened.getSnapshot().unreadCount, 0);
    assert.deepEqual(reopened.getSnapshot().items, []);
  });
}

test('Transient online failures receive bounded retries without polling', async () => {
  const scheduled = [];
  const state = createNotificationState({
    read: async () => JSON.stringify({ items: [], unreadIds: ['1'], pendingIds: ['1'] }),
    write: async () => {},
    fetch: async () => {
      throw new Error('offline');
    },
    mark: async () => {
      throw new Error('offline');
    },
    scheduleRetry: (retry, delay) => {
      scheduled.push({ retry, delay });
      return () => {};
    },
  });
  await state.activate('account');
  await state.refresh();
  for (let n = 0; n < 3; n++) {
    scheduled[n].retry();
    await tick();
  }
  assert.deepEqual(
    scheduled.map((item) => item.delay),
    [1000, 5000, 30000],
  );
  assert.equal(state.getSnapshot().pendingCount, 1);
});
