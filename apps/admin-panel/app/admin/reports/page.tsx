'use client';

import { allReportPages, reportPeriod, validReportRange } from '@tuljai/shared';
import type { BookingReportRow, CommissionSummary } from '@tuljai/types';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  exportBookingReportPdf,
  listBookingReport,
  listCommissionReport,
  type BiReportQuery,
} from '../../../src/api/admin-bi-api';
import { AdminIcon } from '../../../src/components/AdminIcon';
import { PermissionGate } from '../../../src/components/PermissionGate';

import styles from './reports.module.css';

const money = (value: number | string | null) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
type Filters = { startDate: string; endDate: string; reportType: 'all' | 'completed' };
type Tab = 'bookings' | 'occupancy' | 'commission';
const periods = [
  ['today', 'Today'],
  ['week', 'Last 7 days'],
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
] as const;

export default function AdminReportsPage() {
  return (
    <PermissionGate permission="reports.view">
      <ReportsContent />
    </PermissionGate>
  );
}

function ReportsContent() {
  const [filters, setFilters] = useState<Filters>(() => ({
    ...reportPeriod('month'),
    reportType: 'completed',
  }));
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<{
    bookings: BookingReportRow[];
    commission: CommissionSummary[];
  }>({ bookings: [], commission: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('bookings');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const revision = useRef(0);
  const dirty = JSON.stringify(filters) !== JSON.stringify(applied);
  const valid = validReportRange(filters);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const query: BiReportQuery = { ...applied, limit: 500 };
      const [bookings, commission] = await Promise.all([
        allReportPages((page) => listBookingReport({ ...query, page })),
        listCommissionReport(query),
      ]);
      if (current !== revision.current) return;
      setData({ bookings, commission });
      setPage(1);
    } catch (cause) {
      if (current !== revision.current) return;
      setData({ bookings: [], commission: [] });
      setError(
        cause instanceof Error ? cause.message : 'Reports could not be loaded. Please try again.',
      );
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, [applied]);
  useEffect(() => {
    void load();
    return () => {
      revision.current++;
    };
  }, [load]);

  async function exportPdf() {
    setExporting(true);
    setNotice(null);
    try {
      const result = await exportBookingReportPdf(applied);
      download(
        new Blob([Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0))], {
          type: 'application/pdf',
        }),
        result.filename,
      );
      setNotice(`PDF downloaded with ${result.bookingCount} bookings.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'PDF export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const completed = data.bookings.filter((row) =>
    ['CHECKED_OUT', 'COMPLETED'].includes(row.status),
  ).length;
  const revenue = data.bookings.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0);
  const commission = data.bookings.reduce((sum, row) => sum + Number(row.commissionAmount ?? 0), 0);
  const columns =
    tab === 'commission'
      ? ['Lodge', 'Bookings', 'Commission']
      : tab === 'occupancy'
        ? ['Booking', 'Lodge', 'Check-in', 'Check-out', 'Stay status']
        : [
            'Booking / Guest',
            'Lodge / Room',
            'Stay dates',
            'Stay status',
            'Booking amount',
            'Commission',
          ];
  const rows: { key: string; cells: string[] }[] =
    tab === 'commission'
      ? data.commission.map((row) => ({
          key: row.lodgeId ?? 'unassigned',
          cells: [
            row.lodgeName ?? 'Lodge unavailable',
            String(row.bookingCount),
            money(row.commissionTotal),
          ],
        }))
      : data.bookings.map((row) => ({
          key: row.bookingCode,
          cells:
            tab === 'occupancy'
              ? [
                  row.bookingCode,
                  row.lodgeName ?? 'Lodge unavailable',
                  displayDate(row.checkInDate),
                  displayDate(row.checkOutDate),
                  row.status.replaceAll('_', ' '),
                ]
              : [
                  `${row.bookingCode}\n${row.guestName}`,
                  `${row.lodgeName ?? 'Lodge unavailable'}\n${row.roomTypeName ?? ''}`,
                  `${displayDate(row.checkInDate)}\n${displayDate(row.checkOutDate)}`,
                  row.status.replaceAll('_', ' '),
                  money(row.totalAmount),
                  money(row.commissionAmount),
                ],
        }));
  const filteredRows = rows.filter((row) =>
    row.cells.join(' ').toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filteredRows.length / 20));
  const currentPage = Math.min(page, pages);
  const disabled = loading || exporting || dirty || !!error || !data.bookings.length;
  function exportCsv() {
    const headers =
      tab === 'commission'
        ? ['Lodge', 'Bookings', 'Commission Total']
        : [
            'Booking ID',
            'Guest',
            'Lodge',
            'Room Type',
            'Check-in',
            'Check-out',
            'Status',
            'Booking Amount',
            'Commission',
          ];
    const values =
      tab === 'commission'
        ? data.commission.map((r) => [r.lodgeName, r.bookingCount, r.commissionTotal])
        : data.bookings.map((r) => [
            r.bookingCode,
            r.guestName,
            r.lodgeName,
            r.roomTypeName,
            r.checkInDate,
            r.checkOutDate,
            r.status,
            r.totalAmount,
            r.commissionAmount,
          ]);
    const csv = [headers, ...values]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? '');
            return `"${(/^[=+@\-\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n');
    download(
      new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
      `tuljai-${tab}-${applied.startDate}-to-${applied.endDate}.csv`,
    );
  }

  return (
    <div className={`page-stack ${styles.reports}`}>
      <section className={`hero-panel ${styles.hero}`}>
        <div>
          <p className="eyebrow">Reports & insights</p>
          <h2>Your business, clearly in view.</h2>
          <p className="muted-copy">
            Review stays, track commission, and keep a beautifully branded record of every booking.
          </p>
        </div>
        <div className="hero-actions">
          <span className={styles.heroIcon}>
            <AdminIcon name="reports" size={40} />
          </span>
        </div>
      </section>
      <section className={`panel ${styles.filters}`} aria-label="Report filters">
        <div className="section-header">
          <div>
            <p className="eyebrow">Make it your report</p>
            <h3>Choose a reporting period</h3>
          </div>
          <div className={styles.presets}>
            {periods.map(([period, label]) => {
              const range = reportPeriod(period);
              return (
                <button
                  className={`${styles.preset} ${filters.startDate === range.startDate && filters.endDate === range.endDate ? styles.selected : ''}`}
                  type="button"
                  key={period}
                  onClick={() => setFilters((current) => ({ ...current, ...range }))}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <form
          className={styles.filterGrid}
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) {
              setLoading(true);
              setApplied({ ...filters });
            }
          }}
        >
          <label className="form-field">
            <span>From date</span>
            <input
              required
              type="date"
              max={filters.endDate}
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>To date</span>
            <input
              required
              type="date"
              min={filters.startDate}
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Report type</span>
            <select
              value={filters.reportType}
              onChange={(e) =>
                setFilters({ ...filters, reportType: e.target.value as Filters['reportType'] })
              }
            >
              <option value="completed">Completed stays</option>
              <option value="all">All bookings</option>
            </select>
          </label>
          <button className="button button-primary" type="submit" disabled={!valid || exporting}>
            <AdminIcon name="analytics" />
            {loading ? 'Loading reports…' : 'Apply dates'}
          </button>
        </form>
        <p className={styles.hint}>
          {!valid
            ? 'Enter valid dates, with the start on or before the end.'
            : dirty
              ? 'Dates changed. Apply them to update your report and exports.'
              : 'Filtered by booking creation date. Both dates are included, in India Standard Time.'}
        </p>
      </section>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
          <button className="button button-secondary" type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}
      <section
        className={`ops-kpi-grid ${styles.metrics}`}
        aria-label="Report summary"
        aria-busy={loading}
      >
        <Metric
          icon="bookings"
          label="Total bookings"
          value={loading ? '—' : String(data.bookings.length)}
        />
        <Metric icon="finance" label="Booking amount" value={loading ? '—' : money(revenue)} />
        <Metric
          icon="analytics"
          label="Booking commission"
          value={loading ? '—' : money(commission)}
        />
        <Metric
          icon="verification"
          label="Completed stays"
          value={loading ? '—' : String(completed)}
        />
      </section>
      <section className={`panel ${styles.exportPanel}`}>
        <div className={styles.exportIntro}>
          <span className={styles.documentIcon}>
            <AdminIcon name="reports" size={28} />
          </span>
          <div>
            <p className="eyebrow">Ready to file & share</p>
            <h3>Bookings & commission PDF</h3>
            <p className="muted-copy">
              Your Tuljai Stays template, with logo, signature, summary, and every matching booking.
            </p>
            <span className={styles.period}>
              {displayDate(applied.startDate)} – {displayDate(applied.endDate)} ·{' '}
              {applied.reportType === 'completed' ? 'Completed stays' : 'All bookings'}
            </span>
          </div>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={disabled}
          onClick={() => void exportPdf()}
        >
          <AdminIcon name="reports" />
          {exporting ? 'Preparing PDF…' : 'Download PDF report'}
        </button>
      </section>
      <section className={`table-panel ${styles.tablePanel}`} aria-busy={loading}>
        <div className={styles.tableToolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Report view">
            {(['bookings', 'occupancy', 'commission'] as const).map((value) => (
              <button
                key={value}
                id={`tab-${value}`}
                aria-controls="report-content"
                role="tab"
                aria-selected={tab === value}
                className={`${styles.tab} ${tab === value ? styles.activeTab : ''}`}
                type="button"
                onClick={() => {
                  setTab(value);
                  setPage(1);
                  setSearch('');
                }}
              >
                {value === 'bookings'
                  ? 'Bookings'
                  : value === 'occupancy'
                    ? 'Stay register'
                    : 'Commission by lodge'}
              </button>
            ))}
          </div>
          <button
            className="button button-secondary"
            type="button"
            disabled={disabled}
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
        <div className={styles.searchRow}>
          <div>
            <h3>
              {tab === 'bookings'
                ? 'Booking details'
                : tab === 'occupancy'
                  ? 'Stay register'
                  : 'Lodge commission'}
            </h3>
            <p className="muted-copy">
              {loading ? 'Loading your report…' : `${rows.length} records in the applied period`}
            </p>
          </div>
          <input
            aria-label="Search report records"
            type="search"
            placeholder="Search this report…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div id="report-content" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {loading ? (
            <div className={styles.empty} role="status">
              Loading report data…
            </div>
          ) : !filteredRows.length ? (
            <div className={styles.empty}>
              <AdminIcon name="reports" size={32} />
              <h3>{search ? 'No matching records' : 'No records for this period'}</h3>
              <p>
                Try another date range{search ? ' or search term' : ', or choose all bookings'}.
              </p>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th scope="col" key={column}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice((currentPage - 1) * 20, currentPage * 20).map((row) => (
                    <tr key={row.key}>
                      {row.cells.map((cell, i) => (
                        <td key={i}>
                          {cell
                            .split('\n')
                            .map((line, index) =>
                              index ? (
                                <small key={index}>{line}</small>
                              ) : (
                                <span key={index}>{line}</span>
                              ),
                            )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {!loading && filteredRows.length > 0 ? (
          <div className={styles.pagination}>
            <span>
              Showing {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, filteredRows.length)}{' '}
              of {filteredRows.length} · Exports include the full applied report
            </span>
            <div>
              <button
                className="button button-secondary"
                disabled={currentPage === 1}
                type="button"
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                {currentPage} / {pages}
              </span>
              <button
                className="button button-secondary"
                disabled={currentPage === pages}
                type="button"
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: Parameters<typeof AdminIcon>[0]['name'];
  label: string;
  value: string;
}) {
  return (
    <article className={`kpi-card ${styles.metric}`}>
      <span className={styles.metricIcon}>
        <AdminIcon name={icon} size={22} />
      </span>
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
      <span className="kpi-meta">Applied date range</span>
    </article>
  );
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
