import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const now = 1_800_000_000_000;
const token = (exp) => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
function evaluate(source, context) {
  const scope = { exports: {}, ...context };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, scope);
  return scope.exports;
}
const helperSource = readFileSync(new URL('../../../packages/utils/src/access-token-freshness.ts', import.meta.url), 'utf8');
const { isAccessTokenFresh } = evaluate(helperSource, { atob: globalThis.atob });

test('startup token scheduling uses a sixty-second margin and rejects uncertain inputs', () => {
  assert.equal(isAccessTokenFresh(token(now / 1000 + 61), now), true);
  for (const value of [undefined, '', 'malformed', 'a.!.c', token(null), token('9999999999'),
    token(now / 1000), token(now / 1000 + 60)]) {
    assert.equal(isAccessTokenFresh(value, now), false);
  }
  const withoutDecoder = evaluate(helperSource, {});
  assert.equal(withoutDecoder.isAccessTokenFresh(token(now / 1000 + 120), now), true);
});

function restoration(app, accessToken, allowed = true, onboarding = false) {
  const relative = app === 'pilgrim'
    ? '../src/auth/auth-context.tsx' : '../../owner-app/src/auth/auth-context.tsx';
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const ast = ts.createSourceFile('auth.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let restore;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'restore') restore = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(restore);
  const state = { refreshes: 0, clears: 0, complete: false, session: null, route: null };
  const saved = { user: { id: 'test-user' }, tokens: { accessToken, refreshToken: 'test-refresh' } };
  const context = {
    mounted: true,
    restoreAuthSession: async () => saved,
    isAccessTokenFresh: (value) => isAccessTokenFresh(value, now),
    hasAllowedOwnerRole: () => allowed,
    isOnboardingRequired: async () => onboarding,
    setOnboardingRequired: async () => {},
    setSession: (value) => { state.session = value; },
    setBootstrapComplete: (value) => { state.complete = value; },
    refreshAccessToken: async () => { state.refreshes++; return { accessToken: 'renewed' }; },
    saveAuthSession: async () => {},
    clearAuthSession: async () => { state.clears++; },
    emptyAuthSession: {},
    apiClient: { resetSessionExpiredFlag() {} },
    router: { replace: (route) => { state.route = route; } },
  };
  return { state, run: evaluate(`${restore}; exports.run = restore;`, context).run };
}

test('both apps restore fresh sessions without a network round trip, expired tokens still refresh', async () => {
  for (const app of ['pilgrim', 'owner']) {
    const fresh = restoration(app, token(now / 1000 + 120));
    await fresh.run();
    assert.equal(fresh.state.refreshes, 0);
    assert.equal(fresh.state.complete, true);
    assert.equal(fresh.state.session.user.id, 'test-user');
    const expired = restoration(app, token(now / 1000 - 1));
    await expired.run();
    assert.equal(expired.state.refreshes, 1);
    assert.equal(expired.state.session.tokens.accessToken, 'renewed');
  }
});

test('fast restoration preserves owner role gating and pilgrim onboarding', async () => {
  const denied = restoration('owner', token(now / 1000 + 120), false);
  await denied.run();
  assert.equal(denied.state.clears, 1);
  assert.equal(denied.state.session.user, undefined);
  const onboarding = restoration('pilgrim', token(now / 1000 + 120), true, true);
  await onboarding.run();
  assert.equal(onboarding.state.route, '/(auth)/onboarding');
});
