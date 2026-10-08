'use client';

import type {
  AdminBookingDateRange,
  AdminBookingViewKey,
  AdminBookingViewPage,
  AdminBookingViewRow,
} from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listBookingView } from '../../api/booking-views-api';
import { formatDate, formatInr } from '../dashboard/format';

import { BookingViewsStyles } from './BookingViewsStyles';
import { statusLabel } from './status-label';

const RANGES: Array<{ label: string; value: AdminBookingDateRange }> = [
  { label: 'All upcoming', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next 7 days', value: 'week' },
  { label: 'Later', value: 'later' },
  { label: 'Custom', value: 'custom' },
];

function tone(status: string): 'green' | 'blue' | 'orange' | 'red' | 'purple' {
  if (['ACCEPTED', 'QR_GENERATED'].includes(status)) return 'green';
  if (status === 'CHECKED_IN') return 'blue';
  if (['CHECKED_OUT', 'COMPLETED'].includes(status)) return 'purple';
  if (['REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(status)) return 'red';
  return 'orange';
}

export function BookingViewList({
  emptyText,
  note,
  view,
}: {
  emptyText: string;
  note: string;
  view: AdminBookingViewKey;
}) {
  const [range, setRange] = useState<AdminBookingDateRange>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminBookingViewPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listBookingView({ from, page, range: view === 'upcoming' ? range : undefined, search, to, view })
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch(() => {
        if (active) setError('Could not load bookings. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, range, from, to, page, search]);

  return (
    <div className="bv-stack">
      <BookingViewsStyles />
      <p className="bv-note">{note}</p>
      <section className="bv-panel">
        <div className="bv-toolbar">
          {view === 'upcoming' ? (
            <div aria-label="Filter by arrival date" className="bv-chip-row" role="group">
              {RANGES.map((item) => (
                <button
                  aria-pressed={range === item.value}
                  className={range === item.value ? 'bv-filter bv-filter-active' : 'bv-filter'}
                  key={item.value}
                  onClick={() => {
                    setRange(item.value);
                    setPage(1);
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          {view === 'upcoming' && range === 'custom' ? (
            <>
              <label className="bv-date-label">
                From <input className="bv-date" onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" value={from} />
              </label>
              <label className="bv-date-label">
                To <input className="bv-date" onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" value={to} />
              </label>
            </>
          ) : null}
          <input
            aria-label="Search bookings"
            className="bv-search"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search booking, guest or lodge"
            type="search"
            value={searchInput}
          />
        </div>

        {error ? <p className="error-banner" role="alert">{error}</p> : null}
        {loading && !data ? <div aria-label="Loading" className="bv-skeleton" /> : null}
        {data && data.items.length === 0 ? <p className="bv-empty">{emptyText}</p> : null}
        {data && data.items.length > 0 ? (
          <div className="bv-scroll">
            <table className="bv-table">
              <thead>
                <tr><th>Booking</th><th>Guest</th><th>Lodge</th><th>Stay</th><th>Status</th><th>Payment</th><th className="bv-num">Amount</th><th /></tr>
              </thead>
              <tbody>
                {data.items.map((row: AdminBookingViewRow) => (
                  <tr key={row.id}>
                    <td><Link className="bv-link" href={`/admin/bookings/${row.id}`}>{row.bookingCode}</Link></td>
                    <td>{row.guestName}</td>
                    <td>{row.lodgeName}<span className="bv-sub">{row.roomTypeName}</span></td>
                    <td>{formatDate(row.checkInDate)}<span className="bv-sub">to {formatDate(row.checkOutDate)}</span></td>
                    <td><span className={`bv-pill bv-pill-${tone(row.status)}`}>{statusLabel(row.status)}</span></td>
                    <td>{statusLabel(row.paymentStatus)}</td>
                    <td className="bv-num">{row.totalAmount ? formatInr(Number(row.totalAmount)) : '—'}</td>
                    <td className="bv-num"><Link className="bv-link" href={`/admin/bookings/${row.id}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <div className="bv-pager">
            <span>Page {data.page} of {data.totalPages} · {data.totalItems} {data.totalItems === 1 ? 'booking' : 'bookings'}</span>
            <button className="bv-btn" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <button className="bv-btn" disabled={page >= data.totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
