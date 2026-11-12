import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

import ts from 'typescript';

const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../src/features/bookings/payment-outcome.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports, console },
);

test('explicit gateway failures render as failed; dismissal, network and HTTP timeouts remain pending', () => {
  for (const failure of [
    { error: { reason: 'payment_failed' } },
    { reason: 'bank_declined' },
    { description: JSON.stringify({ error: { reason: 'insufficient_funds' } }) },
  ])
    assert.equal(exports.isExplicitPaymentFailure(failure), true);
  for (const unknown of [
    null,
    { code: 0 },
    { code: 2 },
    { description: 'Payment cancelled' },
    new Error('Network Error'),
    { code: 'ETIMEDOUT' },
    { details: { statusCode: 503 } },
  ])
    assert.equal(exports.isExplicitPaymentFailure(unknown), false);
});
