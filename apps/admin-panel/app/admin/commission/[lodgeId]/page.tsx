'use client';

import type { LodgeCommissionFinanceReport } from '@tuljai/types';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';

import {
  createLodgeCommissionSettlement,
  getLodgeCommissionFinanceReport,
  voidLodgeCommissionTransaction,
} from '../../../../src/api/admin-bi-api';
import {
  updateLodgeCommission,
  type LodgeCommissionType,
} from '../../../../src/api/admin-governance-api';
import { FinanceStyles } from '../../../../src/components/finance/FinanceStyles';
import {
  FinBanners,
  FinHeader,
  FinKpi,
  FinPanel,
  formatMoney,
  LedgerTable,
  RuleSummary,
  SettlementForm,
  SettlementHistoryTable,
} from '../../../../src/components/finance/FinanceUi';
import type { SettlementFormValues } from '../../../../src/components/finance/FinanceUi';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function LodgeCommissionDetailPage({
  params,
}: {
  params: Promise<{ lodgeId: string }>;
}) {
  const { lodgeId } = use(params);
  const [report, setReport] = useState<LodgeCommissionFinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [editingRule, setEditingRule] = useState(false);
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [ruleType, setRuleType] = useState<LodgeCommissionType>('PERCENTAGE');
  const [ruleRate, setRuleRate] = useState('0');
  const [ruleFixedAmount, setRuleFixedAmount] = useState('0');
  const [ruleEffectiveFrom, setRuleEffectiveFrom] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await getLodgeCommissionFinanceReport(lodgeId);
      setReport(next);
      setRuleEnabled(next.setting.commissionEnabled);
      setRuleType(next.setting.commissionType);
      setRuleRate(String(next.setting.commissionRatePercent));
      setRuleFixedAmount(String(next.setting.commissionFixedAmount));
      setRuleEffectiveFrom(next.setting.effectiveFrom.slice(0, 10));
    } catch {
      setError('Could not load this lodge commission account.');
    } finally {
      setLoading(false);
    }
  }, [lodgeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRule() {
    const numericRate = Number(ruleRate);
    const numericFixedAmount = Number(ruleFixedAmount);
    if (ruleType === 'PERCENTAGE' && (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100)) {
      setError('Percentage commission must be between 0% and 100%.');
      return;
    }
    if (ruleType === 'FIXED_PER_BOOKING' && (!Number.isFinite(numericFixedAmount) || numericFixedAmount < 0)) {
      setError('Fixed commission must be zero or greater.');
      return;
    }
    setSavingRule(true);
    setError('');
    setMessage('');
    try {
      await updateLodgeCommission(lodgeId, {
        commissionEnabled: ruleEnabled,
        commissionType: ruleType,
        commissionRatePercent: ruleType === 'PERCENTAGE' ? numericRate : 0,
        commissionFixedAmount: ruleType === 'FIXED_PER_BOOKING' ? numericFixedAmount : 0,
        effectiveFrom: ruleEffectiveFrom || undefined,
      });
      setMessage('Commission rule updated. Future bookings will use the new rule.');
      setEditingRule(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commission rule could not be saved.');
    } finally {
      setSavingRule(false);
    }
  }

  async function settle(values: SettlementFormValues): Promise<boolean> {
    setError('');
    setMessage('');
    try {
      setReport(await createLodgeCommissionSettlement(lodgeId, values));
      setMessage('Settlement recorded and allocated against the oldest outstanding commission first.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settlement could not be recorded.');
      return false;
    }
  }

  async function voidTransaction(id: string) {
    if (!window.confirm('Void this outstanding commission transaction?')) return;
    setError('');
    try {
      await voidLodgeCommissionTransaction(id);
      setMessage('Commission transaction voided.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction could not be voided.');
    }
  }

  return (
    <PermissionGate permission="finance.view">
      <div className="fin-stack">
        <FinanceStyles />
        <FinHeader
          actions={
            <>
              <Link className="fin-btn fin-btn-outline" href="/admin/commission">Back to lodges</Link>
              <button className="fin-btn fin-btn-soft" onClick={() => void load()} type="button">Refresh</button>
            </>
          }
          description="Detailed lodge revenue, commission accounting, settlement history and transaction history."
          eyebrow="Finance · Commission Account"
          title={loading && !report ? 'Loading…' : (report?.lodgeName ?? 'Lodge commission')}
        />
        <FinBanners error={error} message={message} />

        {report ? (
          <>
            <section aria-label="Lodge totals" className="fin-kpis">
              <FinKpi icon="receipt" label="Booking revenue" meta="Base for commission" tone="blue" value={formatMoney(report.summary.bookingRevenue)} />
              <FinKpi icon="money" label="Commission receivable" meta="Earned from bookings" tone="green" value={formatMoney(report.summary.commissionReceivable)} />
              <FinKpi icon="clock" label="Outstanding" meta="Awaiting settlement" tone="orange" value={formatMoney(report.summary.outstanding)} />
              <FinKpi icon="check" label="Settled" meta="Recorded payments" tone="purple" value={formatMoney(report.summary.settled)} />
            </section>

            <section className="fin-split">
              <FinPanel
                action={
                  <button className="fin-btn fin-btn-sm fin-btn-soft" onClick={() => setEditingRule((value) => !value)} type="button">
                    {editingRule ? 'Cancel' : 'Edit rule'}
                  </button>
                }
                sub="Active accounting rule"
                title="Commission configuration"
              >
                {!editingRule ? (
                  <RuleSummary setting={report.setting} />
                ) : (
                  <>
                    <div className="fin-form">
                      <label className="fin-field">
                        <span>Commission status</span>
                        <select onChange={(e) => setRuleEnabled(e.target.value === 'ON')} value={ruleEnabled ? 'ON' : 'OFF'}>
                          <option value="OFF">OFF · No commission charged</option>
                          <option value="ON">ON · Charge commission</option>
                        </select>
                      </label>
                      <label className="fin-field">
                        <span>Commission type</span>
                        <select onChange={(e) => setRuleType(e.target.value as LodgeCommissionType)} value={ruleType}>
                          <option value="PERCENTAGE">Percentage (%)</option>
                          <option value="FIXED_PER_BOOKING">Fixed amount per booking (₹)</option>
                        </select>
                      </label>
                      {ruleType === 'PERCENTAGE' ? (
                        <label className="fin-field">
                          <span>Commission rate (%)</span>
                          <input inputMode="decimal" max="100" min="0" onChange={(e) => setRuleRate(e.target.value)} step="0.01" type="number" value={ruleRate} />
                        </label>
                      ) : (
                        <label className="fin-field">
                          <span>Commission per booking (₹)</span>
                          <input inputMode="decimal" min="0" onChange={(e) => setRuleFixedAmount(e.target.value)} step="0.01" type="number" value={ruleFixedAmount} />
                        </label>
                      )}
                      <label className="fin-field">
                        <span>Effective from</span>
                        <input onChange={(e) => setRuleEffectiveFrom(e.target.value)} type="date" value={ruleEffectiveFrom} />
                      </label>
                    </div>
                    <div className="fin-actions fin-actions-end">
                      <button className="fin-btn" disabled={savingRule} onClick={() => void saveRule()} type="button">
                        {savingRule ? 'Saving…' : 'Save rule'}
                      </button>
                    </div>
                  </>
                )}
              </FinPanel>

              <FinPanel sub="Every settlement is stored separately and allocated against the oldest outstanding commission first." title="Record lodge payment">
                <SettlementForm onSubmit={settle} />
              </FinPanel>
            </section>

            <FinPanel sub="Commission History Manager" title="Booking-level accounting ledger">
              <LedgerTable onVoid={(id) => void voidTransaction(id)} transactions={report.transactions} />
            </FinPanel>

            <FinPanel sub="Immutable payment records" title="Settlement history">
              <SettlementHistoryTable settlements={report.settlements} />
            </FinPanel>
          </>
        ) : null}
      </div>
    </PermissionGate>
  );
}
