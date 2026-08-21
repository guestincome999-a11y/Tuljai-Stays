'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { searchAdminUsers, type AdminUserSummary } from '../../../src/api/admin-support-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

function money(value: string | number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function SupportPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(async () => {
    const value = query.trim();
    if (value.length < 2) {
      setUsers([]);
      setError(value ? 'Enter at least 2 characters.' : '');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setUsers((await searchAdminUsers(value)).items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search pilgrims.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void search(), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <PermissionGate permission="support.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Operations · User Support</p>
            <h2>Pilgrim support directory</h2>
            <p className="muted-copy">
              Search by name, mobile, email, or booking code. Profile details and authorised booking
              resolution actions are kept on a dedicated page.
            </p>
          </div>
        </section>

        <section className="panel">
          <label className="form-field">
            <span>Search pilgrim</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, mobile, email, or booking code"
              autoComplete="off"
            />
          </label>
          {error ? <p className="error-banner">{error}</p> : null}
        </section>

        <section className="table-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Customer Directory</p>
              <h3>{loading ? 'Searching…' : `${users.length} result${users.length === 1 ? '' : 's'}`}</h3>
            </div>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Pilgrim</span>
              <span>Mobile</span>
              <span>Email</span>
              <span>Bookings</span>
              <span>Completed</span>
              <span>Booking value</span>
              <span>Action</span>
            </div>
            {users.map((user) => (
              <div className="admin-table-row" key={user.id}>
                <span>
                  <strong>{user.displayName || 'Pilgrim'}</strong>
                  <small>{user.id}</small>
                </span>
                <span>{user.phoneNumber || 'Not provided'}</span>
                <span>{user.email || 'Not provided'}</span>
                <span>{user.totalBookings}</span>
                <span>{user.completedBookings}</span>
                <span>{money(user.totalBookingValue)}</span>
                <span>
                  <Link className="button button-secondary" href={`/admin/support/${user.id}`}>
                    View details
                  </Link>
                </span>
              </div>
            ))}
            {!loading && query.trim().length >= 2 && !users.length ? (
              <p className="muted-copy">No matching pilgrim was found.</p>
            ) : null}
            {!query.trim() ? (
              <p className="muted-copy">Start typing to search the pilgrim directory.</p>
            ) : null}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
