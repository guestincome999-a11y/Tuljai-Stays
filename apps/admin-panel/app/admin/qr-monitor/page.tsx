'use client';

import type { QrScanLogEntry } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listMonitoringQrScanLogs } from '../../../src/api/admin-monitoring-api';
import {
  createAdminRealtimeSocket,
  subscribeAdminRealtimeEvents,
  subscribeAdminRealtimeSessionRecovery,
} from '../../../src/api/realtime-client';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { tokenStorage } from '../../../src/auth/token-storage';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { formatMonitoringLabel, summarizeQrScans } from '../../../src/monitoring/monitoring-utils';

const resultFilters = ['', 'SUCCESS', 'INVALID', 'EXPIRED', 'USED', 'UNAUTHORIZED', 'WRONG_LODGE'];

export default function AdminQrMonitorPage() {
  const auth = useAdminAuth();
  const [logs, setLogs] = useState<QrScanLogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await listMonitoringQrScanLogs();
      setLogs(response.items);
    } catch {
      setErrorMessage('QR monitoring data could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      setRealtimeConnected(false);
      return undefined;
    }

    let active = true;
    let cleanup: (() => void) | undefined;

    void tokenStorage.getAccessToken().then((accessToken) => {
      if (!active || !accessToken) return;

      const socket = createAdminRealtimeSocket(accessToken);
      socket.on('connect', () => setRealtimeConnected(true));
      socket.on('disconnect', () => setRealtimeConnected(false));
      subscribeAdminRealtimeSessionRecovery(socket, async () => {
        setRealtimeConnected(false);
        return auth.refreshSession();
      });
      subscribeAdminRealtimeEvents(socket, (event) => {
        if (
          event.name === 'qr:scan-success' ||
          event.name === 'qr:scan-failed' ||
          event.name === 'dashboard:update'
        ) {
          void load();
        }
      });
      cleanup = () => socket.disconnect();
    });

    return () => {
      active = false;
      cleanup?.();
      setRealtimeConnected(false);
    };
  }, [auth.isAuthenticated, auth.refreshSession, auth.session.tokens?.accessToken, load]);

  useEffect(() => {
    if (realtimeConnected) {
      return undefined;
    }

    const interval = setInterval(() => void load(), 45_000);
    return () => clearInterval(interval);
  }, [load, realtimeConnected]);

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesResult = !result || log.result === result;
      const matchesQuery =
        !normalized ||
        [log.bookingCode, log.guestName, log.failureReason, log.bookingId, log.lodgeId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));

      return matchesResult && matchesQuery;
    });
  }, [logs, query, result]);
  const summary = summarizeQrScans(filteredLogs);

  return (
    <PermissionGate permission="system_health.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">QR Monitoring</p>
            <h2>QR validation health</h2>
            <p className="muted-copy">
              Track successful check-ins, invalid scans, expired QR attempts, duplicate usage, and
              wrong lodge failures from the QR scan log.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="grid grid-4">
          <Metric label="QR Scanned" value={summary.total} />
          <Metric label="Successful" value={summary.success} />
          <Metric label="Failed Validation" value={summary.failed} />
          <Metric label="QR Success" value={summary.successRate} suffix="%" />
        </section>

        <section className="grid grid-4">
          <Metric label="Expired QR" value={summary.expired} />
          <Metric label="Duplicate QR" value={summary.duplicate} />
          <Metric label="Wrong Lodge" value={summary.wrongLodge} />
          <Metric label="Invalid QR" value={summary.invalid} />
        </section>

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Search</span>
              <input
                placeholder="Booking, guest, lodge, reason"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Result</span>
              <select value={result} onChange={(event) => setResult(event.target.value)}>
                {resultFilters.map((item) => (
                  <option key={item || 'all'} value={item}>
                    {item ? formatMonitoringLabel(item) : 'All results'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="table-panel">
          <div className="admin-table qr-monitor-table">
            <div className="admin-table-row admin-table-head">
              <span>Time</span>
              <span>Booking</span>
              <span>Guest</span>
              <span>Result</span>
              <span>Failure</span>
              <span>Lodge</span>
            </div>
            {filteredLogs.map((log) => (
              <div className="admin-table-row" key={log.id}>
                <span>{new Date(log.createdAt).toLocaleString('en-IN')}</span>
                <span>{log.bookingCode ?? log.bookingId ?? 'Unknown'}</span>
                <span>{log.guestName ?? 'Hidden / unavailable'}</span>
                <span className="status-card">{formatMonitoringLabel(log.result)}</span>
                <span>{log.failureReason ?? 'None'}</span>
                <span>{log.lodgeId ?? 'Not linked'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, suffix = '', value }: { label: string; suffix?: string; value: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">QR</span>
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
