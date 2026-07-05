'use client';

import type { AdminBookingSummary, Announcement, FeatureFlag } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listMonitoringAnnouncements,
  listMonitoringBookings,
  listMonitoringFeatureFlags,
} from '../../../src/api/admin-monitoring-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  formatMonitoringLabel,
  summarizeRecentSecuritySignals,
} from '../../../src/monitoring/monitoring-utils';

export default function AdminSecurityPage() {
  const [bookings, setBookings] = useState<AdminBookingSummary[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [bookingResponse, announcementResponse, flagResponse] = await Promise.all([
        listMonitoringBookings(),
        listMonitoringAnnouncements(),
        listMonitoringFeatureFlags(),
      ]);
      setBookings(bookingResponse.items);
      setAnnouncements(announcementResponse.items);
      setFlags(flagResponse);
    } catch {
      setErrorMessage('Security signals could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signals = useMemo(
    () => summarizeRecentSecuritySignals(bookings, announcements, flags),
    [announcements, bookings, flags],
  );

  return (
    <PermissionGate permission="security.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Security Center</p>
            <h2>Security events and controls</h2>
            <p className="muted-copy">
              Review security-sensitive platform signals and access protected foundations for
              session revocation and audit investigation.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="grid grid-4">
          <Metric label="Failed Logins" value="Audit API required" />
          <Metric label="Admin Notices" value={String(signals.adminAnnouncements)} />
          <Metric label="Critical Modes" value={String(signals.criticalFlags)} />
          <Metric label="Session Revocations" value="Endpoint required" />
        </section>

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span>Severity</span>
              <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="">All severities</option>
                <option>Critical</option>
                <option>Warning</option>
                <option>Info</option>
              </select>
            </label>
          </div>
        </section>

        <section className="grid grid-2">
          <section className="panel warning-panel">
            <p className="eyebrow">Session Controls</p>
            <h3>Force logout foundation</h3>
            <p>
              Active session listing and admin-side revocation require
              <code> GET /api/admin/sessions </code>
              and
              <code> POST /api/admin/sessions/:id/revoke </code>.
            </p>
            <div className="quick-actions">
              <Link className="ghost-control" href="/admin/sessions">
                Open Sessions
              </Link>
              <Link className="ghost-control" href="/admin/audit">
                View Audit
              </Link>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Security Events</p>
            <h3>Current visible signals</h3>
            <div className="feed-list">
              {flags
                .filter((flag) =>
                  ['emergency_mode', 'maintenance_mode', 'admin_panel_enabled'].includes(flag.key),
                )
                .map((flag) => (
                  <article className="feed-item" key={flag.key}>
                    <span>{formatMonitoringLabel(flag.key)}</span>
                    <span className="status-card">{flag.enabled ? 'Enabled' : 'Disabled'}</span>
                  </article>
                ))}
            </div>
          </section>
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">SEC</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
