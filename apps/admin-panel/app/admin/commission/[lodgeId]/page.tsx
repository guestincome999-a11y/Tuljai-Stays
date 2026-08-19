'use client';

import type { LodgeCommissionFinanceReport } from '@tuljai/types';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';

import {
  createLodgeCommissionSettlement,
  getLodgeCommissionFinanceReport,
  voidLodgeCommissionTransaction,
} from '../../../../src/api/admin-bi-api';
import { PermissionGate } from '../../../../src/components/PermissionGate';

function money(value: string | number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LodgeCommissionDetailPage({ params }: { params: Promise<{ lodgeId: string }> }) {
  const { lodgeId } = use(params);
  const [report, setReport] = useState<LodgeCommissionFinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await getLodgeCommissionFinanceReport(lodgeId));
    } catch {
      setError('Could not load this lodge commission account.');
    } finally {
      setLoading(false);
    }
  }, [lodgeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function settle() {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid settlement amount.');
      return;
    }
    setError('');
    setMessage('');
    try {
      setReport(await createLodgeCommissionSettlement(lodgeId, {
        amount: numericAmount,
        paymentMethod: method,
        reference: reference || undefined,
        notes: notes || undefined,
      }));
      setAmount('');
      setReference('');
      setNotes('');
      setMessage('Settlement recorded and allocated against the oldest outstanding commission first.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settlement could not be recorded.');
    }
  }

  async function voidTransaction(id: string) {
    if (!window.confirm('Void this outstanding commission transaction?')) return;
    setError('');
    try {
      await voidLodgeCommissionTransaction(id);
      setMessage('Commission transaction voided.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction could not be voided.');
    }
  }

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Finance · Commission Account</p>
            <h2>{loading ? 'Loading…' : report?.lodgeName ?? 'Lodge commission'}</h2>
            <p className="muted-copy">Detailed lodge revenue, commission accounting, settlement history and transaction history.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="button button-secondary" href="/admin/commission">Back to lodges</Link>
            <button className="button button-primary" type="button" onClick={() => void load()}>Refresh</button>
          </div>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}
        {message ? <section className="success-banner">{message}</section> : null}

        {report ? <>
          <section className="grid grid-4">
            <Metric label="Booking revenue" value={money(report.summary.bookingRevenue)} />
            <Metric label="Commission receivable" value={money(report.summary.commissionReceivable)} />
            <Metric label="Outstanding" value={money(report.summary.outstanding)} />
            <Metric label="Settled" value={money(report.summary.settled)} />
          </section>

          <section className="grid grid-2">
            <section className="panel">
              <p className="eyebrow">Active accounting rule</p>
              <h3>Commission configuration</h3>
              <div className="feed-list">
                <Insight label="Status" value={report.setting.commissionEnabled ? 'Enabled' : 'Disabled'} />
                <Insight label="Method" value={report.setting.commissionType === 'FIXED_PER_BOOKING' ? 'Fixed per booking' : 'Percentage'} />
                <Insight label="Rate" value={report.setting.commissionType === 'PERCENTAGE' ? `${report.setting.commissionRatePercent}%` : '—'} />
                <Insight label="Fixed amount" value={report.setting.commissionType === 'FIXED_PER_BOOKING' ? money(report.setting.commissionFixedAmount) : '—'} />
                <Insight label="Effective from" value={new Date(report.setting.effectiveFrom).toLocaleString('en-IN')} />
              </div>
            </section>

            <section className="panel">
              <p className="eyebrow">History Manager · Settlement</p>
              <h3>Record lodge payment</h3>
              <p className="muted-copy">Every settlement is stored separately and allocated against the oldest outstanding commission transactions first.</p>
              <div className="form-grid">
                <label>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" /></label>
                <label>Method<select value={method} onChange={(e) => setMethod(e.target.value)}><option value="BANK_TRANSFER">Bank transfer</option><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>
                <label>Reference<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt / transaction reference" /></label>
                <label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional accounting note" /></label>
              </div>
              <button className="button button-primary" type="button" onClick={() => void settle()}>Record settlement</button>
            </section>
          </section>

          <section className="table-panel">
            <div className="section-heading">
              <div><p className="eyebrow">Commission History Manager</p><h3>Booking-level accounting ledger</h3></div>
            </div>
            <div className="admin-table">
              <div className="admin-table-row admin-table-head"><span>Booking</span><span>Base revenue</span><span>Rule snapshot</span><span>Commission</span><span>Eligible</span><span>Status</span><span>Action</span></div>
              {report.transactions.map((row) => <div className="admin-table-row" key={row.id}>
                <span><strong>{row.bookingCode}</strong><small>{row.checkInDate} → {row.checkOutDate}</small></span>
                <span>{money(row.baseAmount)}</span>
                <span>{row.commissionType === 'FIXED_PER_BOOKING' ? `Fixed ${money(row.commissionFixedAmount)}` : `${row.commissionRatePercent}%`}</span>
                <span>{money(row.commissionAmount)}</span>
                <span>{new Date(row.eligibleAt).toLocaleDateString('en-IN')}</span>
                <span>{row.status}</span>
                <span>{row.status === 'OUTSTANDING' ? <button className="button button-secondary" type="button" onClick={() => void voidTransaction(row.id)}>Void</button> : '—'}</span>
              </div>)}
              {!report.transactions.length ? <p className="muted-copy">No payable commission transactions yet. Completed eligible bookings will appear here automatically.</p> : null}
            </div>
          </section>

          <section className="table-panel">
            <div className="section-heading"><div><p className="eyebrow">Settlement History</p><h3>Immutable payment records</h3></div></div>
            <div className="admin-table">
              <div className="admin-table-row admin-table-head"><span>Date</span><span>Amount</span><span>Method</span><span>Reference</span><span>Notes</span></div>
              {report.settlements.map((row) => <div className="admin-table-row" key={row.id}>
                <span>{new Date(row.settledAt).toLocaleString('en-IN')}</span><span>{money(row.amount)}</span><span>{row.paymentMethod}</span><span>{row.reference ?? '—'}</span><span>{row.notes ?? '—'}</span>
              </div>)}
              {!report.settlements.length ? <p className="muted-copy">No settlements recorded.</p> : null}
            </div>
          </section>
        </> : null}
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="kpi-card"><span className="kpi-icon">INR</span><div><span className="kpi-label">{label}</span><strong>{value}</strong></div></div>;
}

function Insight({ label, value }: { label: string; value: string }) {
  return <article className="feed-item"><span>{label}</span><strong>{value}</strong></article>;
}
