'use client';

import type { FeatureFlag, SystemSetting } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createAnnouncement,
  listAdminFeatureFlags,
  listAdminSettings,
  updateAdminFeatureFlag,
  updateAdminSetting,
} from '../../../src/api/admin-platform-control-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  formatControlLabel,
  maintenanceSettingKeys,
  stringifySettingValue,
} from '../../../src/platform-control/platform-control-config';

const emergencyReasons = [
  'Road closure',
  'Temple crowd rush',
  'Weather issue',
  'System outage',
  'Lodge emergency',
  'Law/order advisory',
  'Maintenance',
  'Other',
];

export default function AdminEmergencyControlPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState(emergencyReasons[0] ?? 'Other');
  const [details, setDetails] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [settingsResponse, flagsResponse] = await Promise.all([
        listAdminSettings(),
        listAdminFeatureFlags(),
      ]);
      setSettings(settingsResponse);
      setFlags(flagsResponse);
      setDrafts(
        Object.fromEntries(
          settingsResponse
            .filter(
              (setting) =>
                maintenanceSettingKeys.includes(setting.key) ||
                setting.key === 'emergency_banner_text',
            )
            .map((setting) => [setting.key, stringifySettingValue(setting.value)]),
        ),
      );
    } catch {
      setErrorMessage('Emergency controls could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flagsByKey = useMemo(() => new Map(flags.map((flag) => [flag.key, flag])), [flags]);
  const settingsByKey = useMemo(
    () => new Map(settings.map((setting) => [setting.key, setting])),
    [settings],
  );

  async function updateFlag(key: string, enabled: boolean) {
    if (!details.trim()) {
      setErrorMessage('Emergency actions require details for audit readiness.');
      return;
    }

    if (!window.confirm(`Confirm ${enabled ? 'enable' : 'disable'} ${formatControlLabel(key)}?`)) {
      return;
    }

    const flag = flagsByKey.get(key);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminFeatureFlag(key, {
        description: flag?.description ?? formatControlLabel(key),
        enabled,
        rolloutPercentage: flag?.rolloutPercentage,
      });
      await load();
      setSuccessMessage(`${formatControlLabel(key)} updated.`);
    } catch {
      setErrorMessage('Emergency action failed.');
    }
  }

  async function saveMaintenanceSettings() {
    if (!details.trim()) {
      setErrorMessage('Maintenance changes require details.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await Promise.all(
        [...maintenanceSettingKeys, 'emergency_banner_text'].map((key) => {
          const setting = settingsByKey.get(key);
          return updateAdminSetting(key, {
            description: setting?.description ?? formatControlLabel(key),
            isPublic: setting?.isPublic ?? key !== 'admin_panel_maintenance_message',
            value: drafts[key] ?? '',
          });
        }),
      );
      await load();
      setSuccessMessage('Emergency and maintenance messages saved.');
    } catch {
      setErrorMessage('Maintenance settings update failed.');
    }
  }

  async function sendEmergencyAnnouncement() {
    if (!details.trim()) {
      setErrorMessage('Emergency announcement requires message details.');
      return;
    }

    if (!window.confirm('Broadcast emergency announcement to all users?')) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createAnnouncement({
        body: details,
        category: 'EMERGENCY',
        priority: 'CRITICAL',
        targetAudience: 'ALL',
        title: `Emergency Notice: ${reason}`,
      });
      setSuccessMessage('Emergency announcement broadcast.');
    } catch {
      setErrorMessage('Emergency announcement failed.');
    }
  }

  return (
    <PermissionGate permission="security.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Emergency Control Center</p>
            <h2>Booking pause and maintenance controls</h2>
            <p className="muted-copy">
              Activate emergency mode, pause booking creation, broadcast emergency notices, and
              publish maintenance messages with confirmation.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="panel warning-panel">
          <p className="eyebrow">Required Reason</p>
          <div className="control-grid">
            <label>
              <span>Reason</span>
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                {emergencyReasons.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Details</span>
              <input value={details} onChange={(event) => setDetails(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="grid grid-2">
          <ControlPanel
            flag={flagsByKey.get('booking_enabled')}
            offLabel="Pause All Bookings"
            onLabel="Resume All Bookings"
            onUpdate={(enabled) => void updateFlag('booking_enabled', enabled)}
          />
          <ControlPanel
            flag={flagsByKey.get('emergency_mode')}
            offLabel="Disable Emergency Mode"
            onLabel="Enable Emergency Mode"
            onUpdate={(enabled) => void updateFlag('emergency_mode', enabled)}
          />
          <ControlPanel
            flag={flagsByKey.get('maintenance_mode')}
            offLabel="Disable Maintenance Mode"
            onLabel="Enable Maintenance Mode"
            onUpdate={(enabled) => void updateFlag('maintenance_mode', enabled)}
          />
          <ControlPanel
            flag={flagsByKey.get('qr_checkin_enabled')}
            offLabel="Disable QR Generation"
            onLabel="Enable QR Generation"
            onUpdate={(enabled) => void updateFlag('qr_checkin_enabled', enabled)}
          />
        </section>

        <section className="settings-grid">
          {[...maintenanceSettingKeys, 'emergency_banner_text'].map((key) => (
            <article className="settings-card" key={key}>
              <strong>{formatControlLabel(key)}</strong>
              <p className="muted-copy">
                {settingsByKey.get(key)?.description ?? 'Maintenance setting'}
              </p>
              <input
                value={drafts[key] ?? ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [key]: event.target.value }))
                }
              />
              <span className="status-card">
                {settingsByKey.get(key)?.isPublic ? 'Public' : 'Private'}
              </span>
            </article>
          ))}
        </section>

        <section className="panel">
          <div className="quick-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => void saveMaintenanceSettings()}
            >
              Save Emergency Messages
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void sendEmergencyAnnouncement()}
            >
              Send Emergency Announcement
            </button>
          </div>
          <p className="muted-copy">
            City, lodge, and room-type booking pauses are UI foundation only until scoped pause
            models are added to the backend.
          </p>
        </section>
      </div>
    </PermissionGate>
  );
}

function ControlPanel({
  flag,
  offLabel,
  onLabel,
  onUpdate,
}: {
  flag: FeatureFlag | undefined;
  offLabel: string;
  onLabel: string;
  onUpdate: (enabled: boolean) => void;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">{flag ? formatControlLabel(flag.key) : 'Control'}</p>
      <h3>{flag?.enabled ? 'Active / enabled' : 'Inactive / disabled'}</h3>
      <p className="muted-copy">{flag?.description ?? 'Feature flag backed platform control.'}</p>
      <div className="quick-actions">
        <button className="button button-primary" type="button" onClick={() => onUpdate(true)}>
          {onLabel}
        </button>
        <button className="button button-secondary" type="button" onClick={() => onUpdate(false)}>
          {offLabel}
        </button>
      </div>
    </section>
  );
}
