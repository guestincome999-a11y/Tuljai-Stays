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
      <div className="page-stack">
        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Booking Control Center</p>
              <h2>All bookings</h2>
              <p className="muted-copy">
                Search, filter, call, escalate, and open booking detail without loading every
                record.
              </p>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void bookings.refresh()}
            >
              Refresh
            </button>
          </div>

          <div className="control-grid">
            <label>
              <span>Search</span>
              <input
                placeholder="Booking code, guest, phone, lodge, room"
                value={filters.query}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={filters.status}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as AdminBookingFilters['status'],
                  }));
                }}
              >
                <option value="">All statuses</option>
                {bookingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>From</span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, fromDate: event.target.value }))
                }
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, toDate: event.target.value }))
                }
              />
            </label>
          </div>
        </section>

        {bookings.errorMessage ? (
          <section className="error-banner">{bookings.errorMessage}</section>
        ) : null}

        <section className="table-panel">
          <div className="admin-table booking-table">
            <div className="admin-table-row admin-table-head">
              <span>Booking Code</span>
              <span>Guest</span>
              <span>Lodge</span>
              <span>Stay</span>
              <span>Status</span>
              <span>Owner Response</span>
              <span>Priority</span>
              <span>Actions</span>
            </div>
            {bookings.filteredItems.map((booking) => (
              <BookingRow
                booking={booking}
                canManage={canManage}
                canSeeContact={canSeeContact}
                key={booking.id}
              />
            ))}
          </div>

          <div className="pagination-row">
            <button
              className="button button-secondary"
              disabled={page <= 1}
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {bookings.data?.page ?? page} of {bookings.data?.totalPages ?? 1}
            </span>
            <button
              className="button button-secondary"
              disabled={!bookings.data || page >= bookings.data.totalPages}
              type="button"
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </section>
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
    <div className="admin-table-row">
      <span>
        <strong>{booking.bookingCode}</strong>
        <small>{new Date(booking.createdAt).toLocaleString('en-IN')}</small>
      </span>
      <span>
        {booking.guestName}
        <small>
          {canSeeContact ? (booking.guestPhone ?? 'No phone') : maskPhone(booking.guestPhone)}
        </small>
      </span>
      <span>
        {booking.lodgeName}
        <small>{booking.roomTypeName}</small>
      </span>
      <span>
        {booking.checkInDate}
        <small>to {booking.checkOutDate}</small>
      </span>
      <span className="status-card">{formatStatus(booking.status)}</span>
      <span className={ownerState.overdue ? 'text-danger' : undefined}>
        {ownerState.message}
        <small>Waiting {getWaitingTime(booking.createdAt)}</small>
      </span>
      <span className={`priority priority-${priority.toLowerCase()}`}>{priority}</span>
      <span className="row-actions">
        <Link className="ghost-control" href={`/admin/bookings/${booking.id}`}>
          View
        </Link>
        {canManage ? (
          <>
            <button className="ghost-control" type="button">
              Call Owner - Owner endpoint required
            </button>
            <a
              className="ghost-control"
              href={booking.guestPhone ? `tel:${booking.guestPhone}` : '#'}
            >
              Call Pilgrim
            </a>
            <Link className="ghost-control" href={`/admin/bookings/${booking.id}#notes`}>
              Add Note
            </Link>
            <Link className="ghost-control" href={`/admin/bookings/${booking.id}#escalation`}>
              Escalate
            </Link>
          </>
        ) : null}
      </span>
    </div>
  );
}
