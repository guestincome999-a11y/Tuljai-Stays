'use client';

import type { AdminBookingConflict } from '@tuljai/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listBookingConflicts } from '../../api/booking-views-api';
import { formatDate } from '../dashboard/format';
import { FinanceStyles } from '../finance/FinanceStyles';
import { FinBanners, FinHeader, FinPanel, FinPill } from '../finance/FinanceUi';

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
    <div className="fin-stack">
      <FinanceStyles />
      <BookingViewsStyles />
      <FinHeader
        description="Checks accepted and checked-in stays over the next 90 days for two problems: one room held by two overlapping bookings, and room types with more overlapping bookings than rooms. Open a booking to resolve it."
        eyebrow="Bookings"
        title="Booking conflicts"
      />
      <FinBanners error={error} />
      <FinPanel sub="Next 90 days" title="Overlap check">
        {!conflicts && !error ? <div aria-label="Loading" className="fin-skeleton" /> : null}
        {conflicts && conflicts.length === 0 ? <p className="fin-empty">No booking conflicts found. Every room is covered for the next 90 days.</p> : null}
        {conflicts && conflicts.length > 0 ? (
          <div className="bk-conflicts">
            {conflicts.map((conflict) => {
              const doubleBooked = conflict.kind === 'DOUBLE_BOOKED_ROOM';
              return (
                <article className={doubleBooked ? 'bk-conflict' : 'bk-conflict bk-conflict-warn'} key={conflict.id}>
                  <div className="bk-conflict-head">
                    <FinPill tone={doubleBooked ? 'red' : 'orange'}>{doubleBooked ? 'Double-booked room' : 'Overbooked room type'}</FinPill>
                    <h3>{conflict.lodgeName}</h3>
                  </div>
                  <p>{conflict.detail} First clash on {formatDate(conflict.onDate)}.</p>
                  <ul>
                    {conflict.bookings.map((booking) => (
                      <li key={booking.bookingId}>
                        <Link className="fin-link" href={`/admin/bookings/${booking.bookingId}`}>{booking.bookingCode}</Link>
                        <span>{booking.guestName}</span>
                        <span className="fin-cell-sub">{formatDate(booking.checkInDate)} to {formatDate(booking.checkOutDate)} · {statusLabel(booking.status)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        ) : null}
      </FinPanel>
    </div>
  );
}
