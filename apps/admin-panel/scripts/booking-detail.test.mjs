import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const tick = () => delay(0);
function harness(getBooking) {
  const slots = [];
  let index = 0;
  let effects = [];
  let event;
  let interval;
  let disconnected = 0;
  const listeners = new Map();
  const auth = {
    isAuthenticated: true,
    refreshSession: async () => true,
    session: { tokens: { accessToken: 'local-test' } },
  };
  const hooks = {
    useState(value) {
      const i = index++;
      if (!(i in slots)) slots[i] = value;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === 'function' ? next(slots[i]) : next;
        },
      ];
    },
    useRef(value) {
      const i = index++;
      return (slots[i] ??= { current: value });
    },
    useCallback(fn, deps) {
      const i = index++;
      if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = index++;
      const old = slots[i];
      if (!old || deps.some((d, j) => d !== old.deps[j])) {
        slots[i] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  const imports = {
    react: hooks,
    '../api/admin-bookings-api': {
      getAdminBooking: getBooking,
      updateAdminBookingStatus: async () => {},
    },
    '../api/realtime-client': {
      createAdminRealtimeSocket: () => ({
        on() {},
        disconnect() {
          disconnected++;
        },
      }),
      subscribeAdminRealtimeEvents: (_, callback) => {
        event = callback;
      },
      subscribeAdminRealtimeSessionRecovery() {},
    },
    '../auth/AdminAuthProvider': { useAdminAuth: () => auth },
    '../auth/token-storage': { tokenStorage: { getAccessToken: async () => 'local-test' } },
  };
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/hooks/useAdminBookingDetail.ts', import.meta.url), 'utf8'),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports);
        return imports[name];
      },
      document: { visibilityState: 'visible' },
      window: {
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
      },
      setInterval: (fn) => {
        interval = fn;
        return 1;
      },
      clearInterval: () => {
        interval = undefined;
      },
    },
  );
  return {
    render() {
      index = 0;
      effects = [];
      const result = exports.useAdminBookingDetail('booking-one');
      effects.forEach((fn) => fn());
      return result;
    },
    emit: (name, bookingId) => event({ name, payload: { bookingId } }),
    focus: () => listeners.get('focus')?.(),
    poll: () => interval?.(),
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
    disconnected: () => disconnected,
  };
}
test('cash notification refreshes the same admin booking details, ignores other bookings and cleans up', async () => {
  let requests = 0;
  const h = harness(async () => ({
    id: 'booking-one',
    activity: [{ title: ++requests === 1 ? 'Checked in' : 'Payment collected at lodge' }],
  }));
  h.render();
  await tick();
  assert.equal(h.render().data.activity[0].title, 'Checked in');
  h.emit('dashboard:update', 'different-booking');
  await tick();
  assert.equal(requests, 1);
  h.emit('dashboard:update', 'booking-one');
  await tick();
  assert.equal(h.render().data.activity[0].title, 'Payment collected at lodge');
  assert.equal(requests, 2);
  h.focus();
  await tick();
  assert.equal(requests, 3);
  h.poll();
  await tick();
  assert.equal(requests, 4);
  h.unmount();
  assert.equal(h.disconnected(), 1);
  h.poll();
  h.focus();
  await tick();
  assert.equal(requests, 4);
});
test('an earlier booking detail response cannot overwrite a newer payment receipt refresh', async () => {
  const pending = [];
  const h = harness(() => new Promise((resolve) => pending.push(resolve)));
  h.render();
  await tick();
  h.emit('dashboard:update', 'booking-one');
  pending[1]({ id: 'booking-one', activity: ['collected'] });
  await tick();
  pending[0]({ id: 'booking-one', activity: ['uncollected'] });
  await tick();
  assert.equal(h.render().data.activity[0], 'collected');
  h.unmount();
});
