import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const { allocateCommissionFIFO } = require('../src/modules/lodges/commission-allocation.ts');
const {
  LodgeCommissionFinanceService,
} = require('../src/modules/lodges/commission-finance.service.ts');
const { CommissionPaymentService } = require('../src/modules/lodges/commission-payment.service.ts');
const { financeExport } = require('../src/modules/lodges/finance-export.ts');
const { financeRange } = require('../src/modules/lodges/owner-finance.service.ts');
const { RazorpayProvider } = require('../src/modules/payments/providers/razorpay.provider.ts');

test('financial PDF exports paginate long transaction references without losing totals', async () => {
  const rows = Array.from({ length: 75 }, (_, i) => [
    '16 Nov 2026, 09:15 IST',
    'Test Owner',
    'Test Lodge',
    '550e8400-e29b-41d4-a716-446655440000',
    `reference-${i}`,
    'order_123456789012345',
    'pay_123456789012345',
    '123.45',
    'UPI',
    'SUCCESSFUL',
  ]);
  rows.push(['TOTAL', '', '', '', '', '', '', '9258.75', '', '']);
  const file = await financeExport(
    'Commission Collection History',
    'Test fixture | 1 Nov 2026 to 16 Nov 2026 | INR',
    [
      'Date',
      'Owner',
      'Lodge',
      'Owner ID',
      'Reference',
      'Order ID',
      'Payment ID',
      'INR',
      'Method',
      'Status',
    ],
    rows,
  );
  const bytes = Buffer.from(file.base64, 'base64');
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 5000);
  if (process.env.FINANCE_PDF_PREVIEW) {
    mkdirSync(dirname(process.env.FINANCE_PDF_PREVIEW), { recursive: true });
    writeFileSync(process.env.FINANCE_PDF_PREVIEW, bytes);
  }
});

