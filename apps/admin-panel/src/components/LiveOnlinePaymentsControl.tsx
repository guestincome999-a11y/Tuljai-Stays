'use client';

import { useEffect, useState } from 'react';

import { listAdminSettings, updateAdminSetting } from '../api/admin-platform-control-api';

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
    <section aria-label="Online payment operations" className="paybar">
      <div className="paybar-copy">
        <strong>Online Payments</strong>
        <span>
          Controls whether pilgrims can start Razorpay payments for prepaid bookings.
          {error ? ` ${error}` : ''}
        </span>
      </div>
      <span className={enabled ? 'paybar-chip paybar-chip-on' : 'paybar-chip'}>
        {enabled ? 'Active' : 'Disabled'}
      </span>
      <button
        aria-checked={enabled}
        aria-label="Toggle online payments"
        className={enabled ? 'paybar-switch paybar-switch-on' : 'paybar-switch'}
        disabled={!loaded || saving}
        role="switch"
        type="button"
        onClick={() => void toggle()}
      >
        <span />
      </button>
      <style jsx global>{`
        .paybar { align-items: center; background: #fff; border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: var(--shadow-soft); display: flex; gap: 14px; margin-bottom: 16px; padding: 12px 18px; }
        .paybar-copy { flex: 1; min-width: 0; }
        .paybar-copy strong { color: var(--color-primary-strong); display: block; font-size: 0.88rem; }
        .paybar-copy span { color: var(--color-muted); display: block; font-size: 0.75rem; font-weight: 500; margin-top: 2px; }
        .paybar-chip { background: #ffe9e9; border-radius: 999px; color: #c8312f; font-size: 0.7rem; font-weight: 700; padding: 4px 11px; }
        .paybar-chip-on { background: #e3f6ec; color: #0d7a54; }
        .paybar-switch { background: #cfd7e4; border: 0; border-radius: 999px; cursor: pointer; height: 24px; padding: 3px; position: relative; transition: background 160ms ease; width: 44px; }
        .paybar-switch span { background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(15, 31, 61, 0.3); display: block; height: 18px; transition: transform 160ms ease; width: 18px; }
        .paybar-switch-on { background: #16a368; }
        .paybar-switch-on span { transform: translateX(20px); }
        .paybar-switch:disabled { cursor: wait; opacity: 0.6; }
      `}</style>
    </section>
  );
}
