import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Date, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const policy = load('../src/pilgrim-ui/booking-pass-policy.ts');
const components = Object.fromEntries(['AppScreen', 'EmptyState', 'LoadingList', 'PrimaryButton',
  'PaymentStatusBadge', 'SecondaryButton', 'StatusBadge', 'StayImage'].map((name) => [name, name]));
function render(bookings, width = 400, syncError = null) {
  const navigation = [];
  const jsx = (type, props) => ({ type, props });
  const { PilgrimBookingsScreen } = load('../src/pilgrim-ui/screens/PilgrimBookingsScreen.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'expo-router': { useRouter: () => ({ push: (value) => navigation.push(value) }) },
    react: { useState: (value) => [value, () => {}] },
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', useWindowDimensions: () => ({ width }) },
    '../booking-pass-policy': policy,
    '../components': { ...components, ui: {} },
    '../mock-data': { formatRupees: (value) => String(value) },
    '../PilgrimAppProvider': { usePilgrimApp: () => ({ bookings, isSyncing: false, syncError, refresh() {}, t: (en) => en }) },
  });
  const nodes = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    nodes.push(value);
    visit(value.props?.children);
  }
  visit(PilgrimBookingsScreen());
  return { nodes, navigation };
}
const booking = { id: 'confirmed-stay', status: 'confirmed', qrReady: false,
  paymentStatus: 'Payment pending', checkInDate: '2020-01-01', checkOutDate: '2020-01-02',
  bookingCode: 'TEST', amount: 900 };

test('confirmed cards retain Details and Pass actions independently of live QR eligibility', () => {
  assert.equal(policy.canViewBookingQr(booking), false);
  for (const width of [360, 420]) {
    const h = render([booking], width);
    const details = h.nodes.find((node) => node.type === 'SecondaryButton' && node.props.children === 'View Details');
    const pass = h.nodes.find((node) => node.type === 'PrimaryButton' && node.props.children === 'View Pass');
    assert.ok(details);
    assert.ok(pass);
    pass.props.onPress();
    assert.equal(h.navigation[0].pathname, '/(app)/pass');
    assert.equal(h.navigation[0].params.bookingId, booking.id);
  }
});

test('pass navigation does not authorize QR display or export for an ineligible booking', () => {
  assert.equal(policy.canOpenBookingPass(booking), true);
  assert.equal(policy.canViewBookingQr(booking), false);
  for (const status of ['pending', 'checked-in', 'cancelled', 'completed'])
    assert.equal(policy.canOpenBookingPass({ ...booking, status }), false);
});

test('failed booking refresh shows Retry without falsely reporting an empty booking list', () => {
  const h = render([], 400, 'Network failed');
  assert.equal(h.nodes.some((node) => node.type === 'EmptyState'), false);
  assert.equal(h.nodes.some((node) => node.type === 'SecondaryButton' && node.props.children === 'Retry'), true);
});


test('alternate booking card also keeps confirmed pass navigation without local payment/date gating', () => {
  const jsx = (type, props) => ({ type, props });
  const { BookingCard } = load('../src/v2/features/bookings/BookingCard.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: () => [false, () => {}] },
    'react-native': { Modal: 'Modal', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: (value) => value } },
    '../../core/dates': { formatShortDate: (value) => value },
    '../../design/theme': { useColors: () => ({}) },
    '../../design/tokens': { elevation: {}, radius: {}, space: {} },
    '../../i18n/language': { useLang: () => ({ lang: 'en', t: (value) => value?.en ?? '' }) },
    '../../i18n/strings': { PASS_STATUSES: ['ACCEPTED', 'QR_GENERATED'], formatRupees: String, myBookingsStrings: {} },
    '../../ui/Button': { Button: 'Button' },
    '../../ui/Icon': { Icon: 'Icon' },
    '../../ui/Photo': { Photo: 'Photo' },
    '../../ui/PressableScale': { PressableScale: 'PressableScale' },
    '../../ui/Text': { Text: 'Text' },
    './BookingStatusBadge': { BookingStatusBadge: 'Badge' },
    './QrPass': { QrPass: 'QrPass' },
  });
  const tree = BookingCard({ booking: { ...booking, status: 'ACCEPTED', paymentStatus: 'PENDING' }, onPress() {} });
  const labels = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value.type === 'Button') labels.push(value.props.label);
    visit(value.props?.children);
  }
  visit(tree);
  assert.ok(labels.includes('View Details'));
  assert.ok(labels.includes('View Pass'));
});
