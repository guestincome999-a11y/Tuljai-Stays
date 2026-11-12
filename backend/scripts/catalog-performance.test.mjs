import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { catalogPrice, matchesCatalogBudget } = require('@tuljai/utils');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');

const { CatalogService } = require('../src/modules/catalog/catalog.service.ts');
const { CatalogQueryDto } = require('../src/modules/catalog/dto/catalog-query.dto.ts');

function fixture(prices = ['0', '500', '1000.50', '1200', '1200.01', null]) {
  let reads = 0;
  const prisma = {
    featureFlag: { findUnique: async () => ({ enabled: false }) },
    lodge: {
      findMany: async (query) => {
        reads++;
        assert.equal(query.where.status, 'VERIFIED');
        assert.equal(query.where.verificationStatus, 'VERIFIED');
        assert.equal(query.where.isActive, true);
        return prices.map((_, i) => ({
          id: `l${i}`,
          name: `Lodge ${i}`,
          propertyType: 'LODGE',
          distanceFromTempleMeters: 100,
          amenities: [],
        }));
      },
    },
    lodgePhoto: {
      findMany: async (query) => {
        assert.equal(query.where.approvalStatus, 'APPROVED');
        return [];
      },
    },
    roomType: {
      findMany: async (query) => {
        assert.equal(query.where.rooms.some.status, 'AVAILABLE');
        return prices.flatMap((price, i) =>
          price === null ? [] : [{ lodgeId: `l${i}`, basePrice: price, festivalPrice: null }],
        );
      },
    },
    review: { groupBy: async () => [] },
  };
  return { service: new CatalogService(prisma, {}), reads: () => reads, prisma };
}

test('budget contract handles decimal, numeric/string, unknown and locale-independent values', () => {
  for (const value of [500, '500', '500.00', ' 500.00 ']) {
    assert.equal(catalogPrice(value), 500);
    assert.equal(matchesCatalogBudget(value, 500, 500), true);
  }
  for (const value of [null, undefined, '', ' ', '₹500', '1,000', '५००', NaN, Infinity, -1, true]) {
    assert.equal(catalogPrice(value), null);
    assert.equal(matchesCatalogBudget(value, undefined, 1200), false);
  }
  assert.equal(matchesCatalogBudget(null), true);
  for (const locale of ['en-IN', 'mr-IN', 'de-DE', 'ar-EG']) {
    // Display formatting must not feed back into the wire contract.
    new Intl.NumberFormat(locale).format(1000.5);
    assert.equal(matchesCatalogBudget('1000.50', 1000.5, 1200), true);
  }
});

test('DTO accepts decimal budgets and rejects invalid price and page inputs', async () => {
  for (const query of [{ minPrice: '0', maxPrice: '1200.50' }, { maxPrice: '1000' }, {}]) {
    assert.equal((await validate(plainToInstance(CatalogQueryDto, query))).length, 0);
  }
  for (const query of [
    { maxPrice: 'NaN' },
    { minPrice: '-1' },
    { maxPrice: '1,200' },
    { page: 0 },
    { pageSize: 51 },
  ]) {
    assert.ok((await validate(plainToInstance(CatalogQueryDto, query))).length > 0);
  }
});

test('budget filtering precedes pagination and preserves totals on all pages', async () => {
  const { service } = fixture();
  const first = await service.listLodges({ maxPrice: 1200, pageSize: 2, page: 1, sort: 'price' });
  const second = await service.listLodges({ maxPrice: 1200, pageSize: 2, page: 2, sort: 'price' });
  assert.deepEqual(
    first.items.map((x) => x.startingPrice),
    ['0', '500'],
  );
  assert.deepEqual(
    second.items.map((x) => x.startingPrice),
    ['1000.5', '1200'],
  );
  assert.equal(first.totalItems, 4);
  assert.equal(second.totalPages, 2);
  assert.equal((await service.listLodges({ minPrice: 1200.01 })).totalItems, 1);
  assert.equal((await service.listLodges({ minPrice: 501, maxPrice: 999 })).totalItems, 0);
  assert.equal((await service.listLodges({})).totalItems, 6);
  await assert.rejects(service.listLodges({ minPrice: 1200, maxPrice: 500 }), /minPrice/);
});

test('concurrent reads share one build, cached and uncached filters agree', async () => {
  const { service, prisma } = fixture();
  let calls = 0;
  const original = prisma.lodge.findMany;
  prisma.lodge.findMany = async (q) => {
    if (q.include?.amenities) calls++;
    return original(q);
  };
  const pages = await Promise.all(
    Array.from({ length: 20 }, () => service.listLodges({ maxPrice: 1200 })),
  );
  assert.equal(calls, 1);
  assert.deepEqual(pages[0], pages[19]);
  service.invalidate();
  assert.deepEqual(await service.listLodges({ maxPrice: 1200 }), pages[0]);
  assert.equal(calls, 2);
});

test('invalidation during a slow build does not restore stale cache', async () => {
  const { service, prisma } = fixture();
  const original = prisma.lodge.findMany;
  let release;
  prisma.lodge.findMany = (q) =>
    new Promise((resolve) => {
      release = async () => resolve(await original(q));
    });
  const old = service.listLodges({});
  service.invalidate();
  prisma.lodge.findMany = original;
  const fresh = await service.listLodges({});
  await release();
  await old;
  assert.deepEqual(await service.listLodges({}), fresh);
});

test('database failure rejects instead of becoming a successful zero result', async () => {
  const { service, prisma } = fixture();
  prisma.lodge.findMany = async () => {
    throw new Error('database unavailable');
  };
  await assert.rejects(service.listLodges({ maxPrice: 1200 }), /database unavailable/);
  await assert.rejects(service.listLodges({ maxPrice: 1200 }), /database unavailable/);
});
