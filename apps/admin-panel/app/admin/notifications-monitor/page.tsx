'use client';

import type { NotificationMetrics } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMonitoringNotificationMetrics } from '../../../src/api/admin-monitoring-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminNotificationsMonitorPage() {
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [filter, setFilter] = useState('All');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      setMetrics(await getMonitoringNotificationMetrics());
    } catch {
      setErrorMessage('Notification monitoring data could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deliverySuccess = useMemo(() => {
    if (!metrics || metrics.sentCount === 0) {
      return 0;
    }

    return Math.round((metrics.deliveredCount / metrics.sentCount) * 100);
  }, [metrics]);

  return (
    <PermissionGate permission="system_health.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Notification Monitoring</p>
            <h2>Delivery and failure visibility</h2>
            <p className="muted-copy">
              Monitor sent, delivered, failed, read, invalid token, and delivery-success signals.
              Provider queue depth requires future instrumentation.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Filter foundation</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                {['All', 'Owner', 'Pilgrim', 'Admin', 'Announcement', 'Emergency'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="grid grid-4">
          <Metric label="Notifications Sent" value={metrics?.sentCount ?? 0} />
          <Metric label="Delivered" value={metrics?.deliveredCount ?? 0} />
          <Metric label="Failed" value={metrics?.failedCount ?? 0} />
          <Metric label="Delivery Success" value={deliverySuccess} suffix="%" />
        </section>

        <section className="grid grid-4">
          <Metric label="Read" value={metrics?.readCount ?? 0} />
          <Metric
            label="Pending"
            value={Math.max((metrics?.totalNotifications ?? 0) - (metrics?.sentCount ?? 0), 0)}
          />
          <Metric label="Invalid Tokens" value={metrics?.invalidDeviceTokens ?? 0} />
          <Metric label="Failure Rate" value={metrics?.failureRate ?? 0} suffix="%" />
        </section>

        <section className="table-panel">
          <p className="eyebrow">Recent Failures</p>
          <div className="admin-table notification-monitor-table">
            <div className="admin-table-row admin-table-head">
              <span>Notification</span>
              <span>Failure Reason</span>
              <span>Queue</span>
            </div>
            {(metrics?.recentFailures ?? []).map((failure) => (
              <div className="admin-table-row" key={failure.notificationId}>
                <span>{failure.notificationId}</span>
                <span>{failure.failureReason ?? 'Unknown failure'}</span>
                <span>Retry queue endpoint required</span>
              </div>
            ))}
          </div>
          {(metrics?.recentFailures.length ?? 0) === 0 ? (
            <p className="empty-table">No recent notification failures.</p>
          ) : null}
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, suffix = '', value }: { label: string; suffix?: string; value: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">FCM</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </div>
    </div>
  );
}
