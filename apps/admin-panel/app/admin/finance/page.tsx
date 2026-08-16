'use client';

import Link from 'next/link';

import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminFinancePage() {
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
          <FinanceCard title="Lodge Commission" description="Configure commission rates and enable or disable commission for each lodge." href="/admin/commission" action="Open Commission" />
          <FinanceCard title="Revenue" description="Review the existing booking revenue and commission intelligence dashboard." href="/admin/revenue" action="Open Revenue" />
        </section>

        <section className="panel">
          <p className="eyebrow">Finance Foundation</p>
          <h3>Collection & settlement accounting</h3>
          <p className="muted-copy">
            Payment and commission ledger tables are now in the database. Online collection and lodge settlement screens will be connected to those ledgers next; no financial amount on this page is presented as settled until the backend reconciliation endpoints are implemented.
          </p>
          <div className="feed-list">
            <Insight label="Online payments" value="OFF by default / Coming Soon" />
            <Insight label="Payment collection ledger" value="Database foundation ready" />
            <Insight label="Commission ledger" value="Database foundation ready" />
            <Insight label="Lodge settlement ledger" value="Database foundation ready" />
            <Insight label="Online collection reconciliation" value="Backend integration pending" />
            <Insight label="Lodge settlement actions" value="Backend integration pending" />
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function FinanceCard({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return (
    <section className="panel">
      <p className="eyebrow">Finance</p>
      <h3>{title}</h3>
      <p className="muted-copy">{description}</p>
      <Link className="button button-primary" href={href}>{action}</Link>
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
