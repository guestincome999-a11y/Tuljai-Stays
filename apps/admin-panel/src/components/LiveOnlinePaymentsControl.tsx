'use client';

import { useEffect, useState } from 'react';

import {
  listAdminSettings,
  updateAdminSetting,
} from '../api/admin-platform-control-api';

const SETTING_KEY = 'enable_online_payments';

export function LiveOnlinePaymentsControl() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void listAdminSettings()
      .then((settings) => {
        if (!active) return;
        const setting = settings.find((item) => item.key === SETTING_KEY);
        setEnabled(setting?.value === true);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load online payment status.');
        setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  async function toggle() {
    if (!loaded || saving) return;

    const nextValue = !enabled;
    setSaving(true);
    setError(null);

    try {
      const setting = await updateAdminSetting(SETTING_KEY, {
        value: nextValue,
        isPublic: true,
        description: 'Online payments enabled',
      });
      setEnabled(setting.value === true);
    } catch {
      setError('Online payment setting could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-label="Online payment operations">
      <div className="section-header">
        <div>
          <p className="eyebrow">Live Operations</p>
          <h3>Online Payments</h3>
          <p className="muted-copy">
            Controls whether pilgrims can start Razorpay payments for prepaid bookings.
          </p>
        </div>
        <button
          aria-checked={enabled}
          className={enabled ? 'button button-primary' : 'button button-secondary'}
          disabled={!loaded || saving}
          role="switch"
          type="button"
          onClick={() => void toggle()}
        >
          {saving ? 'Saving…' : enabled ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="mini-metric-grid">
        <div className="mini-metric">
          <span>Provider</span>
          <strong>Razorpay</strong>
        </div>
        <div className="mini-metric">
          <span>Status</span>
          <strong>{enabled ? 'ACTIVE' : 'DISABLED'}</strong>
        </div>
      </div>
      {error ? <p className="muted-copy">{error}</p> : null}
    </section>
  );
}
