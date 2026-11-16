'use client';

import type {
  CommissionHistoryPage,
  CommissionPaymentDetail,
  LodgeCommissionOverviewRow,
} from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '../../api/client';

import { FinBanners, FinKpi, FinPanel, FinPill, formatMoney } from './FinanceUi';

type ExportFile = { filename: string; base64: string; mimeType?: string };
function download(report: ExportFile) {
  const bytes = Uint8Array.from(atob(report.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: report.mimeType ?? 'application/pdf' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = report.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const time = (v: string) => new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
export function CommissionPaymentHistory({ lodges }: { lodges: LodgeCommissionOverviewRow[] }) {
  const [result, setResult] = useState<CommissionHistoryPage | null>(null);
  const [detail, setDetail] = useState<CommissionPaymentDetail | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    startDate: '',
    endDate: '',
    status: '',
    lodgeId: '',
    ownerId: '',
    sort: 'date',
    direction: 'desc',
  });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const params = Object.fromEntries(
    Object.entries({ ...filters, page, limit: 30 }).filter(([, v]) => v !== ''),
  );
  const load = useCallback(
    async (signal: { active: boolean }) => {
      setError('');
      setResult(null);
      try {
        const response = await apiClient.get<CommissionHistoryPage>('/admin/commission/payments', {
          params: Object.fromEntries(
            Object.entries({ ...filters, page, limit: 30 }).filter(([, v]) => v !== ''),
          ),
        });
        if (signal.active) setResult(response);
      } catch (e) {
        if (signal.active)
          setError(
            e instanceof Error ? e.message : 'Commission payment history could not be loaded.',
          );
      }
    },
    [filters, page],
  );
  useEffect(() => {
    const signal = { active: true };
    void load(signal);
    return () => {
      signal.active = false;
    };
  }, [load, revision]);
  function filter(key: string, value: string) {
    setFilters((p) => ({ ...p, [key]: value }));
    setPage(1);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action could not be completed.');
    } finally {
      setBusy(false);
    }
  }
  const summary = result?.summary;
  return (
    <div className="fin-stack">
      <FinBanners error={error} />
      <section className="fin-kpis" aria-label="Owner commission collections">
        <FinKpi
          icon="money"
          label="Total Commission Received"
          meta="Verified gateway collections · selected filters"
          tone="green"
          value={summary ? formatMoney(summary.receivedPaise / 100) : '—'}
        />
        <FinKpi
          icon="clock"
          label="Pending Commission"
          meta="All-time unpaid lodge-collected commission"
          tone="orange"
          value={summary ? formatMoney(summary.pending) : '—'}
        />
        <FinKpi
          icon="receipt"
          label="Total Payments Received"
          meta="Successful verified payments · selected filters"
          tone="blue"
          value={summary ? String(summary.receivedCount) : '—'}
        />
        <FinKpi
          icon="lodge"
          label="Owners with Outstanding Commission"
          meta="All-time payable balances"
          tone="purple"
          value={summary ? String(summary.owners) : '—'}
        />
      </section>
      <FinPanel
        title="Commission Payment History"
        sub="Payments collected from owners through the Owner App. Revenue transfers to owners are recorded separately."
      >
        <form
          className="commission-filters"
          onSubmit={(e) => {
            e.preventDefault();
            filter('search', search);
          }}
        >
          <label>
            Search owner, lodge or transaction
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, order, payment or reference"
            />
          </label>
          <button className="fin-btn fin-btn-primary" type="submit">
            Search
          </button>
          <label>
            From
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => filter('startDate', e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => filter('endDate', e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(e) => filter('status', e.target.value)}>
              <option value="">All statuses</option>
              {[
                'SUCCESSFUL',
                'PENDING',
                'FAILED',
                'CANCELLED',
                'REFUNDED',
                'RECOVERY_REQUIRED',
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lodge
            <select value={filters.lodgeId} onChange={(e) => filter('lodgeId', e.target.value)}>
              <option value="">All lodges</option>
              {lodges.map((l) => (
                <option key={l.lodgeId} value={l.lodgeId}>
                  {l.lodgeName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Owner ID
            <input
              value={filters.ownerId}
              onChange={(e) => filter('ownerId', e.target.value)}
              placeholder="Exact owner UUID"
            />
          </label>
          <label>
            Sort
            <select value={filters.sort} onChange={(e) => filter('sort', e.target.value)}>
              <option value="date">Date</option>
              <option value="amount">Amount</option>
            </select>
          </label>
          <label>
            Direction
            <select value={filters.direction} onChange={(e) => filter('direction', e.target.value)}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </form>
        <div className="fin-actions">
          <button
            disabled={busy}
            className="fin-btn fin-btn-outline"
            onClick={() => setRevision((r) => r + 1)}
          >
            Refresh
          </button>
          {['csv', 'pdf'].map((format) => (
            <button
              disabled={busy}
              className="fin-btn fin-btn-outline"
              key={format}
              onClick={() =>
                void run(async () => {
                  download(
                    await apiClient.get<ExportFile>('/admin/commission/payments/export', {
                      params: { ...params, format },
                      timeout: 120000,
                    }),
                  );
                })
              }
            >
              Export {format.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="fin-actions">
          <button
            disabled={busy}
            className="fin-btn fin-btn-outline"
            onClick={() =>
              void run(async () =>
                download(
                  await apiClient.get<ExportFile>('/admin/commission/outstanding/export', {
                    params: { format: 'csv' },
                  }),
                ),
              )
            }
          >
            Export owner outstanding CSV
          </button>
          <button
            disabled={busy}
            className="fin-btn fin-btn-outline"
            onClick={() =>
              void run(async () =>
                download(
                  await apiClient.get<ExportFile>('/admin/commission/collections/export', {
                    params: { ...params, format: 'csv' },
                  }),
                ),
              )
            }
          >
            Export daily collections CSV
          </button>
        </div>
        <div className="commission-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                {[
                  'Payment date & time (IST)',
                  'Owner',
                  'Lodge',
                  'Owner ID',
                  'Payment reference',
                  'Razorpay Order ID',
                  'Razorpay Payment ID',
                  'Commission Amount',
                  'Method',
                  'Status',
                  'Payment type',
                  'Remaining after payment',
                  'Current outstanding',
                  'Action',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result?.items.map((p) => (
                <tr key={p.id}>
                  <td>{time(p.verifiedAt ?? p.createdAt)}</td>
                  <td>{p.ownerName}</td>
                  <td>
                    <Link href={`/admin/commission/${p.lodgeId}`}>{p.lodgeName}</Link>
                  </td>
                  <td>{p.ownerId}</td>
                  <td>{p.id}</td>
                  <td>{p.orderId ?? 'Pending'}</td>
                  <td>{p.paymentId ?? '—'}</td>
                  <td>{formatMoney(p.amountPaise / 100)}</td>
                  <td>{p.method ?? '—'}</td>
                  <td>
                    <FinPill
                      tone={
                        p.status === 'SUCCESSFUL'
                          ? 'green'
                          : p.status === 'RECOVERY_REQUIRED'
                            ? 'red'
                            : 'orange'
                      }
                    >
                      {p.status.replace(/_/g, ' ')}
                    </FinPill>
                  </td>
                  <td>{p.paymentType === 'PARTIAL' ? 'Partial' : 'Full'}</td>
                  <td>
                    {p.remainingAfterPaise === null
                      ? 'Not yet recorded'
                      : formatMoney(p.remainingAfterPaise / 100)}
                  </td>
                  <td>{formatMoney(p.currentOutstandingPaise / 100)}</td>
                  <td>
                    <button
                      disabled={busy}
                      className="fin-btn fin-btn-outline"
                      onClick={() =>
                        void run(async () =>
                          setDetail(
                            await apiClient.get<CommissionPaymentDetail>(
                              `/admin/commission/payments/${p.id}`,
                            ),
                          ),
                        )
                      }
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {!result ? (
                <tr>
                  <td colSpan={14}>
                    {error ? 'History unavailable.' : 'Loading payment history…'}
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={14}>No matching commission payments.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="fin-actions">
          <button
            disabled={page === 1 || busy}
            className="fin-btn fin-btn-outline"
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} · {result?.totalItems ?? '—'} payments
          </span>
          <button
            disabled={!result || page * 30 >= result.totalItems || busy}
            className="fin-btn fin-btn-outline"
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </FinPanel>
      {detail ? (
        <FinPanel
          title="Commission Payment Details"
          sub={`${detail.ownerName} · ${detail.lodgeName}`}
        >
          <div className="fin-actions">
            <button className="fin-btn fin-btn-outline" onClick={() => setDetail(null)}>
              Close details
            </button>
            <Link className="fin-btn fin-btn-outline" href={`/admin/commission/${detail.lodgeId}`}>
              View owner outstanding balance
            </Link>
            <button
              className="fin-btn fin-btn-outline"
              onClick={() => {
                setFilters((p) => ({
                  ...p,
                  ownerId: detail.ownerId,
                  lodgeId: '',
                  search: '',
                  status: '',
                  startDate: '',
                  endDate: '',
                }));
                setSearch('');
                setPage(1);
                setDetail(null);
              }}
            >
              All transactions by this owner
            </button>
            <button
              disabled={busy}
              className="fin-btn fin-btn-outline"
              onClick={() =>
                void run(async () => {
                  setDetail(
                    await apiClient.post<CommissionPaymentDetail>(
                      `/admin/commission/payments/${detail.id}/reconcile`,
                      {},
                    ),
                  );
                  setRevision((r) => r + 1);
                })
              }
            >
              Reconcile with Razorpay
            </button>
            <button
              disabled={busy || detail.status !== 'SUCCESSFUL'}
              className="fin-btn fin-btn-primary"
              onClick={() =>
                void run(async () =>
                  download(
                    await apiClient.get<ExportFile>(
                      `/owner/commission/payments/${detail.id}/receipt`,
                    ),
                  ),
                )
              }
            >
              Download receipt
            </button>
          </div>
          <dl className="commission-details">
            {Object.entries({
              Owner: detail.ownerName,
              'Owner ID': detail.ownerId,
              Lodge: detail.lodgeName,
              'Commission Amount': formatMoney(detail.amountPaise / 100),
              'Payment type': detail.paymentType === 'PARTIAL' ? 'Partial' : 'Full',
              'Outstanding when order created':
                detail.outstandingBeforePaise === null
                  ? 'Not recorded'
                  : formatMoney(detail.outstandingBeforePaise / 100),
              'Remaining after payment':
                detail.remainingAfterPaise === null
                  ? 'Not recorded'
                  : formatMoney(detail.remainingAfterPaise / 100),
              'Current outstanding commission': formatMoney(detail.currentOutstandingPaise / 100),
              'Current balance status':
                detail.currentOutstandingPaise === 0
                  ? 'Fully Paid'
                  : 'Partially Paid / Outstanding',
              Status: detail.status,
              'Payment date & time (IST)': detail.verifiedAt
                ? time(detail.verifiedAt)
                : 'Pending verification',
              Reference: detail.id,
              'Razorpay Order ID': detail.orderId,
              'Razorpay Payment ID': detail.paymentId,
              'Payment method': detail.method,
              'Gateway verified': detail.verifiedAt ? time(detail.verifiedAt) : 'No',
              'Webhook received': detail.webhookAt ? time(detail.webhookAt) : 'Not received',
              'Last reconciliation': detail.lastCheckedAt
                ? time(detail.lastCheckedAt)
                : 'Not checked',
              'Ledger settlement': detail.settlementId,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {detail.status === 'RECOVERY_REQUIRED' ? (
            <p role="alert">
              Captured funds require an audited financial review. No commission allocation was
              applied automatically. Review the gateway transaction and booking ledger before taking
              further action.
            </p>
          ) : null}
          <h3>Booking-wise commission · {detail.bookings.length} bookings</h3>
          <table className="fin-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Ledger entry</th>
                <th>Paid on this transaction</th>
                <th>Total commission paid</th>
                <th>Commission remaining</th>
                <th>Balance status</th>
              </tr>
            </thead>
            <tbody>
              {detail.bookings.map((b) => (
                <tr key={b.ledgerId}>
                  <td>
                    <Link href={`/admin/bookings/${b.bookingId}`}>{b.bookingCode}</Link>
                  </td>
                  <td>{b.ledgerId}</td>
                  <td>{formatMoney(b.amountPaise / 100)}</td>
                  <td>{formatMoney(b.totalPaidPaise / 100)}</td>
                  <td>{formatMoney(b.remainingPaise / 100)}</td>
                  <td>
                    {b.remainingPaise === 0
                      ? 'Fully Paid'
                      : b.totalPaidPaise > 0
                        ? 'Partially Paid'
                        : 'Payment Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td>{formatMoney(detail.bookings.reduce((s, b) => s + b.amountPaise, 0) / 100)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </FinPanel>
      ) : null}
      <style jsx>{`
        .commission-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: end;
          margin-bottom: 16px;
        }
        .commission-filters label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .commission-filters input,
        .commission-filters select {
          padding: 9px;
          border: 1px solid var(--color-outline);
          border-radius: 8px;
          background: var(--color-surface);
          color: inherit;
          max-width: 240px;
        }
        .commission-table-wrap {
          overflow: auto;
        }
        .commission-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 16px;
        }
        .commission-details dt {
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .commission-details dd {
          margin: 4px 0;
          overflow-wrap: anywhere;
        }
      `}</style>
    </div>
  );
}
