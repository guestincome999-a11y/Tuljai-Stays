import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';

// Exercise the real hook with deterministic timers; no live gateway or native SDK required.
function harness(read) {
  const slots = [],
    pendingEffects = [],
    timers = new Map();
  let index = 0,
    sequence = 0,
    foreground,
    update;
  const confirmed = [];
  const react = {
    useState(initial) {
      const id = index++;
      if (!(id in slots)) slots[id] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[id],
        (value) => {
          slots[id] = typeof value === 'function' ? value(slots[id]) : value;
        },
      ];
    },
    useRef(initial) {
      const id = index++;
      return (slots[id] ??= { current: initial });
    },
    useCallback(fn, dependencies) {
      const id = index++,
        prior = slots[id];
      if (!prior || dependencies.some((value, i) => value !== prior.dependencies[i]))
        slots[id] = { fn, dependencies };
      return slots[id].fn;
    },
    useEffect(fn, dependencies) {
      const id = index++,
        prior = slots[id];
      if (!prior || dependencies.some((value, i) => value !== prior.dependencies[i])) {
        pendingEffects.push(() => {
          prior?.cleanup?.();
          slots[id] = { dependencies, cleanup: fn() };
        });
      }
    },
  };
  const exports = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../src/features/bookings/usePaymentResolution.ts', import.meta.url),
        'utf8',
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports,
      setTimeout: (fn, delay) => {
        const id = ++sequence;
        timers.set(id, { fn, delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      require: (name) =>
        ({
          react,
          'react-native': {
            AppState: {
              addEventListener: (_name, listener) => {
                foreground = listener;
                return { remove() {} };
              },
            },
          },
          './payment-outcome': {
            onPaymentUpdate: (listener) => {
              update = listener;
              return () => {};
            },
          },
        })[name],
    },
  );
  let state;
  const render = () => {
    index = 0;
    state = exports.usePaymentResolution(read, (...args) => confirmed.push(args));
    while (pendingEffects.length) pendingEffects.shift()();
    return state;
  };
  render();
  return {
    render,
    confirmed,
    timers,
    foreground: () => foreground?.('active'),
    update: () => update?.(),
    tick: async () => {
      const entry = timers.entries().next().value;
      if (entry) {
        timers.delete(entry[0]);
        entry[1].fn();
      }
      for (let i = 0; i < 6; i++) await Promise.resolve();
      return render();
    },
  };
}

test('verification watchdog paints pending; network failures never become failed and polling is bounded', async () => {
  let reads = 0;
  const h = harness(async () => {
    reads++;
    throw new Error('Offline');
  });
  h.render().verifying('order_existing');
  assert.equal(h.render().state.phase, 'VERIFYING');
  assert.equal([...h.timers.values()][0].delay, 12000);
  assert.equal((await h.tick()).state.phase, 'PENDING');
  for (let i = 0; i < 10; i++) await h.tick();
  assert.equal(reads, 7);
  assert.equal(h.render().state.phase, 'PENDING');
  assert.equal(h.timers.size, 0);
  h.foreground();
  h.render();
  await h.tick();
  assert.equal(reads, 8);
});

test('authoritative recovery commits the booking to UI and stops reconciliation', async () => {
  const booking = { id: 'booking', bookingCode: 'TJS-TEST' };
  const h = harness(async () => ({
    status: 'CONFIRMED',
    bookingId: booking.id,
    booking,
    retryCheckout: null,
  }));
  h.render().uncertain('order_existing');
  h.render();
  await h.tick();
  assert.equal(h.confirmed.length, 1);
  assert.equal(h.confirmed[0][1], booking);
  assert.equal(h.render().state, null);
  assert.equal(h.timers.size, 0);
});

test('failed gateway result preserves a retry of the same order; pending checkout can be resumed', async () => {
  const previous = { order: { orderId: 'order_existing' } };
  let result = {
    status: 'PENDING',
    gatewayStatus: 'failed',
    retryCheckout: previous,
  };
  const h = harness(async () => result);
  h.render().uncertain('order_existing');
  h.render();
  await h.tick();
  assert.equal(h.render().state.phase, 'FAILED');
  assert.equal(h.render().retryCheckout.order.orderId, 'order_existing');
  assert.equal(h.confirmed.length, 0);
  result = { status: 'CONFIRMED', bookingId: 'confirmed', retryCheckout: null };
  h.update();
  h.render();
  await h.tick();
  assert.equal(h.confirmed[0][0], 'confirmed');
});
