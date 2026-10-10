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
import { FinanceStyles } from '../finance/FinanceStyles';
import { FinBanners, FinHeader, FinPanel, FinPill } from '../finance/FinanceUi';

import { bookingStatusTone, paymentStatusTone } from './booking-tone';
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

const VIEW_TITLES: Partial<Record<AdminBookingViewKey, string>> = {
  active: 'Active stays',
  cancelled: 'Cancelled bookings',
  completed: 'Completed stays',
  upcoming: 'Upcoming bookings',
};

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
    <div className="fin-stack">
      <FinanceStyles />
      <BookingViewsStyles />
      <FinHeader description={note} eyebrow="Bookings" title={VIEW_TITLES[view] ?? 'Bookings'} />

      <FinPanel
        sub={data ? `${data.totalItems} ${data.totalItems === 1 ? 'booking' : 'bookings'}` : undefined}
        title="Booking list"
      >
        <div className="fin-toolbar">
          {view === 'upcoming' ? (
            <div aria-label="Filter by arrival date" className="fin-chip-row" role="group">
              {RANGES.map((item) => (
                <button
                  aria-pressed={range === item.value}
                  className={range === item.value ? 'fin-filter fin-filter-active' : 'fin-filter'}
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
              <label className="bk-date-label">
                From <input className="bk-date" onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" value={from} />
              </label>
              <label className="bk-date-label">
                To <input className="bk-date" onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" value={to} />
              </label>
            </>
          ) : null}
          <input
            aria-label="Search bookings"
            className="fin-search"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search booking, guest or lodge"
            type="search"
            value={searchInput}
          />
        </div>

        <FinBanners error={error} />
        {loading && !data ? <div aria-label="Loading" className="fin-skeleton" /> : null}
        {data && data.items.length === 0 ? <p className="fin-empty">{emptyText}</p> : null}
        {data && data.items.length > 0 ? (
          <div className="fin-scroll">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Lodge</th>
                  <th>Stay</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="fin-num">Amount</th>
                  <th className="fin-num">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row: AdminBookingViewRow) => (
                  <tr key={row.id}>
                    <td><Link className="fin-link" href={`/admin/bookings/${row.id}`}>{row.bookingCode}</Link></td>
                    <td>{row.guestName}</td>
                    <td>{row.lodgeName}<span className="fin-cell-sub">{row.roomTypeName}</span></td>
                    <td>{formatDate(row.checkInDate)}<span className="fin-cell-sub">to {formatDate(row.checkOutDate)}</span></td>
                    <td><FinPill tone={bookingStatusTone(row.status)}>{statusLabel(row.status)}</FinPill></td>
                    <td><FinPill tone={paymentStatusTone(row.paymentStatus)}>{statusLabel(row.paymentStatus)}</FinPill></td>
                    <td className="fin-num">{row.totalAmount ? formatInr(Number(row.totalAmount)) : '—'}</td>
                    <td className="fin-num"><Link className="fin-btn fin-btn-sm fin-btn-soft" href={`/admin/bookings/${row.id}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data ? (
          <div className="fin-pager">
            <span>Page {data.page} of {data.totalPages} · {data.totalItems} {data.totalItems === 1 ? 'booking' : 'bookings'}</span>
            <button className="fin-btn fin-btn-sm fin-btn-soft" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <button className="fin-btn fin-btn-sm fin-btn-soft" disabled={page >= data.totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        ) : null}
      </FinPanel>
    </div>
  );
}
