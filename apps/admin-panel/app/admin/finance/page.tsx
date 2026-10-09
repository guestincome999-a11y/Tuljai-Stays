'use client';

import type { SystemSetting } from '@tuljai/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { listAdminSettings, updateAdminSetting } from '../../../src/api/admin-platform-control-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { FinanceStyles } from '../../../src/components/finance/FinanceStyles';
import { FinBanners, FinHeader, FinIcon, FinKv, FinPanel, FinPill } from '../../../src/components/finance/FinanceUi';
import type { FinIconName, FinTone } from '../../../src/components/finance/FinanceUi';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { hasPermission } from '../../../src/permissions/permissions';
import { stringifySettingValue } from '../../../src/platform-control/platform-control-config';

const ONLINE_PAYMENTS_KEY = 'enable_online_payments';

const SHORTCUTS: Array<{ action: string; buttonClass: string; description: string; href: string; icon: FinIconName; title: string; tone: FinTone }> = [
  { action: 'Open Commission', buttonClass: 'fin-btn-soft', description: 'Configure commission rates and enable or disable commission for each lodge.', href: '/admin/commission', icon: 'percent', title: 'Lodge Commission', tone: 'blue' },
  { action: 'Open Revenue', buttonClass: 'fin-btn-soft', description: 'Review booking revenue, commission earned, outstanding lodge receivables, and financial history.', href: '/admin/revenue', icon: 'chart', title: 'Revenue', tone: 'green' },
  { action: 'Open Settlements', buttonClass: 'fin-btn-violet', description: 'See which lodges owe commission and record settlements against their ledger.', href: '/admin/settlements', icon: 'bank', title: 'Owner Settlements', tone: 'purple' },
  { action: 'Open Payments', buttonClass: 'fin-btn-soft', description: 'Every payment collected for a booking, online or at the lodge.', href: '/admin/payments', icon: 'card', title: 'Payments', tone: 'orange' },
];

const FOUNDATION: Array<{ label: string; tone: FinTone; value: string }> = [
  { label: 'Payment collection ledger', tone: 'green', value: 'Database foundation ready' },
  { label: 'Commission ledger', tone: 'green', value: 'Database foundation ready' },
  { label: 'Lodge settlement ledger', tone: 'green', value: 'Database foundation ready' },
  { label: 'Online collection reconciliation', tone: 'blue', value: 'Backend-controlled' },
  { label: 'Lodge settlement actions', tone: 'blue', value: 'Backend-controlled' },
];

export default function AdminFinancePage() {
  const auth = useAdminAuth();
  const [onlinePayments, setOnlinePayments] = useState<SystemSetting | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [savingPayments, setSavingPayments] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const canManageSettings = hasPermission(auth.permissions, 'settings.manage');

  const loadOnlinePaymentSetting = useCallback(async () => {
    setLoadingPayments(true);
    setPaymentError('');
    try {
      const settings = await listAdminSettings();
      setOnlinePayments(settings.find((setting) => setting.key === ONLINE_PAYMENTS_KEY) ?? null);
    } catch {
      setPaymentError('Online payment status could not be loaded.');
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    void loadOnlinePaymentSetting();
  }, [loadOnlinePaymentSetting]);

  async function setOnlinePaymentState(enabled: boolean) {
    if (!canManageSettings || !onlinePayments) return;

    setSavingPayments(true);
    setPaymentError('');
    setPaymentMessage('');
    try {
      await updateAdminSetting(ONLINE_PAYMENTS_KEY, {
        description: onlinePayments.description ?? 'Enable online payment entry points.',
        isPublic: onlinePayments.isPublic,
        value: enabled,
      });
      await loadOnlinePaymentSetting();
      setPaymentMessage(`Online payments ${enabled ? 'enabled' : 'disabled'} successfully.`);
    } catch (error) {
      setPaymentError(
        error instanceof Error && error.message.trim()
          ? `Online payment update failed. ${error.message}`
          : 'Online payment update failed.',
      );
    } finally {
      setSavingPayments(false);
    }
  }

  const paymentsOn = onlinePayments ? stringifySettingValue(onlinePayments.value) === 'true' : false;
  const statusPill = loadingPayments ? (
    <FinPill tone="gray">Loading…</FinPill>
  ) : onlinePayments ? (
    <FinPill tone={paymentsOn ? 'green' : 'red'}>{paymentsOn ? 'ENABLED' : 'DISABLED'}</FinPill>
  ) : (
    <FinPill tone="orange">SETTING NOT FOUND</FinPill>
  );
  const controlsDisabled = !canManageSettings || !onlinePayments || savingPayments || loadingPayments;

  return (
    <PermissionGate permission="finance.view">
      <div className="fin-stack">
        <FinanceStyles />
        <FinHeader
          description="Manage lodge commissions, online collections, cash commission receivables, and lodge settlements from one place."
          eyebrow="Finance & Settlements"
          title="Finance"
        />

        <section aria-label="Finance sections" className="fin-links">
          {SHORTCUTS.map((item) => (
            <article className="fin-linkcard" key={item.href}>
              <FinIcon name={item.icon} tone={item.tone} />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <Link className={`fin-btn ${item.buttonClass}`} href={item.href}>{item.action}</Link>
            </article>
          ))}
        </section>

        <FinPanel sub="Online collection" title="Razorpay online payments">
          <p className="fin-text">
            This is the live admin control for online payment entry points. It is OFF by default and
            must be explicitly enabled before pilgrims can use online collection.
          </p>
          <FinBanners error={paymentError} message={paymentMessage} />
          <FinKv
            rows={[
              { label: 'Online payments', value: statusPill },
              { label: 'Control permission', value: canManageSettings ? 'Admin can change setting' : 'Read-only for this role' },
            ]}
          />
          <div className="fin-actions">
            <button className="fin-btn" disabled={controlsDisabled} onClick={() => void setOnlinePaymentState(true)} type="button">
              {savingPayments ? 'Saving…' : 'Enable Online Payments'}
            </button>
            <button className="fin-btn fin-btn-outline" disabled={controlsDisabled} onClick={() => void setOnlinePaymentState(false)} type="button">
              Disable Online Payments
            </button>
            <Link className="fin-btn fin-btn-soft" href="/admin/settings">Open System Settings</Link>
          </div>
        </FinPanel>

        <FinPanel sub="Accounting foundation" title="Collection & settlement accounting">
          <p className="fin-text">
            Payment and commission ledger tables are available in the database. Revenue and
            commission screens remain the source of truth for booking-level accounting; settlement
            actions must not be presented as completed until reconciliation is recorded by the
            backend.
          </p>
          <FinKv
            rows={FOUNDATION.map((item) => ({ label: item.label, value: <FinPill tone={item.tone}>{item.value}</FinPill> }))}
            twoColumns
          />
        </FinPanel>
      </div>
    </PermissionGate>
  );
}
