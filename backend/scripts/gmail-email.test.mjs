import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { deliveryFailure } = require('../src/modules/bookings/confirmation-outbox.ts');
const { GmailEmailProvider } = require('../src/shared/email/gmail-email.provider.ts');
const credentials = {
  clientId: 'synthetic-client',
  clientSecret: 'synthetic-secret',
  refreshToken: 'synthetic-refresh',
};
const message = {
  to: 'controlled@example.com',
  subject: 'Booking confirmed',
  text: 'Booking receipt',
  html: '<p>Booking receipt</p>',
  messageId: '<synthetic-booking@example.com>',
  attachments: [
    {
      filename: 'pass.pdf',
      content: Buffer.from('%PDF-synthetic'),
      contentType: 'application/pdf',
    },
  ],
};
const response = (status, value) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => value,
});
const provider = () =>
  new GmailEmailProvider(credentials, { name: 'Tuljai Stays', address: 'sender@example.com' });

test('Gmail sends RFC MIME with PDF via HTTPS, caches tokens, and deduplicates concurrent OAuth refreshes', async () => {
  const original = globalThis.fetch;
  let tokens = 0,
    sends = 0;
  globalThis.fetch = async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      tokens++;
      assert.equal(init.body.get('grant_type'), 'refresh_token');
      assert.equal(init.body.get('client_secret'), credentials.clientSecret);
      await Promise.resolve();
      return response(200, { access_token: 'synthetic-access', expires_in: 3600 });
    }
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.equal(init.headers.Authorization, 'Bearer synthetic-access');
    const mime = Buffer.from(JSON.parse(init.body).raw, 'base64url').toString();
    assert.match(mime, /multipart\/mixed/);
    assert.match(mime, /application\/pdf/);
    assert.match(mime, /Message-ID: <synthetic-booking@example.com>/i);
    assert.ok(!mime.includes(credentials.clientSecret));
    sends++;
    return response(200, { id: `gmail-id-${sends}` });
  };
  try {
    const p = provider();
    await Promise.all([p.submit(message), p.submit(message)]);
    await p.submit(message);
    assert.equal(tokens, 1);
    assert.equal(sends, 3);
  } finally {
    globalThis.fetch = original;
  }
});

for (const [status, body, expected, permanent] of [
  [429, {}, 'GMAIL_429', false],
  [401, {}, 'GMAIL_401', false],
  [403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 'GMAIL_403', false],
  [403, { error: { errors: [{ reason: 'insufficientPermissions' }] } }, 'GMAIL_403', true],
  [400, {}, 'GMAIL_400', true],
  [503, {}, 'SUBMISSION_UNKNOWN', true],
])
  test(`Gmail HTTP ${status} classifies rejected versus uncertain submission safely (${expected}, permanent=${permanent})`, async () => {
    const original = globalThis.fetch;
    let sends = 0;
    globalThis.fetch = async (url) => {
      if (url.includes('oauth2'))
        return response(200, { access_token: 'synthetic', expires_in: 3600 });
      sends++;
      return response(status, body);
    };
    try {
      await assert.rejects(provider().submit(message), (error) => {
        const result = deliveryFailure(error);
        assert.equal(result.reason, expected);
        assert.equal(result.permanent, permanent);
        return true;
      });
      assert.equal(sends, 1, 'a failed request must not cause an implicit duplicate send');
    } finally {
      globalThis.fetch = original;
    }
  });

test('OAuth failures are safely retryable before submission and never leak provider credentials', async () => {
  const original = globalThis.fetch;
  let submissions = 0;
  globalThis.fetch = async (url) => {
    if (!url.includes('oauth2')) submissions++;
    return response(400, { error: 'invalid_grant', secret: credentials.clientSecret });
  };
  try {
    await assert.rejects(provider().submit(message), (error) => {
      assert.equal(error.code, 'EAUTH');
      assert.ok(!error.message.includes(credentials.clientSecret));
      return true;
    });
    assert.equal(submissions, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('connection loss after Gmail send starts is unknown and must not be automatically retried', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('oauth2'))
      return response(200, { access_token: 'synthetic', expires_in: 3600 });
    throw new Error('Synthetic network timeout');
  };
  try {
    await assert.rejects(provider().submit(message), (error) => deliveryFailure(error).uncertain);
  } finally {
    globalThis.fetch = original;
  }
});
