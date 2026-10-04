'use client';

import type { AdminBookingSummary, AdminBookingTrendPoint } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getAdminBookingTrend, listAdminBookings } from '../api/live-operations-api';
import { formatStatus } from '../bookings/booking-operations';

const REFRESH_MS = 60_000;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PAD = { bottom: 28, left: 12, right: 12, top: 16 };

export function DashboardBookingOverview() {
  const [trend, setTrend] = useState<AdminBookingTrendPoint[] | null>(null);
  const [recent, setRecent] = useState<AdminBookingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      Promise.all([getAdminBookingTrend(7), listAdminBookings({ limit: 5 })])
        .then(([points, bookings]) => {
          if (!active) return;
          setTrend(points);
          setRecent(bookings.items);
          setError(null);
        })
        .catch(() => {
          if (active) setError('Could not load booking activity. Retrying shortly.');
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
    <section className="dash-overview-grid" aria-label="Booking activity">
      {error ? (
        <p className="error-banner dash-overview-error" role="alert">
          {error}
        </p>
      ) : null}

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Booking Overview</h2>
          <span className="dash-card-sub">Last 7 days</span>
        </header>
        {trend ? <TrendChart points={trend} /> : <div className="dash-skeleton-block" aria-label="Loading" />}
      </article>

      <article className="dash-card">
        <header className="dash-card-head">
          <h2>Recent Bookings</h2>
          <Link className="dash-link" href="/admin/bookings">
            View all
          </Link>
        </header>
        {recent ? (
          recent.length === 0 ? (
            <p className="dash-empty">No bookings yet.</p>
          ) : (
            <div className="dash-table-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Guest</th>
                    <th>Lodge</th>
                    <th>Check-in</th>
                    <th>Status</th>
                    <th className="dash-num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <Link className="dash-link" href={`/admin/bookings/${booking.id}`}>
                          {booking.bookingCode}
                        </Link>
                      </td>
                      <td>{booking.guestName}</td>
                      <td>{booking.lodgeName}</td>
                      <td>{formatDate(booking.checkInDate)}</td>
                      <td>
                        <span className={`dash-chip dash-chip-${statusTone(booking.status)}`}>
                          {formatStatus(booking.status)}
                        </span>
                      </td>
                      <td className="dash-num">
                        {booking.totalAmount ? formatInr(Number(booking.totalAmount)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="dash-skeleton-block" aria-label="Loading" />
        )}
      </article>

      <style jsx global>{`
        .dash-overview-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
        .dash-overview-error { grid-column: 1 / -1; }
        .dash-card { background: var(--color-surface); border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: 0 8px 22px rgba(8, 38, 77, 0.06); min-width: 0; padding: 18px; }
        .dash-card-head { align-items: baseline; display: flex; justify-content: space-between; margin-bottom: 12px; }
        .dash-card-head h2 { color: var(--color-primary-strong); font-size: 1rem; margin: 0; }
        .dash-card-sub { color: var(--color-muted); font-size: 0.74rem; font-weight: 700; }
        .dash-link { color: var(--color-primary); font-size: 0.8rem; font-weight: 800; }
        .dash-link:hover { text-decoration: underline; }
        .dash-empty { color: var(--color-muted); font-size: 0.85rem; padding: 18px 0; }
        .dash-skeleton-block { background: var(--color-surface-muted); border-radius: 12px; height: 200px; }
        .dash-table-scroll { overflow-x: auto; }
        .dash-table { border-collapse: collapse; font-size: 0.8rem; width: 100%; }
        .dash-table th { color: var(--color-muted); font-size: 0.7rem; font-weight: 800; padding: 6px 8px; text-align: left; white-space: nowrap; }
        .dash-table td { border-top: 1px solid var(--color-outline); padding: 9px 8px; white-space: nowrap; }
        .dash-num { text-align: right !important; }
        .dash-chip { border-radius: 999px; display: inline-block; font-size: 0.68rem; font-weight: 800; padding: 3px 9px; }
        .dash-chip-good { background: #e3f5ec; color: #0d6b4f; }
        .dash-chip-info { background: #e6effa; color: #123b73; }
        .dash-chip-wait { background: #fdf0dc; color: #9a5b0b; }
        .dash-chip-bad { background: #fbe6e3; color: #a1332a; }
        .dash-chip-done { background: #efe9fb; color: #5a3fa8; }
        .dash-legend { color: var(--color-muted); display: flex; font-size: 0.74rem; font-weight: 700; gap: 14px; margin-bottom: 6px; }
        .dash-legend i { border-radius: 50%; display: inline-block; height: 8px; margin-right: 5px; width: 8px; }
        .dash-chart { display: block; height: auto; width: 100%; }
        @media (max-width: 1100px) { .dash-overview-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function TrendChart({ points }: { points: AdminBookingTrendPoint[] }) {
  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const bookings = points.map((point) => point.bookings);
  const revenue = points.map((point) => Number(point.revenue));
  const maxBookings = Math.max(...bookings, 1);
  const maxRevenue = Math.max(...revenue, 1);
  const x = (index: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number, max: number) => PAD.top + innerH - (value / max) * innerH;
  const line = (values: number[], max: number) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value, max)}`).join(' ');
  const totalBookings = bookings.reduce((sum, value) => sum + value, 0);
  const totalRevenue = revenue.reduce((sum, value) => sum + value, 0);
  const summary = `${totalBookings} bookings and ${formatInr(totalRevenue)} collected over the last ${points.length} days.`;

  return (
    <div>
      <div className="dash-legend">
        <span><i style={{ background: '#2f6fd1' }} />Bookings</span>
        <span><i style={{ background: '#168564' }} />Revenue collected</span>
        <span>{summary}</span>
      </div>
      <svg aria-label={summary} className="dash-chart" role="img" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        {[0, 1, 2, 3].map((step) => {
          const gy = PAD.top + (innerH / 3) * step;
          return <line key={step} stroke="#dbe5f0" strokeDasharray="3 4" x1={PAD.left} x2={CHART_WIDTH - PAD.right} y1={gy} y2={gy} />;
        })}
        <path d={line(revenue, maxRevenue)} fill="none" stroke="#168564" strokeLinejoin="round" strokeWidth="2.5" />
        <path d={line(bookings, maxBookings)} fill="none" stroke="#2f6fd1" strokeLinejoin="round" strokeWidth="2.5" />
        {points.map((point, index) => (
          <g key={point.date}>
            <circle cx={x(index)} cy={y(point.bookings, maxBookings)} fill="#2f6fd1" r="3.5">
              <title>{`${shortDate(point.date)}: ${point.bookings} bookings, ${formatInr(Number(point.revenue))} collected`}</title>
            </circle>
            <circle cx={x(index)} cy={y(Number(point.revenue), maxRevenue)} fill="#168564" r="3.5" />
            <text fill="#5d6f85" fontSize="11" textAnchor="middle" x={x(index)} y={CHART_HEIGHT - 8}>
              {shortDate(point.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function statusTone(status: string): 'good' | 'info' | 'wait' | 'bad' | 'done' {
  if (['ACCEPTED', 'QR_GENERATED'].includes(status)) return 'good';
  if (status === 'CHECKED_IN') return 'info';
  if (['CHECKED_OUT', 'COMPLETED'].includes(status)) return 'done';
  if (['REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(status)) return 'bad';
  return 'wait';
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
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
