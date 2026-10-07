'use client';

import type { AdminSettlementHistoryPage, LodgeCommissionOverviewRow } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listLodgeCommissionOverview } from '../../api/admin-bi-api';
import { listSettlementHistory } from '../../api/finance-admin-api';
import { formatDate, formatInr } from '../dashboard/format';

import { FinanceStyles } from './FinanceStyles';

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

  return (
    <div className="fin-stack">
      <FinanceStyles />
      <p className="fin-note">
        Booking payment → platform commission → settlement. Balances are commission that lodges owe the platform, from the commission ledger. Record a settlement from a lodge&apos;s ledger. There is no automatic settlement schedule.
      </p>
      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      <section aria-label="Settlement totals" className="fin-cards">
        <article className="fin-card fin-card-orange"><span>Pending commission</span><strong>{lodges ? formatInr(outstanding) : '—'}</strong><small>{lodges ? `${owing.length} lodges awaiting settlement` : 'Loading'}</small></article>
        <article className="fin-card fin-card-green"><span>Settled so far</span><strong>{lodges ? formatInr(settled) : '—'}</strong><small>{history ? `${history.totalItems} settlements recorded` : 'Loading'}</small></article>
        <article className="fin-card"><span>Total commission earned</span><strong>{lodges ? formatInr(receivable) : '—'}</strong><small>Across all lodges</small></article>
        <article className="fin-card fin-card-purple"><span>Last settlement</span><strong>{history?.items[0] ? formatDate(history.items[0].settledAt) : 'None yet'}</strong><small>{history?.items[0]?.lodgeName ?? ' '}</small></article>
      </section>

      <section className="fin-panel">
        <div className="fin-panel-head"><h2>Lodges awaiting settlement</h2><Link className="fin-link" href="/admin/commission">Fees &amp; commission</Link></div>
        {!lodges ? <div aria-label="Loading" className="fin-skeleton" /> : owing.length === 0 ? <p className="fin-empty">No commission is outstanding.</p> : (
          <div className="fin-scroll">
            <table className="fin-table">
              <thead><tr><th>Lodge</th><th className="fin-num">Commission earned</th><th className="fin-num">Settled</th><th className="fin-num">Net payable</th><th /></tr></thead>
              <tbody>
                {owing.map((row) => (
                  <tr key={row.lodgeId}>
                    <td><b>{row.lodgeName}</b></td>
                    <td className="fin-num">{formatInr(Number(row.receivable))}</td>
                    <td className="fin-num">{formatInr(Number(row.settled))}</td>
                    <td className="fin-num"><span className="fin-pill fin-pill-orange">{formatInr(Number(row.outstanding))}</span></td>
                    <td className="fin-num"><Link className="fin-btn" href={`/admin/commission/${row.lodgeId}`}>Record settlement</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fin-panel">
        <div className="fin-panel-head"><h2>Settlement history</h2>{history ? <span className="fin-mono">{formatInr(Number(history.settledTotal))} total</span> : null}</div>
        {!history ? <div aria-label="Loading" className="fin-skeleton" /> : history.items.length === 0 ? <p className="fin-empty">No settlements have been recorded yet.</p> : (
          <div className="fin-scroll">
            <table className="fin-table">
              <thead><tr><th>Date</th><th>Lodge</th><th>Method</th><th>Reference</th><th>Recorded by</th><th>Status</th><th className="fin-num">Amount</th></tr></thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.settledAt)}</td>
                    <td><Link className="fin-link" href={`/admin/commission/${item.lodgeId}`}>{item.lodgeName}</Link></td>
                    <td>{item.paymentMethod}</td>
                    <td className="fin-mono">{item.reference ?? '—'}</td>
                    <td>{item.settledByName ?? '—'}</td>
                    <td><span className="fin-pill fin-pill-green">Settled</span></td>
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
            <button className="fin-btn fin-btn-soft" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <button className="fin-btn fin-btn-soft" disabled={page >= history.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
