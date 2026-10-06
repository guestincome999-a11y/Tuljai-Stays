'use client';

import type {
  AdminActivityItem,
  AdminBookingSummary,
  AdminBookingTrendPoint,
  AdminDashboardAlert,
  AdminDashboardInsights,
  AdminDashboardKpis,
  AdminDashboardOperations,
  AdminLodgeAvailabilityRow,
  AdminPendingAction,
  AdminSettlementSummary,
} from '@tuljai/types';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { formatStatus } from '../../bookings/booking-operations';

import { formatCount, formatDate, formatInr, shortDate, timeAgo } from './format';

const Skeleton = () => <div aria-label="Loading" className="dash-skeleton" />;

function Card({
  action,
  children,
  className,
  sub,
  title,
}: {
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  sub?: ReactNode;
  title: string;
}) {
  return (
    <article className={className ? `dash-card ${className}` : 'dash-card'}>
      <header className="dash-card-head">
        <h2>{title}</h2>
        {sub ? <span className="dash-card-sub">{sub}</span> : null}
        {action ? (
          <Link className="dash-link" href={action.href}>
            {action.label}
          </Link>
        ) : null}
      </header>
      {children}
    </article>
  );
}

/* ---------------------------------------------------------------- KPIs */

const KPI_ICONS: Record<string, ReactNode> = {
  active: <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 21v-3M21 21v-3M7 10V7a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3" />,
  bookings: <path d="M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1zM9 12h6M9 16h4" />,
  pending: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  revenue: <path d="M7 5h10M7 9h10M7 5c5 0 5 8 0 8h-1l7 6" />,
};

