'use client';

import type { LodgeCommissionFinanceReport } from '@tuljai/types';
import { useState } from 'react';
import type { ReactNode } from 'react';

type Transaction = LodgeCommissionFinanceReport['transactions'][number];
type Settlement = LodgeCommissionFinanceReport['settlements'][number];
type Setting = LodgeCommissionFinanceReport['setting'];

export type FinTone = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'gray';
export type FinIconName = 'bank' | 'calendar' | 'card' | 'chart' | 'check' | 'clock' | 'lodge' | 'money' | 'percent' | 'receipt';

/* ------------------------------------------------------------ formatting */

export function formatMoney(value: string | number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function formatLabel(value: string): string {
  const text = value.replace(/_/gu, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ledgerTone(status: string): FinTone {
  if (status === 'OUTSTANDING') return 'orange';
  if (status === 'SETTLED' || status === 'PAID') return 'green';
  if (status.includes('VOID')) return 'gray';
  return 'blue';
}

/* ----------------------------------------------------------------- icons */

const ICONS: Record<FinIconName, ReactNode> = {
  bank: <path d="M3 10 12 4l9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" />,
  calendar: (
    <>
      <rect height="15" rx="2" width="16" x="4" y="5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  card: (
    <>
      <rect height="13" rx="2" width="18" x="3" y="6" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  chart: <path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  lodge: <path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6" />,
  money: <path d="M7 5h10M7 9h10M7 5c5 0 5 8 0 8h-1l7 6" />,
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2" />
      <circle cx="16.5" cy="16.5" r="2" />
    </>
  ),
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
};

export function FinIcon({ name, tone }: { name: FinIconName; tone?: FinTone }) {
  return (
    <span className={tone ? `fin-ico fin-ico-${tone}` : 'fin-ico'}>
      <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
        {ICONS[name]}
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------ primitives */

export function FinHeader({ actions, description, eyebrow, title }: { actions?: ReactNode; description: string; eyebrow: string; title: ReactNode }) {
  return (
    <header className="fin-head">
      <div className="fin-head-text">
        <p className="fin-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="fin-desc">{description}</p>
      </div>
      {actions ? <div className="fin-head-actions">{actions}</div> : null}
    </header>
  );
}

export function FinKpi({ icon, label, meta, tone, value }: { icon: FinIconName; label: string; meta?: ReactNode; tone: Exclude<FinTone, 'gray'>; value: ReactNode }) {
  return (
    <article className={`fin-kpi fin-kpi-${tone}`}>
      <FinIcon name={icon} />
      <span className="fin-kpi-label">{label}</span>
      <strong className="fin-kpi-value">{value}</strong>
      <span className="fin-kpi-meta">{meta ?? ' '}</span>
    </article>
  );
}

export function FinPanel({ action, children, sub, title }: { action?: ReactNode; children: ReactNode; sub?: ReactNode; title: string }) {
  return (
    <section className="fin-panel">
      <div className="fin-panel-head">
        <div className="fin-panel-title">
          <h2>{title}</h2>
          {sub ? <span className="fin-panel-sub">{sub}</span> : null}
        </div>
        {action}
      </div>
      <div className="fin-panel-body">{children}</div>
    </section>
  );
}

export function FinKv({ rows, twoColumns }: { rows: Array<{ label: string; value: ReactNode }>; twoColumns?: boolean }) {
  return (
    <div className={twoColumns ? 'fin-kv fin-kv-2' : 'fin-kv'}>
      {rows.map((row) => (
        <div className="fin-kv-row" key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function FinPill({ children, tone }: { children: ReactNode; tone: FinTone }) {
  return <span className={`fin-pill fin-pill-${tone}`}>{children}</span>;
}

export function FinBanners({ error, message }: { error?: string | null; message?: string | null }) {
  return (
    <>
      {error ? <p className="error-banner" role="alert">{error}</p> : null}
      {message ? <p className="success-banner" role="status">{message}</p> : null}
    </>
  );
}

/* ---------------------------------------------------- commission account */

export function RuleSummary({ setting }: { setting: Setting }) {
  const fixed = setting.commissionType === 'FIXED_PER_BOOKING';
  return (
    <FinKv
      rows={[
        { label: 'Status', value: <FinPill tone={setting.commissionEnabled ? 'green' : 'gray'}>{setting.commissionEnabled ? 'Enabled' : 'Disabled'}</FinPill> },
        { label: 'Method', value: fixed ? 'Fixed per booking' : 'Percentage' },
        { label: 'Rate', value: fixed ? '—' : `${setting.commissionRatePercent}%` },
        { label: 'Fixed amount', value: fixed ? formatMoney(setting.commissionFixedAmount) : '—' },
        { label: 'Effective from', value: new Date(setting.effectiveFrom).toLocaleString('en-IN') },
      ]}
    />
  );
}

export interface SettlementFormValues {
  amount: number;
  notes?: string;
  paymentMethod: string;
  reference?: string;
}

/** Settlement entry form. `onSubmit` resolves true when the settlement was recorded, which clears the form. */
export function SettlementForm({ onSubmit }: { onSubmit: (values: SettlementFormValues) => Promise<boolean> }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setProblem('Enter a valid settlement amount.');
      return;
    }
    setProblem('');
    setBusy(true);
    try {
      const saved = await onSubmit({
        amount: numeric,
        notes: notes || undefined,
        paymentMethod: method,
        reference: reference || undefined,
      });
      if (saved) {
        setAmount('');
        setReference('');
        setNotes('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fin-form">
        <label className="fin-field">
          <span>Amount</span>
          <input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} />
        </label>
        <label className="fin-field">
          <span>Payment method</span>
          <select onChange={(event) => setMethod(event.target.value)} value={method}>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="fin-field fin-field-wide">
          <span>Reference</span>
          <input onChange={(event) => setReference(event.target.value)} placeholder="Receipt / transaction reference" value={reference} />
        </label>
        <label className="fin-field fin-field-wide">
          <span>Notes</span>
          <textarea onChange={(event) => setNotes(event.target.value)} placeholder="Optional accounting note" rows={3} value={notes} />
        </label>
        {problem ? <p className="fin-field-error" role="alert">{problem}</p> : null}
      </div>
      <div className="fin-actions fin-actions-end">
        <button className="fin-btn fin-btn-violet" disabled={busy} onClick={() => void submit()} type="button">
          {busy ? 'Recording…' : 'Record settlement'}
        </button>
      </div>
    </>
  );
}

export function LedgerTable({ onVoid, transactions }: { onVoid: (id: string) => void; transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return <p className="fin-empty">No payable commission transactions yet. Completed eligible bookings will appear here automatically.</p>;
  }
  return (
    <div className="fin-scroll">
      <table className="fin-table">
        <thead>
          <tr>
            <th>Booking</th>
            <th className="fin-num">Base revenue</th>
            <th>Rule</th>
            <th className="fin-num">Commission</th>
            <th>Eligible</th>
            <th>Status</th>
            <th className="fin-num">Action</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((row) => (
            <tr key={row.id}>
              <td>
                <b>{row.bookingCode}</b>
                <span className="fin-cell-sub">{row.checkInDate} → {row.checkOutDate}</span>
              </td>
              <td className="fin-num">{formatMoney(row.baseAmount)}</td>
              <td>{row.commissionType === 'FIXED_PER_BOOKING' ? `Fixed ${formatMoney(row.commissionFixedAmount)}` : `${row.commissionRatePercent}%`}</td>
              <td className="fin-num">{formatMoney(row.commissionAmount)}</td>
              <td>{new Date(row.eligibleAt).toLocaleDateString('en-IN')}</td>
              <td><FinPill tone={ledgerTone(row.status)}>{formatLabel(row.status)}</FinPill></td>
              <td className="fin-num">
                {row.status === 'OUTSTANDING' ? (
                  <button className="fin-btn fin-btn-sm fin-btn-danger" onClick={() => onVoid(row.id)} type="button">Void</button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SettlementHistoryTable({ settlements }: { settlements: Settlement[] }) {
  if (settlements.length === 0) return <p className="fin-empty">No settlements recorded.</p>;
  return (
    <div className="fin-scroll">
      <table className="fin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Notes</th>
            <th className="fin-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {settlements.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.settledAt).toLocaleString('en-IN')}</td>
              <td>{formatLabel(row.paymentMethod)}</td>
              <td className="fin-mono">{row.reference ?? '—'}</td>
              <td>{row.notes ?? '—'}</td>
              <td className="fin-num">{formatMoney(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
