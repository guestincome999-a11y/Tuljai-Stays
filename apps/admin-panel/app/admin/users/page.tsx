'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { listAdminUsers, type AdminTrackedUser } from '../../../src/api/admin-users-api';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminTrackedUser[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAdminUsers(search, page);
      setItems(response.items);
      setTotalPages(response.totalPages);
      setTotalItems(response.totalItems);
    } catch {
      setError('Users could not be loaded. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  return (
    <PermissionGate permission="users.view">
      <div className="page-stack">
        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Customer Support & User Tracking</p>
              <h2>Users</h2>
              <p className="muted-copy">Find a pilgrim by name, phone, email or booking code, then open their full history to resolve date, stay, payment or other support requests.</p>
            </div>
            <button className="button button-primary" type="button" onClick={() => void load()}>Refresh</button>
          </div>
          <div className="control-grid">
            <label>
              <span>Search user</span>
              <input value={search} placeholder="Name, phone, email or booking code" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); void load(); } }} />
            </label>
            <div className="row-actions" style={{ alignItems: 'end' }}>
              <button className="button button-secondary" type="button" onClick={() => { setPage(1); void load(); }}>Search</button>
              <span className="muted-copy">{totalItems} users</span>
            </div>
          </div>
        </section>
        {error ? <section className="error-banner">{error}</section> : null}
        <section className="table-panel">
          <div className="admin-table">
            <div className="admin-table-row admin-table-head"><span>User</span><span>Contact</span><span>Bookings</span><span>Total value</span><span>Last login</span><span>Recent booking</span><span>Details</span></div>
            {loading ? <div className="admin-table-row"><span>Loading users…</span></div> : null}
            {!loading && items.length === 0 ? <div className="admin-table-row"><span>No users found.</span></div> : null}
            {items.map((user) => {
              const recent = user.recentBookings[0];
              return (
                <div className="admin-table-row" key={user.id}>
                  <span><strong>{user.displayName || 'Unnamed pilgrim'}</strong><small>Joined {new Date(user.createdAt).toLocaleDateString('en-IN')}</small></span>
                  <span>{user.phoneNumber || 'No phone'}<small>{user.email || 'No email'}</small></span>
                  <span>{user.bookingCount}</span>
                  <span>₹{user.totalBookingValue.toLocaleString('en-IN')}</span>
                  <span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Not recorded'}</span>
                  <span>{recent ? <><strong>{recent.bookingCode}</strong><small>{recent.lodgeName} · {recent.status}</small><Link className="ghost-control" href={`/admin/bookings/${recent.id}`}>Open booking</Link></> : 'No bookings yet'}</span>
                  <span><Link className="button button-secondary" href={`/admin/users/${user.id}`}>View user</Link></span>
                </div>
              );
            })}
          </div>
          <div className="pagination-row">
            <button className="button button-secondary" disabled={page <= 1 || loading} type="button" onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="button button-secondary" disabled={page >= totalPages || loading} type="button" onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
