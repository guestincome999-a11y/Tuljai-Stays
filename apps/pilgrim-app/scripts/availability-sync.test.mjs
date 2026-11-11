import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';

test('inventory hints refresh only the matching lodge, reconnect refreshes all, and cleanup unsubscribes', () => {
  const effects = [],
    values = [],
    foreground = [],
    exports = {};
  let index = 0;
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../src/features/bookings/availability-sync.ts', import.meta.url),
        'utf8',
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports,
      require: (name) =>
        ({
          react: {
            useState: (initial) => {
              const id = index++;
              values[id] = initial;
              return [
                initial,
                (fn) => {
                  values[id] = fn(values[id]);
                },
              ];
            },
            useEffect: (fn) => effects.push(fn()),
          },
          'react-native': {
            AppState: {
              addEventListener: (_event, listener) => {
                foreground.push(listener);
                return { remove() {} };
              },
            },
          },
        })[name],
    },
  );
  exports.useAvailabilityRevision('lodge-a', true);
  exports.useAvailabilityRevision('lodge-b', true);
  exports.notifyAvailabilityChange('lodge-a');
  assert.deepEqual(values, [1, 0]);
  exports.notifyAvailabilityChange();
  assert.deepEqual(values, [2, 1]);
  foreground[1]('active');
  assert.deepEqual(values, [2, 2]);
  effects[0]();
  exports.notifyAvailabilityChange('lodge-a');
  assert.deepEqual(values, [2, 2]);
});
