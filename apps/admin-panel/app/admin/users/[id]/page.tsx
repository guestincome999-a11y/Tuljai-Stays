'use client';

import { use, useState } from 'react';

import type { UserDirectoryBooking } from '../../../../src/api/admin-user-directory-api';
import { useAdminAuth } from '../../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../../src/components/PermissionGate';
import { useAdminUserDirectoryDetail } from '../../../../src/hooks/useAdminUserDirectoryDetail';
import { hasPermission } from '../../../../src/permissions/permissions';

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const auth = useAdminAuth();
  const userDetail = useAdminUserDirectoryDetail(userId);
  const user = userDetail.data;
  const canManage = hasPermission(auth.permissions, 'users.manage');
  const [reason, setReason] = useState('');

  if (userDetail.isLoading) {
    return (
      <PermissionGate permission="users.view">
        <section className="panel">
          <p className="eyebrow">Loading</p>
          <h2>Loading user profile</h2>
        </section>
      </PermissionGate>
    );
  }

  if (!user) {
    return (
      <PermissionGate permission="users.view">
        <section className="panel">
          <p className="eyebrow">Unavailable</p>
          <h2>User could not be opened</h2>
          <p>{userDetail.errorMessage ?? 'Please retry.'}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void userDetail.refresh()}
          >
            Retry
          </button>
        </section>
      </PermissionGate>
    );
  }

  async function handleStatusChange(nextIsActive: boolean) {
    if (!reason.trim()) return;
    const success = await userDetail.setActiveStatus(nextIsActive, reason.trim());
    if (success) setReason('');
  }

  return (
    <PermissionGate permission="users.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">User Profile</p>
            <h2>{user.displayName ?? 'Unnamed user'}</h2>
            <p className="muted-copy">
              {user.roles.join(', ')} · Joined {new Date(user.createdAt).toLocaleDateString('en-IN')}
            </p>
          </div>
          <span className={user.isActive ? 'status-card' : 'priority priority-high'}>
            {user.isActive ? 'Active' : 'Suspended'}
          </span>
        </section>

        {userDetail.actionError ? (
          <section className="error-banner">{userDetail.actionError}</section>
        ) : null}

        <section className="grid grid-2">
          <div className="panel">
            <p className="eyebrow">Profile</p>
            <dl className="detail-list detail-list-wide">
              <Field label="Phone" value={user.phoneNumber ?? 'Not provided'} />
              <Field label="Email" value={user.email ?? 'Not provided'} />
              <Field label="Roles" value={user.roles.join(', ')} />
              <Field
                label="Last login"
                value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Never logged in'}
              />
              <Field label="Created" value={new Date(user.createdAt).toLocaleString('en-IN')} />
              <Field label="Updated" value={new Date(user.updatedAt).toLocaleString('en-IN')} />
            </dl>
          </div>

          <div className="panel">
            <p className="eyebrow">Booking stats</p>
            <div className="mini-metric-grid">
              <div className="mini-metric">
                <span>Total bookings</span>
                <strong>{user.stats.totalBookings}</strong>
              </div>
              <div className="mini-metric">
                <span>Upcoming</span>
                <strong>{user.stats.upcomingBookings}</strong>
              </div>
              <div className="mini-metric">
                <span>Completed</span>
                <strong>{user.stats.completedBookings}</strong>
              </div>
              <div className="mini-metric">
                <span>Cancelled</span>
                <strong>{user.stats.cancelledBookings}</strong>
              </div>
              <div className="mini-metric">
                <span>Total value</span>
                <strong>₹{user.stats.totalBookingValue}</strong>
              </div>
            </div>
          </div>
        </section>

        {canManage ? (
          <section className="panel">
            <p className="eyebrow">Manage account</p>
            <h3>Activate or suspend this account</h3>
            <p className="muted-copy">
              Suspending immediately revokes active sessions and login tokens. A reason is
              required and is recorded in the audit log.
            </p>
            <div className="form-stack">
              <label className="form-field">
                <span>Reason</span>
                <input
                  placeholder="Why are you changing this account's status?"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div className="quick-actions">
                {user.isActive ? (
                  <button
                    className="button button-secondary"
                    disabled={userDetail.isSubmitting || !reason.trim()}
                    type="button"
                    onClick={() => void handleStatusChange(false)}
                  >
                    Suspend account
                  </button>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={userDetail.isSubmitting || !reason.trim()}
                    type="button"
                    onClick={() => void handleStatusChange(true)}
                  >
                    Activate account
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <p className="eyebrow">Sessions</p>
          <h3>Recent devices</h3>
          {user.sessions.length === 0 ? <p className="muted-copy">No session history.</p> : null}
          {user.sessions.length > 0 ? (
            <div className="admin-table">
              <div className="admin-table-row admin-table-head">
                <span>Device</span>
                <span>Platform</span>
                <span>App</span>
                <span>IP Address</span>
                <span>Last seen</span>
                <span>Status</span>
              </div>
              {user.sessions.map((session) => (
                <div className="admin-table-row" key={session.id}>
                  <span>{session.deviceName ?? 'Unknown device'}</span>
                  <span>{session.platform}</span>
                  <span>{session.appType}</span>
                  <span>{session.ipAddress ?? 'Unknown'}</span>
                  <span>{new Date(session.lastSeenAt).toLocaleString('en-IN')}</span>
                  <span>{session.isActive ? 'Online' : 'Signed out'}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="table-panel">
          <p className="eyebrow">Future bookings</p>
          <h3>Upcoming stays</h3>
          <BookingTable
            bookings={user.upcomingBookings}
            emptyLabel="No upcoming bookings."
          />
        </section>

        <section className="table-panel">
          <p className="eyebrow">History</p>
          <h3>Past bookings</h3>
          <BookingTable bookings={user.pastBookings} emptyLabel="No past bookings." />
        </section>
      </div>
    </PermissionGate>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function BookingTable({
  bookings,
  emptyLabel,
}: {
  bookings: UserDirectoryBooking[];
  emptyLabel: string;
}) {
  if (bookings.length === 0) {
    return <p className="muted-copy">{emptyLabel}</p>;
  }

  return (
    <div className="admin-table">
      <div className="admin-table-row admin-table-head">
        <span>Booking Code</span>
        <span>Lodge</span>
        <span>Stay</span>
        <span>Status</span>
        <span>Payment</span>
        <span>Amount</span>
      </div>
      {bookings.map((booking) => (
        <div className="admin-table-row" key={booking.id}>
          <span>
            <strong>{booking.bookingCode}</strong>
            <small>Updated {new Date(booking.updatedAt).toLocaleDateString('en-IN')}</small>
          </span>
          <span>
            {booking.lodge.name}
            <small>{booking.roomType.name}</small>
          </span>
          <span>
            {booking.checkInDate}
            <small>to {booking.checkOutDate}</small>
          </span>
          <span className="status-card">{booking.status}</span>
          <span>{booking.paymentStatus}</span>
          <span>{booking.totalAmount ? `₹${booking.totalAmount}` : 'Not charged'}</span>
        </div>
      ))}
    </div>
  );
}
