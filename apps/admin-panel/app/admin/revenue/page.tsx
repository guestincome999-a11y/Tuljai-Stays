'use client';

import type { BookingReportRow, CommissionSummary } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { listBookingReport, listCommissionReport } from '../../../src/api/admin-bi-api';
import {
  buildLodgeRankings,
  groupRevenueByDate,
  sumCommission,
  sumRevenue,
  toCurrency,
} from '../../../src/business-intelligence/bi-utils';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminRevenuePage() {
  const [rows, setRows] = useState<BookingReportRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionSummary[]>([]);
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
      setErrorMessage('Revenue data could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rankings = useMemo(() => buildLodgeRankings(rows, commissions), [commissions, rows]);
  const revenueByDate = useMemo(() => groupRevenueByDate(rows), [rows]);
  const revenue = sumRevenue(rows);
  const commission = sumCommission(rows);
  const averageBookingValue = rows.length > 0 ? revenue / rows.length : 0;

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Revenue Intelligence</p>
            <h2>Revenue dashboard</h2>
            <p className="muted-copy">
              Revenue estimates, commission estimates, average booking values, and top performing
              lodges from current booking reports.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="grid grid-4">
          <Metric label="Revenue Estimate" value={toCurrency(revenue)} />
          <Metric label="Commission Earned" value={toCurrency(commission)} />
          <Metric label="Average Booking Value" value={toCurrency(averageBookingValue)} />
          <Metric label="Commission Pending" value="Settlement endpoint required" />
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Daily Revenue</p>
            <div className="chart-bars">
              {Object.entries(revenueByDate)
                .slice(0, 12)
                .map(([date, value]) => (
                  <div className="chart-row" key={date}>
                    <span>{date}</span>
                    <div>
                      <i
                        style={{ width: `${Math.min((value / Math.max(revenue, 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <strong>{toCurrency(value)}</strong>
                  </div>
                ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Revenue Foundations</p>
            <div className="feed-list">
              <Insight label="Revenue Today" value="Daily endpoint required" />
              <Insight label="Revenue Yesterday" value="Daily endpoint required" />
              <Insight label="Weekly Revenue" value={toCurrency(revenue)} />
              <Insight label="Monthly Revenue" value={toCurrency(revenue)} />
              <Insight label="Yearly Estimate" value="Forecast endpoint required" />
              <Insight label="Top Revenue Cities" value="Multi-city report required" />
            </div>
          </section>
        </section>

        <section className="table-panel">
          <p className="eyebrow">Top Revenue Lodges</p>
          <div className="admin-table bi-ranking-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span>
              <span>Bookings</span>
              <span>Revenue</span>
              <span>Commission</span>
              <span>Score</span>
            </div>
            {rankings.slice(0, 10).map((row) => (
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

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <article className="feed-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
