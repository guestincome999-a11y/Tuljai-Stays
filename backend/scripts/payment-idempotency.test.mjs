import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const {
  createIdempotentPaymentOrder,
} = require('../src/modules/payments/payment-order-idempotency.ts');
const {
  RazorpayOrderRejectedException,
} = require('../src/modules/payments/providers/razorpay.provider.ts');

const input = { amount: 10000, currency: 'INR', bookingId: 'lock_test', receipt: 'unused' };
function fixture() {
  let row = null;
  let writes = 0;
  let failPersistence = false;
  let gatewayOrder = null;
  const prisma = {
    paymentOrderRequest: {
      upsert: async ({ create }) => {
        row ??= { ...create, status: 'NEW', providerOrderId: null };
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        if (row.status !== where.status) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      update: async ({ data }) => {
        if (failPersistence) {
          failPersistence = false;
          throw new Error('Database disconnected');
        }
        Object.assign(row, data);
        return row;
      },
    },
  };
  const provider = {
    createPayment: async ({ amount, currency, receipt }) => {
      writes += 1;
      gatewayOrder = { id: 'order_test', amount, currency, receipt };
      return {
        provider: 'RAZORPAY',
        orderId: gatewayOrder.id,
        amount,
        currency,
        status: 'CREATED',
      };
    },
    getOrdersByReceipt: async () => (gatewayOrder ? [gatewayOrder] : []),
  };
  return {
    prisma,
    provider,
    row: () => row,
    writes: () => writes,
    failPersistence: () => {
      failPersistence = true;
    },
    replaceGatewayOrder: (value) => {
      gatewayOrder = value;
    },
    create: (value = input) =>
      createIdempotentPaymentOrder(prisma, provider, 'hold:lock_test', value),
  };
}

test('replayed order requests reuse the durable gateway order and reject changed amounts', async () => {
  const f = fixture();
  const first = await f.create();
  assert.deepEqual(await f.create(), first);
  assert.equal(f.writes(), 1);
  assert.equal(f.row().receipt.length, 40);
  await assert.rejects(f.create({ ...input, amount: 10001 }), /amount changed/);
  assert.equal(f.writes(), 1);
});

test('concurrent order requests issue one POST and recover the same receipt', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.create(), f.create()]);
  for (const result of results) {
    if (result.status === 'fulfilled') assert.equal(result.value.orderId, 'order_test');
    else assert.match(result.reason.message, /pending verification/);
  }
  assert.equal((await f.create()).orderId, 'order_test');
  assert.equal(f.writes(), 1);
});

test('an accepted order with a lost gateway response is recovered without another POST', async () => {
  const f = fixture();
  const create = f.provider.createPayment;
  f.provider.createPayment = async (value) => {
    await create(value);
    throw new Error('Gateway timeout');
  };
  await assert.rejects(f.create(), /Gateway timeout/);
  assert.equal(f.row().status, 'UNKNOWN');
  assert.equal((await f.create()).orderId, 'order_test');
  assert.equal(f.writes(), 1);
});

test('an unknown gateway outcome stays blocked when receipt lookup finds no order', async () => {
  const f = fixture();
  let calls = 0;
  f.provider.createPayment = async () => {
    calls += 1;
    throw new Error('Connection lost');
  };
  await assert.rejects(f.create(), /Connection lost/);
  await assert.rejects(f.create(), /pending verification/);
  await assert.rejects(f.create(), /pending verification/);
  assert.equal(calls, 1);
});

test('explicit gateway rejections allow a retry using the same receipt', async () => {
  const f = fixture();
  const create = f.provider.createPayment;
  let calls = 0;
  f.provider.createPayment = async (value) => {
    if (++calls === 1) throw new RazorpayOrderRejectedException('Rate limited');
    return create(value);
  };
  await assert.rejects(f.create(), /Rate limited/);
  assert.equal(f.row().status, 'NEW');
  assert.equal((await f.create()).orderId, 'order_test');
  assert.equal(calls, 2);
});

test('a crash after the external POST but before local persistence recovers by receipt', async () => {
  const f = fixture();
  f.failPersistence();
  await assert.rejects(f.create(), /Database disconnected/);
  assert.equal(f.row().status, 'CREATING');
  assert.equal((await f.create()).orderId, 'order_test');
  assert.equal(f.writes(), 1);
});

test('recovery rejects mismatched receipts, amounts and ambiguous orders', async () => {
  for (const kind of ['receipt', 'amount', 'duplicates']) {
    const f = fixture();
    f.failPersistence();
    await assert.rejects(f.create(), /Database disconnected/);
    const order = {
      id: 'order_test',
      amount: input.amount,
      currency: 'INR',
      receipt: f.row().receipt,
    };
    if (kind === 'receipt') order.receipt = 'other';
    if (kind === 'amount') order.amount = 1;
    f.provider.getOrdersByReceipt = async () => (kind === 'duplicates' ? [order, order] : [order]);
    await assert.rejects(f.create(), /does not match|Multiple gateway orders/);
    assert.equal(f.row().providerOrderId, null);
    assert.equal(f.writes(), 1);
  }
});
