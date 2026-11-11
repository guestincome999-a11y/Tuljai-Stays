import assert from 'node:assert/strict';
import { atob, Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import { deserialize, serialize } from 'node:v8';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const structuredClone = (value) => deserialize(serialize(value));
function load(path, imports = {}, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      atob,
      ...globals,
      require: (name) => {
        assert.ok(name in imports, `Unexpected dependency ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}
const core = load('features/checkin/scan-operation.ts');
const { ApplicationError } = load('../../../packages/utils/src/errors.ts');
const body = {
  version: 1,
  bookingId: '11111111-1111-4111-8111-111111111111',
  qrTokenId: '22222222-2222-4222-8222-222222222222',
  bookingCode: 'TJS-123',
  expiresAt: '2027-01-01T00:00:00Z',
  tokenVersion: 1,
};
const payload = `tjsqr.v1.${Buffer.from(JSON.stringify(body)).toString('base64url')}.${'a'.repeat(43)}`;
const qr = core.recognizeQr(payload);
const response = {
  scanResult: 'SUCCESS',
  booking: {
    id: body.bookingId,
    bookingCode: body.bookingCode,
    guestName: 'Test guest',
    checkInDate: '2026-11-01',
    lodgeId: 'lodge',
    status: 'CHECKED_IN',
    paymentStatus: 'PAY_AT_LODGE',
    totalAmount: '1200',
    balanceAmount: '1200',
    totalGuests: 2,
  },
  register: { id: 'register', checkInAt: '2026-11-01T00:00:00Z', totalGuests: 1 },
};
const tick = () => delay(0);

test('scan API accepts the deployed strict DTO without leaking the local idempotency key', async () => {
  const requests = [];
  const api = load('features/checkin/api/checkin-api.ts', {
    '@tuljai/utils': { ApplicationError },
    '../../../api/client': {
      apiClient: {
        post: async (path, input) => {
          // Model the deployed ValidationPipe with forbidNonWhitelisted enabled.
          assert.deepEqual(Object.keys(input).sort(), ['deviceId', 'qrPayload']);
          requests.push({ path, input });
          return response;
        },
      },
    },
  });
  const f = fixture((item) =>
    api.scanQrCode({
      deviceId: 'owner-device',
      qrPayload: item.qrPayload,
      idempotencyKey: item.key,
    }),
  );
  await f.queue.restore();
  await f.queue.enqueue(qr);
  f.queue.setOnline(true);
  await tick();
  assert.equal(f.queue.get(qr.key).status, 'CHECKED_IN');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/qr/scan');
  assert.equal(requests[0].input.qrPayload, payload);
  assert.equal(requests[0].input.deviceId, 'owner-device');
  assert.equal(f.queue.get(qr.key).key, qr.key);
});

test('cash API explains the undeployed route and never retries a payment write', async () => {
  let calls = 0;
  const api = load('features/checkin/api/checkin-api.ts', {
    '@tuljai/utils': { ApplicationError },
    '../../../api/client': {
      apiClient: {
        post: async () => {
          calls++;
          throw new ApplicationError(
            'Cannot POST /api/owner/bookings/id/collect-payment',
            'Not Found',
            { statusCode: 404 },
          );
        },
      },
    },
  });
  await assert.rejects(api.collectPayAtLodge(body.bookingId, '1200'), (error) => {
    assert.equal(error.code, 'CASH_COLLECTION_UNAVAILABLE');
    assert.match(error.message, /Payment has not been recorded/);
    return true;
  });
  assert.equal(calls, 1);
});

test('cash API preserves booking-not-found and authorization failures', async () => {
  for (const [statusCode, message] of [
    [404, 'Booking not found'],
    [403, 'Forbidden'],
  ]) {
    const failure = new ApplicationError(message, 'API_REQUEST_FAILED', { statusCode });
    const api = load('features/checkin/api/checkin-api.ts', {
      '@tuljai/utils': { ApplicationError },
      '../../../api/client': {
        apiClient: {
          post: async () => {
            throw failure;
          },
        },
      },
    });
    await assert.rejects(
      api.collectPayAtLodge(body.bookingId, '1200'),
      (error) => error === failure,
    );
  }
});

test('cash API sends the confirmed amount to the protected collection endpoint', async () => {
  let calls = 0;
  const api = load('features/checkin/api/checkin-api.ts', {
    '@tuljai/utils': { ApplicationError },
    '../../../api/client': {
      apiClient: {
        post: async (path, input) => {
          calls++;
          assert.equal(path, `/owner/bookings/${body.bookingId}/collect-payment`);
          assert.equal(input.expectedAmount, '1200');
          assert.deepEqual(Object.keys(input), ['expectedAmount']);
          return response.booking;
        },
      },
    },
  });
  assert.equal(await api.collectPayAtLodge(body.bookingId, '1200'), response.booking);
  assert.equal(calls, 1);
});
function fixture(send = async () => response) {
  let disk = [];
  let calls = 0;
  let confirmations = 0;
  const deps = {
    load: async () => structuredClone(disk),
    save: async (items) => {
      disk = structuredClone(items);
    },
    send: async (item) => {
      calls++;
      return send(item);
    },
    confirmed: () => {
      confirmations++;
    },
  };
  return {
    queue: new core.CheckinQueue(deps),
    deps,
    calls: () => calls,
    disk: () => disk,
    confirmations: () => confirmations,
  };
}

test('local recognition, invalid input and synchronous duplicate callback lock', () => {
  assert.equal(qr.bookingCode, 'TJS-123');
  for (const invalid of ['', 'booking-id', '{}', 'https://example.com', payload + '.extra'])
    assert.equal(core.recognizeQr(invalid), null);
  const gate = new core.ScanGate();
  assert.equal(gate.capture(payload).status, 'SCANNED');
  assert.equal(gate.capture(payload), null);
  gate.reset();
  assert.equal(gate.capture('invalid').status, 'QR_INVALID');
});

test('offline queue persists and app restart retries on connection with stable identity', async () => {
  const f = fixture();
  await f.queue.restore();
  await f.queue.enqueue(qr);
  assert.equal(f.calls(), 0);
  assert.equal(f.disk()[0].key, qr.key);
  f.queue.stop();
  const restarted = new core.CheckinQueue(f.deps);
  await restarted.restore();
  assert.equal(restarted.get(qr.key).status, 'RETRY_PENDING');
  restarted.setOnline(true);
  await restarted.flush();
  await tick();
  assert.equal(restarted.get(qr.key).status, 'CHECKED_IN');
  assert.equal(f.calls(), 1);
  assert.equal(f.disk().length, 0);
});

test('duplicate enqueue and concurrent flush never send simultaneous requests', async () => {
  let finish;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await f.queue.restore();
  f.queue.setOnline(true);
  await Promise.all([f.queue.enqueue(qr), f.queue.enqueue(qr), f.queue.flush()]);
  await tick();
  await f.queue.flush();
  assert.equal(f.calls(), 1);
  finish(response);
  await tick();
  await f.queue.enqueue(qr);
  assert.equal(f.calls(), 1);
});

test('network failure remains pending; explicit reconnection completes without false success', async () => {
  let online = false;
  const f = fixture(async () => {
    if (!online) throw new Error('Network');
    return response;
  });
  await f.queue.restore();
  await f.queue.enqueue(qr);
  f.queue.setOnline(true);
  await tick();
  assert.equal(f.queue.get(qr.key).status, 'RETRY_PENDING');
  assert.equal(f.disk().length, 1);
  online = true;
  await f.queue.flush();
  assert.equal(f.queue.get(qr.key).status, 'CHECKED_IN');
});

for (const [code, message, expected] of [
  [400, 'Booking cancelled', 'BOOKING_CANCELLED'],
  [403, 'Forbidden', 'CHECK_IN_NOT_ALLOWED'],
  [404, 'Not found', 'BOOKING_NOT_FOUND'],
]) {
  test(`authoritative failure ${expected} is terminal and never confirms`, async () => {
    const f = fixture(async () => {
      throw { details: { statusCode: code }, message };
    });
    await f.queue.restore();
    await f.queue.enqueue(qr);
    f.queue.setOnline(true);
    await tick();
    assert.equal(f.queue.get(qr.key).status, expected);
    assert.equal(f.confirmations(), 0);
    assert.equal(f.disk().length, 0);
  });
}

test('backend USED response displays already checked in', async () => {
  const f = fixture(async () => ({ ...response, scanResult: 'USED' }));
  await f.queue.restore();
  await f.queue.enqueue(qr);
  f.queue.setOnline(true);
  await tick();
  assert.equal(f.queue.get(qr.key).status, 'ALREADY_CHECKED_IN');
});

test('disk failure prevents HTTP and reports a recoverable save failure', async () => {
  const f = fixture();
  f.deps.save = async () => {
    throw new Error('disk full');
  };
  await f.queue.restore();
  f.queue.setOnline(true);
  await assert.rejects(f.queue.enqueue(qr), /Could not save/);
  await tick();
  assert.equal(f.calls(), 0);
});

test('secure queue uses owner namespaces and removes completed token records', async () => {
  const disk = new Map();
  const store = load('features/checkin/storage/checkin-queue-store.ts', {
    'expo-secure-store': {
      isAvailableAsync: async () => true,
      getItemAsync: async (key) => disk.get(key) ?? null,
      setItemAsync: async (key, value) => {
        disk.set(key, value);
      },
      deleteItemAsync: async (key) => {
        disk.delete(key);
      },
    },
    '../../../auth/web-session-storage': {},
    '../scan-operation': core,
  });
  const a = store.checkinQueueStorage('owner-a');
  const b = store.checkinQueueStorage('owner-b');
  await a.save([qr]);
  assert.equal((await a.load())[0].key, qr.key);
  assert.equal((await b.load()).length, 0);
  await a.save([]);
  assert.equal((await a.load()).length, 0);
  assert.equal(disk.has(`tuljai.owner.checkin.owner-a.${qr.key}`), false);
});

test('scan history refreshes automatically after background confirmation', async () => {
  let revision = 0;
  let calls = 0;
  let index = 0;
  let effects = [];
  const slots = [];
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === 'function' ? value(slots[i]) : value;
        },
      ];
    },
    useCallback(fn, deps) {
      const i = index++;
      const old = slots[i];
      if (!old || deps.some((value, j) => value !== old.deps[j])) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = index++;
      const old = slots[i];
      if (!old || deps.some((value, j) => value !== old[j])) {
        effects.push(fn);
        slots[i] = deps;
      }
    },
  };
  const { useScanHistory } = load('features/checkin/hooks/useScanHistory.ts', {
    react,
    '../../../realtime/realtime-provider': {
      useRealtime: () => ({ connectionRevision: revision, lastEvent: null }),
    },
    '../../lodges/hooks/useAssignedLodges': {
      useAssignedLodges: () => ({ selectedLodge: { id: 'lodge' } }),
    },
    '../api/checkin-api': {
      listQrScanHistory: async () => {
        calls++;
        return { items: [{ id: `scan-${calls}` }] };
      },
    },
  });
  function render() {
    index = 0;
    effects = [];
    const result = useScanHistory('TODAY');
    effects.forEach((fn) => fn());
    return result;
  }
  render();
  await tick();
  assert.equal(render().data[0].id, 'scan-1');
  revision++;
  render();
  await tick();
  assert.equal(render().data[0].id, 'scan-2');
  assert.equal(calls, 2);
});

// Execute the real scanner with deterministic React hooks and native host stubs.
function scannerHarness(f, options = {}) {
  const slots = [];
  let index = 0;
  let effects = [];
  const frames = [];
  const alerts = [];
  const navigation = [];
  let detailRequests = 0;
  let collectionRequests = 0;
  let refreshes = 0;
  const hooks = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === 'function' ? value(slots[i]) : value;
        },
      ];
    },
    useRef(initial) {
      const i = index++;
      return (slots[i] ??= { current: initial });
    },
    useEffect(fn, deps) {
      const i = index++;
      const old = slots[i];
      if (!old || deps.some((value, j) => value !== old.deps[j])) {
        slots[i] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  const component = load(
    'features/checkin/screens/CameraQrScannerScreen.tsx',
    {
      react: hooks,
      'react/jsx-runtime': require('react/jsx-runtime'),
      'react-native': {
        View: 'View',
        ScrollView: 'ScrollView',
        StyleSheet: { create: (value) => value },
        Alert: { alert: (...args) => alerts.push(args) },
      },
      'react-native-paper': {
        Button: 'Button',
        Card: { Content: 'CardContent' },
        Switch: 'Switch',
        Text: 'Text',
        ActivityIndicator: 'ActivityIndicator',
        useTheme: () => ({
          colors: { background: 'white', primary: 'orange', onSurface: 'black' },
        }),
      },
      '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
      '@tuljai/ui': {
        radius: {},
        spacing: {},
        colors: { light: { warning: '#b86b00', success: '#16803d', textMuted: '#666666' } },
      },
      'expo-camera': {
        CameraView: 'Camera',
        useCameraPermissions: () => [{ granted: true }, () => {}],
      },
      'expo-router': { useRouter: () => ({ push: (route) => navigation.push(route) }) },
      '../../../components/FormErrorBanner': {
        FormErrorBanner: ({ message }) =>
          require('react/jsx-runtime').jsx('ErrorBanner', { children: message }),
      },
      '../../../connectivity/connectivity-context': {
        useConnectivity: () => ({ isOffline: options.isOffline ?? false }),
      },
      '../../../owner-ui/theme': { radius: {}, spacing: {} },
      '../../../realtime/realtime-provider': {
        useRealtime: () => ({
          refreshBookingData: () => {
            refreshes++;
          },
        }),
      },
      '../../lodges/hooks/useAssignedLodges': { useAssignedLodges: () => ({ lodges: [] }) },
      '../../bookings/api/owner-bookings-api': {
        getCachedScanBooking: () => options.cached,
        getOwnerBooking: async (id) => {
          detailRequests++;
          return options.getBooking ? options.getBooking(id) : response.booking;
        },
      },
      '../api/checkin-api': {
        collectPayAtLodge: async (...args) => {
          collectionRequests++;
          return options.collect(...args);
        },
      },
      '../CheckinSyncProvider': { useCheckinSync: () => ({ queue: f.queue, ready: true }) },
      '../scan-operation': core,
      '../hooks/useReceptionMode': { useReceptionMode: () => ({ enabled: false }) },
    },
    { requestAnimationFrame: (fn) => frames.push(fn) },
  );
  function resolve(tree) {
    if (Array.isArray(tree)) return tree.map(resolve);
    if (!tree || typeof tree !== 'object') return tree;
    if (typeof tree.type === 'function') return resolve(tree.type(tree.props));
    return { ...tree, props: { ...tree.props, children: resolve(tree.props?.children) } };
  }
  function render() {
    index = 0;
    effects = [];
    const tree = component.CameraQrScannerScreen();
    effects.forEach((fn) => fn());
    return resolve(tree);
  }
  function frame() {
    const batch = frames.splice(0);
    batch.forEach((fn) => fn());
  }
  return {
    render,
    frame,
    alerts,
    navigation,
    detailRequests: () => detailRequests,
    collectionRequests: () => collectionRequests,
    refreshes: () => refreshes,
  };
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function content(tree) {
  if (Array.isArray(tree)) return tree.map(content).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree && typeof tree === 'object' ? content(tree.props?.children) : '';
}
function button(tree, label) {
  return nodes(tree, (node) => node.type === 'Button' && content(node) === label)[0];
}
function scan(h) {
  const camera = nodes(h.render(), (node) => node.type === 'Camera')[0];
  camera.props.onBarcodeScanned({ data: payload });
  return h.render();
}

test('mandatory: old result card appears before a deliberately delayed 2.5-second check-in', async () => {
  let started = false;
  const f = fixture(async () => {
    started = true;
    await delay(2500);
    return response;
  });
  await f.queue.restore();
  f.queue.setOnline(true);
  const h = scannerHarness(f);
  const immediate = scan(h);
  assert.match(content(immediate), /QR Scanned/);
  assert.equal(nodes(immediate, (node) => node.type === 'Camera').length, 0);
  assert.equal(started, false);
  assert.equal(h.detailRequests(), 0);
  h.frame();
  assert.equal(started, false);
  h.frame();
  await tick();
  assert.equal(started, true);
  assert.equal(f.calls(), 1);
  const pending = h.render();
  assert.match(content(pending), /QR Scanned/);
  assert.match(content(pending), /Collect Payment/);
  assert.match(content(pending), /\u20b91,200/);
  assert.equal(button(pending, 'Collected'), undefined);
  await delay(2600);
  assert.match(content(h.render()), /Check-In Successful/);
  assert.equal(f.confirmations(), 1);
});

test('Open Booking works immediately offline before either backend request starts', async () => {
  const f = fixture();
  await f.queue.restore();
  const h = scannerHarness(f, { isOffline: true });
  const tree = scan(h);
  const open = button(tree, 'Open Booking');
  assert.ok(open);
  assert.equal(open.props.disabled, false);
  open.props.onPress();
  assert.equal(h.navigation[0].pathname, '/(app)/bookings/[id]');
  assert.equal(h.navigation[0].params.id, body.bookingId);
  assert.equal(f.calls(), 0);
  assert.equal(h.detailRequests(), 0);
});

test('Open Booking remains available after check-in fails without marking the booking checked in', async () => {
  const f = fixture(async () => {
    throw { details: { statusCode: 403 }, message: 'Not allowed' };
  });
  await f.queue.restore();
  f.queue.setOnline(true);
  const h = scannerHarness(f, { cached: response.booking });
  scan(h);
  h.frame();
  h.frame();
  await tick();
  const tree = h.render();
  assert.match(content(tree), /Check-in could not be completed/);
  assert.doesNotMatch(content(tree), /Check-In Successful/);
  button(tree, 'Open Booking').props.onPress();
  assert.equal(h.navigation[0].params.id, body.bookingId);
  assert.equal(f.confirmations(), 0);
});

test('invalid QR does not offer a booking link', async () => {
  const f = fixture();
  await f.queue.restore();
  const h = scannerHarness(f);
  nodes(h.render(), (node) => node.type === 'Camera')[0].props.onBarcodeScanned({
    data: 'invalid',
  });
  assert.equal(button(h.render(), 'Open Booking'), undefined);
});

test('cached payment guidance is visible immediately in the old order with a bold larger amount', async () => {
  const f = fixture();
  await f.queue.restore();
  const h = scannerHarness(f, { cached: response.booking });
  const tree = scan(h);
  const text = content(tree);
  assert.ok(text.indexOf('Collect Payment') < text.indexOf('Test guest'));
  const amount = nodes(tree, (node) => node.type === 'Text' && content(node) === '\u20b91,200')[0];
  assert.equal(amount.props.style.fontWeight, '700');
  assert.equal(amount.props.style.fontSize, 20);
  assert.equal(h.detailRequests(), 0);
  assert.equal(f.calls(), 0);
  assert.ok(button(tree, 'Scan Next Guest'));
});

for (const [paymentStatus, balanceAmount, label] of [
  ['FULLY_PAID', '0', 'Paid Booking'],
  ['ADVANCE_PAID', '900', 'Advance Paid'],
]) {
  test(`${paymentStatus} clearly displays payment status and does not offer cash collection`, async () => {
    const f = fixture();
    await f.queue.restore();
    const h = scannerHarness(f, { cached: { ...response.booking, paymentStatus, balanceAmount } });
    const tree = scan(h);
    assert.ok(content(tree).includes(label));
    if (paymentStatus === 'FULLY_PAID') assert.match(content(tree), /Nothing to collect/);
    else assert.match(content(tree), /\u20b9900/);
    assert.equal(button(tree, 'Collected'), undefined);
  });
}

async function confirmedHarness(options = {}) {
  const f = fixture();
  await f.queue.restore();
  await f.queue.enqueue(qr);
  f.queue.setOnline(true);
  await tick();
  const h = scannerHarness(f, options);
  scan(h);
  return { f, h };
}

test('unknown advance balance is not displayed as the full amount due', async () => {
  const f = fixture();
  await f.queue.restore();
  const h = scannerHarness(f, {
    cached: { ...response.booking, paymentStatus: 'ADVANCE_PAID', balanceAmount: null },
  });
  const text = content(scan(h));
  assert.match(text, /Confirm balance with the guest/);
  assert.doesNotMatch(text, /1,200/);
});

test('Collected requires two Yes confirmations, handles either No, and only updates after server success', async () => {
  let finish;
  const { h } = await confirmedHarness({
    collect: (id, amount) => {
      assert.equal(id, body.bookingId);
      assert.equal(amount, '1200');
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const press = () => button(h.render(), 'Collected').props.onPress();
  const answer = (name) =>
    h.alerts
      .at(-1)[2]
      .find((item) => item.text === name)
      .onPress();
  press();
  assert.equal(h.alerts.length, 1);
  assert.equal(h.collectionRequests(), 0);
  answer('No');
  assert.equal(h.collectionRequests(), 0);
  press();
  answer('Yes');
  assert.equal(h.alerts.length, 3);
  assert.equal(h.collectionRequests(), 0);
  answer('No');
  assert.equal(h.collectionRequests(), 0);
  press();
  answer('Yes');
  answer('Yes');
  answer('Yes'); // Duplicate native callback must not submit a second receipt.
  press();
  assert.equal(h.collectionRequests(), 1);
  assert.match(content(h.render()), /Collect Payment/);
  finish({
    ...response.booking,
    balanceAmount: '0',
    payAtLodgeCollectedAt: '2026-11-02T10:00:00Z',
  });
  await tick();
  const collected = h.render();
  assert.match(content(collected), /Payment Collected/);
  assert.match(content(collected), /Nothing to collect/);
  assert.doesNotMatch(content(collected), /received online/);
  assert.equal(button(collected, 'Collected').props.disabled, true);
  assert.equal(h.refreshes(), 1);
});

test('failed cash confirmation leaves payment uncollected and exposes the error', async () => {
  const { h } = await confirmedHarness({
    collect: async () => {
      throw new Error('Network unavailable. Please retry.');
    },
  });
  button(h.render(), 'Collected').props.onPress();
  h.alerts
    .at(-1)[2]
    .find((item) => item.text === 'Yes')
    .onPress();
  h.alerts
    .at(-1)[2]
    .find((item) => item.text === 'Yes')
    .onPress();
  await tick();
  const tree = h.render();
  assert.match(content(tree), /Collect Payment/);
  assert.doesNotMatch(content(tree), /Payment Collected/);
  assert.match(content(tree), /Payment could not be marked collected/);
  assert.equal(h.refreshes(), 0);
});

test('offline confirmed result shows payment guidance but cannot submit a cash acknowledgement', async () => {
  const { h } = await confirmedHarness({ isOffline: true });
  const tree = h.render();
  assert.match(content(tree), /Collect Payment/);
  assert.equal(button(tree, 'Collected').props.disabled, true);
  button(tree, 'Collected').props.onPress();
  assert.equal(h.alerts.length, 0);
});
