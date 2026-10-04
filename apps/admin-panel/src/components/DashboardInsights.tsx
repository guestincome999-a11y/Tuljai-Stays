'use client';

import type {
  AdminDashboardInsights,
  AdminDashboardPeriod,
  AdminDashboardAlert,
  AdminPendingAction,
} from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getAdminDashboardInsights } from '../api/live-operations-api';

const REFRESH_MS = 60_000;
const PERIODS: Array<{ label: string; value: AdminDashboardPeriod }> = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: 'week' },
  { label: 'This month', value: 'month' },
];

export function DashboardInsights() {
  const [period, setPeriod] = useState<AdminDashboardPeriod>('month');
  const [data, setData] = useState<AdminDashboardInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      getAdminDashboardInsights(period)
        .then((result) => {
          if (!active) return;
          setData(result);
          setError(null);
        })
        .catch(() => {
          if (active) setError('Could not load dashboard insights. Retrying shortly.');
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [period]);

  const periodLabel = PERIODS.find((item) => item.value === period)?.label ?? '';

  return (
    <section aria-label="Operations insights" className="dash-ins-grid">
      {error ? (
        <p className="error-banner dash-ins-wide" role="alert">
          {error}
        </p>
      ) : null}

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Revenue Summary</h2>
          <select
            aria-label="Revenue period"
            className="dash-select"
            onChange={(event) => {
              setData(null);
              setPeriod(event.target.value as AdminDashboardPeriod);
            }}
            value={period}
          >
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </header>
        {data ? <RevenueDonut summary={data.revenueSummary} /> : <div className="dash-skeleton-block" aria-label="Loading" />}
      </article>

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Pending Owner Actions</h2>
          {data ? <span className="dash-card-sub">{data.pendingActionTotal} open</span> : null}
        </header>
        {data ? <PendingList actions={data.pendingActions} total={data.pendingActionTotal} /> : <div className="dash-skeleton-block" aria-label="Loading" />}
      </article>

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Quick Alerts</h2>
          {data ? <span className="dash-card-sub">{data.alerts.length === 0 ? 'All clear' : `${data.alerts.length} active`}</span> : null}
        </header>
        {data ? <AlertList alerts={data.alerts} /> : <div className="dash-skeleton-block" aria-label="Loading" />}
      </article>

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Top Performing Lodges</h2>
          <span className="dash-card-sub">{periodLabel}</span>
        </header>
        {data ? (
          data.topLodges.length === 0 ? (
            <p className="dash-empty">No bookings in this period yet.</p>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Lodge</th>
                  <th className="dash-num">Bookings</th>
                  <th className="dash-num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topLodges.map((lodge) => (
                  <tr key={lodge.lodgeId}>
                    <td>
                      <Link className="dash-link" href={`/admin/lodges/${lodge.lodgeId}`}>
                        {lodge.name}
                      </Link>
                    </td>
                    <td className="dash-num">{lodge.bookings}</td>
                    <td className="dash-num">{formatInr(Number(lodge.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="dash-skeleton-block" aria-label="Loading" />
        )}
      </article>

      <style jsx global>{`
        .dash-ins-grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dash-ins-wide { grid-column: 1 / -1; }
        .dash-select { background: var(--color-surface); border: 1px solid var(--color-outline); border-radius: 10px; color: var(--color-text); font: inherit; font-size: 0.76rem; font-weight: 700; padding: 5px 8px; }
        .dash-list { display: grid; gap: 0; list-style: none; margin: 0; padding: 0; }
        .dash-list li { align-items: center; border-top: 1px solid var(--color-outline); display: flex; gap: 10px; justify-content: space-between; padding: 10px 0; }
        .dash-list li:first-child { border-top: 0; }
        .dash-item-title { color: var(--color-text); font-size: 0.82rem; font-weight: 800; }
        .dash-item-sub { color: var(--color-muted); display: block; font-size: 0.72rem; font-weight: 650; margin-top: 2px; }
        .dash-item-action { background: var(--color-primary-soft); border-radius: 9px; color: var(--color-primary-strong); flex: 0 0 auto; font-size: 0.72rem; font-weight: 800; padding: 5px 11px; }
        .dash-item-action:hover { background: var(--color-primary); color: #fff; }
        .dash-dot { border-radius: 50%; flex: 0 0 10px; height: 10px; width: 10px; }
        .dash-dot-critical { background: #c9382d; }
        .dash-dot-warning { background: #d98a1d; }
        .dash-dot-info { background: #2f6fd1; }
        .dash-alert-main { align-items: flex-start; display: flex; gap: 10px; min-width: 0; }
        .dash-alert-main .dash-dot { margin-top: 4px; }
        .dash-donut-wrap { align-items: center; display: flex; flex-wrap: wrap; gap: 18px; }
        .dash-donut { flex: 0 0 150px; height: 150px; width: 150px; }
        .dash-donut-legend { display: grid; flex: 1 1 160px; gap: 8px; min-width: 0; }
        .dash-legend-row { align-items: center; display: flex; font-size: 0.78rem; font-weight: 700; gap: 8px; justify-content: space-between; }
        .dash-legend-row span:first-child { align-items: center; display: inline-flex; gap: 7px; }
        .dash-legend-row i { border-radius: 3px; display: inline-block; height: 10px; width: 10px; }
        .dash-legend-row b { color: var(--color-primary-strong); }
        .dash-commission { border-top: 1px dashed var(--color-outline); color: var(--color-muted); font-size: 0.74rem; font-weight: 700; padding-top: 8px; }
        @media (max-width: 1100px) { .dash-ins-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function RevenueDonut({ summary }: { summary: AdminDashboardInsights['revenueSummary'] }) {
  const online = Number(summary.online);
  const lodge = Number(summary.payAtLodge);
  const total = online + lodge;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const onlineLength = total > 0 ? (online / total) * circumference : 0;
  const lodgeLength = total > 0 ? (lodge / total) * circumference : 0;
  const percent = (value: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : '0%');
  const description = `Collected ${formatInr(total)}: ${formatInr(online)} online and ${formatInr(lodge)} at the lodge.`;

  return (
    <div className="dash-donut-wrap">
      <svg aria-label={description} className="dash-donut" role="img" viewBox="0 0 150 150">
        <circle cx="75" cy="75" fill="none" r={radius} stroke="#e6edf6" strokeWidth="18" />
        {total > 0 ? (
          <>
            <circle cx="75" cy="75" fill="none" r={radius} stroke="#2f6fd1" strokeDasharray={`${onlineLength} ${circumference}`} strokeWidth="18" transform="rotate(-90 75 75)" />
            <circle cx="75" cy="75" fill="none" r={radius} stroke="#d98a1d" strokeDasharray={`${lodgeLength} ${circumference}`} strokeDashoffset={-onlineLength} strokeWidth="18" transform="rotate(-90 75 75)" />
          </>
        ) : null}
        <text fill="#08264d" fontSize="15" fontWeight="800" textAnchor="middle" x="75" y="73">{formatInr(total)}</text>
        <text fill="#5d6f85" fontSize="9" textAnchor="middle" x="75" y="89">Collected</text>
      </svg>
      <div className="dash-donut-legend">
        <div className="dash-legend-row">
          <span><i style={{ background: '#2f6fd1' }} />Online payments</span>
          <b>{formatInr(online)} · {percent(online)}</b>
        </div>
        <div className="dash-legend-row">
          <span><i style={{ background: '#d98a1d' }} />Paid at lodge</span>
          <b>{formatInr(lodge)} · {percent(lodge)}</b>
        </div>
        <div className="dash-commission">
          Platform commission: {formatInr(Number(summary.commission))} · {summary.bookingCount} bookings in period
        </div>
      </div>
    </div>
  );
}

function PendingList({ actions, total }: { actions: AdminPendingAction[]; total: number }) {
  if (actions.length === 0) return <p className="dash-empty">Nothing is waiting on owners right now.</p>;
  return (
    <>
      <ul className="dash-list">
        {actions.map((action) => (
          <li key={action.id}>
            <div>
              <span className="dash-item-title">{action.title}</span>
              <span className="dash-item-sub">{action.subtitle} · {timeAgo(action.createdAt)}</span>
            </div>
            <Link className="dash-item-action" href={action.href}>
              {action.kind === 'BOOKING_APPROVAL' ? 'Open' : 'Review'}
            </Link>
          </li>
        ))}
      </ul>
      {total > actions.length ? <p className="dash-card-sub">Showing the {actions.length} oldest of {total}.</p> : null}
    </>
  );
}

function AlertList({ alerts }: { alerts: AdminDashboardAlert[] }) {
  if (alerts.length === 0) return <p className="dash-empty">No payment, owner or delivery problems detected.</p>;
  return (
    <ul className="dash-list">
      {alerts.map((alert) => (
        <li key={alert.id}>
          <div className="dash-alert-main">
            <span aria-hidden="true" className={`dash-dot dash-dot-${alert.severity}`} />
            <div>
              <span className="dash-item-title">{alert.title}</span>
              <span className="dash-item-sub">{alert.detail}</span>
            </div>
          </div>
          <Link className="dash-item-action" href={alert.href}>View</Link>
        </li>
      ))}
    </ul>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number.isFinite(value) ? value : 0);
}
