'use client';

import type { BookingReportRow, CommissionSummary } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listBookingReport, listCommissionReport } from '../../../src/api/admin-bi-api';
import {
  buildLodgeRankings,
  getOwnerBadge,
  toCurrency,
} from '../../../src/business-intelligence/bi-utils';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminPerformancePage() {
  const [rows, setRows] = useState<BookingReportRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionSummary[]>([]);
  const [sort, setSort] = useState<'bookings' | 'revenue' | 'score'>('score');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [bookingResponse, commissionResponse] = await Promise.all([
        listBookingReport({ limit: 300 }),
        listCommissionReport(),
      ]);
      setRows(bookingResponse.items);
      setCommissions(commissionResponse);
    } catch {
      setErrorMessage('Performance data could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rankings = useMemo(
    () => [...buildLodgeRankings(rows, commissions)].sort((a, b) => b[sort] - a[sort]),
    [commissions, rows, sort],
  );

  return (
    <PermissionGate permission="reports.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Performance</p>
            <h2>Lodge and owner performance</h2>
            <p className="muted-copy">
              Rank lodges and prepare owner scorecards using bookings, revenue, commission, QR, and
              response metrics where available.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="score">Health score</option>
                <option value="bookings">Bookings</option>
                <option value="revenue">Revenue</option>
              </select>
            </label>
          </div>
        </section>

        <section className="table-panel">
          <p className="eyebrow">Lodge Performance</p>
          <div className="admin-table bi-ranking-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span>
              <span>Bookings</span>
              <span>Revenue</span>
              <span>Commission</span>
              <span>Health Score</span>
            </div>
            {rankings.map((row) => (
              <div className="admin-table-row" key={row.lodgeId}>
                <span>{row.lodgeId}</span>
                <span>{row.bookings}</span>
                <span>{toCurrency(row.revenue)}</span>
                <span>{toCurrency(row.commission)}</span>
                <span>{Math.round(row.score)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Owner Performance Foundation</p>
            <div className="feed-list">
              <Insight label="Acceptance Rate" value={`${getOwnerBadge(90)} badge ready`} />
              <Insight label="Response Time" value="Backend metric required" />
              <Insight label="Check-in Completion" value="QR and register metrics required" />
              <Insight label="Online Availability" value="Presence by owner required" />
              <Insight label="Missed Bookings" value="Owner timeout metric required" />
              <Insight label="Complaint Count" value="Support/review report required" />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Needs Attention</p>
            <div className="feed-list">
              {rankings
                .slice()
                .reverse()
                .slice(0, 5)
                .map((row) => (
                  <Insight
                    key={row.lodgeId}
                    label={row.lodgeId}
                    value={`Score ${Math.round(row.score)}`}
                  />
                ))}
            </div>
          </section>
        </section>
      </div>
    </PermissionGate>
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
