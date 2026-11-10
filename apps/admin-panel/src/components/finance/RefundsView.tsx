'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  getRefund,
  listRefunds,
  refundAction,
  type RefundDetail,
  type RefundPage,
  type RefundRow,
} from '../../api/refunds-api';
import { useAdminAuth } from '../../auth/AdminAuthProvider';
import { hasPermission } from '../../permissions/permissions';

import { FinanceStyles } from './FinanceStyles';
import { FinHeader, FinKpi, FinPanel, FinPill, formatMoney } from './FinanceUi';

const statuses = ['PENDING', 'INITIATED', 'PROCESSED', 'FAILED', 'NOT_REQUIRED'];
const money = (paise: number | null) =>
  paise === null ? 'Pending review' : formatMoney(paise / 100);
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—';

export function RefundsView() {
  const auth = useAdminAuth();
  const canManage = hasPermission(auth.permissions, 'finance.manage');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<RefundPage | null>(null);
  const [detail, setDetail] = useState<RefundDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await listRefunds(page, search, status));
      setError('');
    } catch {
      setError('Could not load refunds. Please retry.');
    }
  }, [page, search, status]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await listRefunds(page, search, status);
        if (active) {
          setData(result);
          setError('');
        }
      } catch {
        if (active) setError('Could not load refunds. Please retry.');
      }
    };
    const timer = setTimeout(() => void refresh(), 300);
    const interval = setInterval(() => void refresh(), 30000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [page, search, status]);

  async function action(id: string, operation: 'retry' | 'reconcile') {
    if (
      operation === 'retry' &&
      !window.confirm('Retry this failed refund after provider validation? This action is audited.')
    )
      return;
    setBusy(true);
    try {
      setDetail(await refundAction(id, operation));
      await load();
    } catch {
      setError(
        'Action could not complete. Reconcile to check the provider status before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv() {
    setBusy(true);
    try {
      const rows: RefundRow[] = [];
      for (let p = 1; ; p++) {
        const result = await listRefunds(p, search, status);
        rows.push(...result.items);
        if (p * result.pageSize >= result.totalItems) break;
      }
      const escape = (value: string | number | null) =>
        `"${String(value ?? '')
          .replace(/^\s*[=+@-]/, "'$&")
          .replace(/"/g, '""')}"`;
      const csv = [
        [
          'Booking',
          'Pilgrim',
          'Lodge',
          'Cancellation reason',
          'Payment ID',
          'Refund IDs',
          'Original paise',
          'Refund paise',
          'Status',
          'Cancelled',
          'Initiated',
          'Processed',
        ],
        ...rows.map((r) => [
          r.bookingReference,
          r.pilgrimName,
          r.lodgeName,
          r.cancellationReason,
          r.originalPaymentId,
          r.history
            .map((h) => h.providerRefundId)
            .filter(Boolean)
            .join(' '),
          r.originalAmountPaise,
          r.amountPaise,
          r.status,
          r.cancellationDate,
          r.initiatedAt,
          r.processedAt,
        ]),
      ]
        .map((r) => r.map(escape).join(','))
        .join('\r\n');
      const url = URL.createObjectURL(
        new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tuljai-refunds.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not export refunds.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fin-stack">
      <FinanceStyles />
      <FinHeader
        eyebrow="Finance"
        title="Refund Management"
        description="Cancellation refunds, provider reconciliation and audited recovery."
        actions={
          <>
            <button className="fin-btn" disabled={busy} onClick={() => void load()}>
              Refresh
            </button>
            <button
              className="fin-btn fin-btn-outline"
              disabled={busy}
              onClick={() => void exportCsv()}
            >
              Export records
            </button>
          </>
        }
      />
      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      <section className="fin-kpis">
        <FinKpi
          icon="receipt"
          label="Total refunds"
          value={String(data?.summary.reduce((s, r) => s + r.count, 0) ?? 0)}
          tone="blue"
        />
        <FinKpi
          icon="money"
          label="Total refunded"
          value={money(data?.summary.find((r) => r.status === 'PROCESSED')?.amountPaise ?? 0)}
          tone="green"
        />
        {statuses.slice(0, 4).map((s) => (
          <FinKpi
            key={s}
            icon="clock"
            label={s}
            value={String(data?.summary.find((r) => r.status === s)?.count ?? 0)}
            tone={s === 'FAILED' ? 'red' : 'orange'}
          />
        ))}
      </section>
      <FinPanel
        title="Refund records"
        sub="Amounts are validated against captured payments. Processed means provider confirmation, not confirmation of bank credit."
      >
        <div className="fin-filters">
          <input
            aria-label="Search refunds"
            className="fin-input"
            placeholder="Booking, pilgrim, lodge, payment or refund ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Refund status"
            className="fin-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {!data ? (
          <p className="fin-empty">Loading refunds…</p>
        ) : !data.items.length ? (
          <p className="fin-empty">No refunds match these filters.</p>
        ) : (
          <div className="fin-scroll">
            <table className="fin-table">
              <thead>
                <tr>
                  {[
                    'Booking / Pilgrim',
                    'Lodge / Reason',
                    'Payment / Refund ID',
                    'Original / Refund',
                    'Status',
                    'Cancellation / Initiation / Processing',
                    'Details',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="fin-link" href={`/admin/bookings/${row.bookingId}`}>
                        {row.bookingReference}
                      </Link>
                      <div>{row.pilgrimName}</div>
                    </td>
                    <td>
                      {row.lodgeName}
                      <div>{row.cancellationReason}</div>
                    </td>
                    <td>
                      {row.originalPaymentId ?? 'Awaiting capture'}
                      <div>{row.history.at(-1)?.providerRefundId ?? '—'}</div>
                    </td>
                    <td>
                      {money(row.originalAmountPaise)}
                      <div>{money(row.amountPaise)}</div>
                    </td>
                    <td>
                      <FinPill
                        tone={
                          row.status === 'FAILED'
                            ? 'red'
                            : row.status === 'PROCESSED'
                              ? 'green'
                              : 'orange'
                        }
                      >
                        {row.status}
                      </FinPill>
                    </td>
                    <td>
                      {date(row.cancellationDate)}
                      <div>{date(row.initiatedAt)}</div>
                      <div>{date(row.processedAt)}</div>
                    </td>
                    <td>
                      <button
                        className="fin-btn fin-btn-outline"
                        onClick={() =>
                          void getRefund(row.id)
                            .then(setDetail)
                            .catch(() => setError('Could not load refund details.'))
                        }
                      >
                        Open details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="fin-filters">
          <button className="fin-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} · {data?.totalItems ?? 0} records
          </span>
          <button
            className="fin-btn"
            disabled={!data || page * data.pageSize >= data.totalItems}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </FinPanel>
      {detail ? (
        <FinPanel
          title={`Refund · ${detail.bookingReference}`}
          action={
            <button className="fin-btn fin-btn-outline" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          <p>
            {detail.status} · {money(detail.amountPaise)}
          </p>
          {detail.failureReason ? <p role="alert">{detail.failureReason}</p> : null}
          {canManage ? (
            <div className="fin-filters">
              <button
                className="fin-btn"
                disabled={busy}
                onClick={() => void action(detail.id, 'reconcile')}
              >
                Reconcile provider
              </button>
              {detail.status === 'FAILED' ? (
                <button
                  className="fin-btn"
                  disabled={busy}
                  onClick={() => void action(detail.id, 'retry')}
                >
                  Retry eligible failed refund
                </button>
              ) : null}
            </div>
          ) : null}
          <h3>Refund history</h3>
          {detail.history.map((h) => (
            <p key={h.id}>
              {date(h.createdAt)} · {h.providerRefundId ?? h.receipt} · {h.status} ·{' '}
              {money(h.amount)} · {h.speed} {h.failureReason}
            </p>
          ))}
          <h3>Cancellation and deduction details</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(detail.cancellationDetails, null, 2)}
          </pre>
          <h3>Audit history</h3>
          {detail.audits.map((a) => (
            <p key={a.id}>
              {date(a.createdAt)} · {a.action} · {a.actorUserId ?? 'System'}
            </p>
          ))}
          <h3>Provider events</h3>
          {detail.events.map((e) => (
            <p key={e.id}>
              {e.eventType} · {e.processedAt ? 'Handled' : 'Awaiting reconciliation'} {e.lastError}
            </p>
          ))}
        </FinPanel>
      ) : null}
    </div>
  );
}
