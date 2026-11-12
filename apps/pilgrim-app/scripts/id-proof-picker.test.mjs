import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../src/features/bookings/id-proof-picker-error.ts', import.meta.url),
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  { exports, Error },
);
const { isIdProofPickerUnavailable } = exports;

test('recognizes the wrapped OPEN_DOCUMENT error from existing Android installs', () => {
  assert.equal(
    isIdProofPickerUnavailable(
      new Error(
        "Call to function 'ExpoDocumentPicker.getDocumentAsync' has been rejected. Caused by: android.content.ActivityNotFoundException: No Activity found to handle intent { act=android.intent.action.OPEN_DOCUMENT }",
      ),
    ),
    true,
  );
});

test('recognizes a failed fallback launch even without the exception class name', () => {
  assert.equal(
    isIdProofPickerUnavailable(
      new Error('No Activity found to handle intent { act=android.intent.action.GET_CONTENT }'),
    ),
    true,
  );
});

test('keeps validation and upload failures distinct from an unavailable picker', () => {
  for (const error of [
    new Error('ID proof must be 5 MB or smaller.'),
    new Error('Network request failed'),
    null,
    undefined,
  ]) {
    assert.equal(isIdProofPickerUnavailable(error), false);
  }
});
