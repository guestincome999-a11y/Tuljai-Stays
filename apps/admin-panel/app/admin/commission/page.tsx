'use client';

import type { Lodge } from '@tuljai/types';
import { useEffect, useState } from 'react';

import {
  getLodgeCommission,
  listGovernanceLodges,
  updateLodgeCommission,
  type LodgeCommissionConfig,
} from '../../../src/api/admin-governance-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminCommissionPage() {
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [selectedLodgeId, setSelectedLodgeId] = useState('');
  const [config, setConfig] = useState<LodgeCommissionConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState('0');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadLodges();
  }, []);

  useEffect(() => {
    if (!selectedLodgeId) return;
    void loadCommission(selectedLodgeId);
  }, [selectedLodgeId]);

  async function loadLodges() {
    setLoading(true);
    try {
      const response = await listGovernanceLodges({ page: 1, pageSize: 100 });
      setLodges(response.items);
      if (response.items[0]) setSelectedLodgeId(response.items[0].id);
    } catch {
      setError('Could not load lodges.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCommission(lodgeId: string) {
    setError('');
    setMessage('');
    try {
      const next = await getLodgeCommission(lodgeId);
      setConfig(next);
      setEnabled(next.commissionEnabled);
      setRate(String(next.commissionRatePercent));
      setEffectiveFrom(next.effectiveFrom.slice(0, 10));
    } catch {
      setError('Could not load commission settings.');
      setConfig(null);
    }
  }

  async function save() {
    if (!selectedLodgeId) return;
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100) {
      setError('Commission rate must be between 0% and 100%.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const next = await updateLodgeCommission(selectedLodgeId, {
        commissionEnabled: enabled,
        commissionRatePercent: numericRate,
        effectiveFrom: effectiveFrom || undefined,
      });
      setConfig(next);
      setMessage('Commission settings saved successfully.');
    } catch {
      setError('Commission settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const selectedLodge = lodges.find((lodge) => lodge.id === selectedLodgeId);

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Finance · Lodge Commission</p>
            <h2>Commission configuration</h2>
            <p className="muted-copy">
              Configure the commission Tuljai Stays charges to each lodge. The rate is later
              snapshotted onto eligible bookings so historical amounts do not change.
            </p>
          </div>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}
        {message ? <section className="success-banner">{message}</section> : null}

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Lodge</p>
            <h3>Select lodge</h3>
            {loading ? (
              <p className="muted-copy">Loading lodges…</p>
            ) : (
              <select
                className="form-field"
                value={selectedLodgeId}
                onChange={(event) => setSelectedLodgeId(event.target.value)}
              >
                {lodges.map((lodge) => (
                  <option key={lodge.id} value={lodge.id}>
                    {lodge.name}
                  </option>
                ))}
              </select>
            )}
            {selectedLodge ? (
              <div className="panel" style={{ marginTop: 16 }}>
                <strong>{selectedLodge.name}</strong>
                <p className="muted-copy">{selectedLodge.primaryPhone}</p>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <p className="eyebrow">Commercial rule</p>
            <h3>Lodge commission</h3>
            <label className="form-field">
              <span>Commission status</span>
              <select value={enabled ? 'ON' : 'OFF'} onChange={(event) => setEnabled(event.target.value === 'ON')}>
                <option value="OFF">OFF · No commission charged</option>
                <option value="ON">ON · Charge commission</option>
              </select>
            </label>
            <label className="form-field">
              <span>Commission rate (%)</span>
              <input
                inputMode="decimal"
                max="100"
                min="0"
                step="0.01"
                type="number"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Effective from</span>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </label>
            <button className="button button-primary" disabled={saving || !selectedLodgeId} onClick={() => void save()} type="button">
              {saving ? 'Saving…' : 'Save Commission'}
            </button>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Example</p>
          <h3>How the rule will work</h3>
          <p className="muted-copy">
            A ₹1,000 eligible booking at {rate || '0'}% commission creates a commission amount of
            ₹{((1000 * (Number(rate) || 0)) / 100).toFixed(2)}. Online-payment deductions and cash
            receivables will be handled by the later finance stages.
          </p>
          {config ? (
            <p className="muted-copy">Current rule last saved with effective date {config.effectiveFrom.slice(0, 10)}.</p>
          ) : null}
        </section>
      </div>
    </PermissionGate>
  );
}
