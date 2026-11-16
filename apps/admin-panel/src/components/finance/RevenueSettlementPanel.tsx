'use client';

import type { LodgeCommissionFinanceReport } from '@tuljai/types';
import { useRef, useState } from 'react';

import { createLodgeRevenueSettlement } from '../../api/admin-bi-api';

import { FinBanners, FinPanel, SettlementForm, SettlementHistoryTable } from './FinanceUi';
import type { SettlementFormValues } from './FinanceUi';

export function RevenueSettlementPanel({
  report,
  onUpdate,
}: {
  report: LodgeCommissionFinanceReport;
  onUpdate: (report: LodgeCommissionFinanceReport) => void;
}) {
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');

  async function submit(values: SettlementFormValues): Promise<boolean> {
    setError(null);
    setMessage(null);
    const fingerprint = JSON.stringify({ ...values, bankName, accountLast4 });
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const updated = await createLodgeRevenueSettlement(report.lodgeId, {
        ...values,
        idempotencyKey: attempt.current.key,
        bankName: bankName.trim() || undefined,
        accountLast4: accountLast4 || undefined,
      });
      onUpdate(updated);
      attempt.current = null;
      setMessage('Revenue settlement recorded. The payment is visible in the owner app.');
      return true;
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : 'Revenue settlement could not be recorded.',
      );
      return false;
    }
  }

  return (
    <>
      <FinPanel
        title="Record revenue settlement"
        sub="Record an online revenue payment already made to this lodge. Unpaid commission on online bookings is deducted and marked settled."
      >
        <FinBanners error={error} message={message} />
        <div className="fin-form-grid">
          <label className="fin-field">
            Bank name (optional)
            <input maxLength={80} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </label>
          <label className="fin-field">
            Account last four digits only
            <input
              inputMode="numeric"
              maxLength={4}
              value={accountLast4}
              onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        {report.revenue ? (
          <SettlementForm
            buttonLabel="Record revenue settlement"
            maxAmount={Number(report.revenue.balancePayable)}
            onSubmit={submit}
          />
        ) : (
          <p className="fin-empty">
            Revenue settlement data is unavailable. Refresh after the backend update.
          </p>
        )}
      </FinPanel>
      <FinPanel
        title="Revenue settlement history"
        sub="Payments from Tuljai Stays to this lodge, also visible to its owner."
      >
        <SettlementHistoryTable settlements={report.revenueSettlements ?? []} />
      </FinPanel>
    </>
  );
}
