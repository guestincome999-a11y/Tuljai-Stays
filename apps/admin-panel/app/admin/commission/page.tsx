'use client';

import type { LodgeCommissionOverviewRow } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listLodgeCommissionOverview } from '../../../src/api/admin-bi-api';
import { FinanceStyles } from '../../../src/components/finance/FinanceStyles';
import { FinBanners, FinHeader, FinKpi, FinPanel, FinPill, formatMoney } from '../../../src/components/finance/FinanceUi';
import { PermissionGate } from '../../../src/components/PermissionGate';

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
      <div className="fin-stack">
        <FinanceStyles />
        <FinHeader
          actions={<button className="fin-btn fin-btn-outline" onClick={() => void load()} type="button">Refresh</button>}
          description="Every lodge's commission status, receivable and outstanding balance. Open a lodge to edit its commission rule, record settlements, and review the full ledger and settlement history."
          eyebrow="Finance · Lodge Commission"
          title="Lodge commission accounts"
        />
        <FinBanners error={error} />

        <section aria-label="Commission totals" className="fin-kpis">
          <FinKpi icon="lodge" label="Lodges" meta="Matching the search" tone="blue" value={String(filteredRows.length)} />
          <FinKpi icon="money" label="Total receivable" meta="Commission earned" tone="green" value={formatMoney(totals.receivable)} />
          <FinKpi icon="clock" label="Total outstanding" meta="Awaiting settlement" tone="orange" value={formatMoney(totals.outstanding)} />
          <FinKpi icon="check" label="Total settled" meta="Recorded payments" tone="purple" value={formatMoney(totals.settled)} />
        </section>

        <FinPanel sub={`${filteredRows.length} ${filteredRows.length === 1 ? 'lodge' : 'lodges'}`} title="Commission accounts">
          <div className="fin-toolbar">
            <input
              aria-label="Search lodge"
              className="fin-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by lodge name…"
              type="search"
              value={search}
            />
          </div>
          {loading ? (
            <div aria-label="Loading" className="fin-skeleton" />
          ) : !filteredRows.length ? (
            <p className="fin-empty">No lodges match this search.</p>
          ) : (
            <div className="fin-scroll">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Lodge</th>
                    <th>Status</th>
                    <th>Rule</th>
                    <th className="fin-num">Receivable</th>
                    <th className="fin-num">Outstanding</th>
                    <th className="fin-num">Settled</th>
                    <th className="fin-num">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.lodgeId}>
                      <td><b>{row.lodgeName}</b></td>
                      <td><FinPill tone={row.commissionEnabled ? 'green' : 'gray'}>{row.commissionEnabled ? 'ON' : 'OFF'}</FinPill></td>
                      <td>
                        {row.commissionType === 'FIXED_PER_BOOKING'
                          ? `Fixed ${formatMoney(row.commissionFixedAmount)}`
                          : `${row.commissionRatePercent}%`}
                      </td>
                      <td className="fin-num">{formatMoney(row.receivable)}</td>
                      <td className="fin-num">{formatMoney(row.outstanding)}</td>
                      <td className="fin-num">{formatMoney(row.settled)}</td>
                      <td className="fin-num">
                        <Link className="fin-btn fin-btn-sm fin-btn-soft" href={`/admin/commission/${row.lodgeId}`}>Open ledger</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FinPanel>
      </div>
    </PermissionGate>
  );
}
