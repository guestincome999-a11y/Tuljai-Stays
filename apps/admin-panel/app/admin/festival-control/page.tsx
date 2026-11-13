'use client';

import type { FestivalLodgeOperation, FestivalOperationsSnapshot } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { apiClient } from '../../../src/api/client';
import {
  reconcileFestivalPayment,
  updateFestivalLodge,
  updateFestivalMode,
} from '../../../src/api/festival-operations-api';
import { AdminIcon } from '../../../src/components/AdminIcon';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { useFestivalOperations } from '../../../src/hooks/useFestivalOperations';

import './festival.css';

const reasons = [
  'Fully booked',
  'Owner temporarily unavailable',
  'Maintenance',
  'Operational issue',
  'Emergency closure',
  'Other',
];
const workflowLabels = [
  'QR Check-in Not Working',
  'Resolve Fully Booked Lodge',
  'Resolve Booking Processing Issue',
  'Diagnose Lodge Loading Issue',
];
const time = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not recorded';
type Action =
  | { kind: 'mode'; enabled: boolean }
  | { kind: 'lodge'; lodge: FestivalLodgeOperation; enabled: boolean }
  | { kind: 'payment'; id: string; orderId: string }
  | { kind: 'manual' };

export default function FestivalControlPage() {
  return (
    <PermissionGate permission="settings.manage">
      <FestivalControl />
    </PermissionGate>
  );
}

