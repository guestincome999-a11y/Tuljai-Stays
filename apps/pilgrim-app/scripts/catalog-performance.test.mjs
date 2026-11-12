import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => dependencies[name] ?? require(name),
      AbortController,
      setTimeout,
      clearTimeout,
      Date,
      console,
    },
  );
  return exports;
}
const { lodgePrice, matchesLodgeBudget } = load('../src/pilgrim-ui/lodge-price.ts');
const request = load('../src/v2/core/catalog-request.ts');
const summary = { id: 'a', price: 900, priceAvailable: true, hydrated: false, rooms: [] };

test('fresh-device summary and previously hydrated lodge match the same budget', () => {
  assert.equal(lodgePrice(summary), 900);
  for (const lodge of [summary, { ...summary, hydrated: true, rooms: [{ price: 900 }] }]) {
    assert.equal(matchesLodgeBudget(lodge, undefined, 1200), true);
    assert.equal(matchesLodgeBudget(lodge, 950), false);
    assert.equal(matchesLodgeBudget({ ...lodge, price: 1000.5 }, 1000.5, 1000.5), true);
  }
  assert.equal(matchesLodgeBudget({ ...summary, priceAvailable: false }, undefined, 1200), false);
});

test('interrupted requests do not retry or return stale success', async () => {
  const controller = new AbortController();
  let finish;
  let calls = 0;
  const pending = request.readCatalog(() => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  }, controller.signal);
  controller.abort();
  finish('obsolete');
  await assert.rejects(pending, /cancelled/);
  assert.equal(calls, 1);
});

test('cancel during backoff stops retries and 4xx errors are not retried', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = request.readCatalog(async () => {
    calls++;
    throw new Error('offline');
  }, controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(calls, 1);
  await assert.rejects(
    request.readCatalog(async () => {
      throw { details: { statusCode: 400 } };
    }),
  );
});

