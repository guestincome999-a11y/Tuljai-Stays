'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
import { FinHeader, FinKpi, FinKv, FinPanel, FinPill, formatMoney } from './FinanceUi';
import { RefundRecords, refundStatusLabel, refundStatusTone } from './RefundRecords';
import { RefundStyles } from './RefundStyles';

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
  const [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const load = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true);
    try {
      const result = await listRefunds(page, search, status);
      if (request !== revision.current) return;
      setData(result);
      setError('');
    } catch {
      if (request === revision.current) setError('Could not load refunds. Please retry.');
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [page, search, status]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    const interval = setInterval(() => void load(), 30000);
    return () => {
      ++revision.current;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [load]);

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
          'Booking status',
          'Payment status',
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
          r.bookingStatus ?? 'Unavailable',
          r.paymentStatus ?? 'Unavailable',
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
  const cancellation = detail?.cancellationDetails;
  const metadata: Record<string, unknown> =
    cancellation && typeof cancellation === 'object' && !Array.isArray(cancellation)
      ? (cancellation as Record<string, unknown>)
      : {};
  return (
    <div className="fin-stack">
      <FinanceStyles />
      <RefundStyles />
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
      <section className="fin-kpis refund-kpis">
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
            label={refundStatusLabel(s)}
            value={String(data?.summary.find((r) => r.status === s)?.count ?? 0)}
            tone={
              s === 'FAILED'
                ? 'red'
                : s === 'PROCESSED'
                  ? 'green'
                  : s === 'INITIATED'
                    ? 'blue'
                    : 'orange'
            }
          />
        ))}
      </section>
      <RefundRecords
        data={data}
        loading={loading}
        page={page}
        search={search}
        status={status}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onStatus={(value) => {
          setStatus(value);
          setPage(1);
        }}
        onPage={setPage}
        onOpen={(row) => {
          void getRefund(row.id)
            .then(setDetail)
            .catch(() => setError('Could not load refund details.'));
        }}
      />
      {detail ? (
        <div className="refund-details">
          <FinPanel
            title={`Refund · ${detail.bookingReference}`}
            action={
              <button className="fin-btn fin-btn-outline" onClick={() => setDetail(null)}>
                Close
              </button>
            }
          >
            <div className="refund-detail-summary">
              <div>
                <FinPill tone={refundStatusTone(detail.status)}>
                  {refundStatusLabel(detail.status)}
                </FinPill>
                <strong>{money(detail.amountPaise)}</strong>
              </div>
              <span className="fin-text">Refund to the original payment method</span>
            </div>
            <FinKv
              twoColumns
              rows={[
                {
                  label: 'Booking status',
                  value: detail.bookingStatus?.toLowerCase().replaceAll('_', ' ') ?? 'Unavailable',
                },
                {
                  label: 'Payment status',
                  value: detail.paymentStatus ? (
                    <FinPill tone={refundStatusTone(detail.paymentStatus)}>
                      {refundStatusLabel(detail.paymentStatus)}
                    </FinPill>
                  ) : (
                    'Unavailable'
                  ),
                },
                { label: 'Original payment', value: money(detail.originalAmountPaise) },
                {
                  label: 'Payment reference',
                  value: <code>{detail.originalPaymentId ?? 'No captured payment ID'}</code>,
                },
                { label: 'Cancellation reason', value: detail.cancellationReason },
                { label: 'Cancelled', value: date(detail.cancellationDate) },
                { label: 'Refund initiated', value: date(detail.initiatedAt) },
                { label: 'Refund processed', value: date(detail.processedAt) },
                ...(typeof metadata.percent === 'number'
                  ? [{ label: 'Refund policy', value: `${metadata.percent}% eligible` }]
                  : []),
                ...(typeof metadata.deductionPaise === 'number' && metadata.deductionPaise > 0
                  ? [{ label: 'Support deduction', value: money(metadata.deductionPaise) }]
                  : []),
                ...(typeof metadata.deductionReason === 'string' && metadata.deductionReason
                  ? [{ label: 'Deduction reason', value: metadata.deductionReason }]
                  : []),
              ]}
            />
            {Array.isArray(metadata.settledCommissionReview) &&
            metadata.settledCommissionReview.length ? (
              <p className="fin-note">
                This cancelled booking has existing commission settlement allocations requiring
                accounting review. Historical settlements have been preserved.
              </p>
            ) : null}
            {detail.failureReason ? (
              <p className="error-banner" role="alert">
                {detail.failureReason}
              </p>
            ) : null}
            {canManage ? (
              <div className="refund-detail-actions">
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
            <h3 className="refund-detail-heading">Refund history</h3>
            {!detail.history.length ? (
              <p className="fin-text">No refund has been submitted to the payment provider.</p>
            ) : null}
            {detail.history.map((h) => (
              <div className="refund-history-item" key={h.id}>
                <FinPill tone={refundStatusTone(h.status)}>{refundStatusLabel(h.status)}</FinPill>
                <strong>{money(h.amount)}</strong>
                <code>{h.providerRefundId ?? h.receipt}</code>
                <time>{date(h.createdAt)}</time>
                {h.failureReason ? <p>{h.failureReason}</p> : null}
              </div>
            ))}
            <h3 className="refund-detail-heading">Audit history</h3>
            {!detail.audits.length ? (
              <p className="fin-text">No additional refund actions recorded.</p>
            ) : null}
            {detail.audits.map((a) => (
              <div className="refund-audit-item" key={a.id}>
                <span>
                  {a.action.toLowerCase().replaceAll('_', ' ')}
                  <small title={a.actorUserId ?? undefined}>
                    {' '}
                    · {a.actorUserId ? 'Administrator' : 'System'}
                  </small>
                </span>
                <time>{date(a.createdAt)}</time>
              </div>
            ))}
            <h3 className="refund-detail-heading">Provider updates</h3>
            {!detail.events.length ? (
              <p className="fin-text">No provider updates received yet.</p>
            ) : null}
            {detail.events.map((e) => (
              <div className="refund-history-item" key={e.id}>
                <FinPill tone={e.processedAt ? 'green' : 'orange'}>
                  {e.processedAt ? 'Synced' : 'Awaiting update'}
                </FinPill>
                <span>{e.eventType.replace('refund.', 'Refund ').replaceAll('_', ' ')}</span>
                {e.lastError ? <p>{e.lastError}</p> : null}
              </div>
            ))}
          </FinPanel>
        </div>
      ) : null}
    </div>
  );
}
