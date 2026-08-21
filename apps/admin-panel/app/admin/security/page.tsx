'use client';

import type { AdminBookingSummary, Announcement, FeatureFlag } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  disableAdminTwoFactor,
  getAdminTwoFactorStatus,
  setupAdminTwoFactor,
  verifyAdminTwoFactor,
} from '../../../src/api/admin-security-api';
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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ account: string; otpauthUri: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [bookingResponse, announcementResponse, flagResponse, twoFactor] = await Promise.all([
        listMonitoringBookings(),
        listMonitoringAnnouncements(),
        listMonitoringFeatureFlags(),
        getAdminTwoFactorStatus(),
      ]);
      setBookings(bookingResponse.items);
      setAnnouncements(announcementResponse.items);
      setFlags(flagResponse);
      setTwoFactorEnabled(twoFactor.enabled);
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

  async function startTwoFactorSetup() {
    setTwoFactorLoading(true);
    setErrorMessage(null);
    try {
      setTotpSetup(await setupAdminTwoFactor());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start 2FA setup.');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function verifyTwoFactor() {
    setTwoFactorLoading(true);
    setErrorMessage(null);
    try {
      await verifyAdminTwoFactor(totpCode.trim());
      setTwoFactorEnabled(true);
      setTotpSetup(null);
      setTotpCode('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Invalid authenticator code.');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function disableTwoFactor() {
    setTwoFactorLoading(true);
    setErrorMessage(null);
    try {
      await disableAdminTwoFactor(totpCode.trim());
      setTwoFactorEnabled(false);
      setTotpCode('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to disable 2FA.');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  return (
    <PermissionGate permission="security.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Security Center</p>
            <h2>Security events and controls</h2>
            <p className="muted-copy">
              Review security-sensitive platform signals and manage protected admin access.
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

        <section className="panel-card">
          <p className="eyebrow">Admin Authentication</p>
          <h3>Two-factor authentication</h3>
          <p className="muted-copy">
            TOTP is enforced for admin-panel OTP login after it is enabled. Pilgrim and owner phone OTP flows are unchanged.
          </p>
          <div className="status-card">Status: {twoFactorEnabled ? 'Enabled' : 'Not enabled'}</div>

          {!twoFactorEnabled && !totpSetup ? (
            <button className="button button-primary" disabled={twoFactorLoading} type="button" onClick={() => void startTwoFactorSetup()}>
              {twoFactorLoading ? 'Preparing…' : 'Enable 2FA'}
            </button>
          ) : null}

          {totpSetup ? (
            <div className="panel warning-panel">
              <p><strong>Authenticator setup</strong></p>
              <p className="muted-copy">Scan the following otpauth URI with your authenticator, or use the manual secret.</p>
              <label className="form-field">
                <span>Manual secret</span>
                <input readOnly value={totpSetup.secret} />
              </label>
              <label className="form-field">
                <span>Authenticator URI</span>
                <input readOnly value={totpSetup.otpauthUri} />
              </label>
              <label className="form-field">
                <span>6-digit code</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, ''))}
                />
              </label>
              <button className="button button-primary" disabled={twoFactorLoading || totpCode.length !== 6} type="button" onClick={() => void verifyTwoFactor()}>
                Verify and enable
              </button>
            </div>
          ) : null}

          {twoFactorEnabled ? (
            <div className="panel warning-panel">
              <label className="form-field">
                <span>Current authenticator code to disable 2FA</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, ''))}
                />
              </label>
              <button className="button button-secondary" disabled={twoFactorLoading || totpCode.length !== 6} type="button" onClick={() => void disableTwoFactor()}>
                Disable 2FA
              </button>
            </div>
          ) : null}
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
              Active session listing and admin-side revocation remain available through the Sessions and Audit pages.
            </p>
            <div className="quick-actions">
              <Link className="ghost-control" href="/admin/sessions">Open Sessions</Link>
              <Link className="ghost-control" href="/admin/audit">View Audit</Link>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Security Events</p>
            <h3>Current visible signals</h3>
            <div className="feed-list">
              {flags
                .filter((flag) => ['emergency_mode', 'maintenance_mode', 'admin_panel_enabled'].includes(flag.key))
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
