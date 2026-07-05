'use client';

import type {
  AdminDashboardSummary,
  FeatureFlag,
  NotificationMetrics,
  PresenceSummary,
  QrScanLogEntry,
  SystemSetting,
} from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getMonitoringDashboardSummary,
  getMonitoringNotificationMetrics,
  getMonitoringPresence,
  getPlatformHealth,
  listMonitoringFeatureFlags,
  listMonitoringQrScanLogs,
  listMonitoringSettings,
  type HealthResponse,
} from '../../../src/api/admin-monitoring-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  buildHealthServices,
  buildMonitoringAlerts,
  type HealthServiceCard,
} from '../../../src/monitoring/monitoring-utils';

interface SystemHealthState {
  flags: FeatureFlag[];
  health: HealthResponse | null;
  notificationMetrics: NotificationMetrics | null;
  presence: PresenceSummary | null;
  qrLogs: QrScanLogEntry[];
  settings: SystemSetting[];
  summary: AdminDashboardSummary | null;
}

const emptyState: SystemHealthState = {
  flags: [],
  health: null,
  notificationMetrics: null,
  presence: null,
  qrLogs: [],
  settings: [],
  summary: null,
};

export default function AdminSystemHealthPage() {
  const [state, setState] = useState<SystemHealthState>(emptyState);
  const [checkedAt, setCheckedAt] = useState(new Date().toISOString());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    const nextCheckedAt = new Date().toISOString();
    try {
      const [health, presence, notificationMetrics, settings, flags, qrLogs, summary] =
        await Promise.all([
          getPlatformHealth(),
          getMonitoringPresence(),
          getMonitoringNotificationMetrics(),
          listMonitoringSettings(),
          listMonitoringFeatureFlags(),
          listMonitoringQrScanLogs(),
          getMonitoringDashboardSummary(),
        ]);
      setState({
        flags,
        health,
        notificationMetrics,
        presence,
        qrLogs: qrLogs.items,
        settings,
        summary,
      });
      setCheckedAt(nextCheckedAt);
    } catch {
      setErrorMessage('System health data could not be loaded.');
      setCheckedAt(nextCheckedAt);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);

    return () => window.clearInterval(timer);
  }, [load]);

  const services: HealthServiceCard[] = useMemo(
    () =>
      buildHealthServices(
        state.health,
        state.presence,
        state.notificationMetrics,
        state.settings,
        state.flags,
        checkedAt,
      ),
    [
      checkedAt,
      state.flags,
      state.health,
      state.notificationMetrics,
      state.presence,
      state.settings,
    ],
  );
  const alerts = useMemo(
    () => buildMonitoringAlerts(state.health, state.notificationMetrics, state.qrLogs, state.flags),
    [state.flags, state.health, state.notificationMetrics, state.qrLogs],
  );

  return (
    <PermissionGate permission="system_health.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Enterprise Monitoring</p>
            <h2>System health</h2>
            <p className="muted-copy">
              Auto-refreshing view of backend, database, realtime, storage, QR, notifications, and
              platform control health.
            </p>
          </div>
          <div className="hero-actions">
            <span className="live-pill live-pill-on">
              Last checked {new Date(checkedAt).toLocaleTimeString('en-IN')}
            </span>
            <button className="button button-primary" type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        {alerts.length > 0 ? (
          <section className="panel warning-panel">
            <p className="eyebrow">Alert Center</p>
            <div className="alert-grid">
              {alerts.map((alert) => (
                <article className="alert-card" key={`${alert.title}-${alert.message}`}>
                  <span className={`severity severity-${alert.severity.toLowerCase()}`}>
                    {alert.severity}
                  </span>
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="health-grid">
          {services.map((service) => (
            <article className="health-card" key={service.name}>
              <div className="section-header">
                <strong>{service.name}</strong>
                <span className={`health-badge health-${service.status.toLowerCase()}`}>
                  {service.status}
                </span>
              </div>
              <p>{service.detail}</p>
              <dl className="mini-metric-grid">
                <div className="mini-metric">
                  <span>Last checked</span>
                  <strong>{new Date(service.lastChecked).toLocaleTimeString('en-IN')}</strong>
                </div>
                <div className="mini-metric">
                  <span>Uptime</span>
                  <strong>{service.uptime}</strong>
                </div>
              </dl>
            </article>
          ))}
        </section>

        <section className="grid grid-4">
          <Metric label="Total bookings" value={state.summary?.totalBookings ?? 0} />
          <Metric label="Pending bookings" value={state.summary?.pendingBookings ?? 0} />
          <Metric label="Failed notifications" value={state.summary?.failedNotifications ?? 0} />
          <Metric label="Online users" value={state.presence?.totalOnline ?? 0} />
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">TS</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
