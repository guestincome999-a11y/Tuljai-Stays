'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';

import { getAdminUser, type AdminUserDetail } from '../../../../src/api/admin-users-api';
import { PermissionGate } from '../../../../src/components/PermissionGate';

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void getAdminUser(id).then(setUser).catch(() => setError('User details could not be loaded. Please retry.')).finally(() => setLoading(false));
  }, [id]);

  return (
    <PermissionGate permission="users.view">
      <div className="page-stack">
        <div className="section-header"><div><p className="eyebrow">Customer Support · User Tracking</p><h2>User detail</h2></div><Link className="button button-secondary" href="/admin/users">Back to users</Link></div>
        {error ? <section className="error-banner">{error}</section> : null}
        {loading ? <section className="panel"><p className="muted-copy">Loading complete user history…</p></section> : null}
        {user ? <>
          <section className="grid grid-4"><MetricCard label="Bookings" value={user.bookingCount.toString()} /><MetricCard label="Booking value" value={`₹${user.totalBookingValue.toLocaleString('en-IN')}`} /><MetricCard label="Commission" value={`₹${user.totalCommission.toLocaleString('en-IN')}`} /><MetricCard label="Account" value={user.isActive ? 'Active' : 'Inactive'} /></section>
          <section className="grid grid-2">
            <section className="panel"><p className="eyebrow">Identity</p><h3>{user.displayName || 'Unnamed pilgrim'}</h3><p className="muted-copy">Phone: {user.phoneNumber || 'Not available'}</p><p className="muted-copy">Joined: {new Date(user.createdAt).toLocaleString('en-IN')}</p><p className="muted-copy">Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Not recorded'}</p>{user.identities.map((identity) => <p className="muted-copy" key={`${identity.provider}-${identity.createdAt}`}>{identity.provider}: {identity.email || 'Email not available'}</p>)}</section>
            <section className="panel"><p className="eyebrow">Support workflow</p><h3>Full pilgrim history</h3><p className="muted-copy">Use the booking links below to open the existing booking control center for supported operational actions.</p></section>
          </section>
          <section className="table-panel"><div className="section-header"><div><p className="eyebrow">Booking history</p><h3>All bookings for this user</h3></div></div><div className="admin-table"><div className="admin-table-row admin-table-head"><span>Booking</span><span>Lodge</span><span>Stay</span><span>Status</span><span>Payment</span><span>Value</span><span>Action</span></div>{user.bookings.map((booking) => <div className="admin-table-row" key={booking.id}><span><strong>{booking.bookingCode}</strong><small>{new Date(booking.createdAt).toLocaleDateString('en-IN')}</small></span><span>{booking.lodge.name}<small>{booking.roomType?.name || 'Room type unavailable'}</small></span><span>{new Date(booking.checkInDate).toLocaleDateString('en-IN')} → {new Date(booking.checkOutDate).toLocaleDateString('en-IN')}</span><span className="status-card">{booking.status}</span><span>{booking.paymentStatus}<small>{booking.paymentMethod || 'Method not recorded'}</small></span><span>₹{booking.totalAmount.toLocaleString('en-IN')}<small>Commission ₹{booking.commissionAmount.toLocaleString('en-IN')}</small></span><span><Link className="button button-secondary" href={`/admin/bookings/${booking.id}`}>Open booking</Link></span></div>)}</div>{user.bookings.length === 0 ? <p className="empty-table">No bookings found for this user.</p> : null}</section>
        </> : null}
      </div>
    </PermissionGate>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) { return <div className="kpi-card"><span className="kpi-icon">TS</span><div><span className="kpi-label">{label}</span><strong>{value}</strong></div></div>; }
