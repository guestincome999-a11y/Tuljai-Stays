'use client';

import type { AdminUserBooking, AdminUserDetail } from '../../../../src/api/admin-support-api';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import {
  getAdminUser,
  updateAdminUserBooking,
} from '../../../../src/api/admin-support-api';
import { PermissionGate } from '../../../../src/components/PermissionGate';

const TERMINAL_STATUSES = new Set([
  'CHECKED_IN',
  'CHECKED_OUT',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'NO_SHOW',
]);

function money(value: string | number | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function AdminSupportUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [editing, setEditing] = useState<AdminUserBooking | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setUser(await getAdminUser(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pilgrim details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function saveBooking() {
    if (!user || !editing || !notes.trim()) {
      setError('Support notes are required for every booking change.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateAdminUserBooking(user.id, editing.id, {
        checkInDate: editing.checkInDate,
        checkOutDate: editing.checkOutDate,
        guestName: editing.guestName,
        guestPhone: editing.guestPhone,
        guestEmail: editing.guestEmail ?? undefined,
        numberOfAdults: editing.numberOfAdults,
        numberOfChildren: editing.numberOfChildren,
        notes: notes.trim(),
      });
      setEditing(null);
      setNotes('');
      setMessage('Booking updated and connected pilgrim/owner notifications were sent.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PermissionGate permission="support.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Operations · Pilgrim Profile</p>
            <h2>{loading ? 'Loading…' : user?.displayName || 'Pilgrim'}</h2>
            <p className="muted-copy">
              Complete support profile, booking history, payment status, stay details, and controlled
              booking-resolution actions.
            </p>
          </div>
          <div className="row-actions">
            <Link className="button button-secondary" href="/admin/support">
              Back to support
            </Link>
            <button className="button button-primary" type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </section>

        {error ? <p className="error-banner">{error}</p> : null}
        {message ? <p className="success-banner">{message}</p> : null}

        {user ? (
          <>
            <section className="grid grid-4">
              <Metric label="Total bookings" value={String(user.stats.totalBookings)} />
              <Metric label="Completed" value={String(user.stats.completedBookings)} />
              <Metric label="Cancelled" value={String(user.stats.cancelledBookings)} />
              <Metric label="Booking value" value={money(user.stats.totalBookingValue)} />
            </section>

            <section className="grid grid-2">
              <section className="panel">
                <p className="eyebrow">Account</p>
                <h3>Contact details</h3>
                <div className="feed-list">
                  <Insight label="Name" value={user.displayName || 'Not provided'} />
                  <Insight label="Mobile" value={user.phoneNumber || 'Not provided'} />
                  <Insight label="Email" value={user.email || 'Not provided'} />
                  <Insight label="Account created" value={new Date(user.createdAt).toLocaleString('en-IN')} />
                  <Insight
                    label="Last login"
                    value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Not available'}
                  />
                </div>
              </section>
              <section className="panel">
                <p className="eyebrow">Support safety</p>
                <h3>Controlled resolution</h3>
                <p className="muted-copy">
                  Completed, checked-in, cancelled, rejected, expired, no-show, and checked-out
                  bookings are read-only. Payment records are never changed by this workflow.
                </p>
              </section>
            </section>

            <section className="table-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Booking History</p>
                  <h3>All bookings for this pilgrim</h3>
                </div>
              </div>
              <div className="admin-table">
                <div className="admin-table-row admin-table-head">
                  <span>Booking</span>
                  <span>Stay</span>
                  <span>Guest</span>
                  <span>Dates</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                {user.bookings.map((booking) => (
                  <div className="admin-table-row" key={booking.id}>
                    <span>
                      <strong>{booking.bookingCode}</strong>
                      <small>{booking.id}</small>
                    </span>
                    <span>
                      {booking.lodge.name}
                      <small>{booking.roomType.name}{booking.roomNumber ? ` · Room ${booking.roomNumber}` : ''}</small>
                    </span>
                    <span>
                      {booking.guestName}
                      <small>{booking.guestPhone}</small>
                    </span>
                    <span>
                      {booking.checkInDate} → {booking.checkOutDate}
                      <small>{booking.totalGuests} guests</small>
                    </span>
                    <span>{money(booking.totalAmount)}</span>
                    <span>
                      {booking.status}
                      <small>{booking.paymentStatus}</small>
                    </span>
                    <span>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={TERMINAL_STATUSES.has(booking.status)}
                        onClick={() => {
                          setEditing({ ...booking });
                          setNotes('');
                          setError('');
                          setMessage('');
                        }}
                      >
                        {TERMINAL_STATUSES.has(booking.status) ? 'Read only' : 'Edit'}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {editing ? (
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Support Action</p>
                    <h3>Edit {editing.bookingCode}</h3>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Check-in</span>
                    <input type="date" value={editing.checkInDate} onChange={(e) => setEditing({ ...editing, checkInDate: e.target.value })} />
                  </label>
                  <label className="form-field">
                    <span>Check-out</span>
                    <input type="date" value={editing.checkOutDate} onChange={(e) => setEditing({ ...editing, checkOutDate: e.target.value })} />
                  </label>
                  <label className="form-field">
                    <span>Guest name</span>
                    <input value={editing.guestName} onChange={(e) => setEditing({ ...editing, guestName: e.target.value })} />
                  </label>
                  <label className="form-field">
                    <span>Guest mobile</span>
                    <input value={editing.guestPhone} onChange={(e) => setEditing({ ...editing, guestPhone: e.target.value })} />
                  </label>
                  <label className="form-field">
                    <span>Adults</span>
                    <input type="number" min={1} max={50} value={editing.numberOfAdults} onChange={(e) => setEditing({ ...editing, numberOfAdults: Number(e.target.value) })} />
                  </label>
                  <label className="form-field">
                    <span>Children</span>
                    <input type="number" min={0} max={50} value={editing.numberOfChildren} onChange={(e) => setEditing({ ...editing, numberOfChildren: Number(e.target.value) })} />
                  </label>
                </div>
                <label className="form-field">
                  <span>Mandatory support notes</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Record why the customer requested the change and what was verified." />
                </label>
                <div className="row-actions">
                  <button className="button button-secondary" type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button className="button button-primary" type="button" disabled={saving || !notes.trim()} onClick={() => void saveBooking()}>
                    {saving ? 'Saving…' : 'Save & notify'}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </PermissionGate>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <article className="feed-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
