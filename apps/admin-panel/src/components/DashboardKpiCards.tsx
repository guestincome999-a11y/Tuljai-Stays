'use client';

import type { AdminDashboardKpis } from '@tuljai/types';
import { useEffect, useState } from 'react';

import { getAdminDashboardKpis } from '../api/live-operations-api';

const REFRESH_MS = 60_000;

export function DashboardKpiCards() {
  const [kpis, setKpis] = useState<AdminDashboardKpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      getAdminDashboardKpis()
        .then((result) => {
          if (!active) return;
          setKpis(result);
          setError(null);
        })
        .catch(() => {
          if (active) setError('Could not load dashboard figures. Retrying shortly.');
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const cards = [
    {
      key: 'bookings',
      label: 'Total Bookings',
      tone: 'blue',
      value: kpis ? formatCount(kpis.totalBookings) : null,
      meta: kpis ? <Delta current={kpis.bookingsToday} previous={kpis.bookingsYesterday} /> : null,
    },
    {
      key: 'revenue',
      label: 'Total Revenue',
      tone: 'green',
      value: kpis ? formatInr(kpis.totalRevenue) : null,
      meta: kpis ? (
        <Delta current={Number(kpis.revenueToday)} previous={Number(kpis.revenueYesterday)} />
      ) : null,
    },
    {
      key: 'pending',
      label: 'Pending Owner Actions',
      tone: 'amber',
      value: kpis ? formatCount(kpis.pendingOwnerActions) : null,
      meta: kpis ? <span className="dash-kpi-note">Bookings, lodge verification, photos</span> : null,
    },
    {
      key: 'active',
      label: 'Active Stays',
      tone: 'violet',
      value: kpis ? formatCount(kpis.activeStays) : null,
      meta: kpis ? <span className="dash-kpi-note">Guests checked in now</span> : null,
    },
  ];

  return (
    <section aria-label="Key figures" className="dash-kpi-section">
      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dash-kpi-grid">
        {cards.map((card) => (
          <article className={`dash-kpi dash-kpi-${card.tone}`} key={card.key}>
            <span className="dash-kpi-label">{card.label}</span>
            <strong className="dash-kpi-value">
              {card.value ?? <span className="dash-kpi-skeleton" aria-label="Loading" />}
            </strong>
            <span className="dash-kpi-meta">{card.meta}</span>
          </article>
        ))}
      </div>
      <style jsx global>{`
        .dash-kpi-section { display: grid; gap: 10px; }
        .dash-kpi-grid { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .dash-kpi { background: var(--color-surface); border: 1px solid var(--color-outline); border-radius: 16px; box-shadow: 0 8px 22px rgba(8, 38, 77, 0.06); display: grid; gap: 6px; padding: 18px; position: relative; transition: transform 160ms ease, box-shadow 160ms ease; }
        .dash-kpi::before { border-radius: 16px 0 0 16px; bottom: 0; content: ''; left: 0; position: absolute; top: 0; width: 4px; }
        .dash-kpi:hover { box-shadow: 0 14px 30px rgba(8, 38, 77, 0.1); transform: translateY(-2px); }
        .dash-kpi-blue::before { background: #2f6fd1; }
        .dash-kpi-green::before { background: #168564; }
        .dash-kpi-amber::before { background: #d98a1d; }
        .dash-kpi-violet::before { background: #6f4fc9; }
        .dash-kpi-label { color: var(--color-muted); font-size: 0.78rem; font-weight: 800; }
        .dash-kpi-value { color: var(--color-primary-strong); font-size: 1.85rem; letter-spacing: -0.03em; line-height: 1.1; }
        .dash-kpi-meta { font-size: 0.74rem; font-weight: 800; min-height: 1.1em; }
        .dash-kpi-note { color: var(--color-muted); font-weight: 650; }
        .dash-kpi-up { color: #168564; }
        .dash-kpi-down { color: var(--color-danger); }
        .dash-kpi-flat { color: var(--color-muted); }
        .dash-kpi-skeleton { background: var(--color-surface-muted); border-radius: 8px; display: inline-block; height: 1.7rem; width: 5.5rem; }
        @media (max-width: 1100px) { .dash-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .dash-kpi-grid { grid-template-columns: 1fr; } .dash-kpi-value { font-size: 1.5rem; } }
      `}</style>
    </section>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) {
    return (
      <span className="dash-kpi-flat">
        {current > 0 ? `${formatCount(current)} today` : 'No change data yet'}
      </span>
    );
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className="dash-kpi-flat">Same as yesterday</span>;
  const up = change > 0;
  return (
    <span className={up ? 'dash-kpi-up' : 'dash-kpi-down'}>
      {up ? '▲' : '▼'} {Math.abs(change)}% vs yesterday
    </span>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatInr(value: string): string {
  const amount = Number(value);
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number.isFinite(amount) ? amount : 0);
}
