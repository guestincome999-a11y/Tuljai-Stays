import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/hooks/useDoubleBackToExit.ts', import.meta.url), 'utf8');
function harness(platform = 'android') {
  let pathname = '/dashboard';
  let now = 10_000;
  let listener;
  let cleanup;
  const ref = { current: 0 };
  const calls = [];
  const exports = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date: { now: () => now },
    require: (name) => {
      if (name === 'expo-router') return { usePathname: () => pathname };
      if (name === 'react') return { useRef: () => ref, useEffect: (effect) => { cleanup?.(); cleanup = effect(); } };
      if (name === 'react-native') return { Platform: { OS: platform }, ToastAndroid: { SHORT: 0, show: () => calls.push('toast') }, BackHandler: { exitApp: () => calls.push('exit'), addEventListener: (_, callback) => { listener = callback; return { remove: () => { listener = undefined; } }; } } };
      assert.fail('Unexpected import ' + name);
    },
  });
  return { calls, render(path) { pathname = path; exports.useDoubleBackToExit(); }, back() { return listener?.() ?? false; }, advance(ms) { now += ms; } };
}

test('Android Home shows one exit prompt then exits on a second press', () => {
  const app = harness(); app.render('/dashboard');
  assert.equal(app.back(), true);
  assert.deepEqual(app.calls, ['toast']);
  app.advance(1000); app.back();
  assert.deepEqual(app.calls, ['toast', 'exit']);
});
test('other screens leave Back to navigation and never toast or exit', () => {
  const app = harness();
  for (const path of ['/bookings', '/bookings/booking-1', '/rooms', '/reports', '/scan', '/profile', '/login']) {
    app.render(path); assert.equal(app.back(), false);
  }
  assert.deepEqual(app.calls, []);
});
test('returning Home resets the exit window; iOS never intercepts Back', () => {
  const app = harness(); app.render('/dashboard'); app.back();
  app.render('/bookings'); app.advance(500); app.render('/dashboard'); app.back();
  assert.deepEqual(app.calls, ['toast', 'toast']);
  const ios = harness('ios'); ios.render('/dashboard'); assert.equal(ios.back(), false);
});

test('booking search scanner fills the code once without navigation or check-in requests', async () => {
  const code = readFileSync(new URL('../src/features/bookings/components/BookingSearchScanner.tsx', import.meta.url), 'utf8');
  const calls = [];
  const found = [];
  let release;
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-camera': { CameraView: 'Camera', useCameraPermissions: () => [{ granted: true }, () => {}] },
    react: { useState: (value) => [value, () => {}], useRef: (value) => ({ current: value }), useEffect: (effect) => effect() },
    'react-native': { Linking: {}, Modal: 'Modal', View: 'View', StyleSheet: { create: (value) => value, absoluteFill: {} } },
    'react-native-paper': { ActivityIndicator: 'Activity', Button: 'Button', IconButton: 'IconButton', Text: 'Text', useTheme: () => ({ colors: {} }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../api/owner-bookings-api': { lookupOwnerBookingQr: (...args) => { calls.push(args); return new Promise((resolve) => { release = resolve; }); } },
  };
  runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, Error, require: (name) => { assert.ok(name in imports, 'Unexpected side effect import: ' + name); return imports[name]; },
  });
  const tree = exports.BookingSearchScanner({ lodgeId: 'lodge', onClose: () => {}, onFound: (value) => found.push(value) });
  function camera(node) {
    if (Array.isArray(node)) return node.map(camera).find(Boolean);
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === 'Camera') return node;
    return camera(node.props?.children);
  }
  const scan = camera(tree).props.onBarcodeScanned;
  scan({ data: 'tjsqr.v2.signed-test-payload' });
  scan({ data: 'tjsqr.v2.signed-test-payload' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['tjsqr.v2.signed-test-payload', 'lodge']);
  release({ bookingCode: 'TJS-2026-SEARCH' });
  await setImmediate();
  assert.deepEqual(found, ['TJS-2026-SEARCH']);
});
