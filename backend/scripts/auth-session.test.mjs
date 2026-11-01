import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { AuthService } = require('../src/modules/auth/auth.service.ts');
const { JwtAuthStrategy } = require('../src/modules/auth/strategies/jwt-auth.strategy.ts');
const { JwtService } = require('@nestjs/jwt');
const { AxiosError } = require('axios');
const ts = require('typescript');
const root = fileURLToPath(new URL('../../', import.meta.url));
const RealDate = Date;
const start = RealDate.UTC(2026, 0, 1);
let now = start;
class ClockDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [now]));
  }
  static now() {
    return now;
  }
}

function backend(appType) {
  const user = {
    id: 'user-1',
    isActive: true,
    deletedAt: null,
    roles: [appType === 'PILGRIM_APP' ? 'PILGRIM' : appType === 'OWNER_APP' ? 'OWNER' : 'ADMIN'],
    displayName: 'Test user',
    phoneNumber: '+919999999999',
    email: 'test@example.com',
    lastLoginAt: new Date(),
  };
  const refreshes = new Map();
  const sessions = new Map();
  const config = {
    getOrThrow(key) {
      const values = {
        'api.jwt.accessTokenTtl': '15m',
        'api.jwt.refreshTokenTtl': '180d',
        'api.jwt.sessionMaxAgeDays': 180,
        'api.jwt.accessSecret': 'test-access-secret',
        'api.otp.ttlSeconds': 300,
        'api.otp.maxAttempts': 5,
        'api.otp.rateLimitWindowSeconds': 900,
        'api.otp.rateLimitMaxRequests': 5,
        'api.otp.allowDevResponse': false,
        'api.nodeEnv': 'test',
        'api.ownerAuth.passwordResetTtlSeconds': 900,
        'api.ownerAuth.passwordResetRateLimitWindowSeconds': 900,
        'api.ownerAuth.passwordResetRateLimitMaxRequests': 5,
        'api.ownerAuth.resetPasswordDeepLink': 'test://reset',
      };
      assert.ok(key in values, key);
      return values[key];
    },
  };
  let service;
  const prisma = {
    $queryRaw: async () => [],
    user: { findUnique: async () => user, update: async () => user },
    authIdentity: {
      findUnique: async () => ({
        user,
        userId: user.id,
        passwordHash: service.hashSecret('password'),
      }),
    },
    otpRequest: {
      findFirst: async () => ({
        id: 'otp',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(now + 60000),
        otpHash: service.hashSecret('123456'),
      }),
      update: async () => ({}),
    },
    auditLog: { create: async () => ({}) },
    refreshToken: {
      create: async ({ data }) => {
        const row = {
          ...data,
          id: `refresh-${refreshes.size}`,
          createdAt: new Date(),
          revokedAt: null,
          user,
        };
        refreshes.set(row.tokenHash, row);
        return row;
      },
      findUnique: async ({ where }) => {
        const row = refreshes.get(where.tokenHash);
        return row ? { ...row, userSession: sessions.get(row.id) } : null;
      },
      findFirst: async ({ where }) => {
        const row = refreshes.get(where.tokenHash);
        return row?.deviceId === where.deviceId && row.userId === where.userId ? row : null;
      },
      update: async ({ where, data }) => {
        const row = [...refreshes.values()].find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    userSession: {
      create: async ({ data }) => {
        const row = { ...data, id: 'session-1', createdAt: new Date(), isActive: true };
        sessions.set(data.refreshTokenId, row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const row = sessions.get(where.refreshTokenId);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      },
      findFirst: async ({ where }) => {
        const row = sessions.get(where.refreshTokenId);
        const refresh = [...refreshes.values()].find((r) => r.id === where.refreshTokenId);
        return row?.isActive &&
          row.userId === where.userId &&
          row.sessionExpiresAt > new Date() &&
          !refresh.revokedAt &&
          refresh.expiresAt > new Date() &&
          user.isActive &&
          !user.deletedAt
          ? { ...row, user }
          : null;
      },
    },
  };
  const jwt = new JwtService();
  service = new AuthService(config, {}, jwt, prisma, {});
  const strategy = new JwtAuthStrategy(config, prisma);
  return {
    service,
    jwt,
    strategy,
    user,
    sessions,
    async login(deviceId) {
      const dto = {
        deviceId,
        appType,
        platform: 'ANDROID',
        email: user.email,
        password: 'password',
        phoneNumber: user.phoneNumber,
        otp: '123456',
      };
      return appType === 'PILGRIM_APP'
        ? service.verifyOtp(dto, {})
        : appType === 'OWNER_APP'
          ? service.ownerLogin(dto, {})
          : service.adminLogin(dto, {});
    },
  };
}

// Reload real client modules with durable OS storage shared across runtimes.
// Only the OS and HTTP boundaries are mocked; stores and 401 retries run unchanged.
function mobile(app, durable, server) {
  const cache = new Map();
  const secure = {
    isAvailableAsync: async () => true,
    getItemAsync: async (key) => durable.get(key) ?? null,
    setItemAsync: async (key, value) => {
      durable.set(key, value);
    },
    deleteItemAsync: async (key) => {
      durable.delete(key);
    },
  };
  let offline = false;
  let refreshUnavailable = false;
  const axios = require('axios');
  const adapter = async (config) => {
    if (offline) throw new AxiosError('Network unavailable', 'ERR_NETWORK', config);
    if (refreshUnavailable && config.url.endsWith('/auth/refresh-token')) {
      throw new AxiosError('Refresh service unavailable', 'ERR_NETWORK', config);
    }
    try {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      let data;
      if (config.url.endsWith('/auth/refresh-token'))
        data = await server.service.refreshToken(body);
      else {
        const payload = server.jwt.verify(config.headers.Authorization.slice(7), {
          secret: 'test-access-secret',
        });
        data = await server.strategy.validate(payload);
      }
      return { data: { data }, status: 200, statusText: 'OK', config, headers: {} };
    } catch (error) {
      throw new AxiosError(
        error.message,
        'ERR_BAD_REQUEST',
        config,
        {},
        {
          status: 401,
          data: { message: error.message },
          config,
          headers: {},
          statusText: 'Unauthorized',
        },
      );
    }
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    function localRequire(id) {
      if (id === 'expo-secure-store') return secure;
      if (id === 'react-native') return { Platform: { OS: 'android' } };
      if (id === 'axios')
        return {
          __esModule: true,
          ...axios,
          default: {
            ...axios,
            create: (options) => {
              const client = axios.create(options);
              client.defaults.adapter = adapter;
              return client;
            },
          },
        };
      if (id === '@tuljai/utils') return load(path.join(root, 'packages/utils/src/errors.ts'));
      if (id === '@tuljai/shared')
        return {
          ...load(path.join(root, 'packages/shared/src/api-client.ts')),
          emptyAuthSession: { activeSession: null, user: null, tokens: null },
          readPublicEnvironment: () => ({ apiBaseUrl: 'https://test.invalid/api' }),
        };
      if (id.includes('config/api-base-url'))
        return {
          resolvePilgrimApiBaseUrl: () => 'https://test.invalid/api',
          resolveOwnerApiBaseUrl: () => 'https://test.invalid/api',
        };
      if (id.includes('selected-lodge-store')) return { clearSelectedLodge: async () => {} };
      if (id.startsWith('.')) {
        let target = path.resolve(path.dirname(filename), id);
        if (!existsSync(target)) target += '.ts';
        return load(target);
      }
      return require(id);
    }
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      Date: ClockDate,
      process,
      console,
      setTimeout,
      clearTimeout,
    })(localRequire, mod, mod.exports);
    return mod.exports;
  }
  const base = path.join(root, `apps/${app}-app/src`);
  const clientModule = load(path.join(base, 'api/client.ts'));
  return {
    store: load(path.join(base, 'auth/auth-session-store.ts')),
    api: clientModule.apiClient,
    tokens: load(path.join(base, 'auth/secure-token-store.ts')).secureTokenStore,
    expired: (handler) =>
      clientModule[
        app === 'pilgrim' ? 'setPilgrimSessionExpiredHandler' : 'setOwnerSessionExpiredHandler'
      ](handler),
    offline: (value) => {
      offline = value;
    },
    failRefresh: (value) => {
      refreshUnavailable = value;
    },
  };
}

for (const [app, appType] of [
  ['pilgrim', 'PILGRIM_APP'],
  ['owner', 'OWNER_APP'],
]) {
  test(`${app}: 15-minute refresh and restart after 7/90/179/181 days`, async () => {
    globalThis.Date = ClockDate;
    now = start;
    try {
      const server = backend(appType);
      const durable = new Map();
      let client = mobile(app, durable, server);
      durable.set(`tuljai.${app}.deviceId`, 'device-1');
      const login = await server.login('device-1');
      const originalDeadline = login.session.sessionExpiresAt;
      assert.equal(new RealDate(originalDeadline).getTime(), start + 180 * 86400000);
      const decoded = server.jwt.decode(login.tokens.accessToken);
      assert.equal(decoded.exp - decoded.iat, 900);
      await client.store.saveAuthSession({
        activeSession: login.session,
        tokens: login.tokens,
        user: login.user,
      });
      now = start + 16 * 60000;
      await client.api.get('/auth/me');
      assert.notEqual(await client.tokens.getAccessToken(), login.tokens.accessToken);
      for (const day of [7, 90, 179]) {
        now = start + day * 86400000;
        client = mobile(app, durable, server);
        const restored = await client.store.restoreAuthSession();
        assert.equal(restored.tokens.refreshToken, login.tokens.refreshToken);
        await client.api.get('/auth/me');
        assert.equal(
          client.store.getAuthSession().activeSession.sessionExpiresAt,
          originalDeadline,
        );
        assert.equal(
          [...server.sessions.values()][0].sessionExpiresAt.toISOString(),
          originalDeadline,
        );
      }
      now += 16 * 60000;
      client.offline(true);
      await assert.rejects(client.api.get('/auth/me'));
      assert.equal(await client.tokens.getRefreshToken(), login.tokens.refreshToken);
      client.offline(false);
      let transientExpired = false;
      client.expired(() => {
        transientExpired = true;
      });
      client.failRefresh(true);
      await assert.rejects(client.api.get('/auth/me'));
      assert.equal(transientExpired, false);
      assert.equal(await client.tokens.getRefreshToken(), login.tokens.refreshToken);
      client.failRefresh(false);
      await client.api.get('/auth/me');
      now = start + 181 * 86400000;
      client = mobile(app, durable, server);
      assert.equal((await client.store.restoreAuthSession()).tokens, null);
      assert.equal(await client.tokens.getRefreshToken(), null);
      let expired = false;
      client.expired(() => {
        expired = true;
      });
      await assert.rejects(client.api.get('/auth/me'));
      assert.equal(expired, true);
      await assert.rejects(
        server.service.refreshToken({
          deviceId: 'device-1',
          refreshToken: login.tokens.refreshToken,
        }),
      );
    } finally {
      globalThis.Date = RealDate;
    }
  });
}

for (const appType of ['PILGRIM_APP', 'OWNER_APP', 'ADMIN_PANEL']) {
  test(`${appType}: revocation, inactive session/account, binding and exact deadline`, async () => {
    globalThis.Date = ClockDate;
    now = start;
    try {
      const server = backend(appType);
      const login = await server.login('device-1');
      const input = { deviceId: 'device-1', refreshToken: login.tokens.refreshToken };
      await assert.rejects(server.service.refreshToken({ ...input, deviceId: 'other-device' }));
      server.user.isActive = false;
      await assert.rejects(server.service.refreshToken(input));
      server.user.isActive = true;
      const session = [...server.sessions.values()][0];
      session.isActive = false;
      await assert.rejects(server.service.refreshToken(input));
      session.isActive = true;
      now = start + 180 * 86400000 - 1000;
      const last = await server.service.refreshToken(input);
      assert.equal(last.expiresInSeconds, 1);
      now += 1000;
      await assert.rejects(server.service.refreshToken(input));
      now = start;
      await server.service.logout(server.user.id, input);
      await assert.rejects(server.service.refreshToken(input));
      await assert.rejects(server.strategy.validate(server.jwt.decode(login.tokens.accessToken)));
    } finally {
      globalThis.Date = RealDate;
    }
  });
}

test('Admin: persistent HttpOnly cookie keeps the original deadline, rejects CSRF and revokes logout', async () => {
  globalThis.Date = ClockDate;
  now = start;
  try {
    const server = backend('ADMIN_PANEL');
    const login = await server.login('admin-device');
    const filename = path.join(root, 'apps/admin-panel/app/api/auth-session/route.ts');
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const { NextRequest } = require('next/server');
    const mod = { exports: {} };
    let unavailable = false;
    const backendFetch = async (url, options) => {
      if (unavailable) throw new Error('Network unavailable');
      try {
        const input = JSON.parse(options.body);
        const result = url.endsWith('/auth/logout')
          ? await server.service.logout(server.user.id, input)
          : await server.service.refreshToken(input);
        return Response.json({ data: result });
      } catch {
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      }
    };
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      Date: ClockDate,
      process: { env: { NODE_ENV: 'production' } },
      fetch: backendFetch,
    })(
      (id) =>
        id.includes('config/api-base-url')
          ? { resolveAdminApiBaseUrl: () => 'https://backend.invalid/api' }
          : require(id),
      mod,
      mod.exports,
    );
    const route = mod.exports;
    const origin = 'https://admin.invalid';
    let cookie;
    const request = (method, body, requestOrigin = origin) =>
      new NextRequest(`${origin}/api/auth-session`, {
        method,
        headers: {
          origin: requestOrigin,
          'Content-Type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const credentials = { deviceId: 'admin-device', refreshToken: login.tokens.refreshToken };
    const rejected = await route.POST(request('POST', credentials, 'https://attacker.invalid'));
    assert.equal(rejected.status, 403);
    const response = await route.POST(request('POST', credentials));
    assert.equal(response.status, 200);
    const stored = response.cookies.get('tuljai-admin-refresh');
    assert.equal(stored.httpOnly, true);
    assert.equal(stored.secure, true);
    assert.equal(stored.sameSite, 'strict');
    assert.equal(stored.expires.getTime(), start + 180 * 86400000);
    cookie = `tuljai-admin-refresh=${encodeURIComponent(stored.value)}`;
    // A persistent cookie is the only secret needed after browser restarts.
    for (const day of [7, 90, 179]) {
      now = start + day * 86400000;
      const refreshed = await route.PATCH(request('PATCH'));
      assert.equal(refreshed.status, 200);
      assert.equal(refreshed.headers.get('set-cookie'), null);
      assert.equal((await refreshed.json()).sessionExpiresAt, login.session.sessionExpiresAt);
    }
    unavailable = true;
    const temporaryFailure = await route.PATCH(request('PATCH'));
    assert.equal(temporaryFailure.status, 503);
    assert.equal(temporaryFailure.headers.get('set-cookie'), null);
    unavailable = false;
    now = start + 181 * 86400000;
    assert.equal((await route.PATCH(request('PATCH'))).status, 401);
    now = start;
    assert.equal((await route.DELETE(request('DELETE'))).status, 200);
    await assert.rejects(server.service.refreshToken(credentials));
  } finally {
    globalThis.Date = RealDate;
  }
});

test('Environment accepts requested durations and rejects invalid values', () => {
  const { validateEnvironment } = require('../src/shared/config/env.validation.ts');
  const config = {
    DATABASE_URL: 'postgresql://test',
    JWT_ACCESS_SECRET: 'test',
    JWT_REFRESH_SECRET: 'test',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '180d',
    AUTH_SESSION_MAX_AGE_DAYS: '180',
  };
  assert.equal(validateEnvironment(config).AUTH_SESSION_MAX_AGE_DAYS, 180);
  assert.throws(() => validateEnvironment({ ...config, JWT_REFRESH_EXPIRES_IN: 'forever' }));
  assert.throws(() => validateEnvironment({ ...config, AUTH_SESSION_MAX_AGE_DAYS: '0' }));
});
