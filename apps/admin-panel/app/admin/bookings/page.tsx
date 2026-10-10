'use client';

import type { AdminBookingSummary } from '@tuljai/types';
import Link from 'next/link';
import { useState } from 'react';

import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import {
  bookingStatuses,
  formatStatus,
  getBookingPriority,
  getOwnerResponseState,
  getWaitingTime,
  maskPhone,
} from '../../../src/bookings/booking-operations';
import { bookingPriorityTone, bookingStatusTone } from '../../../src/components/bookings/booking-tone';
import { BookingViewsStyles } from '../../../src/components/bookings/BookingViewsStyles';
import { FinanceStyles } from '../../../src/components/finance/FinanceStyles';
import { FinBanners, FinHeader, FinPanel, FinPill } from '../../../src/components/finance/FinanceUi';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { useAdminBookings, type AdminBookingFilters } from '../../../src/hooks/useAdminBookings';
import { hasPermission } from '../../../src/permissions/permissions';

const initialFilters: AdminBookingFilters = {
  fromDate: '',
  query: '',
  status: '',
  toDate: '',
};

export default function AdminBookingsPage() {
  const auth = useAdminAuth();
  const [filters, setFilters] = useState<AdminBookingFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const bookings = useAdminBookings(filters, page);
  const canManage = hasPermission(auth.permissions, 'bookings.manage');
  const canSeeContact = hasPermission(auth.permissions, 'bookings.manage');

  return (
    <PermissionGate permission="bookings.view">
      <div className="fin-stack">
        <FinanceStyles />
        <BookingViewsStyles />
        <FinHeader
          actions={
            <button className="fin-btn" disabled={bookings.isRefreshing} onClick={() => void bookings.refresh()} type="button">
              {bookings.isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          }
          description="Search, filter, call, escalate, and open booking detail without loading every record."
          eyebrow="Booking Control Center"
          title="All bookings"
        />

        <FinPanel sub="Narrow the list" title="Filters">
          <div className="bk-filters">
            <label className="fin-field">
              <span>Search</span>
              <input
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Booking code, guest, phone, lodge, room"
                value={filters.query}
              />
            </label>
            <label className="fin-field">
              <span>Status</span>
              <select
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as AdminBookingFilters['status'],
                  }));
                }}
                value={filters.status}
              >
                <option value="">All statuses</option>
                {bookingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="fin-field">
              <span>From</span>
              <input
                onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                type="date"
                value={filters.fromDate}
              />
            </label>
            <label className="fin-field">
              <span>To</span>
              <input
                onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                type="date"
                value={filters.toDate}
              />
            </label>
          </div>
        </FinPanel>

        <FinBanners error={bookings.errorMessage} />

        <FinPanel sub={`Page ${bookings.data?.page ?? page} of ${bookings.data?.totalPages ?? 1}`} title="Bookings">
          {bookings.isLoading && !bookings.data ? <div aria-label="Loading" className="fin-skeleton" /> : null}
          {!bookings.isLoading && bookings.filteredItems.length === 0 ? (
            <p className="fin-empty">No bookings match these filters.</p>
          ) : null}
          {bookings.filteredItems.length > 0 ? (
            <div className="fin-scroll">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Guest</th>
                    <th>Lodge</th>
                    <th>Stay</th>
                    <th>Status</th>
                    <th>Owner response</th>
                    <th>Priority</th>
                    <th className="fin-num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.filteredItems.map((booking) => (
                    <BookingRow
                      booking={booking}
                      canManage={canManage}
                      canSeeContact={canSeeContact}
                      key={booking.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="fin-pager">
            <span>Page {bookings.data?.page ?? page} of {bookings.data?.totalPages ?? 1}</span>
            <button
              className="fin-btn fin-btn-sm fin-btn-soft"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="fin-btn fin-btn-sm fin-btn-soft"
              disabled={!bookings.data || page >= bookings.data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </FinPanel>
      </div>
    </PermissionGate>
  );
}

function BookingRow({
  booking,
  canManage,
  canSeeContact,
}: {
  booking: AdminBookingSummary;
  canManage: boolean;
  canSeeContact: boolean;
}) {
  const ownerState = getOwnerResponseState(booking);
  const priority = getBookingPriority(booking);

  return (
    <tr>
      <td>
        <Link className="fin-link" href={`/admin/bookings/${booking.id}`}>{booking.bookingCode}</Link>
        <span className="fin-cell-sub">{new Date(booking.createdAt).toLocaleString('en-IN')}</span>
      </td>
      <td>
        {booking.guestName}
        <span className="fin-cell-sub">
          {canSeeContact ? (booking.guestPhone ?? 'No phone') : maskPhone(booking.guestPhone)}
        </span>
      </td>
      <td>
        {booking.lodgeName}
        <span className="fin-cell-sub">{booking.roomTypeName}</span>
      </td>
      <td>
        {booking.checkInDate}
        <span className="fin-cell-sub">
          to {booking.checkoutDateFlexible ? 'checkout not fixed' : booking.checkOutDate}
        </span>
      </td>
      <td>
        <FinPill tone={bookingStatusTone(booking.status)}>{formatStatus(booking.status)}</FinPill>
      </td>
      <td className="bk-wrap">
        <span className={ownerState.overdue ? 'bk-danger' : undefined}>{ownerState.message}</span>
        <span className="fin-cell-sub">Waiting {getWaitingTime(booking.createdAt)}</span>
      </td>
      <td>
        <FinPill tone={bookingPriorityTone(priority)}>{priority}</FinPill>
      </td>
      <td className="bk-actions-cell">
        <div className="bk-actions">
          <Link className="fin-btn fin-btn-sm fin-btn-soft" href={`/admin/bookings/${booking.id}`}>
            View
          </Link>
          {canManage ? (
            <>
              <button
                className="fin-btn fin-btn-sm fin-btn-outline"
                disabled
                title="Owner endpoint required"
                type="button"
              >
                Call Owner
              </button>
              <a
                className="fin-btn fin-btn-sm fin-btn-outline"
                href={booking.guestPhone ? `tel:${booking.guestPhone}` : '#'}
              >
                Call Pilgrim
              </a>
              <Link className="fin-btn fin-btn-sm fin-btn-outline" href={`/admin/bookings/${booking.id}#notes`}>
                Add Note
              </Link>
              <Link className="fin-btn fin-btn-sm fin-btn-violet" href={`/admin/bookings/${booking.id}#escalation`}>
                Escalate
              </Link>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
