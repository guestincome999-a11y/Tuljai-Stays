import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const app = '../../apps/pilgrim-app/src/';

function load(relativePath, imports) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.ok(name in imports, `Unexpected runtime dependency: ${name}`);
      return imports[name];
    },
    Intl,
    Date,
  });
  return exports;
}

const record = {
  id: 'booking-1',
  lodgeId: 'lodge-1',
  roomTypeId: 'room-1',
  lodgeName: 'Shree Bhavani Residency',
  roomTypeName: 'Deluxe Family AC',
  lodgeGoogleMapsLink: 'https://maps.google.com/?q=18.01,76.07',
  lodgeCheckInTime: '13:00',
  lodgeCheckOutTime: '11:00',
  bookingCode: 'TS-123',
  checkInDate: '2026-11-01',
  checkOutDate: '2026-11-03',
  checkoutDateFlexible: false,
  numberOfAdults: 2,
  numberOfChildren: 1,
  totalAmount: '2499.50',
  paymentStatus: 'FULLY_PAID',
  status: 'ACCEPTED',
  createdAt: '2026-10-29T08:00:00.000Z',
  updatedAt: '2026-10-29T08:30:00.000Z',
};

function syncWith(get) {
  return load(`${app}pilgrim-ui/backend-sync.ts`, {
    '../api/client': { apiClient: { get } },
    '../features/bookings/api/bookings-api': {},
    '../features/notifications/api/notifications-api': {},
    './mock-data': { pilgrimLodges: [{ hero: 'fallback.jpg' }] },
  });
}

test('booking refresh uses joined lodge and room names without any catalogue requests', async () => {
  const api = load(`${app}features/bookings/api/bookings-api.ts`, {
    '../../../api/client': { apiClient: { get: async () => [record] } },
    '../../lodges/api/lodge-discovery-api': {
      getLodgeDetails: () => assert.fail('Must not request public lodge details'),
      listLodgePhotos: () => assert.fail('Must not request public photos'),
      listLodgeRoomTypes: () => assert.fail('Must not request public rooms'),
    },
    '../checkout-attempt': {},
  });
  for (let refresh = 0; refresh < 3; refresh += 1) {
    const [enriched] = await api.listMyBookings();
    const card = syncWith(() => assert.fail('No catalogue needed')).mapBooking(enriched, []);
    assert.equal(card.lodgeName, record.lodgeName);
    assert.equal(card.roomName, record.roomTypeName);
    assert.equal(card.amount, 2499.5);
    assert.equal(card.guests, '2 adults · 1 child');
    assert.equal(card.checkIn, '1 Nov 2026');
    assert.equal(card.checkOut, '3 Nov 2026');
    assert.equal(card.googleMapsLink, record.lodgeGoogleMapsLink);
    assert.equal(card.checkInTime, '13:00');
    assert.equal(card.checkOutTime, '11:00');
    assert.equal(card.paymentStatus, 'Paid');
  }
});

test('a historical booking outside the public page keeps its actual authorized cover photo', async () => {
  const calls = [];
  const sync = load(`${app}pilgrim-ui/backend-sync.ts`, {
    '../api/client': {
      apiClient: {
        get: async (path) => {
          calls.push(path);
          assert.equal(path, '/catalog/my-bookings');
          return [{ id: record.id, coverUrl: 'actual-booking-cover.jpg' }];
        },
      },
    },
    '../features/bookings/api/bookings-api': {
      listMyBookings: async () => [
        { booking: { ...record, status: 'COMPLETED' }, coverPhotoUrl: null },
      ],
    },
    '../features/notifications/api/notifications-api': {},
    './mock-data': {},
  });
  const [history] = await sync.loadBackendBookings([]);
  assert.equal(history.image, 'actual-booking-cover.jpg');
  assert.equal(history.lodgeName, record.lodgeName);
  assert.equal(history.status, 'completed');
  assert.deepEqual(calls, ['/catalog/my-bookings']);
});

