'use client';

import type { AdminBookingConflict } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listBookingConflicts } from '../../api/booking-views-api';
import { formatDate } from '../dashboard/format';

import { BookingViewsStyles } from './BookingViewsStyles';
import { statusLabel } from './status-label';

export function BookingConflictsView() {
  const [conflicts, setConflicts] = useState<AdminBookingConflict[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listBookingConflicts()
      .then((result) => {
        if (active) setConflicts(result);
      })
      .catch(() => {
        if (active) setError('Could not check for booking conflicts. Please try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bv-stack">
      <BookingViewsStyles />
      <p className="bv-note">
        Checks accepted and checked-in stays over the next 90 days for two problems: one room held by two overlapping bookings, and room types with more overlapping bookings than rooms. Open a booking to resolve it.
      </p>
      {error ? <p className="error-banner" role="alert">{error}</p> : null}
      <section className="bv-panel">
        {!conflicts && !error ? <div aria-label="Loading" className="bv-skeleton" /> : null}
        {conflicts && conflicts.length === 0 ? <p className="bv-empty">No booking conflicts found. Every room is covered for the next 90 days.</p> : null}
        {conflicts && conflicts.length > 0 ? (
          <div className="bv-conflicts">
            {conflicts.map((conflict) => (
              <article className={conflict.kind === 'DOUBLE_BOOKED_ROOM' ? 'bv-conflict' : 'bv-conflict bv-conflict-warn'} key={conflict.id}>
                <h3>{conflict.kind === 'DOUBLE_BOOKED_ROOM' ? 'Double-booked room' : 'Overbooked room type'} · {conflict.lodgeName}</h3>
                <p>{conflict.detail} First clash on {formatDate(conflict.onDate)}.</p>
                <ul>
                  {conflict.bookings.map((booking) => (
                    <li key={booking.bookingId}>
                      <Link className="bv-link" href={`/admin/bookings/${booking.bookingId}`}>{booking.bookingCode}</Link>
                      <span>{booking.guestName}</span>
                      <span className="bv-sub">{formatDate(booking.checkInDate)} to {formatDate(booking.checkOutDate)} · {statusLabel(booking.status)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
