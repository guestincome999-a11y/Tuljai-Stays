'use client';

import type {
  AdminActivityItem,
  AdminDashboardOperations,
  AdminLodgeAvailabilityRow,
  AdminSettlementSummary,
} from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getAdminDashboardOperations } from '../api/live-operations-api';

const REFRESH_MS = 60_000;

export function DashboardOperations() {
  const [data, setData] = useState<AdminDashboardOperations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      getAdminDashboardOperations()
        .then((result) => {
          if (!active) return;
          setData(result);
          setError(null);
        })
        .catch(() => {
          if (active) setError('Could not load settlements and availability. Retrying shortly.');
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section aria-label="Settlements, availability and activity" className="dash-ops-grid">
      {error ? (
        <p className="error-banner dash-ops-wide" role="alert">
          {error}
        </p>
      ) : null}

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Owner Settlements</h2>
          <Link className="dash-link" href="/admin/commission">
            Manage
          </Link>
        </header>
        {data ? <SettlementCard summary={data.settlements} /> : <div className="dash-skeleton-block" aria-label="Loading" />}
      </article>

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Lodge Availability</h2>
          {data ? (
            <span className="dash-card-sub">
              {data.availability.totals.remaining} of {data.availability.totals.total} rooms open
            </span>
          ) : null}
        </header>
        {data ? <AvailabilityCard rows={data.availability.rows} /> : <div className="dash-skeleton-block" aria-label="Loading" />}
      </article>

      <article className="dash-card dash-ops-wide">
        <header className="dash-card-head">
          <h2>Recent Activity</h2>
          <Link className="dash-link" href="/admin/audit">
            View all
          </Link>
        </header>
        {data ? <ActivityList items={data.activity} /> : <div className="dash-skeleton-block" aria-label="Loading" />}
      </article>

      <style jsx global>{`
        .dash-ops-grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dash-ops-wide { grid-column: 1 / -1; }
        .dash-stat-row { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 12px; }
        .dash-stat { background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 12px; padding: 10px 12px; }
        .dash-stat span { color: var(--color-muted); display: block; font-size: 0.7rem; font-weight: 800; }
        .dash-stat strong { color: var(--color-primary-strong); display: block; font-size: 1.05rem; margin-top: 3px; }
        .dash-note { color: var(--color-muted); font-size: 0.74rem; font-weight: 650; margin: 8px 0 0; }
        .dash-avail-list { display: grid; gap: 12px; list-style: none; margin: 0; max-height: 340px; overflow-y: auto; padding: 0; }
        .dash-avail-head { align-items: baseline; display: flex; justify-content: space-between; margin-bottom: 5px; }
        .dash-avail-bar { background: #e6edf6; border-radius: 999px; display: flex; height: 9px; overflow: hidden; }
        .dash-avail-bar i { display: block; height: 100%; }
        .dash-avail-meta { color: var(--color-muted); display: flex; flex-wrap: wrap; font-size: 0.7rem; font-weight: 700; gap: 12px; margin-top: 5px; }
        .dash-avail-meta b { color: var(--color-text); }
        .dash-key { align-items: center; display: inline-flex; gap: 5px; }
        .dash-key i { border-radius: 2px; display: inline-block; height: 8px; width: 8px; }
        .dash-feed-time { color: var(--color-muted); flex: 0 0 auto; font-size: 0.72rem; font-weight: 700; }
        @media (max-width: 1100px) { .dash-ops-grid { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .dash-stat-row { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function SettlementCard({ summary }: { summary: AdminSettlementSummary }) {
  return (
    <div>
      <div className="dash-stat-row">
        <div className="dash-stat">
          <span>Pending amount</span>
          <strong>{formatInr(Number(summary.outstandingTotal))}</strong>
        </div>
        <div className="dash-stat">
          <span>Lodges awaiting</span>
          <strong>{summary.lodgesAwaiting}</strong>
        </div>
        <div className="dash-stat">
          <span>Last settlement</span>
          <strong>{summary.lastSettledAt ? formatDate(summary.lastSettledAt) : 'None yet'}</strong>
        </div>
      </div>
      {summary.recent.length === 0 ? (
        <p className="dash-empty">No settlements recorded yet.</p>
      ) : (
        <ul className="dash-list">
          {summary.recent.slice(0, 3).map((item) => (
            <li key={item.id}>
              <div>
                <span className="dash-item-title">{item.lodgeName}</span>
                <span className="dash-item-sub">
                  {formatDate(item.settledAt)} · {item.paymentMethod}
                  {item.reference ? ` · Ref ${item.reference}` : ''}
                </span>
              </div>
              <span className="dash-chip dash-chip-good">Settled {formatInr(Number(item.amount))}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="dash-note">
        Commission owed by lodges to the platform. No settlement schedule is configured, so there is no next-settlement date.
      </p>
    </div>
  );
}

function AvailabilityCard({ rows }: { rows: AdminLodgeAvailabilityRow[] }) {
  if (rows.length === 0) return <p className="dash-empty">No active rooms found yet.</p>;
  return (
    <div>
      <div className="dash-avail-meta" style={{ marginBottom: 10 }}>
        <span className="dash-key"><i style={{ background: '#c9382d' }} />Occupied</span>
        <span className="dash-key"><i style={{ background: '#168564' }} />Remaining</span>
        <span className="dash-key"><i style={{ background: '#d98a1d' }} />Unavailable / maintenance</span>
      </div>
      <ul className="dash-avail-list">
        {rows.map((row) => {
          const pct = (value: number) => (row.total > 0 ? (value / row.total) * 100 : 0);
          return (
            <li key={row.lodgeId}>
              <div className="dash-avail-head">
                <Link className="dash-item-title" href={`/admin/lodges/${row.lodgeId}`}>{row.name}</Link>
                <span className="dash-card-sub">{row.total} rooms</span>
              </div>
              <div aria-label={`${row.name}: ${row.occupied} occupied, ${row.remaining} remaining, ${row.unavailable} unavailable`} className="dash-avail-bar" role="img">
                <i style={{ background: '#c9382d', width: `${pct(row.occupied)}%` }} />
                <i style={{ background: '#168564', width: `${pct(row.remaining)}%` }} />
                <i style={{ background: '#d98a1d', width: `${pct(row.unavailable)}%` }} />
              </div>
              <div className="dash-avail-meta">
                <span>Occupied <b>{row.occupied}</b></span>
                <span>Remaining <b>{row.remaining}</b></span>
                <span>Unavailable <b>{row.unavailable}</b></span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityList({ items }: { items: AdminActivityItem[] }) {
  if (items.length === 0) return <p className="dash-empty">No recent activity recorded.</p>;
  return (
    <ul className="dash-list">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <span className="dash-item-title">{item.label}</span>
            <span className="dash-item-sub">
              {item.actorName ?? 'System'} · {item.entityType.replace(/_/gu, ' ')}
            </span>
          </div>
          <span className="dash-feed-time">{timeAgo(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number.isFinite(value) ? value : 0);
}