// Deterministic hook scheduler exercises the actual hook without a native device.
// Effects run after render; network completion is controlled by each test.
function hookHarness(mode = 'v2') {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[i].value,
        (next) => {
          slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps))
        effects.push(() => {
          slots[i]?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
    },
  };
  const calls = [];
  const cached = [];
  const cacheLodgeSummaries = (items) => {
    for (const item of items) {
      const index = cached.findIndex((previous) => previous.id === item.id);
      if (index < 0) cached.push(item); else cached[index] = item;
    }
  };
  const read = (query, signal) => new Promise((resolve, reject) => calls.push({ query, signal, resolve, reject }));
  const dependencies = {
    react,
    './catalog-request': request,
    './catalog': { fetchCatalog: read },
    '../api/client': { apiClient: { get: (_, options) => read(options.params, options.signal) } },
    '../v2/core/catalog-request': request,
    './backend-sync': { toSummaryLodge: (item) => item },
    './PilgrimAppProvider': { usePilgrimApp: () => ({ cacheLodgeSummaries, catalogRevision: 0, lodges: cached }) },
  };
  const module = load(mode === 'premium' ? '../src/pilgrim-ui/useBrowseCatalog.ts' : '../src/v2/core/useCatalogList.ts', dependencies);
  const useCatalogList = mode === 'premium' ? module.useBrowseCatalog : module.useCatalogList;
  return {
    calls,
    render(query) {
      cursor = 0;
      const value = useCatalogList(query);
      const pending = effects;
      effects = [];
      pending.forEach((fn) => fn());
      return value;
    },
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}
const page = (ids, current = 1, totalPages = 1) => ({
  items: ids.map((id) => ({ id })),
  page: current,
  totalItems: ids.length,
  totalPages,
  pageSize: 12,
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('slow old filter cannot overwrite newer results, requests cancel on change/unmount', async () => {
  const h = hookHarness();
  h.render({ maxPrice: 500 });
  h.render({ maxPrice: 1200 });
  assert.equal(h.calls[0].signal.aborted, true);
  h.calls[1].resolve(page(['new']));
  await tick();
  h.calls[0].resolve(page([]));
  await tick();
  assert.equal(h.render({ maxPrice: 1200 }).items[0].id, 'new');
  h.unmount();
  assert.equal(h.calls[1].signal.aborted, true);
});

test('pagination deduplicates concurrent end events and exposes failures', async () => {
  const h = hookHarness();
  const q = { maxPrice: 1200 };
  h.render(q);
  h.calls[0].resolve(page(['a'], 1, 3));
  await tick();
  let state = h.render(q);
  const first = state.loadMore();
  const duplicate = state.loadMore();
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve(page(['a', 'b'], 2, 3));
  await Promise.all([first, duplicate]);
  state = h.render(q);
  assert.equal(state.items.length, 2);
  const failing = state.loadMore();
  h.calls[2].reject({ details: { statusCode: 503 } });
  await failing;
  state = h.render(q);
  assert.equal(state.error, true);
  assert.equal(state.errorKind, 'server');
  assert.equal(state.items.length, 2);
  h.unmount();
});

test('cached empty pages remain loading until revalidated; network failure stays an error', async () => {
  const h = hookHarness();
  const q = { maxPrice: 1 };
  h.render(q);
  h.calls[0].resolve(page([]));
  await tick();
  assert.equal(h.render(q).loading, false);
  h.render({ maxPrice: 2 });
  h.render(q);
  assert.equal(h.render(q).loading, true);
  h.calls[2].reject(new Error('timeout'));
  await tick();
  assert.equal(h.render(q).errorKind, 'network');
  h.unmount();
});

// Execute the active provider's callbacks with controlled IO, rather than testing
// only the alternate discovery hook or duplicating the provider algorithm.
function providerHarness() {
  const source = readFileSync(new URL('../src/pilgrim-ui/PilgrimAppProvider.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('provider.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let loadCallback;
  let pollCallback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadLodges')
      loadCallback = node.initializer.arguments[0].getText(ast);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'setInterval' &&
        node.arguments[0].getText(ast).includes('loadLodges'))
      pollCallback = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(loadCallback && pollCallback);
  const calls = [];
  const state = { loading: false, error: null, lodges: [] };
  const scope = {
    exports: {},
    lodgeLoadVersionRef: { current: 0 },
    lodgeLoadPendingRef: { current: false },
    lodgesRef: { current: [] },
    lastLodgeLoadAtRef: { current: 0 },
    hydratingIdsRef: { current: new Set() },
    invalidateLodgeCatalogCache() {},
    loadLodgeSummaries: () => new Promise((resolve, reject) => calls.push({ resolve, reject })),
    setIsLoadingLodges: (value) => { state.loading = value; },
    setLodgeLoadError: (value) => { state.error = value; },
    setLodges: (value) => { state.lodges = value; },
    setFavoriteIds: (fn) => fn([]),
    setCatalogRevision: () => {},
    catalogErrorKind: request.catalogErrorKind,
    AppState: { currentState: 'active' },
  };
  vm.createContext(scope);
  const code = `const loadLodges = ${loadCallback}; exports.load = loadLodges; exports.poll = ${pollCallback};`;
  vm.runInContext(ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, scope);
  return { ...scope.exports, calls, state };
}

test('active provider polling cannot supersede a slow catalogue request', async () => {
  const h = providerHarness();
  const pending = h.load();
  assert.equal(h.state.loading, true);
  h.poll();
  h.poll();
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve([summary]);
  await pending;
  assert.equal(h.state.loading, false);
  assert.equal(h.state.lodges[0].id, summary.id);
  h.poll();
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve([summary]);
  await tick();
});

test('active provider keeps latest request state and distinguishes failure from empty results', async () => {
  const h = providerHarness();
  const old = h.load();
  const current = h.load();
  h.calls[0].reject(new Error('offline'));
  await assert.rejects(old);
  assert.equal(h.state.loading, true);
  assert.equal(h.state.error, null);
  h.calls[1].reject(new Error('offline'));
  await assert.rejects(current);
  assert.equal(h.state.loading, false);
  assert.match(h.state.error, /Connection/);
  const retry = h.load();
  assert.equal(h.state.error, null);
  assert.equal(h.state.loading, true);
  h.calls[2].resolve([]);
  await retry;
  assert.equal(h.state.error, null);
  assert.equal(h.state.loading, false);
  assert.equal(h.state.lodges.length, 0);
});


test('detail hydration preserves thumbnails for cards and originals for the gallery', async () => {
  const { hydrateBackendLodge } = load('../src/pilgrim-ui/backend-sync.ts', {
    '../api/client': { apiClient: { get: async () => ({
      lodge: { id: 'a', name: 'Test lodge', propertyType: 'LODGE', amenities: [], rules: null },
      photos: [{ url: 'https://example.invalid/original.jpg', thumbnailUrl: 'https://example.invalid/thumb.webp' }],
      roomTypes: [{ id: 'r', name: 'Room', basePrice: '900.50', totalRooms: 1, capacityAdults: 2 }],
    }) } },
    '../features/bookings/api/bookings-api': {},
    '../features/notifications/api/notifications-api': {},
    '../v2/core/catalog-request': request,
    './mock-data': { pilgrimLodges: [], initialPilgrimNotifications: [] },
  });
  const hydrated = await hydrateBackendLodge(summary);
  assert.equal(hydrated.hero, 'https://example.invalid/thumb.webp');
  assert.equal(hydrated.photos[0], 'https://example.invalid/original.jpg');
  assert.equal(hydrated.price, 900.5);
});


test('premium browse cancels obsolete filters, deduplicates pagination and renders summaries directly', async () => {
  const h = hookHarness('premium');
  h.render({ maxPrice: 500 });
  await new Promise((resolve) => setTimeout(resolve, 320));
  h.render({ maxPrice: 1200 });
  assert.equal(h.calls[0].signal.aborted, true);
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(h.calls[1].query.maxPrice, 1200);
  assert.equal(h.calls[1].query.pageSize, 6);
  h.calls[1].resolve(page(['fresh'], 1, 2));
  await tick();
  h.calls[0].resolve(page([]));
  await tick();
  const state = h.render({ maxPrice: 1200 });
  assert.equal(state.items[0].id, 'fresh');
  state.loadMore();
  state.loadMore();
  assert.equal(h.calls.length, 3);
  h.calls[2].resolve(page(['next'], 2, 2));
  await tick();
  assert.equal(h.render({ maxPrice: 1200 }).items.length, 2);
  h.unmount();
  assert.equal(h.calls[2].signal.aborted, true);
});
