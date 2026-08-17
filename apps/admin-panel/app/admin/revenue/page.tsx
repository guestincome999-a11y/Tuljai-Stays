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
  const [selectedLodgeId, setSelectedLodgeId] = useState<string | null>(null);
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
  const selectedLodge = rankings.find((row) => row.lodgeId === selectedLodgeId) ?? null;

  return (
    <PermissionGate permission="finance.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Revenue Intelligence</p>
            <h2>Revenue dashboard</h2>
            <p className="muted-copy">
              Revenue estimates, commission estimates, average booking values, and lodge-level
              receivable/payable views from current booking reports.
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
          <Metric label="Commission Receivable" value={toCurrency(commission)} />
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
          <div className="section-heading">
            <div>
              <p className="eyebrow">Lodge Commission Report</p>
              <p className="muted-copy">
                Every lodge shows the commission currently receivable by Tuljai Stays. The same
                amount is the lodge's payable commission under the current commission model.
              </p>
            </div>
          </div>
          <div className="admin-table bi-ranking-table">
            <div className="admin-table-row admin-table-head">
              <span>Lodge</span>
              <span>Bookings</span>
              <span>Revenue</span>
              <span>Commission Receivable</span>
              <span>Action</span>
            </div>
            {rankings.slice(0, 20).map((row) => (
              <div className="admin-table-row" key={row.lodgeId}>
                <span>
                  <strong>{row.lodgeId}</strong>
                </span>
                <span>{row.bookings}</span>
                <span>{toCurrency(row.revenue)}</span>
                <span>{toCurrency(row.commission)}</span>
                <span>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setSelectedLodgeId(row.lodgeId)}
                  >
                    View report
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>

        {selectedLodge ? (
          <section className="panel" aria-label="Lodge commission report">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Lodge Report Card</p>
                <h3>{selectedLodge.lodgeId}</h3>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setSelectedLodgeId(null)}
              >
                Close
              </button>
            </div>

            <div className="grid grid-4">
              <Metric label="Bookings" value={String(selectedLodge.bookings)} />
              <Metric label="Booking Revenue" value={toCurrency(selectedLodge.revenue)} />
              <Metric label="Tuljai Receivable" value={toCurrency(selectedLodge.commission)} />
              <Metric label="Lodge Payable" value={toCurrency(selectedLodge.commission)} />
            </div>

            <div className="feed-list">
              <Insight label="Commission status" value="Outstanding in current report" />
              <Insight
                label="Settlement tracking"
                value="Not enabled yet — no settlement endpoint is assumed"
              />
              <Insight
                label="Accounting interpretation"
                value="Receivable by Tuljai Stays = payable by this lodge"
              />
            </div>
          </section>
        ) : null}

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
