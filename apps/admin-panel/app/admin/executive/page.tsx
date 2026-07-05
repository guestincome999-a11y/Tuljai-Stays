'use client';

import type {
  AdminDashboardSummary,
  BookingReportRow,
  NotificationMetrics,
  QrScanLogEntry,
} from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getBiNotificationMetrics,
  getExecutiveSummary,
  listBiQrScanLogs,
  listBookingReport,
} from '../../../src/api/admin-bi-api';
import {
  buildExecutiveKpis,
  getAcceptanceRate,
  getBusinessScore,
  getCancellationRate,
  getOccupancyRate,
  getQrSuccessRate,
  sumRevenue,
  toCurrency,
  toPercent,
} from '../../../src/business-intelligence/bi-utils';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminExecutivePage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [rows, setRows] = useState<BookingReportRow[]>([]);
  const [qrLogs, setQrLogs] = useState<QrScanLogEntry[]>([]);
  const [notificationMetrics, setNotificationMetrics] = useState<NotificationMetrics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [summaryResponse, bookingResponse, qrResponse, notificationResponse] =
        await Promise.all([
          getExecutiveSummary(),
          listBookingReport({ limit: 200 }),
          listBiQrScanLogs(),
          getBiNotificationMetrics(),
        ]);
      setSummary(summaryResponse);
      setRows(bookingResponse.items);
      setQrLogs(qrResponse.items);
      setNotificationMetrics(notificationResponse);
    } catch {
      setErrorMessage('Executive BI data could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(
    () => (summary ? buildExecutiveKpis(summary, rows, qrLogs, notificationMetrics) : []),
    [notificationMetrics, qrLogs, rows, summary],
  );
  const scorecards = useMemo<Array<[string, string]>>(() => {
    if (!summary) {
      return [];
    }

    return [
      ['Platform Health', getBusinessScore(100 - summary.failedNotifications)],
      ['Business Growth', getBusinessScore(Math.min(summary.todayBookings * 10, 100))],
      ['Operational Efficiency', getBusinessScore(getAcceptanceRate(summary))],
      ['Owner Performance', getBusinessScore(summary.liveOwnersOnline * 10)],
      [
        'Lodge Quality',
        getBusinessScore((summary.verifiedLodges / Math.max(summary.totalLodges, 1)) * 100),
      ],
      ['Customer Satisfaction', 'Review aggregate required'],
    ];
  }, [summary]);

  return (
    <PermissionGate permission="analytics.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Executive BI</p>
            <h2>Business intelligence overview</h2>
            <p className="muted-copy">
              Revenue, bookings, occupancy, QR efficiency, notification efficiency, and business
              scorecards for senior administrators.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}

        <section className="bi-kpi-grid">
          {kpis.map((kpi) => (
            <article className="bi-card" key={kpi.label}>
              <span className="kpi-label">{kpi.label}</span>
              <strong>{kpi.value}</strong>
              <small>
                {kpi.trend === 'up' ? 'Up' : kpi.trend === 'down' ? 'Down' : 'Flat'} /{' '}
                {kpi.comparison}
              </small>
              <small>Updated {kpi.lastUpdated}</small>
            </article>
          ))}
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Executive Insights</p>
            <h3>Automated highlights</h3>
            <div className="feed-list">
              <Insight label="Revenue estimate" value={toCurrency(sumRevenue(rows))} />
              <Insight
                label="Highest occupancy signal"
                value={summary ? toPercent(getOccupancyRate(summary)) : '0%'}
              />
              <Insight
                label="QR issues"
                value={`${100 - Math.round(getQrSuccessRate(qrLogs))}% failure signal`}
              />
              <Insight
                label="Cancellation trend"
                value={summary ? toPercent(getCancellationRate(summary)) : '0%'}
              />
              <Insight label="Fastest growing lodge" value="Trend endpoint required" />
              <Insight label="Slowest responding owner" value="Owner response metric required" />
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Business Scorecards</p>
            <h3>Executive ratings</h3>
            <div className="feed-list">
              {scorecards.map(([label, value]) => (
                <Insight key={label} label={label} value={String(value)} />
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