const sql = (value) => (Array.isArray(value) ? value.join('?') : value.sql);
function fixture() {
  const row = {
    id: 'internal',
    ownerId: 'owner',
    lodgeId: 'lodge',
    amountPaise: 12345,
    paymentType: 'FULL',
    outstandingBeforePaise: 12345,
    remainingAfterPaise: null,
    currentOutstandingPaise: 12345,
    status: 'PENDING',
    orderId: 'order',
    paymentId: null,
    bookings: [],
  };
  const state = {
    settlements: 0,
    allocations: 0,
    notifications: 0,
    audits: [],
    writes: 0,
    claimed: false,
    denied: false,
    failAllocation: false,
    items: [
      {
        id: 'ledger',
        reserved: 12345,
        due: 12345,
        expectedDue: 12345,
        eligible: true,
        status: 'OUTSTANDING',
      },
    ],
    gateway: [
      {
        id: 'pay',
        order_id: 'order',
        amount: 12345,
        currency: 'INR',
        captured: true,
        status: 'captured',
        method: 'upi',
      },
    ],
  };
  const db = {
    $queryRaw: async (query, ...values) => {
      const s = sql(query);
      if (s.startsWith('SELECT (SELECT'))
        return [{ paise: state.items.reduce((sum, i) => sum + i.due, 0) }];
      if (s.includes('UPDATE commission_payments SET last_checked_at') && s.includes('RETURNING')) {
        if (row.orderId || state.claimed) return [];
        state.claimed = true;
        return [{ amount: row.amountPaise }];
      }
      if (s.includes('SELECT status FROM commission_payments')) return [{ status: row.status }];
      if (s.includes('i.amount_paise AS reserved')) return state.items;
      if (s.includes('INSERT INTO lodge_commission_settlements')) {
        state.settlements++;
        return [{ id: 'settlement' }];
      }
      if (s.includes('UPDATE commission_payments SET webhook_at')) return [{ id: row.id }];
      if (s.includes('FROM commission_payment_items i')) return row.bookings;
      if (s.includes('FROM commission_payments p')) return [{ ...row }];
      if (s.includes('SELECT id,amount_paise AS amount FROM commission_payments'))
        return state.noActive ? [] : [{ id: row.id, amount: row.amountPaise }];
      if (s.includes('AS paise FROM lodge_commission_ledger'))
        return state.items.map((i) => ({ id: i.id, paise: i.due }));
      if (s.includes('INSERT INTO commission_payments')) {
        state.noActive = false;
        row.amountPaise = values[2];
        row.paymentType = values[3];
        row.outstandingBeforePaise = values[4];
        return [{ id: row.id }];
      }
      return [];
    },
    $executeRaw: async (query, ...values) => {
      const s = sql(query);
      if (s.includes('INSERT INTO lodge_commission_settlement_allocations')) {
        if (state.failAllocation) throw new Error('write failed');
        state.allocations++;
        for (const item of state.items) item.due -= item.reserved;
      }
      if (s.includes('INSERT INTO commission_payment_items')) {
        const vals = query.values;
        state.items = state.items.filter((i) => vals.includes(i.id));
        for (let i = 0; i < vals.length; i += 4) {
          const item = state.items.find((x) => x.id === vals[i + 1]);
          item.reserved = vals[i + 2];
          item.expectedDue = vals[i + 3];
        }
      }
      if (s.includes('UPDATE lodge_commission_ledger'))
        for (const item of state.items)
          item.status = s.includes('CASE WHEN')
            ? item.due === 0
              ? 'SETTLED'
              : 'OUTSTANDING'
            : 'SETTLED';
      if (s.includes("SET status='SUCCESSFUL'")) {
        row.status = 'SUCCESSFUL';
        row.paymentId = 'pay';
        row.remainingAfterPaise = values[2];
        row.currentOutstandingPaise = values[2];
      }
      if (s.includes("SET status='RECOVERY_REQUIRED'")) row.status = 'RECOVERY_REQUIRED';
      if (s.includes("SET status='FAILED'") && row.status === 'PENDING') row.status = 'FAILED';
      if (s.includes("SET status='CANCELLED'") && row.status === 'PENDING')
        row.status = 'CANCELLED';
      if (s.includes("SET status='PENDING'") && ['FAILED', 'CANCELLED'].includes(row.status))
        row.status = 'PENDING';
      if (s.includes('SET order_id=')) row.orderId = values[0];
      if (s.includes('SET last_checked_at=NULL')) state.claimed = false;
      return 1;
    },
    auditLog: { create: async ({ data }) => state.audits.push(data) },
    notification: {
      create: async () => {
        state.notifications++;
      },
    },
  };
  let queue = Promise.resolve();
  db.$transaction = (fn) => {
    const result = queue.then(async () => {
      const before = {
        row: { ...row },
        settlements: state.settlements,
        allocations: state.allocations,
        notifications: state.notifications,
        audits: [...state.audits],
      };
      try {
        return await fn(db);
      } catch (e) {
        Object.assign(row, before.row);
        Object.assign(state, {
          settlements: before.settlements,
          allocations: before.allocations,
          notifications: before.notifications,
          audits: before.audits,
        });
        throw e;
      }
    });
    queue = result.catch(() => {});
    return result;
  };
  const access = {
    assertCanManageLodge: async () => {
      if (state.denied) throw new Error('Forbidden');
    },
  };
  const provider = {
    getOrderPayments: async () => state.gateway,
    verifyPayment: async () => ({ verified: false }),
    createPayment: async (input) => {
      state.requestedAmount = input.amount;
      state.writes++;
      if (state.uncertain) throw new Error('timeout');
      return { orderId: 'recovered-order' };
    },
    getOrdersByReceipt: async () => state.orders ?? [],
  };
  const service = new CommissionPaymentService(db, access, provider);
  return { service, state, row, provider, db };
}

