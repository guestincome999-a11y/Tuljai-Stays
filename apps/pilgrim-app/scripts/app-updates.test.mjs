import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../src/updates/update-policy.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText,
  { exports, Date },
);
const { createUpdateChecker, canRestartForUpdate } = exports;

test('one update check covers simultaneous launch and foreground events, then observes cooldown', async () => {
  let now = 0;
  let checks = 0;
  let downloads = 0;
  const check = createUpdateChecker(
    {
      checkForUpdateAsync: async () => {
        checks += 1;
        return { isAvailable: true };
      },
      fetchUpdateAsync: async () => {
        downloads += 1;
      },
    },
    () => now,
  );
  await Promise.all([check(), check(), check()]);
  assert.equal(checks, 1);
  assert.equal(downloads, 1);
  now = 60_000;
  await check();
  assert.equal(checks, 1);
  now = 5 * 60_000;
  await check();
  assert.equal(checks, 2);
});

test('an offline or failed download leaves the app usable and a later foreground can retry', async () => {
  let now = 0;
  let checks = 0;
  let downloads = 0;
  const check = createUpdateChecker(
    {
      checkForUpdateAsync: async () => {
        checks += 1;
        if (checks === 1) throw new Error('Offline');
        return { isAvailable: true };
      },
      fetchUpdateAsync: async () => {
        downloads += 1;
        if (downloads === 1) throw new Error('Interrupted download');
      },
    },
    () => now,
  );
  await check();
  now += 5 * 60_000;
  await check();
  now += 5 * 60_000;
  await check();
  assert.equal(checks, 3);
  assert.equal(downloads, 2);
});

test('no available update does not download anything; rollback directives are fetched', async () => {
  let rollback = false;
  let now = 0;
  let downloads = 0;
  const check = createUpdateChecker(
    {
      checkForUpdateAsync: async () => ({ isAvailable: false, isRollBackToEmbedded: rollback }),
      fetchUpdateAsync: async () => {
        downloads += 1;
      },
    },
    () => now,
  );
  await check();
  assert.equal(downloads, 0);
  rollback = true;
  now += 5 * 60_000;
  await check();
  assert.equal(downloads, 1);
});

test('restarting is deferred across both checkout flows, booking payment, login and pass routes', () => {
  for (const path of [
    '/book/lodge-1',
    '/booking/booking-1',
    '/(app)/bookings/new',
    '/(app)/bookings/id',
    '/pass',
    '/(app)/pass',
    '/login',
    '/verify',
    '/(auth)/verify-otp',
    '/auth/google',
    '/name',
    '/(auth)/onboarding',
  ]) {
    assert.equal(canRestartForUpdate(path), false, path);
  }
  for (const path of [
    '/(app)/home',
    '/(tabs)',
    '/explore',
    '/(app)/lodges/id',
    '/(app)/bookings',
    '/profile',
  ]) {
    assert.equal(canRestartForUpdate(path), true, path);
  }
});
