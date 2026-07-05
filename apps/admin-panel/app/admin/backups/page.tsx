'use client';

import { useCallback, useEffect, useState } from 'react';

import { getPlatformHealth, type HealthResponse } from '../../../src/api/admin-monitoring-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminBackupsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      setHealth(await getPlatformHealth());
    } catch {
      setErrorMessage('Backup readiness signals could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PermissionGate permission="system_health.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Backup And Recovery</p>
            <h2>Backup readiness center</h2>
            <p className="muted-copy">
              Monitors database/storage readiness and documents future backup actions without
              pretending backup jobs exist.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="grid grid-4">
          <Metric
            label="Database"
            value={health?.database === 'ok' ? 'Reachable' : 'Unavailable'}
          />
          <Metric
            label="Storage"
            value={health?.storageConfigured ? 'Configured' : 'Not configured'}
          />
          <Metric label="Last Backup" value="Endpoint required" />
          <Metric label="Restore Ready" value="Verification required" />
        </section>

        <section className="table-panel">
          <div className="admin-table backup-table">
            <div className="admin-table-row admin-table-head">
              <span>Capability</span>
              <span>Status</span>
              <span>Required Backend Support</span>
            </div>
            {[
              ['Run Backup', 'Foundation only', 'POST /api/admin/backups/run'],
              ['Verify Backup', 'Foundation only', 'POST /api/admin/backups/:id/verify'],
              ['Restore Backup', 'Foundation only', 'POST /api/admin/backups/:id/restore'],
              ['Storage Usage', 'Foundation only', 'GET /api/admin/storage/usage'],
              ['Scheduled Backup', 'Foundation only', 'GET /api/admin/backups/schedule'],
            ].map(([capability, status, required]) => (
              <div className="admin-table-row" key={capability}>
                <span>{capability}</span>
                <span className="status-card">{status}</span>
                <span>{required}</span>
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
      <span className="kpi-icon">BKP</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
