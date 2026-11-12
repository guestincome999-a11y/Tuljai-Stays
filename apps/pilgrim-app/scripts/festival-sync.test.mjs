import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';

function load(file, imports, globals = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(`../src/v2/core/${file}`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
      ...globals,
    },
  );
  return exports;
}

test('catalogue requests deduplicate concurrent identical filters but keep different filters separate', async () => {
  let reads = 0;
  const catalogue = load('catalog.ts', {
    './api': {
      api: {
        get: async () => {
          reads++;
          return { items: [] };
        },
      },
    },
  });
  const first = catalogue.fetchCatalog({ maxPrice: 1000 });
  const duplicate = catalogue.fetchCatalog({ maxPrice: 1000 });
  assert.equal(first, duplicate);
  await Promise.all([first, duplicate, catalogue.fetchCatalog({ maxPrice: 500 })]);
  assert.equal(reads, 2);
  await catalogue.fetchCatalog({ maxPrice: 1000 });
  assert.equal(reads, 3, 'completed reads do not become stale availability caches');
});

test('mounted lodge list removes closures immediately and refreshes on realtime, foreground and fallback', async () => {
  const sync = load('catalog-sync.ts', {});
  let backendItems = [{ id: 'lodge-a' }, { id: 'lodge-b' }];
  let reads = 0;
  let state;
  const effects = [],
    cleanups = [],
    foreground = [],
    intervals = [],
    refreshers = new Set();
  const { useCatalogList } = load(
    'useCatalogList.ts',
    {
      react: {
        useState: (initial) => {
          state = typeof initial === 'function' ? initial() : initial;
          return [
            state,
            (value) => {
              state = typeof value === 'function' ? value(state) : value;
            },
          ];
        },
        useRef: (current) => ({ current }),
        useCallback: (fn) => fn,
        useEffect: (fn) => effects.push(fn),
      },
      'react-native': {
        AppState: {
          currentState: 'active',
          addEventListener: (_name, fn) => {
            foreground.push(fn);
            return { remove() {} };
          },
        },
      },
      './catalog-sync': sync,
      './useCachedFetch': {
        registerCachedRefresher: (fn) => {
          refreshers.add(fn);
          return () => refreshers.delete(fn);
        },
      },
      './catalog': {
        fetchCatalog: async () => {
          reads++;
          return { items: backendItems, page: 1, totalItems: backendItems.length, totalPages: 1 };
        },
      },
    },
    {
      setInterval: (fn) => {
        intervals.push(fn);
        return 1;
      },
      clearInterval() {},
    },
  );
  useCatalogList({ maxPrice: 1000 });
  for (const effect of effects) cleanups.push(effect());
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state.items.length, 2);
  sync.notifyCatalogChange({ lodgeId: 'lodge-a', isActive: false });
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].id, 'lodge-b');
  backendItems = [{ id: 'lodge-b' }];
  await Promise.all([...refreshers].map((fn) => fn()));
  foreground[0]('active');
  await new Promise((resolve) => setTimeout(resolve, 0));
  intervals[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(reads, 4);
  for (const cleanup of cleanups) cleanup?.();
  assert.equal(refreshers.size, 0);
});
