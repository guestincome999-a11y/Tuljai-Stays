'use client';

import { useState } from 'react';

import {
  getAdminUser,
  searchAdminUsers,
  updateAdminUserBooking,
  type AdminUserBooking,
  type AdminUserDetail,
  type AdminUserSummary,
} from '../../../src/api/admin-support-api';

export default function SupportPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [editing, setEditing] = useState<AdminUserBooking | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      setUsers((await searchAdminUsers(query.trim())).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not search users.');
    } finally {
      setLoading(false);
    }
  }

  async function openUser(id: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      setSelected(await getAdminUser(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load user.');
    } finally {
      setLoading(false);
    }
  }

  async function saveBooking() {
    if (!selected || !editing || !notes.trim()) {
      setError('Add support notes before saving a booking change.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateAdminUserBooking(selected.id, editing.id, {
        checkInDate: editing.checkInDate,
        checkOutDate: editing.checkOutDate,
        guestName: editing.guestName,
        guestPhone: editing.guestPhone,
        guestEmail: editing.guestEmail ?? undefined,
        numberOfAdults: editing.numberOfAdults,
        numberOfChildren: editing.numberOfChildren,
        notes: notes.trim(),
      });
      setSelected(await getAdminUser(selected.id));
      setEditing(null);
      setNotes('');
      setMessage(
        'Booking updated. The pilgrim and lodge owner will receive the update automatically.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Customer operations</p>
          <h2>User Support & Booking Resolution</h2>
          <p>
            Find a pilgrim by name, phone, email or booking code and resolve authorised booking
            changes with an audit trail.
          </p>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Find pilgrim</h3>
            <p>Use the details provided by the customer during support.</p>
          </div>
        </div>
        <div className="button-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
            }}
            placeholder="Name, mobile, email or booking code"
          />
          <button
            className="button button-primary"
            disabled={loading || query.trim().length < 2}
            onClick={() => void search()}
          >
            Search
          </button>
        </div>
        {users.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Bookings</th>
                  <th>Booking value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.displayName || 'Unnamed pilgrim'}</strong>
                      <br />
                      <small>{user.id}</small>
                    </td>
                    <td>
                      {user.phoneNumber || '—'}
                      <br />
                      {user.email || '—'}
                    </td>
                    <td>
                      {user.totalBookings}
                      <br />
                      <small>{user.completedBookings} completed</small>
                    </td>
                    <td>₹{Number(user.totalBookingValue).toLocaleString('en-IN')}</td>
                    <td>
                      <button
                        className="button button-secondary"
                        onClick={() => void openUser(user.id)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3>{selected.displayName || 'Unnamed pilgrim'}</h3>
              <p>
                {selected.phoneNumber || 'No phone'} · {selected.email || 'No email'}
              </p>
            </div>
            <button className="button button-secondary" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="metric-grid">
            <div className="metric-card">
              <span>Total bookings</span>
              <strong>{selected.stats.totalBookings}</strong>
            </div>
            <div className="metric-card">
              <span>Completed</span>
              <strong>{selected.stats.completedBookings}</strong>
            </div>
            <div className="metric-card">
              <span>Cancelled</span>
              <strong>{selected.stats.cancelledBookings}</strong>
            </div>
            <div className="metric-card">
              <span>Total booking value</span>
              <strong>₹{Number(selected.stats.totalBookingValue).toLocaleString('en-IN')}</strong>
            </div>
          </div>
          {selected.bookings.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Stay</th>
                    <th>Guest</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selected.bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <strong>{booking.bookingCode}</strong>
                        <br />
                        <small>{booking.id}</small>
                      </td>
                      <td>
                        {booking.lodge.name}
                        <br />
                        {booking.roomType.name}
                        {booking.roomNumber ? ` · Room ${booking.roomNumber}` : ''}
                      </td>
                      <td>
                        {booking.guestName}
                        <br />
                        {booking.guestPhone}
                      </td>
                      <td>
                        {booking.checkInDate} → {booking.checkOutDate}
                        <br />
                        {booking.totalGuests} guests
                      </td>
                      <td>
                        {booking.status}
                        <br />
                        {booking.paymentStatus}
                      </td>
                      <td>
                        <button
                          className="button button-secondary"
                          disabled={[
                            'CHECKED_IN',
                            'CHECKED_OUT',
                            'COMPLETED',
                            'CANCELLED',
                            'REJECTED',
                            'EXPIRED',
                            'NO_SHOW',
                          ].includes(booking.status)}
                          onClick={() => {
                            setEditing({ ...booking });
                            setNotes('');
                            setError('');
                            setMessage('');
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No bookings found for this pilgrim.</p>
          )}
        </div>
      ) : null}

      {editing ? (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3>Edit {editing.bookingCode}</h3>
              <p>
                Only operational booking details are editable here. Payment records are not changed
                by support.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Check-in
              <input
                type="date"
                value={editing.checkInDate}
                onChange={(e) => setEditing({ ...editing, checkInDate: e.target.value })}
              />
            </label>
            <label>
              Check-out
              <input
                type="date"
                value={editing.checkOutDate}
                onChange={(e) => setEditing({ ...editing, checkOutDate: e.target.value })}
              />
            </label>
            <label>
              Guest name
              <input
                value={editing.guestName}
                onChange={(e) => setEditing({ ...editing, guestName: e.target.value })}
              />
            </label>
            <label>
              Guest mobile
              <input
                value={editing.guestPhone}
                onChange={(e) => setEditing({ ...editing, guestPhone: e.target.value })}
              />
            </label>
            <label>
              Adults
              <input
                type="number"
                min={1}
                max={50}
                value={editing.numberOfAdults}
                onChange={(e) => setEditing({ ...editing, numberOfAdults: Number(e.target.value) })}
              />
            </label>
            <label>
              Children
              <input
                type="number"
                min={0}
                max={50}
                value={editing.numberOfChildren}
                onChange={(e) =>
                  setEditing({ ...editing, numberOfChildren: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Support notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Example: Customer called support and requested a date change; identity verified through account details."
            />
          </label>
          <div className="button-row">
            <button className="button button-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={saving || !notes.trim()}
              onClick={() => void saveBooking()}
            >
              {saving ? 'Saving…' : 'Save & notify'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
    </div>
  );
}
