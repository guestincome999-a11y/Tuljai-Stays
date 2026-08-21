'use client';

import type { BookingReportRow, CommissionSummary } from '@tuljai/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listBookingReport,
  listCommissionReport,
  listOccupancyReport,
} from '../../../src/api/admin-bi-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

interface ReportState {
  bookings: BookingReportRow[];
  occupancy: BookingReportRow[];
  commission: CommissionSummary[];
}
function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  const serialized = JSON.stringify(value);
  return serialized ?? '';
}
function csvEscape(value: unknown): string {
  const text = displayValue(value);
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}
function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
export default function AdminReportsPage() {
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 29);
    return toInputDate(date);
  }, [today]);
  const defaultEnd = useMemo(() => toInputDate(today), [today]);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [data, setData] = useState<ReportState>({ bookings: [], occupancy: [], commission: [] });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadReports = useCallback(async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setErrorMessage('Choose a valid start and end date.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const query = { endDate, limit: 500, page: 1, startDate };
      const [bookings, occupancy, commission] = await Promise.all([
        listBookingReport(query),
        listOccupancyReport(query),
        listCommissionReport({ endDate, startDate }),
      ]);
      setData({ bookings: bookings.items, occupancy: occupancy.items, commission });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load reports.');
      setData({ bookings: [], occupancy: [], commission: [] });
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);
  useEffect(() => {
    void loadReports();
  }, [loadReports]);
  const totalRevenue = data.bookings.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0);
  const totalCommission = data.commission.reduce(
    (sum, row) => sum + Number(row.commissionTotal),
    0,
  );
  const completedOrCheckedOut = data.occupancy.filter(
    (row) => row.status === 'COMPLETED' || row.status === 'CHECKED_OUT',
  ).length;
  function exportBookings(): void {
    downloadCsv(
      `tuljai-stays-bookings-${startDate}-to-${endDate}.csv`,
      [
        'Booking Code',
        'Guest',
        'Lodge ID',
        'Check-in',
        'Check-out',
        'Status',
        'Revenue',
        'Commission',
      ],
      data.bookings.map((row) => [
        row.bookingCode,
        row.guestName,
        row.lodgeId,
        row.checkInDate,
        row.checkOutDate,
        row.status,
        row.totalAmount ?? '0',
        row.commissionAmount ?? '0',
      ]),
    );
  }
  function exportCommission(): void {
    downloadCsv(
      `tuljai-stays-commission-${startDate}-to-${endDate}.csv`,
      ['Lodge ID', 'Bookings', 'Commission Total'],
      data.commission.map((row) => [row.lodgeId ?? '', row.bookingCount, row.commissionTotal]),
    );
  }
  return (
    <PermissionGate permission="reports.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Business Reports</p>
            <h2>Bookings, occupancy and commission</h2>
            <p className="muted-copy">
              Tuljai Stays operational reporting for Tuljapur. Reports use the authenticated admin
              APIs and never expose multi-city or multi-currency controls.
            </p>
          </div>
          <div className="hero-actions">
            <button
              className="button button-secondary"
              disabled={loading || data.bookings.length === 0}
              type="button"
              onClick={exportBookings}
            >
              Export bookings CSV
            </button>
            <button
              className="button button-secondary"
              disabled={loading || data.commission.length === 0}
              type="button"
              onClick={exportCommission}
            >
              Export commission CSV
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Filters</p>
              <h3>Date range</h3>
            </div>
            <button
              className="button button-primary"
              disabled={loading}
              type="button"
              onClick={() => void loadReports()}
            >
              {loading ? 'Loading…' : 'Apply filters'}
            </button>
          </div>
          <div className="control-grid">
            <label className="form-field">
              <span>Start date</span>
              <input
                max={endDate}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>End date</span>
              <input
                min={startDate}
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
        </section>
        {errorMessage ? (
          <section className="error-banner">
            <span>{errorMessage}</span>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void loadReports()}
            >
              Retry
            </button>
          </section>
        ) : null}
        <section className="ops-kpi-grid">
          <Metric label="Bookings" value={data.bookings.length} />
          <Metric label="Booking revenue" value={`₹${totalRevenue.toLocaleString('en-IN')}`} />
          <Metric label="Commission" value={`₹${totalCommission.toLocaleString('en-IN')}`} />
          <Metric label="Completed stays" value={completedOrCheckedOut} />
        </section>
        <ReportTable
          title="Booking report"
          eyebrow="Admin / reports / bookings"
          empty="No bookings found for this date range."
          loading={loading}
          columns={['Booking', 'Guest', 'Lodge', 'Stay', 'Status', 'Revenue', 'Commission']}
          rows={data.bookings.map((row) => [
            row.bookingCode,
            row.guestName,
            row.lodgeId,
            `${row.checkInDate} → ${row.checkOutDate}`,
            row.status,
            `₹${Number(row.totalAmount ?? 0).toLocaleString('en-IN')}`,
            `₹${Number(row.commissionAmount ?? 0).toLocaleString('en-IN')}`,
          ])}
        />
        <ReportTable
          title="Occupancy report"
          eyebrow="Admin / reports / occupancy"
          empty="No occupancy records found for this date range."
          loading={loading}
          columns={['Booking', 'Lodge', 'Check-in', 'Check-out', 'Status']}
          rows={data.occupancy.map((row) => [
            row.bookingCode,
            row.lodgeId,
            row.checkInDate,
            row.checkOutDate,
            row.status,
          ])}
        />
        <ReportTable
          title="Commission by lodge"
          eyebrow="Admin / reports / commission"
          empty="No commission records found for this date range."
          loading={loading}
          columns={['Lodge', 'Bookings', 'Commission']}
          rows={data.commission.map((row) => [
            row.lodgeId ?? 'Unknown',
            row.bookingCount,
            `₹${Number(row.commissionTotal).toLocaleString('en-IN')}`,
          ])}
        />
      </div>
    </PermissionGate>
  );
}
function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
      <span className="kpi-meta">Selected date range</span>
    </article>
  );
}
function ReportTable({
  title,
  eyebrow,
  columns,
  rows,
  empty,
  loading,
}: {
  title: string;
  eyebrow: string;
  columns: string[];
  rows: unknown[][];
  empty: string;
  loading: boolean;
}) {
  return (
    <section className="table-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {loading ? <p className="muted-copy">Loading report data…</p> : null}
      {!loading && rows.length === 0 ? <p className="muted-copy">{empty}</p> : null}
      {!loading && rows.length > 0 ? (
        <div className="admin-table" role="table">
          <div className="admin-table-row admin-table-head" role="row">
            {columns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          {rows.slice(0, 500).map((row, index) => (
            <div className="admin-table-row" key={`${title}-${index}`} role="row">
              {row.map((value, valueIndex) => (
                <span key={`${index}-${valueIndex}`}>{displayValue(value)}</span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
