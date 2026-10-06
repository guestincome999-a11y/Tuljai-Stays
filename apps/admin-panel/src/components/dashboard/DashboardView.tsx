'use client';

import type { AdminDashboardPeriod } from '@tuljai/types';
import { useState } from 'react';

import {
  ActivityCard,
  AvailabilityCard,
  BookingOverviewCard,
  JourneyBanner,
  KpiRow,
  PendingActionsCard,
  QuickAlertsCard,
  RecentBookingsCard,
  RevenueSummaryCard,
  SettlementsCard,
  TopLodgesCard,
} from './DashboardCards';
import { useDashboardData } from './useDashboardData';

export function DashboardView() {
  const [period, setPeriod] = useState<AdminDashboardPeriod>('month');
  const data = useDashboardData(period);

  return (
    <div className="dash-root">
      {data.failed ? (
        <p className="error-banner" role="alert">
          Some dashboard figures could not be loaded. They will retry automatically.
        </p>
      ) : null}
      <div className="dash-layout">
        <div className="dash-main">
          <KpiRow kpis={data.kpis} />
          <BookingOverviewCard points={data.trend} />
          <RecentBookingsCard bookings={data.recent} />
          <div className="dash-pair">
            <PendingActionsCard insights={data.insights} />
            <RevenueSummaryCard insights={data.insights} onPeriod={setPeriod} period={period} />
          </div>
          <div className="dash-pair">
            <SettlementsCard operations={data.operations} />
            <AvailabilityCard operations={data.operations} />
          </div>
        </div>
        <div className="dash-side">
          <QuickAlertsCard insights={data.insights} />
          <TopLodgesCard insights={data.insights} />
          <ActivityCard operations={data.operations} />
        </div>
      </div>
      <JourneyBanner />

      <style jsx global>{`
        .dash-root { display: grid; gap: 16px; }
        .dash-layout { align-items: start; display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) 300px; }
        .dash-main, .dash-side { display: grid; gap: 16px; min-width: 0; }
        .dash-pair { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dash-card { background: #fff; border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: var(--shadow-soft); min-width: 0; padding: 18px 20px; }
        .dash-card-head { align-items: center; display: flex; gap: 10px; margin-bottom: 14px; }
        .dash-card-head h2 { color: var(--color-primary-strong); flex: 1; font-size: 0.98rem; font-weight: 800; margin: 0; }
        .dash-card-sub { color: var(--color-muted); font-size: 0.74rem; font-weight: 600; }
        .dash-link { color: var(--color-primary); font-size: 0.78rem; font-weight: 700; }
        .dash-link:hover { text-decoration: underline; }
        .dash-link-text { color: var(--color-primary-strong); font-weight: 700; }
        .dash-muted { color: var(--color-muted); font-weight: 600; }
        .dash-up { color: #16a368; font-weight: 800; }
        .dash-down { color: var(--color-danger); font-weight: 800; }
        .dash-empty { color: var(--color-muted); font-size: 0.84rem; margin: 0; padding: 14px 0; }
        .dash-note { color: var(--color-muted); font-size: 0.72rem; font-weight: 600; margin: 10px 0 0; }
        .dash-skeleton { background: linear-gradient(90deg, #eef2f8, #f6f8fc, #eef2f8); border-radius: 12px; height: 160px; }
        .dash-kpi-grid { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .dash-kpi { border: 1px solid; border-radius: 16px; display: grid; gap: 4px; padding: 16px 18px; }
        .dash-kpi-blue { background: #eef4ff; border-color: #d3e1ff; }
        .dash-kpi-green { background: #ecf9f2; border-color: #cdeedd; }
        .dash-kpi-orange { background: #fff5ea; border-color: #fddfbd; }
        .dash-kpi-purple { background: #f4efff; border-color: #e1d5fb; }
        .dash-kpi-icon { align-items: center; border-radius: 50%; display: inline-flex; height: 40px; justify-content: center; margin-bottom: 6px; width: 40px; }
        .dash-kpi-blue .dash-kpi-icon { background: #dce8ff; color: #2563eb; }
        .dash-kpi-green .dash-kpi-icon { background: #d2f0e0; color: #16a368; }
        .dash-kpi-orange .dash-kpi-icon { background: #ffe5c7; color: #f08a1c; }
        .dash-kpi-purple .dash-kpi-icon { background: #e6dbfb; color: #7c4ddb; }
        .dash-kpi-label { color: var(--color-primary-strong); font-size: 0.78rem; font-weight: 600; line-height: 1.25; min-height: 2.5em; }
        .dash-kpi-value { color: var(--color-primary-strong); font-size: 1.7rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
        .dash-kpi-meta { font-size: 0.74rem; min-height: 1.1em; }
        .dash-kpi-skeleton { background: rgba(15, 31, 61, 0.08); border-radius: 8px; display: inline-block; height: 1.5rem; width: 5rem; }
        .dash-legend { color: var(--color-muted); display: flex; flex-wrap: wrap; font-size: 0.74rem; font-weight: 600; gap: 4px 16px; margin-bottom: 8px; }
        .dash-legend i { border-radius: 50%; display: inline-block; height: 8px; margin-right: 6px; width: 8px; }
        .dash-chart { display: block; height: auto; width: 100%; }
        .dash-scroll { overflow-x: auto; }
        .dash-table { border-collapse: collapse; font-size: 0.8rem; width: 100%; }
        .dash-table th { color: var(--color-muted); font-size: 0.72rem; font-weight: 700; padding: 8px; text-align: left; white-space: nowrap; }
        .dash-table td { border-top: 1px solid var(--color-outline); padding: 12px 8px; white-space: nowrap; }
        .dash-num { text-align: right !important; }
        .dash-side .dash-table { table-layout: fixed; }
        .dash-side .dash-table th, .dash-side .dash-table td { padding-left: 4px; padding-right: 4px; white-space: normal; }
        .dash-side .dash-table th.dash-num:nth-child(2), .dash-side .dash-table td.dash-num:nth-child(2) { width: 62px; }
        .dash-side .dash-table th.dash-num:nth-child(3), .dash-side .dash-table td.dash-num:nth-child(3) { width: 78px; }
        .dash-chip { border-radius: 999px; display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 4px 11px; }
        .dash-chip-green { background: #e3f6ec; color: #0d7a54; }
        .dash-chip-blue { background: #e7efff; color: #1d4fd1; }
        .dash-chip-purple { background: #f0e9ff; color: #6a3fd0; }
        .dash-chip-red { background: #ffe9e9; color: #c8312f; }
        .dash-chip-orange { background: #fff0dd; color: #b86a0a; }
        .dash-list { display: grid; list-style: none; margin: 0; padding: 0; }
        .dash-list li { align-items: center; border-top: 1px solid var(--color-outline); display: flex; gap: 12px; padding: 12px 0; }
        .dash-list li:first-child { border-top: 0; padding-top: 2px; }
        .dash-grow { flex: 1; min-width: 0; }
        .dash-item-title { color: var(--color-primary-strong); display: block; font-size: 0.82rem; font-weight: 700; }
        .dash-item-sub { color: var(--color-muted); display: block; font-size: 0.72rem; font-weight: 500; margin-top: 2px; }
        .dash-time { color: var(--color-muted); flex: 0 0 auto; font-size: 0.72rem; font-weight: 500; }
        .dash-ico { border-radius: 10px; flex: 0 0 34px; height: 34px; position: relative; width: 34px; }
        .dash-ico::after { border-radius: 50%; content: ''; height: 10px; left: 12px; position: absolute; top: 12px; width: 10px; }
        .dash-ico-red { background: #ffe9e9; } .dash-ico-red::after { background: #e5484d; }
        .dash-ico-orange { background: #fff0dd; } .dash-ico-orange::after { background: #f08a1c; }
        .dash-ico-blue { background: #e7efff; } .dash-ico-blue::after { background: #2563eb; }
        .dash-btn-soft { background: #eaf1ff; border-radius: 9px; color: var(--color-primary); flex: 0 0 auto; font-size: 0.72rem; font-weight: 700; padding: 6px 12px; }
        .dash-btn-soft:hover { background: var(--color-primary); color: #fff; }
        .dash-select { background: #fff; border: 1px solid var(--color-outline); border-radius: 10px; color: var(--color-primary-strong); font-size: 0.76rem; font-weight: 600; padding: 6px 10px; }
        .dash-donut-wrap { align-items: center; display: flex; flex-wrap: wrap; gap: 20px; }
        .dash-donut { flex: 0 0 156px; height: 156px; width: 156px; }
        .dash-donut-legend { display: grid; flex: 1 1 150px; gap: 9px; min-width: 0; }
        .dash-legend-row { align-items: center; display: flex; font-size: 0.78rem; font-weight: 600; justify-content: space-between; }
        .dash-legend-row span { align-items: center; display: inline-flex; gap: 8px; }
        .dash-legend-row i { border-radius: 3px; display: inline-block; height: 9px; width: 9px; }
        .dash-legend-row b { color: var(--color-primary-strong); }
        .dash-stat-row { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 8px; }
        .dash-stat { background: var(--color-surface-subtle); border: 1px solid var(--color-outline); border-radius: 12px; padding: 10px 12px; }
        .dash-stat span { color: var(--color-muted); display: block; font-size: 0.7rem; font-weight: 600; }
        .dash-stat strong { color: var(--color-primary-strong); display: block; font-size: 1rem; margin-top: 3px; }
        .dash-avail-list { display: grid; gap: 14px; list-style: none; margin: 0; max-height: 330px; overflow-y: auto; padding: 0; }
        .dash-avail-head { align-items: baseline; display: flex; justify-content: space-between; margin-bottom: 6px; }
        .dash-bar { background: #eef2f8; border-radius: 999px; display: flex; height: 8px; overflow: hidden; }
        .dash-bar i { display: block; height: 100%; }
        .dash-avail-meta { color: var(--color-muted); display: flex; flex-wrap: wrap; font-size: 0.7rem; font-weight: 600; gap: 4px 12px; margin-top: 6px; }
        .dash-avail-meta b { color: var(--color-primary-strong); }
        .dash-banner { align-items: center; background: linear-gradient(90deg, #fff1e6 0%, #f1ecff 60%, #eaf1ff 100%); border: 1px solid var(--color-outline); border-radius: 16px; display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; padding: 18px 24px; }
        .dash-banner strong { color: #0b2a5b; display: block; font-size: 1rem; }
        .dash-banner p { color: var(--color-muted); font-size: 0.8rem; margin: 3px 0 0; }
        .dash-banner-btn { background: var(--color-navy); border-radius: 10px; color: #fff; font-size: 0.8rem; font-weight: 700; padding: 10px 18px; }
        .dash-banner-btn:hover { background: var(--gradient-primary-hover); }
        @media (max-width: 1280px) { .dash-layout { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 1000px) { .dash-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dash-pair { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 560px) { .dash-kpi-grid { grid-template-columns: minmax(0, 1fr); } .dash-stat-row { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
    </div>
  );
}
