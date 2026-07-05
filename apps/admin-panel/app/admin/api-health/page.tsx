'use client';

import type { NotificationMetrics, PresenceSummary, QrScanLogEntry } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getMonitoringNotificationMetrics,
  getMonitoringPresence,
  getPlatformHealth,
  listMonitoringQrScanLogs,
  type HealthResponse,
} from '../../../src/api/admin-monitoring-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { monitoredApiRows, summarizeQrScans } from '../../../src/monitoring/monitoring-utils';

export default function AdminApiHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [presence, setPresence] = useState<PresenceSummary | null>(null);
  const [notificationMetrics, setNotificationMetrics] = useState<NotificationMetrics | null>(null);
  const [qrLogs, setQrLogs] = useState<QrScanLogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [healthResponse, presenceResponse, notificationResponse, qrResponse] =
        await Promise.all([
          getPlatformHealth(),
          getMonitoringPresence(),
          getMonitoringNotificationMetrics(),
          listMonitoringQrScanLogs(),
        ]);
      setHealth(healthResponse);
      setPresence(presenceResponse);
      setNotificationMetrics(notificationResponse);
      setQrLogs(qrResponse.items);
    } catch {
      setErrorMessage('API diagnostics could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const qrSummary = useMemo(() => summarizeQrScans(qrLogs), [qrLogs]);

  return (
    <PermissionGate permission="system_health.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">API Diagnostics</p>
            <h2>Critical API availability</h2>
            <p className="muted-copy">
              Displays available health signals and marks response-time/error-rate metrics as
              instrumentation work where backend diagnostics are not yet exposed.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="grid grid-4">
          <Metric label="Backend" value={health?.status === 'ok' ? 'Healthy' : 'Degraded'} />
          <Metric label="Realtime users" value={String(presence?.totalOnline ?? 0)} />
          <Metric
            label="Notification failures"
            value={String(notificationMetrics?.failedCount ?? 0)}
          />
          <Metric label="QR success" value={`${qrSummary.successRate}%`} />
        </section>

        <section className="table-panel">
          <div className="admin-table api-health-table">
            <div className="admin-table-row admin-table-head">
              <span>Endpoint</span>
              <span>Availability</span>
              <span>Average</span>
              <span>P95</span>
              <span>Error Rate</span>
              <span>Success Rate</span>
              <span>Last Failure</span>
            </div>
            {monitoredApiRows.map((row) => (
              <div className="admin-table-row" key={row.endpoint}>
                <span>{row.endpoint}</span>
                <span className="status-card">{row.availability}</span>
                <span>{row.responseTime}</span>
                <span>{row.p95Response}</span>
                <span>{row.errorRate}</span>
                <span>{row.successRate}</span>
                <span>{row.lastFailure}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">API</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
