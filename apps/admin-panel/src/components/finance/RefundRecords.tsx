'use client';

import Link from 'next/link';

import type { RefundPage, RefundRow } from '../../api/refunds-api';

import { FinPanel, FinPill, formatMoney, type FinTone } from './FinanceUi';

export const refundStatuses = ['PENDING', 'INITIATED', 'PROCESSED', 'FAILED', 'NOT_REQUIRED'];
const statusLabels: Record<string, string> = {
  NOT_REQUIRED: 'Not required',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
};
const statusTones: Record<string, FinTone> = {
  FAILED: 'red',
  PROCESSED: 'green',
  PAID: 'green',
  REFUNDED: 'purple',
  INITIATED: 'blue',
  CANCELLED: 'gray',
  NOT_REQUIRED: 'gray',
};
export const refundStatusLabel = (status: string) =>
  statusLabels[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
export const refundStatusTone = (status: string): FinTone => statusTones[status] ?? 'orange';
export const refundMoney = (paise: number | null) =>
  paise === null ? 'Under review' : formatMoney(paise / 100);
export const refundDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      })
    : '—';

export function RefundRecords({
  data,
  loading,
  search,
  status,
  page,
  onSearch,
  onStatus,
  onPage,
  onOpen,
}: {
  data: RefundPage | null;
  loading: boolean;
  search: string;
  status: string;
  page: number;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onPage: (value: number) => void;
  onOpen: (row: RefundRow) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((data?.totalItems ?? 0) / (data?.pageSize ?? 50)));
  const filtered = Boolean(search || status);
  return (
    <div className="refund-records">
      <FinPanel
        title="Refund records"
        sub="Follow each booking, payment and refund from one place."
        action={<span className="refund-record-count">{data?.totalItems ?? 0} records</span>}
      >
        <div className="refund-controls">
          <div className="refund-search-row">
            <label className="refund-search">
              <span className="refund-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
              </span>
              <input
                aria-label="Search refunds"
                type="search"
                placeholder="Search booking, pilgrim, lodge or payment ID…"
                value={search}
                onChange={(event) => onSearch(event.target.value)}
              />
            </label>
            <span className="refund-live-note">
              <span />
              {loading ? 'Updating records…' : 'Updates every 30 seconds'}
            </span>
          </div>
          <div className="refund-filter-row">
            <span className="refund-filter-label">Refund status</span>
            <div className="fin-chip-row" role="group" aria-label="Filter by refund status">
              {['', ...refundStatuses].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  className={`fin-filter${status === value ? ' fin-filter-active' : ''}`}
                  onClick={() => onStatus(value)}
                >
                  {value ? (
                    <span
                      aria-hidden="true"
                      className={`refund-status-dot refund-dot-${refundStatusTone(value)}`}
                    />
                  ) : null}
                  {value ? refundStatusLabel(value) : 'All refunds'}
                </button>
              ))}
            </div>
            {filtered ? (
              <button
                className="refund-clear"
                type="button"
                onClick={() => {
                  onSearch('');
                  onStatus('');
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
        <div className="refund-results-meta">
          <span>
            {loading && !data
              ? 'Loading refund records'
              : `${data?.totalItems ?? 0} ${data?.totalItems === 1 ? 'record' : 'records'}${filtered ? ' matching your filters' : ' in total'}`}
          </span>
          <span>Latest cancellations first</span>
        </div>
        {!data && loading ? (
          <div className="fin-skeleton" aria-label="Loading refund records" />
        ) : !data?.items.length ? (
          <div className="refund-empty">
            <span aria-hidden="true">↩</span>
            <h3>{filtered ? 'No matching refunds' : 'No refund records yet'}</h3>
            <p>
              {filtered
                ? 'Try a different booking reference or choose another status.'
                : 'Cancellation refunds will appear here when they are recorded.'}
            </p>
            {filtered ? (
              <button
                type="button"
                className="fin-btn fin-btn-soft"
                onClick={() => {
                  onSearch('');
                  onStatus('');
                }}
              >
                Show all refunds
              </button>
            ) : null}
          </div>
        ) : (
          <div className="fin-scroll refund-table-wrap" aria-busy={loading}>
            <table className="fin-table refund-table">
              <thead>
                <tr>
                  <th>Booking & pilgrim</th>
                  <th>Lodge & cancellation</th>
                  <th>Original payment</th>
                  <th className="fin-num">Refund amount</th>
                  <th>Refund status</th>
                  <th>Activity</th>
                  <th>
                    <span className="refund-visually-hidden">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        className="fin-link refund-booking-link"
                        href={`/admin/bookings/${row.bookingId}`}
                      >
                        {row.bookingReference}
                      </Link>
                      <span className="fin-cell-sub refund-guest">{row.pilgrimName}</span>
                      {row.bookingStatus ? (
                        <span className="refund-booking-state">
                          Booking {row.bookingStatus.toLowerCase().replaceAll('_', ' ')}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <strong className="refund-lodge">{row.lodgeName}</strong>
                      <span className="fin-cell-sub refund-reason">{row.cancellationReason}</span>
                    </td>
                    <td>
                      <FinPill tone={refundStatusTone(row.paymentStatus ?? '')}>
                        {row.paymentStatus
                          ? refundStatusLabel(row.paymentStatus)
                          : 'Status unavailable'}
                      </FinPill>
                      <code
                        className="fin-cell-sub refund-reference"
                        title={row.originalPaymentId ?? undefined}
                      >
                        {row.originalPaymentId ??
                          (row.paymentStatus === 'PENDING'
                            ? 'Awaiting confirmation'
                            : 'No captured payment ID')}
                      </code>
                      <span className="fin-cell-sub">
                        Original {refundMoney(row.originalAmountPaise)}
                      </span>
                    </td>
                    <td className="fin-num">
                      <strong className="refund-amount">{refundMoney(row.amountPaise)}</strong>
                      <span className="fin-cell-sub">
                        {row.status === 'NOT_REQUIRED'
                          ? 'No additional refund'
                          : 'To original payment method'}
                      </span>
                    </td>
                    <td>
                      <FinPill tone={refundStatusTone(row.status)}>
                        {refundStatusLabel(row.status)}
                      </FinPill>
                      <code
                        className="fin-cell-sub refund-reference"
                        title={row.history.at(-1)?.providerRefundId ?? undefined}
                      >
                        {row.history.at(-1)?.providerRefundId ??
                          (row.status === 'NOT_REQUIRED' ? '—' : 'Reference not issued yet')}
                      </code>
                    </td>
                    <td className="refund-activity">
                      <span>
                        <small>Cancelled</small>
                        {refundDate(row.cancellationDate)}
                      </span>
                      {row.initiatedAt ? (
                        <span>
                          <small>Initiated</small>
                          {refundDate(row.initiatedAt)}
                        </span>
                      ) : null}
                      {row.processedAt ? (
                        <span>
                          <small>Processed</small>
                          {refundDate(row.processedAt)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <button
                        className="fin-btn fin-btn-sm fin-btn-soft refund-open"
                        type="button"
                        aria-label={`View refund for ${row.bookingReference}`}
                        onClick={() => onOpen(row)}
                      >
                        Details <span aria-hidden="true">↗</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="fin-pager refund-pager">
          <span>
            Page {page} of {totalPages}
            <span className="refund-page-range">
              {data?.totalItems
                ? ` · ${(page - 1) * data.pageSize + 1}–${Math.min(page * data.pageSize, data.totalItems)} of ${data.totalItems}`
                : ''}
            </span>
          </span>
          <button
            className="fin-btn fin-btn-sm fin-btn-outline"
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
          >
            ← Previous
          </button>
          <button
            className="fin-btn fin-btn-sm fin-btn-soft"
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPage(page + 1)}
          >
            Next →
          </button>
        </div>
        <p className="refund-bank-note">
          Processed confirms the payment provider completed the refund. Your bank may take
          additional time to show the credit.
        </p>
      </FinPanel>
    </div>
  );
}
