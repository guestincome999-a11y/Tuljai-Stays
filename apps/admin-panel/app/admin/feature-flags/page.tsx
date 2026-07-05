'use client';

import type { FeatureFlag } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listAdminFeatureFlags,
  updateAdminFeatureFlag,
} from '../../../src/api/admin-platform-control-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  featureFlagDefinitions,
  formatControlLabel,
  rolloutOptions,
} from '../../../src/platform-control/platform-control-config';

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      setFlags(await listAdminFeatureFlags());
    } catch {
      setErrorMessage('Feature flags could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flagsByKey = useMemo(() => new Map(flags.map((flag) => [flag.key, flag])), [flags]);

  async function updateFlag(key: string, enabled: boolean, rolloutPercentage?: number | null) {
    const definition = featureFlagDefinitions.find((item) => item.key === key);
    const flag = flagsByKey.get(key);

    if (!flag || !definition) {
      setErrorMessage('Feature flag metadata is unavailable.');
      return;
    }

    if (definition.critical && !reason.trim()) {
      setErrorMessage('Critical feature flags require a reason.');
      return;
    }

    if (definition.critical && !window.confirm(`Confirm change for ${formatControlLabel(key)}?`)) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminFeatureFlag(key, {
        description: flag.description ?? definition.description,
        enabled,
        rolloutPercentage: rolloutPercentage ?? flag.rolloutPercentage,
      });
      await load();
      setSuccessMessage(`${formatControlLabel(key)} updated.`);
    } catch {
      setErrorMessage('Feature flag update failed.');
    }
  }

  return (
    <PermissionGate permission="feature_flags.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Platform Control Center</p>
            <h2>Feature flags</h2>
            <p className="muted-copy">
              Enable, disable, and prepare rollout controls for app behavior across mobile and admin
              surfaces.
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
          <label className="form-field">
            <span>Reason for dangerous changes</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </section>

        <section className="settings-grid">
          {featureFlagDefinitions.map((definition) => {
            const flag = flagsByKey.get(definition.key);

            return (
              <article className="settings-card" key={definition.key}>
                <div>
                  <strong>{formatControlLabel(definition.key)}</strong>
                  <p className="muted-copy">{flag?.description ?? definition.description}</p>
                </div>
                <div className="quick-actions">
                  <span className="status-card">{flag?.enabled ? 'Enabled' : 'Disabled'}</span>
                  {definition.critical ? (
                    <span className="priority priority-high">Critical</span>
                  ) : null}
                </div>
                <label className="form-field">
                  <span>Rollout percentage</span>
                  <select
                    value={flag?.rolloutPercentage ?? 100}
                    onChange={(event) =>
                      void updateFlag(
                        definition.key,
                        flag?.enabled ?? false,
                        Number(event.target.value),
                      )
                    }
                  >
                    {rolloutOptions.map((rollout) => (
                      <option key={rollout} value={rollout}>
                        {rollout}%
                      </option>
                    ))}
                  </select>
                </label>
                <small className="muted-copy">
                  Updated:{' '}
                  {flag?.updatedAt
                    ? new Date(flag.updatedAt).toLocaleString('en-IN')
                    : 'Not available'}
                </small>
                <div className="row-actions">
                  <button
                    className="button button-primary"
                    disabled={flag?.enabled === true}
                    type="button"
                    onClick={() => void updateFlag(definition.key, true)}
                  >
                    Enable
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={flag?.enabled === false}
                    type="button"
                    onClick={() => void updateFlag(definition.key, false)}
                  >
                    Disable
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </PermissionGate>
  );
}