test('home requests one small page, retains summary prices on failed hydration, and leaves later pages lazy', async () => {
  const requests = [];
  const sync = syncWith(async (path, options) => {
    requests.push(path);
    if (path !== '/catalog/lodges') throw new Error('Temporary connection failure');
    assert.equal(options.params.pageSize, 6);
    assert.equal(options.params.page, 1);
    return {
      totalPages: 2,
      items: [
        {
          id: `lodge-${options.params.page}`,
          name: 'Real Lodge',
          propertyType: 'HOTEL',
          startingPrice: '899.50',
          coverUrl: 'cover.jpg',
          distanceFromTempleMeters: 200,
        },
      ],
    };
  });
  const summaries = await sync.loadLodgeSummaries();
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].price, 899.5);
  const retained = await sync.hydrateBackendLodge(summaries[0]);
  assert.equal(retained.price, 899.5);
  assert.equal(retained.hero, 'cover.jpg');
  assert.equal(requests.length, 2);
});

test('simultaneous views coalesce a lodge detail request and later refreshes remain fresh', async () => {
  let calls = 0;
  let resolveRead;
  const sync = syncWith(() => {
    calls += 1;
    return new Promise((resolve) => {
      resolveRead = resolve;
    });
  });
  const view = {
    lodge: {
      id: 'same-lodge',
      name: 'Real Lodge',
      amenities: [],
      propertyType: 'HOTEL',
      reviewCount: 0,
    },
    photos: [],
    roomTypes: [],
  };
  const first = sync.loadLodgeById('same-lodge');
  const second = sync.loadLodgeById('same-lodge');
  assert.equal(calls, 1);
  resolveRead(view);
  assert.equal((await first).name, 'Real Lodge');
  assert.equal((await second).name, 'Real Lodge');
  const refreshed = sync.loadLodgeById('same-lodge');
  assert.equal(calls, 2);
  resolveRead(view);
  await refreshed;
});

test('one detail request provides the actual price and rooms even without lodge photos', async () => {
  let requests = 0;
  const sync = syncWith(async () => {
    requests += 1;
    return {
      lodge: { id: 'lodge-1', name: record.lodgeName, amenities: [], propertyType: 'HOTEL' },
      photos: [],
      roomTypes: [
        {
          id: 'room-1',
          name: record.roomTypeName,
          basePrice: '1250.25',
          totalRooms: 4,
          capacityAdults: 2,
          capacityChildren: 1,
        },
      ],
    };
  });
  const lodge = await sync.hydrateBackendLodge({
    id: 'lodge-1',
    hero: 'cover.jpg',
    photos: ['cover.jpg'],
  });
  assert.equal(requests, 1);
  assert.equal(lodge.price, 1250.25);
  assert.equal(lodge.rooms[0].name, record.roomTypeName);
  assert.equal(lodge.hero, 'cover.jpg');
});

test('a configured zero price remains distinguishable from a lodge with no priced rooms', async () => {
  const sync = syncWith(async () => ({
    totalPages: 1,
    items: [
      { id: 'free', name: 'Free stay', startingPrice: '0', propertyType: 'DHARAMSHALA' },
      { id: 'empty', name: 'No rooms', startingPrice: null, propertyType: 'HOTEL' },
    ],
  }));
  const [free, empty] = await sync.loadLodgeSummaries();
  assert.equal(free.price, 0);
  assert.equal(free.priceAvailable, true);
  assert.equal(empty.priceAvailable, false);
});

test('backend serializes joined names and lodge times in the booking response', () => {
  require('ts-node').register({
    project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
    transpileOnly: true,
  });
  const { BookingsService } = require('../src/modules/bookings/bookings.service.ts');
  const booking = BookingsService.prototype.toBooking({
    ...record,
    checkInDate: new Date(`${record.checkInDate}T00:00:00Z`),
    checkOutDate: new Date(`${record.checkOutDate}T00:00:00Z`),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    guests: [],
    lodge: {
      name: record.lodgeName,
      googleMapsLink: record.lodgeGoogleMapsLink,
      checkInTime: '13:00',
      checkOutTime: '11:00',
    },
    roomType: { name: record.roomTypeName },
  });
  assert.equal(booking.lodgeName, record.lodgeName);
  assert.equal(booking.roomTypeName, record.roomTypeName);
  assert.equal(booking.lodgeGoogleMapsLink, record.lodgeGoogleMapsLink);
  assert.equal(booking.lodgeCheckInTime, '13:00');
});
