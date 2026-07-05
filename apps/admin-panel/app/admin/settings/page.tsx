'use client';

import type { SystemSetting } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listAdminSettings, updateAdminSetting } from '../../../src/api/admin-platform-control-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { hasPermission } from '../../../src/permissions/permissions';
import {
  coerceSettingValue,
  formatControlLabel,
  remoteAppConfigKeys,
  settingDefinitions,
  stringifySettingValue,
} from '../../../src/platform-control/platform-control-config';

export default function AdminSettingsPage() {
  const auth = useAdminAuth();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const canManageSettings = hasPermission(auth.permissions, 'settings.manage');
  const canManageFinance = hasPermission(auth.permissions, 'finance.manage');
  const isFinanceOnly =
    canManageFinance && !hasPermission(auth.permissions, 'feature_flags.manage');

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await listAdminSettings();
      setSettings(response);
      setDrafts(
        Object.fromEntries(
          response.map((setting) => [setting.key, stringifySettingValue(setting.value)]),
        ),
      );
    } catch {
      setErrorMessage('Settings could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const settingsByKey = useMemo(
    () => new Map(settings.map((setting) => [setting.key, setting])),
    [settings],
  );

  const categories = [...new Set(settingDefinitions.map((definition) => definition.category))];
  const remoteSettings = remoteAppConfigKeys
    .map((key) => settingsByKey.get(key))
    .filter((setting): setting is SystemSetting => Boolean(setting));

  async function saveSetting(definitionKey: string) {
    const definition = settingDefinitions.find((item) => item.key === definitionKey);
    const setting = settingsByKey.get(definitionKey);

    if (!definition || !setting) {
      setErrorMessage('Setting metadata is unavailable.');
      return;
    }

    if (definition.critical && !reason.trim()) {
      setErrorMessage('Critical settings require a reason.');
      return;
    }

    if (
      definition.critical &&
      !window.confirm(`Confirm change for ${formatControlLabel(definition.key)}?`)
    ) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminSetting(definition.key, {
        description: setting.description ?? definition.description,
        isPublic: setting.isPublic ?? definition.publicDefault,
        value: coerceSettingValue(drafts[definition.key] ?? '', definition.type),
      });
      await load();
      setSuccessMessage(`${formatControlLabel(definition.key)} updated.`);
    } catch {
      setErrorMessage('Setting update failed.');
    }
  }

  return (
    <PermissionGate permission="settings.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Platform Control Center</p>
            <h2>System settings</h2>
            <p className="muted-copy">
              Control public configuration, booking timers, support links, app update behavior, and
              commission foundation without releasing a new app.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="panel warning-panel">
          <p className="eyebrow">Audit Safety</p>
          <h3>Reason for sensitive changes</h3>
          <label className="form-field">
            <span>Change reason</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </section>

        {categories.map((category) => (
          <section className="table-panel" key={category}>
            <div className="section-header">
              <div>
                <p className="eyebrow">{category}</p>
                <h3>{category} settings</h3>
              </div>
            </div>
            <div className="settings-grid">
              {settingDefinitions
                .filter((definition) => definition.category === category)
                .map((definition) => {
                  const setting = settingsByKey.get(definition.key);
                  const disabled =
                    !canManageSettings ||
                    (definition.permission === 'finance.manage' && !canManageFinance) ||
                    (isFinanceOnly && definition.permission !== 'finance.manage');

                  return (
                    <article className="settings-card" key={definition.key}>
                      <div>
                        <strong>{formatControlLabel(definition.key)}</strong>
                        <p className="muted-copy">
                          {setting?.description ?? definition.description}
                        </p>
                      </div>
                      <div className="quick-actions">
                        <span className="status-card">
                          {setting?.isPublic ? 'Public' : 'Private'}
                        </span>
                        {definition.critical ? (
                          <span className="priority priority-high">Critical</span>
                        ) : null}
                      </div>
                      <SettingInput
                        disabled={disabled}
                        type={definition.type}
                        value={drafts[definition.key] ?? ''}
                        onChange={(value) =>
                          setDrafts((current) => ({ ...current, [definition.key]: value }))
                        }
                      />
                      <small className="muted-copy">
                        Updated:{' '}
                        {setting?.updatedAt
                          ? new Date(setting.updatedAt).toLocaleString('en-IN')
                          : 'Not available'}
                      </small>
                      <button
                        className="button button-primary"
                        disabled={disabled}
                        type="button"
                        onClick={() => void saveSetting(definition.key)}
                      >
                        Save
                      </button>
                    </article>
                  );
                })}
            </div>
          </section>
        ))}

        <section className="table-panel">
          <p className="eyebrow">Remote App Configuration</p>
          <h3>Public app configuration preview</h3>
          <div className="admin-table settings-preview-table">
            <div className="admin-table-row admin-table-head">
              <span>Key</span>
              <span>Value</span>
              <span>Visibility</span>
            </div>
            {remoteSettings.map((setting) => (
              <div className="admin-table-row" key={setting.key}>
                <span>{formatControlLabel(setting.key)}</span>
                <span>{stringifySettingValue(setting.value) || 'Empty'}</span>
                <span className="status-card">{setting.isPublic ? 'Public' : 'Private'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function SettingInput({
  disabled,
  onChange,
  type,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  type: string;
  value: string;
}) {
  if (type === 'boolean') {
    return (
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
    );
  }

  return (
    <input
      disabled={disabled}
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
