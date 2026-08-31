'use client';

import type { LodgeCommissionOverviewRow } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listLodgeCommissionOverview } from '../../../src/api/admin-bi-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

function money(value: string | number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminCommissionPage() {
  const [rows, setRows] = useState<LodgeCommissionOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await listLodgeCommissionOverview());
    } catch {
      setError('Could not load lodge commission overview.');
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = rows.filter((row) =>
    row.lodgeName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totals = filteredRows.reduce(
    (acc, row) => ({
      outstanding: acc.outstanding + Number(row.outstanding || 0),
      receivable: acc.receivable + Number(row.receivable || 0),
      settled: acc.settled + Number(row.settled || 0),
    }),
    { outstanding: 0, receivable: 0, settled: 0 },
  );

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Finance · Lodge Commission</p>
            <h2>Lodge commission accounts</h2>
            <p className="muted-copy">
              Every lodge&apos;s commission status, receivable and outstanding balance. Open a
              lodge to edit its commission rule, record settlements, and review the full ledger
              and settlement history.
            </p>
          </div>
          <button className="button button-secondary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}

        <section className="grid grid-4">
          <Metric label="Lodges" value={String(filteredRows.length)} />
          <Metric label="Total receivable" value={money(totals.receivable)} />
          <Metric label="Total outstanding" value={money(totals.outstanding)} />
          <Metric label="Total settled" value={money(totals.settled)} />
        </section>

        <section className="panel">
          <label className="form-field">
            <span>Search lodge</span>
            <input
              placeholder="Search by lodge name…"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </section>

        <section className="table-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">All lodges</p>
              <h3>Commission accounts</h3>
            </div>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span>
              <span>Status</span>
              <span>Rule</span>
              <span>Receivable</span>
              <span>Outstanding</span>
              <span>Settled</span>
              <span>Action</span>
            </div>
            {loading ? <p className="muted-copy">Loading lodges…</p> : null}
            {!loading && !filteredRows.length ? (
              <p className="muted-copy">No lodges match this search.</p>
            ) : null}
            {filteredRows.map((row) => (
              <div className="admin-table-row" key={row.lodgeId}>
                <span>
                  <strong>{row.lodgeName}</strong>
                </span>
                <span>{row.commissionEnabled ? 'ON' : 'OFF'}</span>
                <span>
                  {row.commissionType === 'FIXED_PER_BOOKING'
                    ? `Fixed ${money(row.commissionFixedAmount)}`
                    : `${row.commissionRatePercent}%`}
                </span>
                <span>{money(row.receivable)}</span>
                <span>{money(row.outstanding)}</span>
                <span>{money(row.settled)}</span>
                <span>
                  <Link className="button button-primary" href={`/admin/commission/${row.lodgeId}`}>
                    Open ledger
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">INR</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
