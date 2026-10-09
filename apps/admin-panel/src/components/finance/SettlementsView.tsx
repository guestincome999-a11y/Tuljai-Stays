'use client';

import type { AdminSettlementHistoryPage, LodgeCommissionOverviewRow } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listLodgeCommissionOverview } from '../../api/admin-bi-api';
import { listSettlementHistory } from '../../api/finance-admin-api';
import { formatDate, formatInr } from '../dashboard/format';

import { FinanceStyles } from './FinanceStyles';
import { FinBanners, FinHeader, FinKpi, FinPanel, FinPill, formatLabel } from './FinanceUi';

export function SettlementsView() {
  const [lodges, setLodges] = useState<LodgeCommissionOverviewRow[] | null>(null);
  const [history, setHistory] = useState<AdminSettlementHistoryPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listLodgeCommissionOverview()
      .then((rows) => {
        if (active) setLodges(rows);
      })
      .catch(() => {
        if (active) setError('Could not load lodge commission balances.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    listSettlementHistory(page)
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch(() => {
        if (active) setError('Could not load settlement history.');
      });
    return () => {
      active = false;
    };
  }, [page]);

  const receivable = (lodges ?? []).reduce((sum, row) => sum + Number(row.receivable), 0);
  const settled = (lodges ?? []).reduce((sum, row) => sum + Number(row.settled), 0);
  const outstanding = (lodges ?? []).reduce((sum, row) => sum + Number(row.outstanding), 0);
  const owing = (lodges ?? []).filter((row) => Number(row.outstanding) > 0).sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
  const last = history?.items[0];

  return (
    <div className="fin-stack">
      <FinanceStyles />
      <FinHeader
        actions={<Link className="fin-btn fin-btn-outline" href="/admin/commission">Fees &amp; commission</Link>}
        description="Booking payment → platform commission → settlement. Balances are commission that lodges owe the platform, from the commission ledger. Record a settlement from a lodge's ledger. There is no automatic settlement schedule."
        eyebrow="Finance"
        title="Owner settlements"
      />
      <FinBanners error={error} />

      <section aria-label="Settlement totals" className="fin-kpis">
        <FinKpi icon="clock" label="Pending commission" meta={lodges ? `${owing.length} lodges awaiting settlement` : 'Loading'} tone="orange" value={lodges ? formatInr(outstanding) : '—'} />
        <FinKpi icon="check" label="Settled so far" meta={history ? `${history.totalItems} settlements recorded` : 'Loading'} tone="green" value={lodges ? formatInr(settled) : '—'} />
        <FinKpi icon="money" label="Total commission earned" meta="Across all lodges" tone="blue" value={lodges ? formatInr(receivable) : '—'} />
        <FinKpi icon="calendar" label="Last settlement" meta={last?.lodgeName ?? 'No settlements yet'} tone="purple" value={last ? formatDate(last.settledAt) : 'None yet'} />
      </section>

      <FinPanel sub={lodges ? `${owing.length} with a balance to settle` : undefined} title="Lodges awaiting settlement">
        {!lodges ? (
          <div aria-label="Loading" className="fin-skeleton" />
        ) : owing.length === 0 ? (
          <p className="fin-empty">No commission is outstanding.</p>
        ) : (
          <div className="fin-scroll">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Lodge</th>
                  <th className="fin-num">Commission earned</th>
                  <th className="fin-num">Settled</th>
                  <th className="fin-num">Net payable</th>
                  <th className="fin-num">Action</th>
                </tr>
              </thead>
              <tbody>
                {owing.map((row) => (
                  <tr key={row.lodgeId}>
                    <td><b>{row.lodgeName}</b></td>
                    <td className="fin-num">{formatInr(Number(row.receivable))}</td>
                    <td className="fin-num">{formatInr(Number(row.settled))}</td>
                    <td className="fin-num"><FinPill tone="orange">{formatInr(Number(row.outstanding))}</FinPill></td>
                    <td className="fin-num">
                      <Link className="fin-btn fin-btn-sm fin-btn-violet" href={`/admin/commission/${row.lodgeId}`}>Record settlement</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FinPanel>

      <FinPanel sub={history ? `${formatInr(Number(history.settledTotal))} settled in total` : undefined} title="Settlement history">
        {!history ? (
          <div aria-label="Loading" className="fin-skeleton" />
        ) : history.items.length === 0 ? (
          <p className="fin-empty">No settlements have been recorded yet.</p>
        ) : (
          <div className="fin-scroll">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Lodge</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Recorded by</th>
                  <th>Status</th>
                  <th className="fin-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.settledAt)}</td>
                    <td><Link className="fin-link" href={`/admin/commission/${item.lodgeId}`}>{item.lodgeName}</Link></td>
                    <td>{formatLabel(item.paymentMethod)}</td>
                    <td className="fin-mono">{item.reference ?? '—'}</td>
                    <td>{item.settledByName ?? '—'}</td>
                    <td><FinPill tone="green">Settled</FinPill></td>
                    <td className="fin-num">{formatInr(Number(item.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history ? (
          <div className="fin-pager">
            <span>Page {history.page} of {history.totalPages}</span>
            <button className="fin-btn fin-btn-sm fin-btn-soft" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <button className="fin-btn fin-btn-sm fin-btn-soft" disabled={page >= history.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        ) : null}
      </FinPanel>
    </div>
  );
}
