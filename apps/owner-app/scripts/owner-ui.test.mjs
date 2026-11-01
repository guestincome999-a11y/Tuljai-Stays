import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function load(path, imports = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    Date,
    Set,
    Map,
    Promise,
    require: (name) => {
      assert.ok(name in imports, `Unexpected runtime dependency: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

const display = load('features/bookings/utils/booking-display.ts');
const now = Date.parse('2026-10-30T09:00:00Z');
const cashRequest = {
  paymentStatus: 'PAY_AT_LODGE',
  status: 'PENDING_OWNER_APPROVAL',
  ownerResponseDeadline: '2026-10-30T09:05:00Z',
};

test('incoming alerts accept only eligible pay-at-lodge requests', () => {
  assert.equal(display.isIncomingBookingEligible(cashRequest, now), true);
  for (const paymentStatus of ['PENDING', 'ADVANCE_PAID', 'FULLY_PAID', 'REFUNDED', 'FAILED']) {
    assert.equal(display.isIncomingBookingEligible({ ...cashRequest, paymentStatus }, now), false);
  }
  for (const status of ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CHECKED_IN']) {
    assert.equal(display.isIncomingBookingEligible({ ...cashRequest, status }, now), false);
  }
});

test('expired and invalid deadlines cannot expose response actions', () => {
  for (const ownerResponseDeadline of ['2026-10-30T08:59:59Z', '2026-10-30T09:00:00Z', 'invalid']) {
    assert.equal(
      display.isIncomingBookingEligible({ ...cashRequest, ownerResponseDeadline }, now),
      false,
    );
  }
  assert.equal(
    display.isIncomingBookingEligible({ ...cashRequest, ownerResponseDeadline: null }, now),
    true,
  );
});

test('prepaid labels and flexible checkout retain business meaning', () => {
  assert.equal(
    display.getStatusLabel({ paymentStatus: 'FULLY_PAID', status: 'ACCEPTED' }),
    'Assigned',
  );
  assert.equal(display.getPaymentLabel('ADVANCE_PAID'), 'Advance paid online');
  assert.equal(display.getPaymentLabel('REFUNDED'), 'Refunded');
  assert.equal(display.formatCheckOut({ checkoutDateFlexible: true }), 'Not fixed');
  assert.equal(display.getRoomRequirement({ roomTypeName: 'Family' }), '1 × Family');
});

function bookingApi(client) {
  return load('features/bookings/api/owner-bookings-api.ts', {
    '../../../api/client': { apiClient: client },
  });
}

test('accept/reject are mutually exclusive across simultaneous UI and push actions', async () => {
  let release;
  const calls = [];
  const api = bookingApi({
    post: (path) => {
      calls.push(path);
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  const pending = api.acceptOwnerBooking('booking-1');
  await assert.rejects(api.acceptOwnerBooking('booking-1'), /already in progress/);
  await assert.rejects(api.rejectOwnerBooking('booking-1', 'Full'), /already in progress/);
  assert.deepEqual(calls, ['/owner/bookings/booking-1/accept']);
  release({ id: 'booking-1', status: 'ACCEPTED' });
  assert.equal((await pending).status, 'ACCEPTED');
});

test('a failed response releases the lock for a deliberate retry', async () => {
  let count = 0;
  const api = bookingApi({
    post: async (path, body) => {
      count += 1;
      if (count === 1) throw new Error('Connection lost');
      assert.equal(path, '/owner/bookings/booking-2/reject');
      assert.equal(body.reason, 'Lodge full');
      return { status: 'REJECTED' };
    },
  });
  await assert.rejects(api.rejectOwnerBooking('booking-2', 'Lodge full'), /Connection lost/);
  assert.equal((await api.rejectOwnerBooking('booking-2', 'Lodge full')).status, 'REJECTED');
  assert.equal(count, 2);
});

test('independent bookings do not block each other', async () => {
  const api = bookingApi({ post: async (path) => ({ path }) });
  const results = await Promise.all([api.acceptOwnerBooking('one'), api.acceptOwnerBooking('two')]);
  assert.equal(results.length, 2);
  assert.notEqual(results[0].path, results[1].path);
});

test('date availability uses server counts and preserves exact dates', async () => {
  const response = { available: true, availableRoomCount: 3, roomTypeId: 'type-1' };
  const api = bookingApi({
    get: async (path, options) => {
      assert.equal(path, '/lodges/lodge-1/room-types/type-1/availability');
      assert.equal(options.params.checkInDate, '2026-10-30');
      assert.equal(options.params.checkOutDate, '2026-11-01');
      return response;
    },
  });
  assert.equal(
    await api.getRoomTypeAvailability('lodge-1', 'type-1', '2026-10-30', '2026-11-01'),
    response,
  );
});

test('UI response hook rejects rapid duplicate taps and keeps errors visible', async () => {
  let calls = 0;
  let finish;
  let completed = 0;
  const hook = load('features/bookings/hooks/useOwnerBookings.ts', {
    react: {
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useEffect: () => undefined,
      useRef: (current) => ({ current }),
      useState: (value) => [value, () => undefined],
    },
    '../../../connectivity/connectivity-context': { useConnectivity: () => ({ isOffline: false }) },
    '../../../realtime/realtime-events': {},
    '../../../realtime/realtime-provider': {},
    '../api/owner-bookings-api': {
      acceptOwnerBooking: () => {
        calls += 1;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  const actions = hook.useOwnerBookingActions(() => {
    completed += 1;
  });
  const first = actions.accept('booking-3');
  assert.equal(await actions.accept('booking-3'), false);
  assert.equal(calls, 1);
  finish({});
  assert.equal(await first, true);
  assert.equal(completed, 1);
});

function roomHook(update, readRooms = async () => [{ id: 'room-1', status: 'AVAILABLE' }]) {
  const states = [];
  let refreshCalls = 0;
  const hook = load('features/rooms/hooks/useRoomOperations.ts', {
    react: {
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useEffect: () => undefined,
      useRef: (current) => ({ current }),
      useState: (initial) => {
        const slot = { value: initial };
        states.push(slot);
        return [
          initial,
          (value) => {
            slot.value = typeof value === 'function' ? value(slot.value) : value;
          },
        ];
      },
    },
    'expo-router': { useFocusEffect: () => undefined },
    '../../../auth/auth-context': { useAuth: () => ({ user: { id: 'review-owner' } }) },
    '../../../connectivity/connectivity-context': { useConnectivity: () => ({ isOffline: false }) },
    '../../../realtime/realtime-provider': { useRealtime: () => ({ connected: true }) },
    '../../lodges/hooks/useAssignedLodges': {
      useAssignedLodges: () => ({ selectedLodge: { id: 'lodge-1' } }),
    },
    '../api/owner-rooms-api': {
      updateRoomStatus: update,
      listRooms: async () => {
        refreshCalls += 1;
        return readRooms();
      },
      listRoomTypes: async () => [],
      listOwnerPhotos: async () => [],
      listManualBookings: async () => [],
    },
    '../storage/housekeeping-notes-store': { loadHousekeepingNotes: async () => ({}) },
    '../storage/room-board-cache': { saveRoomBoardCache: async () => undefined },
  });
  return { operations: hook.useRoomOperations(), states, refreshCalls: () => refreshCalls };
}

test('successful room mutation reloads authoritative inventory and prevents duplicate submissions', async () => {
  let finish;
  let writes = 0;
  const room = roomHook(() => {
    writes += 1;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = room.operations.updateRoomStatus('room-1', 'AVAILABLE');
  assert.equal(await room.operations.updateRoomStatus('room-1', 'MAINTENANCE'), false);
  assert.equal(writes, 1);
  finish({ status: 'AVAILABLE' });
  assert.equal(await first, true);
  assert.equal(room.refreshCalls(), 1);
  assert.equal(room.states[0].value.rooms[0].status, 'AVAILABLE');
  assert.equal(room.states[1].value, false);
});

test('failed room mutation exposes an error without a success message or false inventory update', async () => {
  const room = roomHook(async () => {
    throw new Error('Server rejected update');
  });
  assert.equal(await room.operations.updateRoomStatus('room-1', 'AVAILABLE'), false);
  assert.match(room.states[0].value.errorMessage, /Update failed/);
  assert.equal(room.states[2].value, null);
  assert.equal(room.refreshCalls(), 0);
  assert.equal(room.states[1].value, false);
});

test('web device identity is stable across requests and session restoration', async () => {
  const values = new Map();
  const imports = {
    'expo-secure-store': { isAvailableAsync: async () => false },
    'react-native': { Platform: { OS: 'web' } },
    '../auth/web-session-storage': {
      getWebSessionStorage: () => ({
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      }),
    },
  };
  const device = load('device/device-identity.ts', imports);
  const first = await device.getOrCreateDeviceId();
  assert.equal(await device.getOrCreateDeviceId(), first);
  assert.equal(await load('device/device-identity.ts', imports).getOrCreateDeviceId(), first);
});

test('a late inventory response cannot replace a newer refresh', async () => {
  const reads = [];
  const room = roomHook(
    async () => undefined,
    () => new Promise((resolve) => reads.push(resolve)),
  );
  const first = room.operations.refresh();
  await new Promise(setImmediate);
  assert.equal(reads.length, 1);
  const latest = room.operations.refresh();
  await new Promise(setImmediate);
  assert.equal(reads.length, 2);
  reads[1]([{ id: 'newest-room', status: 'MAINTENANCE' }]);
  await latest;
  reads[0]([{ id: 'older-room', status: 'AVAILABLE' }]);
  await first;
  assert.equal(room.states[0].value.rooms[0].id, 'newest-room');
  assert.equal(room.states[0].value.rooms[0].status, 'MAINTENANCE');
});

function roomCacheHarness() {
  const values = new Map();
  let lastKey;
  const api = load('features/rooms/storage/room-board-cache.ts', {
    'expo-secure-store': {
      isAvailableAsync: async () => true,
      getItemAsync: async (key) => values.get(key) ?? null,
      setItemAsync: async (key, value) => {
        lastKey = key;
        values.set(key, value);
      },
      deleteItemAsync: async (key) => {
        values.delete(key);
      },
    },
  });
  return { api, corruptLast: () => values.set(lastKey, '{'), entries: () => values.size };
}

test('room caches stay isolated between owners and lodges', async () => {
  const { api } = roomCacheHarness();
  const board = (id) => ({ rooms: [{ id }], photos: [], roomTypes: [] });
  await api.saveRoomBoardCache('owner-a.lodge-one', board('room-a'));
  assert.equal(await api.loadRoomBoardCache('owner-b.lodge-one'), null);
  assert.equal(await api.loadRoomBoardCache('owner-a.lodge-two'), null);
  await api.saveRoomBoardCache('owner-b.lodge-one', board('room-b'));
  assert.equal((await api.loadRoomBoardCache('owner-a.lodge-one')).rooms[0].id, 'room-a');
  assert.equal((await api.loadRoomBoardCache('owner-b.lodge-one')).rooms[0].id, 'room-b');
});

test('corrupt cache cleanup does not remove another owner cache', async () => {
  const cache = roomCacheHarness();
  const board = { rooms: [], photos: [], roomTypes: [] };
  await cache.api.saveRoomBoardCache('owner-a.lodge-one', board);
  await cache.api.saveRoomBoardCache('owner-b.lodge-one', board);
  cache.corruptLast();
  assert.equal(await cache.api.loadRoomBoardCache('owner-b.lodge-one'), null);
  assert.equal(cache.entries(), 1);
  assert.ok(await cache.api.loadRoomBoardCache('owner-a.lodge-one'));
});
