'use client';

import type {
  AdminPaymentRow,
  AdminPaymentsPage,
  PaymentCollectionMethod,
  PaymentCollectionStatus,
} from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listAdminPayments } from '../../api/finance-admin-api';
import { formatDate, formatInr } from '../dashboard/format';

import { FinanceStyles } from './FinanceStyles';
import { FinKpi, FinPanel, FinPill } from './FinanceUi';
import type { FinTone } from './FinanceUi';

export interface PaymentsPreset {
  /** Fixed payment method for this view (Razorpay = ONLINE, Pay at lodge = PAY_AT_LODGE). */
  method?: PaymentCollectionMethod;
  note: string;
  /** Fixed status for this view (Refunds = REFUNDED); hides the status filter chips. */
  status?: PaymentCollectionStatus;
}

const STATUS_LABEL: Record<PaymentCollectionStatus, string> = {
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  PAID: 'Successful',
  PENDING: 'Pending',
  REFUNDED: 'Refunded',
};

const STATUS_TONE: Record<PaymentCollectionStatus, FinTone> = {
  CANCELLED: 'gray',
  FAILED: 'red',
  PAID: 'green',
  PENDING: 'orange',
  REFUNDED: 'purple',
};

function plural(count: number): string {
  return `${count} ${count === 1 ? 'payment' : 'payments'}`;
}

const FILTERS: Array<PaymentCollectionStatus | 'ALL'> = ['ALL', 'PAID', 'PENDING', 'FAILED', 'CANCELLED', 'REFUNDED'];

export function PaymentsView({ preset }: { preset: PaymentsPreset }) {
  const [filter, setFilter] = useState<PaymentCollectionStatus | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminPaymentsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const status = preset.status ?? (filter === 'ALL' ? undefined : filter);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listAdminPayments({ method: preset.method, page, search, status })
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch(() => {
        if (active) setError('Could not load payments. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preset.method, page, search, status]);

  const counts = new Map((data?.statusCounts ?? []).map((item) => [item.status, item]));
  const total = (data?.statusCounts ?? []).reduce((sum, item) => sum + item.count, 0);
  const notCollected = Number(counts.get('FAILED')?.amount ?? 0) + Number(counts.get('CANCELLED')?.amount ?? 0);

  return (
    <div className="fin-stack">
      <FinanceStyles />
      <p className="fin-note">{preset.note}</p>

      <section aria-label="Payment totals" className="fin-kpis">
        <FinKpi icon="check" label="Successful" meta={plural(counts.get('PAID')?.count ?? 0)} tone="green" value={formatInr(Number(counts.get('PAID')?.amount ?? 0))} />
        <FinKpi icon="clock" label="Pending" meta={plural(counts.get('PENDING')?.count ?? 0)} tone="orange" value={formatInr(Number(counts.get('PENDING')?.amount ?? 0))} />
        <FinKpi icon="card" label="Failed or cancelled" meta={`${formatInr(notCollected)} not collected`} tone="red" value={(counts.get('FAILED')?.count ?? 0) + (counts.get('CANCELLED')?.count ?? 0)} />
        <FinKpi icon="receipt" label="Refunded" meta={plural(counts.get('REFUNDED')?.count ?? 0)} tone="purple" value={formatInr(Number(counts.get('REFUNDED')?.amount ?? 0))} />
      </section>

      <FinPanel sub={data ? plural(data.totalItems) : undefined} title="Payment records">
        <div className="fin-toolbar">
          {preset.status ? null : (
            <div aria-label="Filter by status" className="fin-chip-row" role="group">
              {FILTERS.map((item) => (
                <button
                  aria-pressed={filter === item}
                  className={filter === item ? 'fin-filter fin-filter-active' : 'fin-filter'}
                  key={item}
                  onClick={() => {
                    setFilter(item);
                    setPage(1);
                  }}
                  type="button"
                >
                  {item === 'ALL' ? 'All' : STATUS_LABEL[item]}
                  <b>{item === 'ALL' ? total : (counts.get(item)?.count ?? 0)}</b>
                </button>
              ))}
            </div>
          )}
          <input
            aria-label="Search payments"
            className="fin-search"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search booking, guest or payment ID"
            type="search"
            value={searchInput}
          />
        </div>

        {error ? <p className="error-banner" role="alert">{error}</p> : null}
        {loading && !data ? <div aria-label="Loading" className="fin-skeleton" /> : null}
        {data && data.items.length === 0 ? <p className="fin-empty">No payments match these filters.</p> : null}
        {data && data.items.length > 0 ? (
          <div className="fin-scroll">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Lodge</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th className="fin-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row: AdminPaymentRow) => (
                  <tr key={row.id}>
                    <td><Link className="fin-link" href={`/admin/bookings/${row.bookingId}`}>{row.bookingCode}</Link></td>
                    <td>{row.guestName}</td>
                    <td>{row.lodgeName}</td>
                    <td>{row.method === 'ONLINE' ? (row.provider ? `Online · ${row.provider}` : 'Online') : 'Pay at lodge'}</td>
                    <td><FinPill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</FinPill></td>
                    <td className="fin-mono">{row.providerPaymentId ?? row.providerOrderId ?? '—'}</td>
                    <td>{formatDate(row.paidAt ?? row.createdAt)}</td>
                    <td className="fin-num">{formatInr(Number(row.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <div className="fin-pager">
            <span>Page {data.page} of {data.totalPages} · {plural(data.totalItems)}</span>
            <button className="fin-btn fin-btn-sm fin-btn-soft" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <button className="fin-btn fin-btn-sm fin-btn-soft" disabled={page >= data.totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        ) : null}
      </FinPanel>
    </div>
  );
}
