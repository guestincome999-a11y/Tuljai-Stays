'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  createPromoCode,
  deactivatePromoCode,
  listPromoCodes,
  type PromoCode,
  type PromoDiscountType,
} from '../../../src/api/admin-promotions-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function PromotionsPage() {
  const [items, setItems] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<PromoDiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('10');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  );
  const [usageLimit, setUsageLimit] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPromoCodes());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load promo codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      await createPromoCode({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
      });
      setCode('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create promo code.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: string) {
    setError(null);
    try {
      await deactivatePromoCode(id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to deactivate promo code.');
    }
  }

  return (
    <PermissionGate permission="finance.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Revenue Controls</p>
            <h1>Promo codes</h1>
            <p className="muted-copy">
              Create INR booking discounts with explicit validity and usage limits.
            </p>
          </div>
        </section>
        {error ? <section className="error-banner">{error}</section> : null}
        <section className="panel-card">
          <div className="control-grid">
            <label className="form-field">
              <span>Code</span>
              <input
                maxLength={32}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
            <label className="form-field">
              <span>Discount type</span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FLAT">Flat INR</option>
              </select>
            </label>
            <label className="form-field">
              <span>Discount value</span>
              <input
                inputMode="decimal"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Usage limit</span>
              <input
                inputMode="numeric"
                placeholder="Unlimited"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>
          <button
            className="button button-primary"
            disabled={saving || !code.trim()}
            type="button"
            onClick={() => void create()}
          >
            {saving ? 'Creating…' : 'Create promo code'}
          </button>
        </section>
        <section className="panel-card">
          {loading ? <p>Loading promo codes…</p> : null}
          {!loading && items.length === 0 ? (
            <div className="empty-state">
              <h2>No promo codes</h2>
              <p>Create the first discount code above.</p>
            </div>
          ) : null}
          {!loading && items.length > 0 ? (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Validity</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.code}</strong>
                      </td>
                      <td>
                        {item.discount_type === 'PERCENTAGE'
                          ? `${item.discount_value}%`
                          : `₹${item.discount_value}`}
                      </td>
                      <td>
                        {new Date(item.starts_at).toLocaleString('en-IN')} –{' '}
                        {new Date(item.ends_at).toLocaleString('en-IN')}
                      </td>
                      <td>
                        {item.usage_count}
                        {item.usage_limit === null ? '' : ` / ${item.usage_limit}`}
                      </td>
                      <td>{item.active ? 'Active' : 'Inactive'}</td>
                      <td>
                        {item.active ? (
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => void deactivate(item.id)}
                          >
                            Deactivate
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </PermissionGate>
  );
}