test('IST filters include the end date and reject invalid or reversed dates', () => {
  const range = financeRange({ startDate: '2026-12-31', endDate: '2026-12-31' });
  assert.equal(range.start.toISOString(), '2026-12-30T18:30:00.000Z');
  assert.equal(range.end.toISOString(), '2026-12-31T18:30:00.000Z');
  for (const q of [
    { startDate: '2026-02-30' },
    { startDate: '2026-11-17', endDate: '2026-11-16' },
    { endDate: 'x' },
  ])
    assert.throws(() => financeRange(q));
});
test('concurrent reconciliation and duplicate webhooks allocate captured paise exactly once', async () => {
  const f = fixture();
  await Promise.all([f.service.reconcile('internal'), f.service.reconcile('internal')]);
  await f.service.receiveVerifiedWebhook('order');
  assert.equal(f.row.status, 'SUCCESSFUL');
  assert.equal(f.state.settlements, 1);
  assert.equal(f.state.allocations, 1);
  assert.equal(f.state.notifications, 1);
  assert.equal(f.state.audits.filter((a) => a.action === 'COMMISSION_PAYMENT_VERIFIED').length, 1);
});
test('frontend success without a valid signature never allocates commission', async () => {
  const f = fixture();
  await assert.rejects(
    f.service.verify('internal', {}, { orderId: 'order', paymentId: 'pay', signature: 'bad' }),
    /signature/,
  );
  assert.equal(f.state.allocations, 0);
  assert.equal(f.row.status, 'PENDING');
  await assert.rejects(
    f.service.verify('internal', {}, { orderId: 'different', paymentId: 'pay', signature: 'bad' }),
    /belong/,
  );
});
test('signature verification alone is insufficient: authorized payments stay pending', async () => {
  const f = fixture();
  f.provider.verifyPayment = async () => ({ verified: true });
  f.state.gateway[0].status = 'authorized';
  f.state.gateway[0].captured = false;
  const result = await f.service.verify(
    'internal',
    {},
    { orderId: 'order', paymentId: 'pay', signature: 'signed' },
  );
  assert.equal(result.status, 'PENDING');
  assert.equal(f.state.allocations, 0);
});
test('amount, currency, order, refunds, duplicate captures and changed ledger all require audited recovery', async (t) => {
  for (const kind of [
    'amount',
    'currency',
    'order',
    'refunded',
    'multiple',
    'voided',
    'alreadyAllocated',
    'missing',
  ])
    await t.test(kind, async () => {
      const f = fixture();
      if (kind === 'amount') f.state.gateway[0].amount = 1;
      if (kind === 'currency') f.state.gateway[0].currency = 'USD';
      if (kind === 'order') f.state.gateway[0].order_id = 'different';
      if (kind === 'refunded') f.state.gateway[0].amount_refunded = 1;
      if (kind === 'multiple') f.state.gateway.push({ ...f.state.gateway[0], id: 'pay2' });
      if (kind === 'voided') f.state.items[0].eligible = false;
      if (kind === 'alreadyAllocated') f.state.items[0].due = 1;
      if (kind === 'missing') f.state.items = [];
      await f.service.reconcile('internal');
      assert.equal(f.row.status, 'RECOVERY_REQUIRED');
      assert.equal(f.state.allocations, 0);
      assert.equal(f.state.notifications, 0);
      assert.equal(f.state.audits[0].action, 'COMMISSION_PAYMENT_RECOVERY_REQUIRED');
    });
});
test('ledger write failure rolls back settlement, allocation, notification and success', async () => {
  const f = fixture();
  f.state.failAllocation = true;
  await assert.rejects(f.service.reconcile('internal'), /write failed/);
  assert.equal(f.row.status, 'PENDING');
  assert.equal(f.state.settlements, 0);
  assert.equal(f.state.notifications, 0);
});
test('failed or dismissed checkout retains its order; a later capture is still reconciled', async () => {
  const f = fixture();
  f.state.gateway = [];
  await f.service.cancelled('internal', {});
  assert.equal(f.row.status, 'CANCELLED');
  const resumed = await f.service.create('lodge', { id: 'owner' }, 12345);
  assert.equal(resumed.orderId, 'order');
  assert.equal(f.state.writes, 0);
  f.state.gateway = [
    {
      id: 'pay',
      order_id: 'order',
      amount: 12345,
      currency: 'INR',
      status: 'failed',
      captured: false,
    },
  ];
  await f.service.reconcile('internal');
  assert.equal(f.row.status, 'FAILED');
  f.state.gateway[0].status = 'captured';
  f.state.gateway[0].captured = true;
  await f.service.reconcile('internal');
  assert.equal(f.row.status, 'SUCCESSFUL');
});
test('unknown order outcomes recover by receipt and never issue another gateway write', async () => {
  const f = fixture();
  f.row.orderId = null;
  f.state.uncertain = true;
  await assert.rejects(f.service.create('lodge', { id: 'owner' }, 12345), /timeout/);
  await f.service.create('lodge', { id: 'owner' }, 12345);
  assert.equal(f.state.writes, 1);
  assert.equal(f.row.orderId, null);
  f.state.orders = [{ id: 'recovered-order', amount: 12345, currency: 'INR' }];
  await f.service.create('lodge', { id: 'owner' }, 12345);
  assert.equal(f.row.orderId, 'recovered-order');
  assert.equal(f.state.writes, 1);
});
test('unassigned owners cannot inspect, verify, pay or dismiss another lodge transaction', async () => {
  const f = fixture();
  f.state.denied = true;
  await assert.rejects(f.service.detail('internal', {}), /Forbidden/);
  await assert.rejects(f.service.create('lodge', {}, 12345), /Forbidden/);
  await assert.rejects(f.service.cancelled('internal', {}), /Forbidden/);
  assert.equal(f.state.allocations, 0);
});
test('resuming an order requires reviewing the original amount', async () => {
  const f = fixture();
  await assert.rejects(f.service.create('lodge', { id: 'owner' }, 1), /original amount/);
  assert.equal(f.state.writes, 0);
});