function FestivalControl() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [dates, setDates] = useState({
    checkInDate: today,
    checkOutDate: new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10),
  });
  const [dateDraft, setDateDraft] = useState(dates);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { data, error, refreshing, connected, refresh } = useFestivalOperations({
    ...dates,
    search,
    filter,
    page,
  });
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('Operational issue');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<number | null>(null);
  const [config, setConfig] = useState({ name: '', startDate: '', endDate: '' });
  const [identity, setIdentity] = useState({ bookingCode: '', guestPhone: '' });
  const [history, setHistory] = useState<string | null>(null);
  const synchronizedVersion = useRef<string | null>(null);
  const confirmationVersion = useRef('');
  useEffect(() => {
    if (data && data.mode.updatedAt !== synchronizedVersion.current) {
      synchronizedVersion.current = data.mode.updatedAt;
      setConfig({
        name: data.mode.name,
        startDate: data.mode.startDate,
        endDate: data.mode.endDate,
      });
    }
  }, [data]);
  // A new installation has no flag version yet.
  useEffect(() => {
    if (data && !data.mode.updatedAt)
      setConfig({
        name: data.mode.name,
        startDate: data.mode.startDate,
        endDate: data.mode.endDate,
      });
  }, [data?.mode.name, data?.mode.updatedAt]);

  function open(next: Action) {
    confirmationVersion.current = data?.mode.updatedAt ?? '';
    setAction(next);
    setReason('');
    setActionError(null);
    setCategory('Operational issue');
  }
  async function apply() {
    if (!action || !data || busy) return;
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      if (action.kind === 'mode') {
        await updateFestivalMode({
          ...config,
          enabled: action.enabled,
          reason,
          expectedUpdatedAt: confirmationVersion.current,
        });
        setMessage(
          action.enabled
            ? 'Festival policies enabled. Existing reservations remain valid.'
            : 'Normal discovery policies restored. Lodge closures and reservations are preserved.',
        );
      } else if (action.kind === 'lodge') {
        await updateFestivalLodge(action.lodge.id, {
          isActive: action.enabled,
          reason: category,
          detail: reason,
          expectedUpdatedAt: action.lodge.updatedAt,
          ...dates,
        });
        setMessage(
          `${action.lodge.name}: ${action.enabled ? 'enabled after availability verification' : 'closed to new bookings'}. Existing reservations remain valid.`,
        );
      } else if (action.kind === 'payment') {
        const result = await reconcileFestivalPayment(action.id, reason);
        setMessage(
          `Gateway verification finished: ${result.status.replaceAll('_', ' ')}. No charge was initiated.`,
        );
      } else {
        const result = await apiClient.post<{ bookingId: string; status: string }>(
          '/admin/festival-operations/recovery/checkin',
          { ...identity, reason },
        );
        setMessage(
          `Booking verification completed: ${result.status.replaceAll('_', ' ')}. Check-in remains protected against duplicate processing.`,
        );
        setIdentity({ bookingCode: '', guestPhone: '' });
      }
      setAction(null);
      await refresh();
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : 'Action failed. Refresh and check the current state before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  const health = error
    ? 'Offline'
    : !data
      ? 'Checking'
      : data.alerts.some((a) => a.severity === 'critical')
        ? 'Critical'
        : data.alerts.length
          ? 'Warning'
          : 'Healthy';
  const apiHealth = error
    ? 'Offline'
    : !data
      ? 'Checking'
      : data.diagnostics.telemetry.recentErrors.some((entry) => entry.status >= 500)
        ? 'Critical'
        : 'Healthy';
  const chooseFilter = (value: string) => {
    setFilter(value);
    setPage(1);
    document
      .getElementById('lodge-operations')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="fc page-stack">
      <section className="fc-heading">
        <div>
          <p className="eyebrow">Festival Operations & Emergency Control</p>
          <h2>Festival Control Center</h2>
          <p className="muted-copy">
            Lodge availability, booking recovery and live platform operations.
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={refreshing}
          onClick={() => void refresh()}
          type="button"
        >
          {refreshing ? 'Synchronizing…' : 'Refresh operations'}
        </button>
      </section>
      {error && (
        <div className="error-banner" role="alert">
          {error}{' '}
          <button className="button button-secondary" onClick={() => void refresh()} type="button">
            Retry synchronization
          </button>
        </div>
      )}
      {message && (
        <div className="success-banner" role="status">
          {message}
        </div>
      )}
      {!data ? (
        <section className="panel fc-skeleton" aria-busy={refreshing}>
          <h3>{error ? 'Operational information unavailable' : 'Loading the control center…'}</h3>
          <p>Critical controls become available after an authoritative synchronization.</p>
        </section>
      ) : (
        <>
          <section className="fc-mode panel">
            <div>
              <p className="eyebrow">Operational mode</p>
              <h3>
                <span className={`fc-dot ${data.mode.enabled ? 'fc-dot-on' : ''}`} /> Festival Mode{' '}
                <b>{data.mode.enabled ? 'ON' : 'OFF'}</b>
              </h3>
              <p>{data.mode.name || 'Festival not configured'}</p>
              <p className="muted-copy">
                {data.mode.startDate || 'Start date not set'} —{' '}
                {data.mode.endDate || 'End date not set'}
              </p>
            </div>
            <dl className="fc-facts">
              <div>
                <dt>Current status</dt>
                <dd>
                  <a href="#critical-alerts" aria-label="Review detected operational alerts">
                    <Pill
                      tone={
                        health === 'Healthy'
                          ? 'good'
                          : health === 'Critical' || health === 'Offline'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {health} · {data.alerts.length} alerts
                    </Pill>
                  </a>
                </dd>
              </div>
              <div>
                <dt>Configuration updated</dt>
                <dd>{time(data.mode.updatedAt)}</dd>
              </div>
              <div>
                <dt>Activated by</dt>
                <dd>
                  {data.mode.activatedBy ||
                    (data.mode.enabled ? 'Legacy activation; see audit history' : 'Mode is off')}
                </dd>
              </div>
              <div>
                <dt>Last changed by</dt>
                <dd>{data.mode.lastChangedBy || 'Not recorded'}</dd>
              </div>
              <div>
                <dt>Last successful data sync · IST</dt>
                <dd>{time(data.checkedAt)}</dd>
              </div>
              <div>
                <dt>Realtime connection</dt>
                <dd>
                  <Pill tone={connected ? 'good' : 'warning'}>
                    {connected ? 'Connected' : 'Fallback synchronization'}
                  </Pill>
                </dd>
              </div>
            </dl>
            <div className="fc-mode-action">
              <button
                className={`button ${data.mode.enabled ? 'button-secondary' : 'button-primary'}`}
                disabled={busy || !!error}
                onClick={() => open({ kind: 'mode', enabled: !data.mode.enabled })}
                type="button"
              >
                {data.mode.enabled ? 'Disable Festival Mode' : 'Enable Festival Mode'}
              </button>
              <small>Confirmation and an audit reason required</small>
            </div>
          </section>
          <section aria-labelledby="overview-title">
            <div className="fc-section-title">
              <h3 id="overview-title">Live operational overview</h3>
              <span className="muted-copy">
                Availability for {dates.checkInDate} → {dates.checkOutDate}
              </span>
            </div>
            <div className="fc-kpis">
              {(
                [
                  ['Active verified lodges', data.kpis.activeLodges, 'active'],
                  ['Festival-eligible lodges', data.kpis.eligibleLodges, 'active'],
                  ['Temporarily disabled', data.kpis.disabledLodges, 'disabled'],
                  ['Fully booked lodges', data.kpis.fullyBookedLodges, 'full'],
                  ['Available rooms', data.kpis.availableRooms, 'active'],
                ] as const
              ).map(([label, value, target]) => (
                <button
                  className="fc-kpi"
                  key={label}
                  onClick={() => chooseFilter(target)}
                  type="button"
                >
                  <span>{label}</span>
                  <strong>{value.toLocaleString('en-IN')}</strong>
                  <small>View lodge operations ↗</small>
                </button>
              ))}
              {(
                [
                  ['Active bookings', data.kpis.activeBookings, '/admin/bookings'],
                  ['Pending payment verification', data.kpis.pendingPayments, '#payment-recovery'],
                  ['Stuck / recovery operations', data.kpis.stuckOperations, '#payment-recovery'],
                  ['Active stays', data.kpis.activeStays, '/admin/bookings/active'],
                ] as const
              ).map(([label, value, href]) => (
                <Link className="fc-kpi" href={href} key={label}>
                  <span>{label}</span>
                  <strong>{value.toLocaleString('en-IN')}</strong>
                  <small>Open management ↗</small>
                </Link>
              ))}
              <a className="fc-kpi" href="#festival-performance">
                <span>System / API condition</span>
                <strong className="fc-health-value">{apiHealth}</strong>
                <small>Review observed conditions ↗</small>
              </a>
            </div>
            <p className="fc-note">
              Festival-eligible means verified, active and available for the selected stay.
              Booking/payment/stay counts are platform-wide. Zero rooms includes allocations, live
              holds and room blocks.
            </p>
          </section>
          <section className="panel" aria-labelledby="quick-title">
            <div className="fc-section-title">
              <div>
                <p className="eyebrow">Emergency Quick Action Center</p>
                <h3 id="quick-title">Festival Quick Actions</h3>
              </div>
              <AdminIcon name="operations" />
            </div>
            <div className="fc-quick-grid">
              <QuickGroup title="Lodge emergencies">
                <button onClick={() => chooseFilter('active')} type="button">
                  Disable a lodge →
                </button>
                <button onClick={() => chooseFilter('disabled')} type="button">
                  Re-enable a lodge →
                </button>
                <button onClick={() => chooseFilter('full')} type="button">
                  View fully booked lodges →
                </button>
                <button onClick={() => chooseFilter('empty')} type="button">
                  View lodges with zero available rooms →
                </button>
                <Link href="/admin/rooms">Open availability management →</Link>
              </QuickGroup>
              <QuickGroup title="Booking emergencies">
                <Link href="/admin/operations/intervention">Pending bookings & intervention →</Link>
                <a href="#payment-recovery">Failed / stuck payment operations →</a>
                <Link href="/admin/bookings/conflicts">Review possible allocation conflicts →</Link>
                <Link href="/admin/bookings">Open booking management →</Link>
              </QuickGroup>
              <QuickGroup title="Payment emergencies">
                <a href="#payment-recovery">Pending verification & safe retries →</a>
                <Link href="/admin/finance">Payments and recovery records →</Link>
                <Link href="/admin/payments/refunds">Open refund management →</Link>
                <a href="#festival-performance">Recent webhook endpoint errors →</a>
              </QuickGroup>
              <QuickGroup title="Synchronization & system">
                <a href="#festival-performance">Realtime & backend health →</a>
                <Link href="/admin/notifications-monitor">Failed notification deliveries →</Link>
                <a href="#festival-activity">Operational activity history →</a>
                <Link href="/admin/system-health">Open system health information →</Link>
              </QuickGroup>
            </div>
            <div className="fc-workflow-buttons">
              {workflowLabels.map((label, index) => (
                <button
                  className="button button-secondary"
                  key={label}
                  onClick={() => setWorkflow(index)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section className="panel" id="lodge-operations">
            <div className="fc-section-title">
              <div>
                <p className="eyebrow">Authoritative inventory</p>
                <h3>Lodge Operations</h3>
              </div>
              <Link className="button button-secondary" href="/admin/lodges">
                All lodge details
              </Link>
            </div>
            <form
              className="fc-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                if (dateDraft.checkInDate >= dateDraft.checkOutDate) return;
                setDates(dateDraft);
                setSearch(searchDraft);
                setPage(1);
              }}
            >
              <label className="form-field">
                <span>Search lodges</span>
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Lodge name"
                  maxLength={100}
                />
              </label>
              <label className="form-field">
                <span>Check-in</span>
                <input
                  type="date"
                  value={dateDraft.checkInDate}
                  onChange={(event) =>
                    setDateDraft({ ...dateDraft, checkInDate: event.target.value })
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>Check-out</span>
                <input
                  type="date"
                  min={dateDraft.checkInDate}
                  value={dateDraft.checkOutDate}
                  onChange={(event) =>
                    setDateDraft({ ...dateDraft, checkOutDate: event.target.value })
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>Status</span>
                <select
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All lodges</option>
                  <option value="active">Active verified</option>
                  <option value="disabled">Disabled</option>
                  <option value="full">Fully booked</option>
                  <option value="empty">Zero available rooms</option>
                </select>
              </label>
              <button
                className="button button-primary"
                disabled={refreshing || dateDraft.checkInDate >= dateDraft.checkOutDate}
                type="submit"
              >
                Apply filters
              </button>
            </form>
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Lodge</th>
                    <th>Operational status</th>
                    <th>Available rooms</th>
                    <th>Reason / last update · IST</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lodges.items.map((lodge) => (
                    <tr key={lodge.id}>
                      <td>
                        <Link href={`/admin/lodges/${lodge.id}`}>
                          <strong>{lodge.name}</strong>
                        </Link>
                        <small>{lodge.verificationStatus.replaceAll('_', ' ')}</small>
                      </td>
                      <td>
                        <Pill
                          tone={
                            !lodge.isActive ? 'danger' : lodge.availableRooms ? 'good' : 'warning'
                          }
                        >
                          {!lodge.isActive
                            ? 'Disabled'
                            : lodge.availableRooms
                              ? 'Active'
                              : 'No availability'}
                        </Pill>
                      </td>
                      <td>
                        <strong>{lodge.availableRooms}</strong>
                      </td>
                      <td>
                        {lodge.operationsReason || 'No operational closure'}
                        <small>{time(lodge.updatedAt)}</small>
                      </td>
                      <td>
                        <div className="fc-row-actions">
                          <button
                            className="button button-secondary"
                            disabled={
                              busy ||
                              !!error ||
                              (!lodge.isActive &&
                                (!lodge.availableRooms ||
                                  lodge.verificationStatus !== 'VERIFIED' ||
                                  lodge.status !== 'VERIFIED'))
                            }
                            onClick={() => open({ kind: 'lodge', lodge, enabled: !lodge.isActive })}
                            type="button"
                          >
                            {lodge.isActive ? 'Disable lodge' : 'Enable lodge'}
                          </button>
                          {lodge.isActive && (
                            <button
                              className="fc-text-button"
                              onClick={() => {
                                open({ kind: 'lodge', lodge, enabled: false });
                                setCategory('Fully booked');
                              }}
                              type="button"
                            >
                              Mark fully booked
                            </button>
                          )}
                          <Link href={`/admin/lodges/${lodge.id}`}>Rooms & availability ↗</Link>
                          <Link href={`/admin/bookings?lodgeId=${lodge.id}`}>Bookings ↗</Link>
                          <button
                            className="fc-text-button"
                            onClick={() => setHistory(lodge.id)}
                            type="button"
                          >
                            Activity history ↗
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.lodges.items.length && (
              <div className="fc-empty">
                <h4>No lodges match these filters</h4>
                <p>Try another name, stay window or operational status.</p>
              </div>
            )}
            <div className="fc-pagination">
              <span>
                {data.lodges.total} lodges · Page {page} of{' '}
                {Math.max(1, Math.ceil(data.lodges.total / data.lodges.pageSize))}
              </span>
              <div>
                <button
                  className="button button-secondary"
                  disabled={page <= 1 || refreshing}
                  onClick={() => setPage(page - 1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="button button-secondary"
                  disabled={page * data.lodges.pageSize >= data.lodges.total || refreshing}
                  onClick={() => setPage(page + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
          <div className="fc-columns">
            <section className="panel" id="critical-alerts">
              <div className="fc-section-title">
                <h3>Critical Alerts</h3>
                <Pill tone={data.alerts.length ? 'warning' : 'good'}>
                  {data.alerts.length} detected
                </Pill>
              </div>
              {!data.alerts.length ? (
                <div className="fc-empty">No alert conditions detected in the measured data.</div>
              ) : (
                data.alerts.map((alert) => (
                  <article className={`fc-alert fc-alert-${alert.severity}`} key={alert.id}>
                    <div>
                      <Pill tone={alert.severity === 'critical' ? 'danger' : 'warning'}>
                        {alert.severity}
                      </Pill>
                      <small>Observed {time(alert.at)}</small>
                    </div>
                    <h4>{alert.entity}</h4>
                    <p>{alert.detail}</p>
                    <Link href={alert.href}>{alert.action} →</Link>
                  </article>
                ))
              )}
            </section>
            <section className="panel" id="festival-performance">
              <div className="fc-section-title">
                <h3>Festival Performance</h3>
                <Link href="/admin/system-health">System health ↗</Link>
              </div>
              <dl className="fc-performance">
                <Fact
                  label="Database probe"
                  value={`${data.diagnostics.databaseLatencyMs} ms · connected`}
                />
                <Fact
                  label="API average response"
                  value={
                    data.diagnostics.telemetry.averageLatencyMs === null
                      ? 'No completed request samples'
                      : `${data.diagnostics.telemetry.averageLatencyMs} ms`
                  }
                />
                <Fact
                  label="HTTP errors / completed requests"
                  value={`${data.diagnostics.telemetry.errors} / ${data.diagnostics.telemetry.requests}`}
                />
                <Fact
                  label="Active booking / check-in requests"
                  value={data.diagnostics.telemetry.activeBookingRequests}
                />
                <Fact
                  label="Failed booking / check-in requests"
                  value={data.diagnostics.telemetry.failedBookingRequests}
                />
                <Fact
                  label="Backend process memory (RSS)"
                  value={`${data.diagnostics.telemetry.memoryMb} MB`}
                />
                <Fact
                  label="Authenticated realtime users"
                  value={data.diagnostics.onlineConnections}
                />
                <Fact
                  label="This console realtime"
                  value={connected ? 'Connected' : 'Disconnected; fallback reads active'}
                />
                <Fact
                  label="Oldest pending payment (queue preview)"
                  value={time(data.diagnostics.oldestPendingPaymentAt)}
                />
                <Fact
                  label="Availability synchronization"
                  value={`Last authoritative read: ${time(data.checkedAt)}`}
                />
                <Fact
                  label="Realtime publisher"
                  value={data.diagnostics.synchronization.ready ? 'Initialized' : 'Unavailable'}
                />
                <Fact
                  label="Last successful event publication · IST"
                  value={time(data.diagnostics.synchronization.lastPublishedAt)}
                />
              </dl>
              <details>
                <summary>Failed synchronization publications (five minutes)</summary>
                {data.diagnostics.synchronization.failures.length ? (
                  data.diagnostics.synchronization.failures.map((failure, index) => (
                    <p key={`${failure.at}-${index}`}>
                      {failure.event} · {time(failure.at)}
                    </p>
                  ))
                ) : (
                  <p>No failed publications observed in this process.</p>
                )}
                <p className="fc-note">
                  Refresh and reconnect read authoritative state. Socket emissions have no durable
                  replay queue, so there are no eligible jobs to replay here. Successful publication
                  does not prove device receipt.
                </p>
              </details>
              <p className="fc-note">
                {data.diagnostics.telemetry.scope}. Measurements are not fleet-wide. Connection
                counts do not prove delivery to every device. Gateway uptime, peak traffic and
                infrastructure logs are not exposed by this deployment.
              </p>
              <details>
                <summary>Slowest measured endpoints</summary>
                <div className="fc-table-wrap">
                  <table className="fc-table">
                    <thead>
                      <tr>
                        <th>Endpoint template</th>
                        <th>Mean latency</th>
                        <th>Requests / errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.diagnostics.telemetry.endpoints.map((endpoint) => (
                        <tr key={endpoint.route}>
                          <td>{endpoint.route}</td>
                          <td>{endpoint.averageLatencyMs} ms</td>
                          <td>
                            {endpoint.requests} / {endpoint.errors}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <details>
                <summary>Recent endpoint errors (five minutes)</summary>
                {data.diagnostics.telemetry.recentErrors.length ? (
                  data.diagnostics.telemetry.recentErrors.map((failure, i) => (
                    <p key={`${failure.at}-${i}`}>
                      {failure.status} · {failure.route}
                      <small className="fc-block">{time(failure.at)}</small>
                    </p>
                  ))
                ) : (
                  <p>No recent errors observed in this process.</p>
                )}
              </details>
            </section>
          </div>
          <section className="panel" id="payment-recovery">
            <div className="fc-section-title">
              <div>
                <p className="eyebrow">Gateway reconciliation</p>
                <h3>Payment & Booking Recovery</h3>
              </div>
              <Link href="/admin/finance">Finance records ↗</Link>
            </div>
            <p className="muted-copy">
              Oldest 20 pending / recovery intents. Retries query the gateway through existing
              reconciliation; captured allocation conflicts require review. Webhook errors appear in
              measured endpoint failures; there is no durable webhook failure queue.
            </p>
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Gateway order</th>
                    <th>Status</th>
                    <th>Last update · IST</th>
                    <th>Attempts</th>
                    <th>Recovery</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.orderId}</td>
                      <td>
                        <Pill tone={payment.status === 'PENDING' ? 'warning' : 'danger'}>
                          {payment.status.replaceAll('_', ' ')}
                        </Pill>
                      </td>
                      <td>{time(payment.updatedAt)}</td>
                      <td>{payment.attempts}</td>
                      <td>
                        <div className="fc-row-actions">
                          {payment.status === 'PENDING' ? (
                            <button
                              className="button button-secondary"
                              disabled={busy || !!error}
                              onClick={() =>
                                open({ kind: 'payment', id: payment.id, orderId: payment.orderId })
                              }
                              type="button"
                            >
                              Retry verification
                            </button>
                          ) : (
                            <Link href="/admin/finance">Review paid allocation ↗</Link>
                          )}
                          {payment.bookingId && (
                            <Link href={`/admin/bookings/${payment.bookingId}`}>Booking ↗</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.payments.length && (
              <div className="fc-empty">No pending or recovery payment intents.</div>
            )}
          </section>
          <Activity data={data} />
          <details className="panel fc-settings">
            <summary>Festival configuration</summary>
            <p className="muted-copy">
              All verified, active lodges with valid availability remain eligible. Festival mode
              filters unavailable lodges for the selected stay (today by default). Dates are
              metadata; activation is explicit. Configured festival rates apply only while mode is
              on and within the festival dates. Explicit date price overrides retain priority.
            </p>
            <div className="fc-toolbar">
              <label className="form-field">
                <span>Festival name</span>
                <input
                  value={config.name}
                  maxLength={120}
                  onChange={(event) => setConfig({ ...config, name: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Starts</span>
                <input
                  type="date"
                  value={config.startDate}
                  onChange={(event) => setConfig({ ...config, startDate: event.target.value })}
                />
              </label>
              <label className="form-field">
                <span>Ends</span>
                <input
                  type="date"
                  value={config.endDate}
                  onChange={(event) => setConfig({ ...config, endDate: event.target.value })}
                />
              </label>
              <button
                className="button button-secondary"
                disabled={busy || !!error}
                onClick={() => open({ kind: 'mode', enabled: data.mode.enabled })}
                type="button"
              >
                Review configuration change
              </button>
            </div>
            <p>
              <Link href="/admin/banners">Banners and advisories remain in Content →</Link>
            </p>
          </details>
        </>
      )}
      {action && data && (
        <Modal
          title={
            action.kind === 'mode'
              ? `${action.enabled ? 'Enable' : 'Disable'} Festival Mode / save configuration`
              : action.kind === 'lodge'
                ? `${action.enabled ? 'Enable' : 'Disable'} ${action.lodge.name}`
                : action.kind === 'payment'
                  ? 'Retry gateway verification'
                  : 'Authorized manual check-in'
          }
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <p>
            {action.kind === 'mode'
              ? `${action.enabled ? 'Festival discovery will hide lodges without valid availability for the stay window.' : 'Normal discovery policies will be restored.'} Configured festival pricing follows the mode and festival date window. Lodge closures, price configuration, bookings and payment states are preserved.`
              : action.kind === 'lodge'
                ? action.enabled
                  ? `The backend will revalidate verification and availability for ${dates.checkInDate} to ${dates.checkOutDate} before reopening this lodge.`
                  : 'This lodge will stop accepting new bookings and disappear from new searches. Confirmed bookings and in-progress payment records remain intact.'
                : action.kind === 'payment'
                  ? `Read gateway status for ${action.orderId}. This does not create an order, initiate a charge or force a payment to success.`
                  : 'Check the guest’s identification against the affected booking before proceeding. The backend validates booking code, guest phone, booking status, active QR token and room allocation using the existing check-in service.'}
          </p>
          {action.kind === 'mode' && (
            <p>
              <strong>{config.name || 'Enter a festival name in configuration first'}</strong> ·{' '}
              {config.startDate || 'No start date'} → {config.endDate || 'No end date'}
            </p>
          )}
          {action.kind === 'lodge' && !action.enabled && (
            <label className="form-field">
              <span>Closure reason</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {reasons.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {action.kind === 'manual' && (
            <div className="fc-manual-form">
              <p className="muted-copy">
                Enter the booking reference printed on the guest pass and the phone number recorded
                on the booking.
              </p>
              {(['bookingCode', 'guestPhone'] as const).map((key) => (
                <label className="form-field" key={key}>
                  <span>
                    {key === 'bookingCode'
                      ? 'Booking code on guest pass'
                      : 'Guest phone on booking'}
                  </span>
                  <input
                    value={identity[key]}
                    type={key === 'guestPhone' ? 'tel' : 'text'}
                    placeholder={
                      key === 'bookingCode'
                        ? 'Booking reference from guest pass'
                        : 'Guest phone number'
                    }
                    maxLength={key === 'bookingCode' ? 100 : 20}
                    autoComplete="off"
                    onChange={(event) => setIdentity({ ...identity, [key]: event.target.value })}
                  />
                </label>
              ))}
            </div>
          )}
          <label className="form-field">
            <span>Audit reason / operational details</span>
            <textarea
              value={reason}
              maxLength={500}
              minLength={5}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this action is necessary"
            />
          </label>
          {actionError && (
            <p className="error-banner" role="alert">
              {actionError}
            </p>
          )}
          <div className="fc-dialog-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => setAction(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={
                busy ||
                reason.trim().length < 5 ||
                (action.kind === 'mode' && config.name.trim().length < 3) ||
                (action.kind === 'manual' && Object.values(identity).some((value) => !value.trim()))
              }
              onClick={() => void apply()}
              type="button"
            >
              {busy ? 'Applying safely…' : 'Confirm action'}
            </button>
          </div>
        </Modal>
      )}
      {workflow !== null && data && (
        <Modal title={workflowLabels[workflow]!} onClose={() => setWorkflow(null)}>
          <Workflow
            index={workflow}
            data={data}
            connected={connected}
            onManual={() => {
              setWorkflow(null);
              open({ kind: 'manual' });
            }}
            onFilter={(value) => {
              setWorkflow(null);
              chooseFilter(value);
            }}
            onRefresh={() => {
              void refresh();
              setWorkflow(null);
            }}
          />
        </Modal>
      )}
      {history && data && (
        <Modal title="Lodge activity history" onClose={() => setHistory(null)}>
          <p>Recent operations are shown below. Open the audit log for full historical records.</p>
          <Activity data={data} entityId={history} />
          <Link className="button button-secondary" href={`/admin/audit?entityId=${history}`}>
            Open full audit history
          </Link>
        </Modal>
      )}
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: 'good' | 'warning' | 'danger' }) {
  return <span className={`fc-pill fc-pill-${tone}`}>{children}</span>;
}
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function QuickGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fc-quick-group">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
function Activity({ data, entityId }: { data: FestivalOperationsSnapshot; entityId?: string }) {
  const items = entityId
    ? data.activity.filter((item) => item.entityId === entityId)
    : data.activity;
  return (
    <section className="panel" id={entityId ? undefined : 'festival-activity'}>
      <div className="fc-section-title">
        <h3>Festival Activity Log</h3>
        <Link href="/admin/audit">Full audit log ↗</Link>
      </div>
      <p className="fc-note">
        Latest 30 operational entries. Admin identity, time, prior/new state and recovery reasons
        are retained in audit metadata.
      </p>
      {!items.length ? (
        <p>No matching recent operations recorded.</p>
      ) : (
        <div className="fc-table-wrap">
          <table className="fc-table">
            <thead>
              <tr>
                <th>Action / entity</th>
                <th>Admin</th>
                <th>Time · IST</th>
                <th>Change details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.action.replaceAll('_', ' ')}
                    <small>{item.entityId}</small>
                  </td>
                  <td>{item.actor}</td>
                  <td>{time(item.at)}</td>
                  <td>
                    <details>
                      <summary>Previous / new values</summary>
                      <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="fc-dialog"
      ref={ref}
      aria-labelledby="fc-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="fc-section-title">
        <h3 id="fc-dialog-title">{title}</h3>
        <button className="fc-close" aria-label="Close dialog" onClick={onClose} type="button">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Workflow({
  index,
  data,
  connected,
  onManual,
  onFilter,
  onRefresh,
}: {
  index: number;
  data: FestivalOperationsSnapshot;
  connected: boolean;
  onManual: () => void;
  onFilter: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="fc-workflow">
      <ol>
        {index === 0 ? (
          <>
            <li>
              Confirm the scanner has network access and camera permission. Retry a signed pass
              after reconnecting.
            </li>
            <li>
              Backend/database probe: {data.diagnostics.database} (
              {data.diagnostics.databaseLatencyMs} ms). Last observed {time(data.checkedAt)}.
            </li>
            <li>
              Booking verification uses the existing signed QR service and atomic token consumption.
            </li>
            <li>
              {data.diagnostics.qrFailures} unsuccessful scans in 24 hours.{' '}
              <Link href="/admin/qr-monitor">Inspect affected scan records →</Link>
            </li>
            <li>
              <Link href="/admin/bookings">
                Open the affected booking and verify guest identity →
              </Link>
            </li>
            <li>
              For an eligible pass, retry scanning in the owner app. If the camera remains
              unavailable, use authorized manual verification below.
            </li>
          </>
        ) : index === 1 ? (
          <>
            <li>
              Open the lodge and inspect room-level status, dated blocks and active holds for the
              affected stay.
            </li>
            <li>
              <Link href="/admin/bookings/conflicts">Inspect possible allocation conflicts →</Link>
            </li>
            <li>
              Mark the lodge fully booked to close new bookings while preserving confirmed
              reservations.
            </li>
            <li>
              Resolve room availability, then re-enable. The server checks actual eligibility before
              reopening.
            </li>
          </>
        ) : index === 2 ? (
          <>
            <li>
              Locate the order in Payment & Booking Recovery or{' '}
              <Link href="/admin/finance">finance records →</Link>
            </li>
            <li>
              Check booking status, gateway order and processed webhooks in the existing finance
              recovery view. Gateway uptime is not independently monitored here.
            </li>
            <li>
              Pending verification can use the guarded gateway retry. A lease prevents concurrent
              verification attempts.
            </li>
            <li>
              Already confirmed payments remain confirmed. Captured payments requiring allocation
              review must be inspected before refund or recovery.
            </li>
            <li>Never start another charge to resolve an uncertain result.</li>
          </>
        ) : (
          <>
            <li>Confirm network access. A cached view can be older than the server.</li>
            <li>
              Database probe: {data.diagnostics.database}. Console realtime:{' '}
              {connected ? 'connected' : 'disconnected; fallback reads enabled'}.
            </li>
            <li>
              Refresh the control center to execute the shared availability queries.{' '}
              <Link href="/admin/system-health">Open backend health information →</Link>
            </li>
            <li>
              Inspect recent listing / availability endpoint errors in Festival Performance.{' '}
              <a href="/admin/festival-control#festival-performance">Open measured API errors →</a>
            </li>
            <li>
              Check that verified lodges have rooms for the selected stay; clear conflicting search
              filters in the pilgrim app.
            </li>
            <li>
              Use the pilgrim app retry or pull-to-refresh. A failure must keep a retryable state.
            </li>
          </>
        )}
      </ol>
      <div className="fc-dialog-actions">
        {index === 0 && (
          <button className="button button-primary" onClick={onManual} type="button">
            Manual identity verification
          </button>
        )}
        {index === 1 && (
          <button className="button button-primary" onClick={() => onFilter('full')} type="button">
            Open lodges with no rooms
          </button>
        )}
        {index === 2 && (
          <a className="button button-primary" href="#payment-recovery" onClick={onRefresh}>
            Open payment recovery
          </a>
        )}
        {index === 3 && (
          <button className="button button-primary" onClick={onRefresh} type="button">
            Refresh operational diagnostics
          </button>
        )}
      </div>
    </div>
  );
}
