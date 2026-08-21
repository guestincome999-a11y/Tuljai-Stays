'use client';

import Link from 'next/link';
import type { SystemSetting } from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import {
  listAdminSettings,
  updateAdminSetting,
} from '../../../src/api/admin-platform-control-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { hasPermission } from '../../../src/permissions/permissions';
import { stringifySettingValue } from '../../../src/platform-control/platform-control-config';

const ONLINE_PAYMENTS_KEY = 'enable_online_payments';

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

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Finance & Settlements</p>
            <h2>Finance</h2>
            <p className="muted-copy">
              Manage lodge commissions, online collections, cash commission receivables, and lodge
              settlements from one place.
            </p>
          </div>
        </section>

        <section className="grid grid-2">
          <FinanceCard
            title="Lodge Commission"
            description="Configure commission rates and enable or disable commission for each lodge."
            href="/admin/commission"
            action="Open Commission"
          />
          <FinanceCard
            title="Revenue"
            description="Review booking revenue, commission earned, outstanding lodge receivables, and financial history."
            href="/admin/revenue"
            action="Open Revenue"
          />
        </section>

        <section className="panel">
          <p className="eyebrow">Online Collection</p>
          <h3>Razorpay online payments</h3>
          <p className="muted-copy">
            This is the live admin control for online payment entry points. It is OFF by default and
            must be explicitly enabled before pilgrims can use online collection.
          </p>
          {paymentError ? <p className="error-banner">{paymentError}</p> : null}
          {paymentMessage ? <p className="success-banner">{paymentMessage}</p> : null}
          <div className="feed-list">
            <article className="feed-item">
              <span>Online payments</span>
              <strong>
                {loadingPayments
                  ? 'Loading…'
                  : onlinePayments
                    ? stringifySettingValue(onlinePayments.value) === 'true'
                      ? 'ENABLED'
                      : 'DISABLED'
                    : 'SETTING NOT FOUND'}
              </strong>
            </article>
            <article className="feed-item">
              <span>Control permission</span>
              <strong>{canManageSettings ? 'Admin can change setting' : 'Read-only for this role'}</strong>
            </article>
          </div>
          <div className="row-actions">
            <button
              className="button button-primary"
              disabled={!canManageSettings || !onlinePayments || savingPayments || loadingPayments}
              type="button"
              onClick={() => void setOnlinePaymentState(true)}
            >
              {savingPayments ? 'Saving…' : 'Enable Online Payments'}
            </button>
            <button
              className="button button-secondary"
              disabled={!canManageSettings || !onlinePayments || savingPayments || loadingPayments}
              type="button"
              onClick={() => void setOnlinePaymentState(false)}
            >
              Disable Online Payments
            </button>
            <Link className="button button-secondary" href="/admin/settings">
              Open System Settings
            </Link>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Accounting Foundation</p>
          <h3>Collection & settlement accounting</h3>
          <p className="muted-copy">
            Payment and commission ledger tables are available in the database. Revenue and
            commission screens remain the source of truth for booking-level accounting; settlement
            actions must not be presented as completed until reconciliation is recorded by the backend.
          </p>
          <div className="feed-list">
            <Insight label="Payment collection ledger" value="Database foundation ready" />
            <Insight label="Commission ledger" value="Database foundation ready" />
            <Insight label="Lodge settlement ledger" value="Database foundation ready" />
            <Insight label="Online collection reconciliation" value="Backend-controlled" />
            <Insight label="Lodge settlement actions" value="Backend-controlled" />
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function FinanceCard({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Finance</p>
      <h3>{title}</h3>
      <p className="muted-copy">{description}</p>
      <Link className="button button-primary" href={href}>
        {action}
      </Link>
    </section>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <article className="feed-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