test('new orders require the complete authoritative balance; empty or changed balances never dispatch', async () => {
  const f = fixture();
  f.state.noActive = true;
  f.row.orderId = null;
  await assert.rejects(f.service.create('lodge', { id: 'owner' }, 1), /balance changed/);
  assert.equal(f.state.writes, 0);
  const order = await f.service.create('lodge', { id: 'owner' }, 12345);
  assert.equal(order.orderId, 'recovered-order');
  assert.equal(f.state.writes, 1);
  const empty = fixture();
  empty.state.noActive = true;
  empty.state.items = [];
  await assert.rejects(empty.service.create('lodge', { id: 'owner' }, 12345), /No payable/);
  assert.equal(empty.state.writes, 0);
});

test('FIFO partial payments retain entry remainders and every earlier allocation snapshot', () => {
  let ledger = [
    { id: 'oldest', paise: 400000 },
    { id: 'newer', paise: 600000 },
  ];
  const snapshots = [];
  for (const amount of [300000, 200000, 150000, 350000]) {
    const plan = allocateCommissionFIFO(ledger, amount);
    snapshots.push(JSON.parse(JSON.stringify(plan)));
    for (const a of plan.allocations) ledger.find((l) => l.id === a.id).paise -= a.paise;
    ledger = ledger.filter((l) => l.paise > 0);
  }
  assert.deepEqual(
    snapshots.map((s) => s.outstanding),
    [1000000, 700000, 500000, 350000],
  );
  assert.deepEqual(
    snapshots.map((s) => s.paymentType),
    ['PARTIAL', 'PARTIAL', 'PARTIAL', 'FULL'],
  );
  assert.deepEqual(
    snapshots[1].allocations.map((a) => [a.id, a.paise]),
    [
      ['oldest', 100000],
      ['newer', 100000],
    ],
  );
  assert.equal(snapshots[0].allocations[0].dueBeforePaise, 400000);
  assert.equal(
    snapshots.reduce((sum, s) => sum + s.allocations.reduce((n, a) => n + a.paise, 0), 0),
    1000000,
  );
  assert.deepEqual(ledger, []);
});
test('invalid, fractional-paise and excessive partial amounts cannot be reserved', () => {
  for (const amount of [0, -1, 0.1, NaN, Infinity, 10001])
    assert.throws(() => allocateCommissionFIFO([{ id: 'a', paise: 10000 }], amount));
  assert.deepEqual(allocateCommissionFIFO([{ id: 'a', paise: 10000 }], 1).allocations, [
    { id: 'a', paise: 1, dueBeforePaise: 10000 },
  ]);
});
test('a verified partial capture settles only its allocated paise and keeps the booking outstanding', async () => {
  const f = fixture();
  f.state.noActive = true;
  f.row.orderId = null;
  const order = await f.service.create('lodge', { id: 'owner' }, 3200, 'PARTIAL');
  assert.equal(order.amountPaise, 3200);
  assert.equal(order.paymentType, 'PARTIAL');
  assert.equal(order.outstandingBeforePaise, 12345);
  assert.equal(f.state.requestedAmount, 3200);
  assert.equal(f.state.items[0].due, 12345);
  assert.equal(f.state.allocations, 0);
  f.state.gateway[0].order_id = 'recovered-order';
  f.state.gateway[0].amount = 3200;
  await f.service.reconcile('internal');
  await f.service.reconcile('internal');
  assert.equal(f.row.status, 'SUCCESSFUL');
  assert.equal(f.row.remainingAfterPaise, 9145);
  assert.equal(f.state.items[0].due, 9145);
  assert.equal(f.state.items[0].status, 'OUTSTANDING');
  assert.equal(f.state.allocations, 1);
});
test('concurrent partial orders reuse one reservation and reject another amount until reconciliation', async () => {
  const f = fixture();
  f.state.noActive = true;
  f.row.orderId = null;
  const results = await Promise.allSettled([
    f.service.create('lodge', { id: 'owner' }, 3200, 'PARTIAL'),
    f.service.create('lodge', { id: 'owner' }, 4000, 'PARTIAL'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(f.state.writes, 1);
  assert.equal(f.row.amountPaise, 3200);
  await assert.rejects(
    f.service.create('lodge', { id: 'owner' }, 5000, 'PARTIAL'),
    /original amount/,
  );
});
test('partial amount validation happens against current server debt before any gateway write', async () => {
  for (const amount of [0, -1, 3.2, 12346]) {
    const f = fixture();
    f.state.noActive = true;
    f.row.orderId = null;
    await assert.rejects(f.service.create('lodge', { id: 'owner' }, amount, 'PARTIAL'));
    assert.equal(f.state.writes, 0);
    assert.equal(f.state.allocations, 0);
  }
});
test('a cancelled booking or already settled ledger cannot be paid by resuming an old checkout', async () => {
  const f = fixture();
  f.state.items[0].due = 0;
  f.state.items[0].eligible = false;
  const result = await f.service.create('lodge', { id: 'owner' }, 12345);
  assert.equal(result.status, 'RECOVERY_REQUIRED');
  assert.equal(f.state.writes, 0);
  assert.equal(f.state.allocations, 0);
});

test('manual commission receipts require an offline method, receipt evidence and explanation', async () => {
  let transactions = 0;
  const service = new LodgeCommissionFinanceService(
    {},
    { assertLodgeExists: async () => {} },
    {
      $transaction: async () => {
        transactions++;
      },
    },
  );
  for (const dto of [
    { amount: 1, paymentMethod: 'RAZORPAY', reference: 'pay_id', notes: 'gateway' },
    { amount: 1, paymentMethod: 'BANK_TRANSFER', reference: 'bank_ref' },
    { amount: 1, paymentMethod: 'CASH', notes: 'cash' },
  ])
    await assert.rejects(
      service.createSettlement('lodge', dto, 'admin'),
      /Offline commission receipts/,
    );
  assert.equal(transactions, 0);
});
test('manual ledger voids cannot race a reserved or settled gateway payment', async () => {
  let writes = 0;
  let reserved = true;
  const db = {
    $queryRaw: async (q) => {
      const s = sql(q);
      if (s.includes('booking_id AS')) return [{ bookingId: 'booking', lodgeId: 'lodge' }];
      if (s.includes('SELECT p.id')) return reserved ? [{ id: 'payment' }] : [];
      if (s.includes('AS allocated'))
        return [{ lodgeId: 'lodge', status: 'SETTLED', allocated: '123.45' }];
      return [];
    },
    $executeRaw: async () => {
      writes++;
    },
  };
  db.$transaction = (fn) => fn(db);
  const service = new LodgeCommissionFinanceService({}, {}, db);
  await assert.rejects(service.voidTransaction('ledger', 'admin'), /reserved gateway/);
  reserved = false;
  await assert.rejects(service.voidTransaction('ledger', 'admin'), /settled commission/);
  assert.equal(writes, 0);
});
test('CSV exports quote cells, protect spreadsheet formulas and include report context', async () => {
  const file = await financeExport(
    'Commission',
    'Lodge | 2026-11-16',
    ['Guest', 'INR'],
    [['=HYPERLINK("x")', '123.45']],
    'csv',
  );
  const csv = Buffer.from(file.base64, 'base64').toString('utf8');
  assert.match(csv, /Tuljai Stays/);
  assert.match(csv, /2026-11-16/);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /123.45/);
});
test('Razorpay signature checks reject tampered order references and unsigned webhooks', async () => {
  const { createHmac } = await import('node:crypto');
  const previous = process.env.RAZORPAY_KEY_SECRET;
  const hook = process.env.RAZORPAY_WEBHOOK_SECRET;
  try {
    process.env.RAZORPAY_KEY_SECRET = 'test-only';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-hook';
    const provider = new RazorpayProvider();
    const signature = createHmac('sha256', 'test-only').update('order|pay').digest('hex');
    assert.equal(
      (await provider.verifyPayment({ orderId: 'order', paymentId: 'pay', signature })).verified,
      true,
    );
    assert.equal(
      (await provider.verifyPayment({ orderId: 'tampered', paymentId: 'pay', signature })).verified,
      false,
    );
    assert.equal(provider.verifyWebhook(Buffer.from('{}'), '0'.repeat(64)), false);
  } finally {
    if (previous === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previous;
    if (hook === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = hook;
  }
});
