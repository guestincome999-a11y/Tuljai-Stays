import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

import ts from 'typescript';
const source = readFileSync(
  new URL('../src/features/bookings/guest-capacity.ts', import.meta.url),
  'utf8',
);
const module = { exports: {} };
new Function(
  'exports',
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
)(module.exports);
const { guestCapacityError } = module.exports;
test('Guest capacity rejects adults and children separately, permits exact limits and rooms without child capacity', () => {
  assert.equal(guestCapacityError(2, 1, 2, 1), null);
  assert.match(guestCapacityError(3, 0, 2, 1), /Maximum 2 adults and 1 children/);
  assert.match(guestCapacityError(1, 2, 2, 1), /Maximum/);
  assert.match(guestCapacityError(1, 1, 2, 0), /0 children/);
  assert.equal(guestCapacityError(1, 0, 1, 0), null);
});
