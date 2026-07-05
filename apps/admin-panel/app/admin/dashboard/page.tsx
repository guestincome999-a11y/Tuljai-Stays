'use client';

import type {
  AdminBookingSummary,
  AdminDashboardSummary,
  Lodge,
  NotificationMetrics,
  PresenceSummary,
  QrScanLogEntry,
} from '@tuljai/types';
import { useMemo, useState } from 'react';

import { PermissionGate } from '../../../src/components/PermissionGate';
import { useLiveOperations } from '../../../src/hooks/useLiveOperations';

interface KpiCard {
  action: string;
  icon: string;
  label: string;
  value: string;
}

export default function AdminDashboardPage() {
  const operations = useLiveOperations();
  const [query, setQuery] = useState('');
  const kpis = getKpiCards(
    operations.summary,
    operations.presence,
    operations.notificationMetrics,
    operations.qrScans,
  );
  const filteredBookings = useMemo(
    () => filterBookings(operations.bookings, query),
    [operations.bookings, query],
  );
  const interventionQueue = useMemo(
    () => buildInterventionQueue(operations.bookings, operations.qrScans),
    [operations.bookings, operations.qrScans],
  );
  const lodgeCards = useMemo(
    () => buildLodgeCards(operations.lodges, operations.bookings),
    [operations.bookings, operations.lodges],
  );

  return (
    <PermissionGate permission="dashboard.view">
      <PermissionGate permission="operations.view">
        <div className="page-stack" aria-live="polite">
          {operations.announcements[0] ? (
            <section className="emergency-banner">
              <div>
                <p className="eyebrow">Emergency Operations</p>
                <h2>{operations.announcements[0].title}</h2>
                <p>{operations.announcements[0].body}</p>
              </div>
              <span className="status-card">High priority</span>
            </section>
          ) : null}

          <section className="hero-panel command-hero">
            <div>
              <p className="eyebrow">Live Operations Center</p>
              <h2>Enterprise Command Dashboard</h2>
              <p>
                Realtime monitoring for bookings, owner presence, rooms, QR health, notifications,
                and admin intervention during peak pilgrimage operations.
              </p>
            </div>
            <div className="hero-actions">
              <span className={operations.connected ? 'live-pill live-pill-on' : 'live-pill'}>
                {operations.connected ? 'Realtime connected' : 'REST fallback active'}
              </span>
              <span className="status-card">
                Updated{' '}
                {operations.lastUpdatedAt ? formatTime(operations.lastUpdatedAt) : 'pending'}
              </span>
              <button
                className="button button-primary"
                disabled={operations.isRefreshing}
                type="button"
                onClick={() => void operations.refresh()}
              >
                Refresh
              </button>
            </div>
          </section>

          {operations.errorMessage ? (
            <section className="error-banner">
              {operations.errorMessage}
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void operations.refresh()}
              >
                Retry
              </button>
            </section>
          ) : null}

          <section className="dashboard-search" role="search">
            <label>
              <span>Global dashboard search</span>
              <input
                placeholder="Search booking, lodge, owner, phone, guest, room"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p className="muted-copy">
              Results open future admin pages when those routes are implemented.
            </p>
          </section>

          <section className="ops-kpi-grid">
            {kpis.map((card) => (
              <button className="kpi-card" key={card.label} type="button">
                <span className="kpi-icon" aria-hidden="true">
                  {card.icon}
                </span>
                <span>
                  <span className="kpi-label">{card.label}</span>
                  <strong>{card.value}</strong>
                  <span className="kpi-meta">
                    {operations.lastUpdatedAt ? formatTime(operations.lastUpdatedAt) : 'Loading'} /
                    Live
                  </span>
                  <span className="kpi-action">{card.action}</span>
                </span>
              </button>
            ))}
          </section>

          <section className="grid grid-2">
            <OwnerPresencePanel presence={operations.presence} />
            <NotificationHealth metrics={operations.notificationMetrics} />
          </section>

          <section className="grid grid-2">
            <InterventionQueue items={interventionQueue} />
            <QrMonitoring qrScans={operations.qrScans} summary={operations.summary} />
          </section>

          <section className="grid grid-2">
            <LiveBookingFeed bookings={filteredBookings} />
            <FestivalWidget
              enabled={operations.festivalModeEnabled}
              presence={operations.presence}
              summary={operations.summary}
            />
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Live Lodge Status Board</p>
                <h3>Lodge pressure and room posture</h3>
              </div>
            </div>
            <div className="lodge-board">
              {lodgeCards.map((lodge) => (
                <article className={`lodge-card lodge-card-${lodge.color}`} key={lodge.id}>
                  <h4>{lodge.name}</h4>
                  <p>{lodge.status}</p>
                  <dl>
                    <div>
                      <dt>Pending</dt>
                      <dd>{lodge.pendingBookings}</dd>
                    </div>
                    <div>
                      <dt>Available</dt>
                      <dd>{lodge.availableRooms}</dd>
                    </div>
                    <div>
                      <dt>Occupied</dt>
                      <dd>{lodge.occupiedRooms}</dd>
                    </div>
                    <div>
                      <dt>Rating</dt>
                      <dd>{lodge.averageRating}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Live Map Foundation</p>
                <h3>Lodge operating map</h3>
              </div>
            </div>
            <div className="map-foundation">
              {lodgeCards.slice(0, 12).map((lodge) => (
                <button
                  className={`map-marker map-marker-${lodge.color}`}
                  key={lodge.id}
                  type="button"
                >
                  <span>{lodge.name}</span>
                  <small>{lodge.pendingBookings} pending</small>
                </button>
              ))}
            </div>
          </section>

          <section className="quick-actions">
            {[
              'Bookings',
              'Operations Queue',
              'Lodges',
              'Owners',
              'Notifications',
              'Announcements',
              'Reports',
              'Security',
              'Settings',
            ].map((action) => (
              <button className="button button-secondary" key={action} type="button">
                {action}
              </button>
            ))}
          </section>
        </div>
      </PermissionGate>
    </PermissionGate>
  );
}

function OwnerPresencePanel({ presence }: { presence: PresenceSummary | null }) {
  const onlineOwners = presence?.onlineOwners ?? 0;

  return (
    <section className="panel">
      <p className="eyebrow">Live Owner Presence</p>
      <h3>{onlineOwners} owners online</h3>
      <div className="presence-list">
        <PresenceRow label="Available owners" status="green" value={onlineOwners} />
        <PresenceRow label="Busy owners" status="yellow" value="Realtime detail pending" />
        <PresenceRow label="Offline owners" status="red" value="Owner detail API pending" />
      </div>
      <p className="muted-copy">
        Detailed owner name, assigned lodge, response time, and last seen need an admin owner
        presence endpoint.
      </p>
    </section>
  );
}

function PresenceRow({
  label,
  status,
  value,
}: {
  label: string;
  status: 'green' | 'red' | 'yellow';
  value: number | string;
}) {
  return (
    <div className="presence-row">
      <span className={`presence-dot presence-dot-${status}`} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NotificationHealth({ metrics }: { metrics: NotificationMetrics | null }) {
  return (
    <section className="panel">
      <p className="eyebrow">Notification Health</p>
      <h3>{metrics?.failedCount ?? 0} failed</h3>
      <div className="mini-metric-grid">
        <Metric label="Sent" value={metrics?.sentCount ?? 0} />
        <Metric label="Delivered" value={metrics?.deliveredCount ?? 0} />
        <Metric label="Pending" value={getPendingNotifications(metrics)} />
        <Metric label="Read" value={metrics?.readCount ?? 0} />
      </div>
      <p className="muted-copy">
        Retry queue details will attach to notification delivery controls later.
      </p>
    </section>
  );
}

function InterventionQueue({ items }: { items: InterventionQueueItem[] }) {
  return (
    <section className="panel">
      <p className="eyebrow">Admin Intervention Queue</p>
      <h3>{items.length} items need attention</h3>
      <div className="queue-list">
        {items.length === 0 ? (
          <p className="muted-copy">No active intervention items detected.</p>
        ) : null}
        {items.map((item) => (
          <article className="queue-item" key={item.id}>
            <span className={`priority priority-${item.priority.toLowerCase()}`}>
              {item.priority}
            </span>
            <div>
              <strong>{item.bookingCode}</strong>
              <p>
                {item.pilgrim} / {item.lodge} / {item.waitingTime}
              </p>
              <p>{item.reason}</p>
              <div className="queue-actions">
                {[
                  'Open Booking',
                  'Call Owner',
                  'Call Pilgrim',
                  'Copy Phone',
                  'Record Call Outcome',
                  'Add Note',
                  'Escalate',
                  'Transfer',
                ].map((action) => (
                  <button className="ghost-control" key={action} type="button">
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function QrMonitoring({
  qrScans,
  summary,
}: {
  qrScans: QrScanLogEntry[];
  summary: AdminDashboardSummary | null;
}) {
  const failures = qrScans.filter((scan) => scan.result !== 'SUCCESS');

  return (
    <section className="panel">
      <p className="eyebrow">Live QR Monitoring</p>
      <h3>{failures.length} recent QR failures</h3>
      <div className="mini-metric-grid">
        <Metric label="Generated" value="API pending" />
        <Metric label="Scanned" value={qrScans.length} />
        <Metric label="Duplicate/Used" value={countQr(qrScans, 'USED')} />
        <Metric label="Expired" value={countQr(qrScans, 'EXPIRED')} />
        <Metric label="Wrong Lodge" value={countQr(qrScans, 'WRONG_LODGE')} />
        <Metric label="Invalid" value={countQr(qrScans, 'INVALID')} />
      </div>
      <p className="muted-copy">
        Room and check-in totals remain live through dashboard summary:{' '}
        {summary?.todayCheckIns ?? 0} check-ins today.
      </p>
    </section>
  );
}

function LiveBookingFeed({ bookings }: { bookings: AdminBookingSummary[] }) {
  return (
    <section className="panel">
      <p className="eyebrow">Live Booking Feed</p>
      <h3>Newest bookings</h3>
      <div className="feed-list">
        {bookings.map((booking) => (
          <article className="feed-item" key={booking.id}>
            <div>
              <strong>{booking.bookingCode}</strong>
              <p>
                {booking.guestName} / {booking.lodgeName}
              </p>
            </div>
            <span className="status-card">{formatStatus(booking.status)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function FestivalWidget({
  enabled,
  presence,
  summary,
}: {
  enabled: boolean;
  presence: PresenceSummary | null;
  summary: AdminDashboardSummary | null;
}) {
  if (!enabled) {
    return (
      <section className="panel muted-panel">
        <p className="eyebrow">Festival Operations</p>
        <h3>Festival mode inactive</h3>
        <p>
          This widget appears with live pressure indicators when public festival mode is enabled.
        </p>
      </section>
    );
  }

  const occupancy = getOccupancy(summary?.occupiedRooms ?? 0, summary?.availableRooms ?? 0);

  return (
    <section className="panel festival-panel">
      <p className="eyebrow">Festival Operations</p>
      <h3>Festival mode active</h3>
      <div className="mini-metric-grid">
        <Metric label="Occupancy" value={`${occupancy}%`} />
        <Metric label="Booking Pressure" value={summary?.pendingBookings ?? 0} />
        <Metric label="Avg Response" value="Endpoint pending" />
        <Metric label="Waiting Time" value="Endpoint pending" />
        <Metric label="Today's Pilgrims" value={presence?.onlinePilgrims ?? 0} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getKpiCards(
  summary: AdminDashboardSummary | null,
  presence: PresenceSummary | null,
  metrics: NotificationMetrics | null,
  qrScans: QrScanLogEntry[],
): KpiCard[] {
  const failedQrScans = qrScans.filter((scan) => scan.result !== 'SUCCESS').length;
  const pendingNotifications = metrics
    ? Math.max(metrics.totalNotifications - metrics.sentCount - metrics.failedCount, 0)
    : 0;

  return [
    {
      action: 'Open pilgrims',
      icon: 'P',
      label: 'Active Pilgrims',
      value: String(presence?.onlinePilgrims ?? 0),
    },
    {
      action: 'Open owners',
      icon: 'O',
      label: 'Active Lodge Owners',
      value: String(summary?.totalOwners ?? 0),
    },
    {
      action: 'Open owner presence',
      icon: 'O',
      label: 'Online Owners',
      value: String(presence?.onlineOwners ?? summary?.liveOwnersOnline ?? 0),
    },
    { action: 'Open owner presence', icon: 'B', label: 'Busy Owners', value: 'Detail API pending' },
    {
      action: 'Open owner presence',
      icon: 'F',
      label: 'Offline Owners',
      value: getOfflineOwnerCount(summary, presence),
    },
    {
      action: 'Open bookings',
      icon: 'B',
      label: 'Pending Bookings',
      value: String(summary?.pendingBookings ?? 0),
    },
    {
      action: 'Open queue',
      icon: 'Q',
      label: 'Bookings Waiting for Owner',
      value: String(summary?.pendingBookings ?? 0),
    },
    {
      action: 'Open queue',
      icon: 'I',
      label: 'Admin Intervention Queue',
      value: String(summary?.pendingBookings ?? 0),
    },
    {
      action: 'Open bookings',
      icon: 'T',
      label: "Today's Bookings",
      value: String(summary?.todayBookings ?? 0),
    },
    {
      action: 'Open register',
      icon: 'I',
      label: "Today's Check-ins",
      value: String(summary?.todayCheckIns ?? 0),
    },
    {
      action: 'Open register',
      icon: 'O',
      label: "Today's Check-outs",
      value: String(summary?.todayCheckOuts ?? 0),
    },
    {
      action: 'Open rooms',
      icon: 'R',
      label: 'Rooms Available',
      value: String(summary?.availableRooms ?? 0),
    },
    {
      action: 'Open rooms',
      icon: 'R',
      label: 'Rooms Occupied',
      value: String(summary?.occupiedRooms ?? 0),
    },
    { action: 'Open rooms', icon: 'C', label: 'Rooms Cleaning', value: 'Endpoint pending' },
    { action: 'Open rooms', icon: 'M', label: 'Rooms Maintenance', value: 'Endpoint pending' },
    {
      action: 'Open QR monitoring',
      icon: 'Q',
      label: 'QR Generated Today',
      value: 'Endpoint pending',
    },
    {
      action: 'Open QR monitoring',
      icon: 'S',
      label: 'QR Scans Today',
      value: String(qrScans.length),
    },
    {
      action: 'Open QR monitoring',
      icon: 'F',
      label: 'Failed QR Scans',
      value: String(failedQrScans),
    },
    {
      action: 'Open notifications',
      icon: 'N',
      label: 'Notifications Pending',
      value: String(pendingNotifications),
    },
    {
      action: 'Open notifications',
      icon: 'F',
      label: 'Failed Notifications',
      value: String(summary?.failedNotifications ?? metrics?.failedCount ?? 0),
    },
    {
      action: 'Open announcements',
      icon: 'E',
      label: 'Emergency Announcements Active',
      value: 'Visible if active',
    },
  ];
}

interface InterventionQueueItem {
  bookingCode: string;
  id: string;
  lodge: string;
  pilgrim: string;
  priority: 'HIGH' | 'MEDIUM';
  reason: string;
  waitingTime: string;
}

function buildInterventionQueue(
  bookings: AdminBookingSummary[],
  qrScans: QrScanLogEntry[],
): InterventionQueueItem[] {
  const bookingItems = bookings
    .filter(
      (booking) => booking.status === 'PENDING_OWNER_APPROVAL' || booking.status === 'EXPIRED',
    )
    .slice(0, 6)
    .map((booking) => ({
      bookingCode: booking.bookingCode,
      id: booking.id,
      lodge: booking.lodgeName,
      pilgrim: booking.guestName,
      priority: booking.status === 'EXPIRED' ? 'HIGH' : 'MEDIUM',
      reason:
        booking.status === 'EXPIRED'
          ? 'Booking expired before owner response'
          : 'Waiting for owner response',
      waitingTime: getWaitingTime(booking.createdAt),
    })) satisfies InterventionQueueItem[];

  const qrItems = qrScans
    .filter((scan) => scan.result !== 'SUCCESS')
    .slice(0, 3)
    .map((scan) => ({
      bookingCode: scan.bookingCode ?? 'QR scan',
      id: scan.id,
      lodge: scan.lodgeId ?? 'Unknown lodge',
      pilgrim: scan.guestName ?? 'Unknown pilgrim',
      priority: 'HIGH',
      reason: `QR validation failed: ${formatStatus(scan.result)}`,
      waitingTime: getWaitingTime(scan.createdAt),
    })) satisfies InterventionQueueItem[];

  return [...bookingItems, ...qrItems].slice(0, 8);
}

function buildLodgeCards(lodges: Lodge[], bookings: AdminBookingSummary[]) {
  return lodges.map((lodge) => {
    const lodgeBookings = bookings.filter((booking) => booking.lodgeId === lodge.id);
    const pendingBookings = lodgeBookings.filter(
      (booking) => booking.status === 'PENDING_OWNER_APPROVAL',
    ).length;
    const occupiedRooms = lodgeBookings.filter((booking) => booking.status === 'CHECKED_IN').length;
    const availableRooms = Math.max(0, 10 - occupiedRooms);
    const color =
      lodge.status === 'SUSPENDED'
        ? 'gray'
        : pendingBookings > 3
          ? 'red'
          : pendingBookings > 0
            ? 'yellow'
            : 'green';

    return {
      averageRating: 'Endpoint pending',
      availableRooms,
      color,
      id: lodge.id,
      name: lodge.name,
      occupiedRooms,
      pendingBookings,
      status: formatStatus(lodge.status),
    };
  });
}

function filterBookings(bookings: AdminBookingSummary[], query: string): AdminBookingSummary[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return bookings;
  }

  return bookings.filter((booking) =>
    [
      booking.bookingCode,
      booking.guestName,
      booking.guestPhone,
      booking.lodgeName,
      booking.roomNumber,
      booking.roomTypeName,
      booking.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized)),
  );
}

function getPendingNotifications(metrics: NotificationMetrics | null): number {
  if (!metrics) {
    return 0;
  }

  return Math.max(metrics.totalNotifications - metrics.sentCount - metrics.failedCount, 0);
}

function countQr(scans: QrScanLogEntry[], result: QrScanLogEntry['result']): number {
  return scans.filter((scan) => scan.result === result).length;
}

function getOccupancy(occupiedRooms: number, availableRooms: number): number {
  const total = occupiedRooms + availableRooms;
  return total === 0 ? 0 : Math.round((occupiedRooms / total) * 100);
}

function getOfflineOwnerCount(
  summary: AdminDashboardSummary | null,
  presence: PresenceSummary | null,
): string {
  if (!summary) {
    return '0';
  }

  return String(
    Math.max(summary.totalOwners - (presence?.onlineOwners ?? summary.liveOwnersOnline), 0),
  );
}

function getWaitingTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatStatus(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
