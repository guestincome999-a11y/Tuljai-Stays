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
  getNotificationDeliveryRate,
  getOccupancyRate,
  getQrSuccessRate,
  groupBookingsByStatus,
  toPercent,
} from '../../../src/business-intelligence/bi-utils';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [rows, setRows] = useState<BookingReportRow[]>([]);
  const [qrLogs, setQrLogs] = useState<QrScanLogEntry[]>([]);
  const [notificationMetrics, setNotificationMetrics] = useState<NotificationMetrics | null>(null);
  const [range, setRange] = useState('Month');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [summaryResponse, bookingResponse, qrResponse, notificationResponse] =
        await Promise.all([
          getExecutiveSummary(),
          listBookingReport({ limit: 300 }),
          listBiQrScanLogs(),
          getBiNotificationMetrics(),
        ]);
      setSummary(summaryResponse);
      setRows(bookingResponse.items);
      setQrLogs(qrResponse.items);
      setNotificationMetrics(notificationResponse);
    } catch {
      setErrorMessage('Analytics data could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusDistribution = useMemo(() => groupBookingsByStatus(rows), [rows]);

  return (
    <PermissionGate permission="analytics.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Analytics</p>
            <h2>Booking, occupancy, customer and efficiency analytics</h2>
            <p className="muted-copy">
              Business analytics from available booking, notification, QR, and dashboard summary
              data.
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
              <span>Range</span>
              <select value={range} onChange={(event) => setRange(event.target.value)}>
                {['Today', 'Week', 'Month', 'Year', 'Custom Range'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>City</span>
              <input placeholder="City filter foundation" />
            </label>
            <label>
              <span>Lodge</span>
              <input placeholder="Lodge filter foundation" />
            </label>
            <label>
              <span>Owner</span>
              <input placeholder="Owner filter foundation" />
            </label>
          </div>
        </section>

        <section className="grid grid-4">
          <Metric
            label="Average Occupancy"
            value={summary ? toPercent(getOccupancyRate(summary)) : '0%'}
          />
          <Metric label="QR Success" value={toPercent(getQrSuccessRate(qrLogs))} />
          <Metric
            label="Notification Delivery"
            value={toPercent(getNotificationDeliveryRate(notificationMetrics))}
          />
          <Metric label="Average Group Size" value="Booking detail endpoint required" />
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Booking Status Distribution</p>
            <div className="chart-bars">
              {Object.entries(statusDistribution).map(([status, count]) => (
                <div className="chart-row" key={status}>
                  <span>{status}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.min((count / Math.max(rows.length, 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">QR And Notification Analytics</p>
            <div className="feed-list">
              <Insight label="QR Failure %" value={toPercent(100 - getQrSuccessRate(qrLogs))} />
              <Insight label="Duplicate Scans" value="Failure reason trend shown in QR monitor" />
              <Insight label="Expired QR" value="Failure reason trend shown in QR monitor" />
              <Insight label="Wrong Lodge" value="Failure reason trend shown in QR monitor" />
              <Insight
                label="Read Rate"
                value={
                  notificationMetrics
                    ? toPercent(
                        (notificationMetrics.readCount /
                          Math.max(notificationMetrics.totalNotifications, 1)) *
                          100,
                      )
                    : '0%'
                }
              />
              <Insight label="Most Active Hours" value="Hourly dimension required" />
            </div>
          </section>
        </section>

        <section className="grid grid-2">
          <FoundationPanel
            title="Customer Analytics"
            items={[
              'New pilgrims',
              'Returning pilgrims',
              'Average stay',
              'Families',
              'Solo travellers',
              'Repeat booking rate',
            ]}
          />
          <FoundationPanel
            title="Geographic Insights"
            items={[
              'State-wise pilgrims',
              'District-wise pilgrims',
              'City-wise bookings',
              'Popular routes',
              'Top referral areas',
              'Growth by region',
            ]}
          />
          <FoundationPanel
            title="Predictive Analytics"
            items={[
              'Expected occupancy',
              'Expected booking load',
              'Peak festival hours',
              'Expected QR volume',
              'Staff requirement',
              'Expected revenue',
            ]}
          />
          <FoundationPanel
            title="Seasonality"
            items={[
              'Bookings by hour',
              'Bookings by weekday',
              'Monthly bookings',
              'Seasonal bookings',
              'Festival spikes',
              'Manual interventions',
            ]}
          />
        </section>
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">BI</span>
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

function FoundationPanel({ items, title }: { items: string[]; title: string }) {
  return (
    <section className="panel">
      <p className="eyebrow">{title}</p>
      <h3>{title} foundation</h3>
      <div className="roadmap-grid">
        {items.map((item) => (
          <article className="roadmap-card" key={item}>
            <h4>{item}</h4>
            <p>Requires dedicated analytics dimensions before production use.</p>
          </article>
        ))}
      </div>
    </section>
  );
}
