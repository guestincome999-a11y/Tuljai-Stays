'use client';

import type { Lodge } from '@tuljai/types';
import { useEffect, useState } from 'react';

import {
  getLodgeCommission,
  listGovernanceLodges,
  updateLodgeCommission,
  type LodgeCommissionConfig,
  type LodgeCommissionType,
} from '../../../src/api/admin-governance-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminCommissionPage() {
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [selectedLodgeId, setSelectedLodgeId] = useState('');
  const [config, setConfig] = useState<LodgeCommissionConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [commissionType, setCommissionType] = useState<LodgeCommissionType>('PERCENTAGE');
  const [rate, setRate] = useState('0');
  const [fixedAmount, setFixedAmount] = useState('0');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void loadLodges(); }, []);
  useEffect(() => { if (selectedLodgeId) void loadCommission(selectedLodgeId); }, [selectedLodgeId]);

  async function loadLodges() {
    setLoading(true);
    try {
      const response = await listGovernanceLodges({ page: 1, pageSize: 100 });
      setLodges(response.items);
      if (response.items[0]) setSelectedLodgeId(response.items[0].id);
    } catch { setError('Could not load lodges.'); }
    finally { setLoading(false); }
  }

  async function loadCommission(lodgeId: string) {
    setError(''); setMessage('');
    try {
      const next = await getLodgeCommission(lodgeId);
      setConfig(next);
      setEnabled(next.commissionEnabled);
      setCommissionType(next.commissionType);
      setRate(String(next.commissionRatePercent));
      setFixedAmount(String(next.commissionFixedAmount));
      setEffectiveFrom(next.effectiveFrom.slice(0, 10));
    } catch { setError('Could not load commission settings.'); setConfig(null); }
  }

  async function save() {
    if (!selectedLodgeId) return;
    const numericRate = Number(rate);
    const numericFixedAmount = Number(fixedAmount);

    if (commissionType === 'PERCENTAGE' && (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100)) {
      setError('Percentage commission must be between 0% and 100%.'); return;
    }
    if (commissionType === 'FIXED_PER_BOOKING' && (!Number.isFinite(numericFixedAmount) || numericFixedAmount < 0)) {
      setError('Fixed commission must be zero or greater.'); return;
    }

    setSaving(true); setError(''); setMessage('');
    try {
      const next = await updateLodgeCommission(selectedLodgeId, {
        commissionEnabled: enabled,
        commissionType,
        commissionRatePercent: commissionType === 'PERCENTAGE' ? numericRate : 0,
        commissionFixedAmount: commissionType === 'FIXED_PER_BOOKING' ? numericFixedAmount : 0,
        effectiveFrom: effectiveFrom || undefined,
      });
      setConfig(next); setMessage('Commission settings saved successfully.');
    } catch { setError('Commission settings could not be saved.'); }
    finally { setSaving(false); }
  }

  const selectedLodge = lodges.find((lodge) => lodge.id === selectedLodgeId);
  const exampleCommission = commissionType === 'FIXED_PER_BOOKING'
    ? Number(fixedAmount) || 0
    : (1000 * (Number(rate) || 0)) / 100;

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Finance · Lodge Commission</p>
            <h2>Commission configuration</h2>
            <p className="muted-copy">Choose either a percentage or a fixed rupee amount per booking. The selected rule is snapshotted onto bookings so historical commissions do not change.</p>
          </div>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}
        {message ? <section className="success-banner">{message}</section> : null}

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Lodge</p>
            <h3>Select lodge</h3>
            {loading ? <p className="muted-copy">Loading lodges…</p> : (
              <select className="form-field" value={selectedLodgeId} onChange={(event) => setSelectedLodgeId(event.target.value)}>
                {lodges.map((lodge) => <option key={lodge.id} value={lodge.id}>{lodge.name}</option>)}
              </select>
            )}
            {selectedLodge ? <div className="panel" style={{ marginTop: 16 }}><strong>{selectedLodge.name}</strong><p className="muted-copy">{selectedLodge.primaryPhone}</p></div> : null}
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
              <span>Commission type</span>
              <select value={commissionType} onChange={(event) => setCommissionType(event.target.value as LodgeCommissionType)}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_PER_BOOKING">Fixed amount per booking (₹)</option>
              </select>
            </label>
            {commissionType === 'PERCENTAGE' ? (
              <label className="form-field">
                <span>Commission rate (%)</span>
                <input inputMode="decimal" max="100" min="0" step="0.01" type="number" value={rate} onChange={(event) => setRate(event.target.value)} />
              </label>
            ) : (
              <label className="form-field">
                <span>Commission per booking (₹)</span>
                <input inputMode="decimal" min="0" step="0.01" type="number" value={fixedAmount} onChange={(event) => setFixedAmount(event.target.value)} />
              </label>
            )}
            <label className="form-field">
              <span>Effective from</span>
              <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            </label>
            <button className="button button-primary" disabled={saving || !selectedLodgeId} onClick={() => void save()} type="button">{saving ? 'Saving…' : 'Save Commission'}</button>
          </section>
        </section>

        <section className="panel">
          <p className="eyebrow">Example</p>
          <h3>₹1,000 eligible booking</h3>
          <p className="muted-copy">
            {commissionType === 'FIXED_PER_BOOKING'
              ? `Fixed commission: ₹${exampleCommission.toFixed(2)} per booking.`
              : `Percentage commission: ${Number(rate) || 0}% = ₹${exampleCommission.toFixed(2)} commission.`}
          </p>
          {config ? <p className="muted-copy">Current rule last saved with effective date {config.effectiveFrom.slice(0, 10)}.</p> : null}
        </section>
      </div>
    </PermissionGate>
  );
}