export function KpiRow({ kpis }: { kpis: AdminDashboardKpis | null }) {
  const cards = [
    { key: 'bookings', label: 'Total Bookings', tone: 'blue', value: kpis ? formatCount(kpis.totalBookings) : null, meta: kpis ? <Delta current={kpis.bookingsToday} previous={kpis.bookingsYesterday} /> : null },
    { key: 'revenue', label: 'Total Revenue', tone: 'green', value: kpis ? formatInr(Number(kpis.totalRevenue)) : null, meta: kpis ? <Delta current={Number(kpis.revenueToday)} previous={Number(kpis.revenueYesterday)} /> : null },
    { key: 'pending', label: 'Pending Owner Actions', tone: 'orange', value: kpis ? formatCount(kpis.pendingOwnerActions) : null, meta: kpis ? <span className="dash-muted">Bookings, verification, photos</span> : null },
    { key: 'active', label: 'Active Stays', tone: 'purple', value: kpis ? formatCount(kpis.activeStays) : null, meta: kpis ? <span className="dash-muted">Guests checked in now</span> : null },
  ];
  return (
    <section aria-label="Key figures" className="dash-kpi-grid">
      {cards.map((card) => (
        <article className={`dash-kpi dash-kpi-${card.tone}`} key={card.key}>
          <span className="dash-kpi-icon">
            <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">{KPI_ICONS[card.key]}</svg>
          </span>
          <span className="dash-kpi-label">{card.label}</span>
          <strong className="dash-kpi-value">{card.value ?? <span className="dash-kpi-skeleton" />}</strong>
          <span className="dash-kpi-meta">{card.meta}</span>
        </article>
      ))}
    </section>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return <span className="dash-muted">{current > 0 ? `${formatCount(current)} today` : 'No comparison yet'}</span>;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className="dash-muted">Same as yesterday</span>;
  const up = change > 0;
  return (
    <span className={up ? 'dash-up' : 'dash-down'}>
      {up ? '↑' : '↓'} {Math.abs(change)}% <span className="dash-muted">vs. yesterday</span>
    </span>
  );
}

/* ----------------------------------------------------- Booking overview */

const CHART_W = 640;
const CHART_H = 230;
const PAD = { b: 28, l: 34, r: 34, t: 14 };

export function BookingOverviewCard({ points }: { points: AdminBookingTrendPoint[] | null }) {
  return (
    <Card sub="Last 7 days" title="Booking Overview">
      {points ? <TrendChart points={points} /> : <Skeleton />}
    </Card>
  );
}

function TrendChart({ points }: { points: AdminBookingTrendPoint[] }) {
  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;
  const bookings = points.map((point) => point.bookings);
  const revenue = points.map((point) => Number(point.revenue));
  const maxB = Math.max(...bookings, 1);
  const maxR = Math.max(...revenue, 1);
  const x = (i: number) => PAD.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number, max: number) => PAD.t + innerH - (v / max) * innerH;
  const line = (values: number[], max: number) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v, max)}`).join(' ');
  const area = `${line(bookings, maxB)} L${x(points.length - 1)},${PAD.t + innerH} L${x(0)},${PAD.t + innerH} Z`;
  const totalB = bookings.reduce((a, b) => a + b, 0);
  const totalR = revenue.reduce((a, b) => a + b, 0);
  const summary = `${totalB} bookings and ${formatInr(totalR)} collected over the last ${points.length} days.`;
  return (
    <div>
      <div className="dash-legend">
        <span><i style={{ background: '#2563eb' }} />Bookings</span>
        <span><i style={{ background: '#16a368' }} />Revenue</span>
        <span className="dash-muted">{summary}</span>
      </div>
      <svg aria-label={summary} className="dash-chart" role="img" viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        {[0, 1, 2, 3].map((step) => {
          const gy = PAD.t + (innerH / 3) * step;
          return <line key={step} stroke="#e6ebf3" x1={PAD.l} x2={CHART_W - PAD.r} y1={gy} y2={gy} />;
        })}
        <path d={area} fill="rgba(37, 99, 235, 0.08)" />
        <path d={line(revenue, maxR)} fill="none" stroke="#16a368" strokeLinejoin="round" strokeWidth="2.4" />
        <path d={line(bookings, maxB)} fill="none" stroke="#2563eb" strokeLinejoin="round" strokeWidth="2.4" />
        {points.map((point, i) => (
          <g key={point.date}>
            <circle cx={x(i)} cy={y(Number(point.revenue), maxR)} fill="#fff" r="3.6" stroke="#16a368" strokeWidth="2" />
            <circle cx={x(i)} cy={y(point.bookings, maxB)} fill="#fff" r="3.6" stroke="#2563eb" strokeWidth="2">
              <title>{`${shortDate(point.date)}: ${point.bookings} bookings, ${formatInr(Number(point.revenue))} collected`}</title>
            </circle>
            <text fill="#6b7a90" fontSize="11" textAnchor="middle" x={x(i)} y={CHART_H - 8}>{shortDate(point.date)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------ Recent bookings */

export function RecentBookingsCard({ bookings }: { bookings: AdminBookingSummary[] | null }) {
  return (
    <Card action={{ href: '/admin/bookings', label: 'View All' }} title="Recent Bookings">
      {!bookings ? <Skeleton /> : bookings.length === 0 ? <p className="dash-empty">No bookings yet.</p> : (
        <div className="dash-scroll">
          <table className="dash-table">
            <thead><tr><th>Booking ID</th><th>Guest</th><th>Lodge</th><th>Check-in</th><th>Status</th><th className="dash-num">Amount</th></tr></thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td><Link className="dash-link" href={`/admin/bookings/${booking.id}`}>{booking.bookingCode}</Link></td>
                  <td>{booking.guestName}</td>
                  <td>{booking.lodgeName}</td>
                  <td>{formatDate(booking.checkInDate)}</td>
                  <td><span className={`dash-chip dash-chip-${statusTone(booking.status)}`}>{formatStatus(booking.status)}</span></td>
                  <td className="dash-num">{booking.totalAmount ? formatInr(Number(booking.totalAmount)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function statusTone(status: string): 'green' | 'blue' | 'orange' | 'red' | 'purple' {
  if (['ACCEPTED', 'QR_GENERATED'].includes(status)) return 'green';
  if (status === 'CHECKED_IN') return 'blue';
  if (['CHECKED_OUT', 'COMPLETED'].includes(status)) return 'purple';
  if (['REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(status)) return 'red';
  return 'orange';
}

/* -------------------------------------------------- Pending owner actions */

export function PendingActionsCard({ insights }: { insights: AdminDashboardInsights | null }) {
  return (
    <Card sub={insights ? `${insights.pendingActionTotal} open` : undefined} title="Pending Owner Actions">
      {!insights ? <Skeleton /> : insights.pendingActions.length === 0 ? <p className="dash-empty">Nothing is waiting on owners right now.</p> : (
        <>
          <ul className="dash-list">
            {insights.pendingActions.map((action: AdminPendingAction) => (
              <li key={action.id}>
                <span className={`dash-ico dash-ico-${action.kind === 'BOOKING_APPROVAL' ? 'orange' : action.kind === 'LODGE_VERIFICATION' ? 'red' : 'blue'}`} />
                <div className="dash-grow">
                  <span className="dash-item-title">{action.title}</span>
                  <span className="dash-item-sub">{action.subtitle}</span>
                </div>
                <span className="dash-time">{timeAgo(action.createdAt)}</span>
                <Link className="dash-btn-soft" href={action.href}>{action.kind === 'BOOKING_APPROVAL' ? 'Open' : 'Review'}</Link>
              </li>
            ))}
          </ul>
          {insights.pendingActionTotal > insights.pendingActions.length ? <p className="dash-note">Showing the {insights.pendingActions.length} oldest of {insights.pendingActionTotal}.</p> : null}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------ Revenue summary */

export function RevenueSummaryCard({
  insights,
  onPeriod,
  period,
}: {
  insights: AdminDashboardInsights | null;
  onPeriod: (value: 'today' | 'week' | 'month') => void;
  period: 'today' | 'week' | 'month';
}) {
  const summary = insights?.revenueSummary;
  const online = Number(summary?.online ?? 0);
  const lodge = Number(summary?.payAtLodge ?? 0);
  const total = online + lodge;
  const r = 54;
  const c = 2 * Math.PI * r;
  const onlineLen = total > 0 ? (online / total) * c : 0;
  const lodgeLen = total > 0 ? (lodge / total) * c : 0;
  const pct = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '0%');
  return (
    <article className="dash-card">
      <header className="dash-card-head">
        <h2>Revenue Summary</h2>
        <select aria-label="Revenue period" className="dash-select" onChange={(event) => onPeriod(event.target.value as 'today' | 'week' | 'month')} value={period}>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">This month</option>
        </select>
      </header>
      {!summary ? <Skeleton /> : (
        <div className="dash-donut-wrap">
          <svg aria-label={`Collected ${formatInr(total)}: ${formatInr(online)} online and ${formatInr(lodge)} at the lodge.`} className="dash-donut" role="img" viewBox="0 0 150 150">
            <circle cx="75" cy="75" fill="none" r={r} stroke="#eef2f8" strokeWidth="18" />
            {total > 0 ? (
              <>
                <circle cx="75" cy="75" fill="none" r={r} stroke="#2563eb" strokeDasharray={`${onlineLen} ${c}`} strokeWidth="18" transform="rotate(-90 75 75)" />
                <circle cx="75" cy="75" fill="none" r={r} stroke="#f5a524" strokeDasharray={`${lodgeLen} ${c}`} strokeDashoffset={-onlineLen} strokeWidth="18" transform="rotate(-90 75 75)" />
              </>
            ) : null}
            <text fill="#0f1f3d" fontSize="15" fontWeight="800" textAnchor="middle" x="75" y="73">{formatInr(total)}</text>
            <text fill="#6b7a90" fontSize="9" textAnchor="middle" x="75" y="89">Total Revenue</text>
          </svg>
          <div className="dash-donut-legend">
            <div className="dash-legend-row"><span><i style={{ background: '#2563eb' }} />Online payments</span><b>{pct(online)}</b></div>
            <div className="dash-legend-row"><span><i style={{ background: '#f5a524' }} />Paid at lodge</span><b>{pct(lodge)}</b></div>
            <div className="dash-legend-row"><span><i style={{ background: '#16a368' }} />Platform commission</span><b>{formatInr(Number(summary.commission))}</b></div>
            <p className="dash-note">{summary.bookingCount} bookings in period</p>
          </div>
        </div>
      )}
    </article>
  );
}

/* ---------------------------------------------------------- Quick alerts */

export function QuickAlertsCard({ insights }: { insights: AdminDashboardInsights | null }) {
  return (
    <Card action={{ href: '/admin/operations/intervention', label: 'View All' }} title="Quick Alerts">
      {!insights ? <Skeleton /> : insights.alerts.length === 0 ? <p className="dash-empty">All clear. No payment, owner or delivery problems detected.</p> : (
        <ul className="dash-list">
          {insights.alerts.map((alert: AdminDashboardAlert) => (
            <li key={alert.id}>
              <span className={`dash-ico dash-ico-${alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue'}`} />
              <div className="dash-grow">
                <span className="dash-item-title">{alert.title}</span>
                <span className="dash-item-sub">{alert.detail}</span>
              </div>
              <Link className="dash-btn-soft" href={alert.href}>View</Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------- Top lodges */

export function TopLodgesCard({ insights }: { insights: AdminDashboardInsights | null }) {
  return (
    <Card action={{ href: '/admin/lodges', label: 'View All' }} title="Top Performing Lodges">
      {!insights ? <Skeleton /> : insights.topLodges.length === 0 ? <p className="dash-empty">No bookings in this period yet.</p> : (
        <table className="dash-table">
          <thead><tr><th>Lodge</th><th className="dash-num">Bookings</th><th className="dash-num">Revenue</th></tr></thead>
          <tbody>
            {insights.topLodges.map((lodge) => (
              <tr key={lodge.lodgeId}>
                <td><Link className="dash-link dash-link-text" href={`/admin/lodges/${lodge.lodgeId}`}>{lodge.name}</Link></td>
                <td className="dash-num">{lodge.bookings}</td>
                <td className="dash-num">{formatInr(Number(lodge.revenue))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------- Settlements */

export function SettlementsCard({ operations }: { operations: AdminDashboardOperations | null }) {
  return (
    <Card action={{ href: '/admin/commission', label: 'Manage' }} title="Owner Settlements">
      {!operations ? <Skeleton /> : <SettlementBody summary={operations.settlements} />}
    </Card>
  );
}

function SettlementBody({ summary }: { summary: AdminSettlementSummary }) {
  return (
    <div>
      <div className="dash-stat-row">
        <div className="dash-stat"><span>Pending amount</span><strong>{formatInr(Number(summary.outstandingTotal))}</strong></div>
        <div className="dash-stat"><span>Lodges awaiting</span><strong>{summary.lodgesAwaiting}</strong></div>
        <div className="dash-stat"><span>Last settlement</span><strong>{summary.lastSettledAt ? formatDate(summary.lastSettledAt) : 'None yet'}</strong></div>
      </div>
      {summary.recent.length === 0 ? <p className="dash-empty">No settlements recorded yet.</p> : (
        <ul className="dash-list">
          {summary.recent.slice(0, 3).map((item) => (
            <li key={item.id}>
              <div className="dash-grow">
                <span className="dash-item-title">{item.lodgeName}</span>
                <span className="dash-item-sub">{formatDate(item.settledAt)} · {item.paymentMethod}{item.reference ? ` · Ref ${item.reference}` : ''}</span>
              </div>
              <span className="dash-chip dash-chip-green">Settled {formatInr(Number(item.amount))}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="dash-note">Commission owed by lodges to the platform. No settlement schedule is configured, so there is no next-settlement date.</p>
    </div>
  );
}

/* ---------------------------------------------------------- Availability */

export function AvailabilityCard({ operations }: { operations: AdminDashboardOperations | null }) {
  const totals = operations?.availability.totals;
  return (
    <Card sub={totals ? `${totals.remaining} of ${totals.total} rooms open` : undefined} title="Lodge Availability">
      {!operations ? <Skeleton /> : operations.availability.rows.length === 0 ? <p className="dash-empty">No active rooms found yet.</p> : (
        <div>
          <div className="dash-legend">
            <span><i style={{ background: '#e5484d' }} />Occupied</span>
            <span><i style={{ background: '#16a368' }} />Remaining</span>
            <span><i style={{ background: '#f5a524' }} />Unavailable / maintenance</span>
          </div>
          <ul className="dash-avail-list">
            {operations.availability.rows.map((row: AdminLodgeAvailabilityRow) => {
              const pct = (v: number) => (row.total > 0 ? (v / row.total) * 100 : 0);
              return (
                <li key={row.lodgeId}>
                  <div className="dash-avail-head">
                    <Link className="dash-link dash-link-text" href={`/admin/lodges/${row.lodgeId}`}>{row.name}</Link>
                    <span className="dash-card-sub">{row.total} rooms</span>
                  </div>
                  <div aria-label={`${row.name}: ${row.occupied} occupied, ${row.remaining} remaining, ${row.unavailable} unavailable`} className="dash-bar" role="img">
                    <i style={{ background: '#e5484d', width: `${pct(row.occupied)}%` }} />
                    <i style={{ background: '#16a368', width: `${pct(row.remaining)}%` }} />
                    <i style={{ background: '#f5a524', width: `${pct(row.unavailable)}%` }} />
                  </div>
                  <div className="dash-avail-meta"><span>Occupied <b>{row.occupied}</b></span><span>Remaining <b>{row.remaining}</b></span><span>Unavailable <b>{row.unavailable}</b></span></div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- Activity */

export function ActivityCard({ operations }: { operations: AdminDashboardOperations | null }) {
  return (
    <Card action={{ href: '/admin/audit', label: 'View All' }} title="Recent Activity">
      {!operations ? <Skeleton /> : operations.activity.length === 0 ? <p className="dash-empty">No recent activity recorded.</p> : (
        <ul className="dash-list">
          {operations.activity.map((item: AdminActivityItem) => (
            <li key={item.id}>
              <span className="dash-ico dash-ico-blue" />
              <div className="dash-grow">
                <span className="dash-item-title">{item.label}</span>
                <span className="dash-item-sub">{item.actorName ?? 'System'} · {item.entityType.replace(/_/gu, ' ')}</span>
              </div>
              <span className="dash-time">{timeAgo(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- Banner */

export function JourneyBanner() {
  return (
    <aside className="dash-banner">
      <div>
        <strong>Keep the journey smooth</strong>
        <p>Manage lodges, bookings, users and more — all in one place.</p>
      </div>
      <Link className="dash-banner-btn" href="/admin/settings">Go to Settings →</Link>
    </aside>
  );
}
