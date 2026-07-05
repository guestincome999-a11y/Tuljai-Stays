'use client';

import type { FeatureFlag, SystemSetting } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listAdminFeatureFlags,
  listAdminSettings,
  updateAdminFeatureFlag,
  updateAdminSetting,
} from '../../../src/api/admin-platform-control-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  festivalSettingKeys,
  formatControlLabel,
  stringifySettingValue,
} from '../../../src/platform-control/platform-control-config';

export default function AdminFestivalControlPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
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
            .filter((setting) => festivalSettingKeys.includes(setting.key))
            .map((setting) => [setting.key, stringifySettingValue(setting.value)]),
        ),
      );
    } catch {
      setErrorMessage('Festival controls could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const settingsByKey = useMemo(
    () => new Map(settings.map((setting) => [setting.key, setting])),
    [settings],
  );
  const festivalMode = flags.find((flag) => flag.key === 'festival_mode');

  async function setFestivalMode(enabled: boolean) {
    if (!reason.trim()) {
      setErrorMessage('Festival mode changes require a reason.');
      return;
    }

    if (!window.confirm(enabled ? 'Enable Festival Mode?' : 'Disable Festival Mode?')) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminFeatureFlag('festival_mode', {
        description: festivalMode?.description ?? 'Festival mode pricing and alerts',
        enabled,
        rolloutPercentage: festivalMode?.rolloutPercentage,
      });
      await load();
      setSuccessMessage(enabled ? 'Festival Mode enabled.' : 'Festival Mode disabled.');
    } catch {
      setErrorMessage('Festival Mode update failed.');
    }
  }

  async function saveFestivalSettings() {
    if (!reason.trim()) {
      setErrorMessage('Festival setting changes require a reason.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await Promise.all(
        festivalSettingKeys.map((key) => {
          const setting = settingsByKey.get(key);
          return updateAdminSetting(key, {
            description: setting?.description ?? formatControlLabel(key),
            isPublic: setting?.isPublic ?? true,
            value: drafts[key] ?? '',
          });
        }),
      );
      await load();
      setSuccessMessage('Festival settings saved.');
    } catch {
      setErrorMessage('Festival settings update failed.');
    }
  }

  return (
    <PermissionGate permission="settings.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Festival Control Center</p>
            <h2>Navratri and pilgrimage event controls</h2>
            <p className="muted-copy">
              Control festival mode, app banners, advisories, support instructions, and event date
              foundations without hardcoded dates.
            </p>
          </div>
          <div className="hero-actions">
            <span className={festivalMode?.enabled ? 'status-card' : 'live-pill'}>
              {festivalMode?.enabled ? 'Festival Mode Active' : 'Festival Mode Off'}
            </span>
          </div>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="panel warning-panel">
          <p className="eyebrow">Audit Safety</p>
          <label className="form-field">
            <span>Reason</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="quick-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => void setFestivalMode(true)}
            >
              Enable Festival Mode
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void setFestivalMode(false)}
            >
              Disable Festival Mode
            </button>
          </div>
        </section>

        <section className="settings-grid">
          {festivalSettingKeys.map((key) => (
            <article className="settings-card" key={key}>
              <strong>{formatControlLabel(key)}</strong>
              <p className="muted-copy">
                {settingsByKey.get(key)?.description ?? 'Festival setting'}
              </p>
              <input
                type={key.endsWith('_date') ? 'date' : key.endsWith('_color') ? 'color' : 'text'}
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
          <div className="section-header">
            <div>
              <p className="eyebrow">Booking Pressure Foundation</p>
              <h3>Event operations readiness</h3>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void saveFestivalSettings()}
            >
              Save Festival Settings
            </button>
          </div>
          <div className="roadmap-grid">
            {[
              'Pilgrim app festival banner',
              'Owner app festival emphasis',
              'Admin operations widgets',
              'Announcement priority',
              'Booking monitoring',
              'Notification priority foundation',
            ].map((item) => (
              <article className="roadmap-card" key={item}>
                <h4>{item}</h4>
                <p>
                  Uses public settings and the `festival_mode` flag when app-side adoption is
                  enabled.
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
