'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { UserDirectorySummary } from '../../../src/api/admin-user-directory-api';
import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';
import {
  useAdminUserDirectory,
  type AdminUserDirectoryFilters,
} from '../../../src/hooks/useAdminUserDirectory';
import { hasPermission } from '../../../src/permissions/permissions';

const initialFilters: AdminUserDirectoryFilters = {
  q: '',
  role: '',
  status: '',
};

export default function AdminUsersPage() {
  const auth = useAdminAuth();
  const [filters, setFilters] = useState<AdminUserDirectoryFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const users = useAdminUserDirectory(filters, page);
  const canManage = hasPermission(auth.permissions, 'users.manage');

  return (
    <PermissionGate permission="users.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">User Monitoring</p>
            <h2>All users</h2>
            <p className="muted-copy">
              Every pilgrim, owner, and admin account in one place, with activity signals and
              account controls.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => users.refresh()}>
            Refresh
          </button>
        </section>

        {users.statsError ? <section className="error-banner">{users.statsError}</section> : null}

        <section className="panel">
          <p className="eyebrow">Overview</p>
          <div className="mini-metric-grid">
            <div className="mini-metric">
              <span>Total users</span>
              <strong>{users.stats?.totalUsers ?? '—'}</strong>
            </div>
            <div className="mini-metric">
              <span>Active</span>
              <strong>{users.stats?.activeUsers ?? '—'}</strong>
            </div>
            <div className="mini-metric">
              <span>Suspended</span>
              <strong>{users.stats?.inactiveUsers ?? '—'}</strong>
            </div>
            <div className="mini-metric">
              <span>Active in last 7 days</span>
              <strong>{users.stats?.recentlyActiveUsers ?? '—'}</strong>
            </div>
            <div className="mini-metric">
              <span>Pilgrims</span>
              <strong>{users.stats?.byRole.PILGRIM ?? '—'}</strong>
            </div>
            <div className="mini-metric">
              <span>Owners</span>
              <strong>{users.stats?.byRole.OWNER ?? '—'}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Search</span>
              <input
                placeholder="Name, phone, or email"
                value={filters.q}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, q: event.target.value }));
                }}
              />
            </label>
            <label>
              <span>Role</span>
              <select
                value={filters.role}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    role: event.target.value as AdminUserDirectoryFilters['role'],
                  }));
                }}
              >
                <option value="">All roles</option>
                <option value="PILGRIM">Pilgrim</option>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={filters.status}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as AdminUserDirectoryFilters['status'],
                  }));
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>
            </label>
          </div>
        </section>

        {users.errorMessage ? (
          <section className="error-banner">{users.errorMessage}</section>
        ) : null}

        <section className="table-panel">
          <div className="admin-table user-directory-table">
            <div className="admin-table-row admin-table-head">
              <span>User</span>
              <span>Contact</span>
              <span>Roles</span>
              <span>Bookings</span>
              <span>Last active</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {!users.isLoading && (users.data?.items.length ?? 0) === 0 ? (
              <div className="admin-table-row">
                <span>No users match these filters.</span>
              </div>
            ) : null}
            {(users.data?.items ?? []).map((user) => (
              <UserRow canManage={canManage} key={user.id} user={user} />
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
              Page {users.data?.page ?? page} of {users.data?.totalPages ?? 1} ·{' '}
              {users.data?.totalItems ?? 0} users
            </span>
            <button
              className="button button-secondary"
              disabled={!users.data || page >= users.data.totalPages}
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

function UserRow({ user, canManage }: { user: UserDirectorySummary; canManage: boolean }) {
  return (
    <div className="admin-table-row">
      <span>
        <strong>{user.displayName ?? 'Unnamed user'}</strong>
        <small>Joined {new Date(user.createdAt).toLocaleDateString('en-IN')}</small>
      </span>
      <span>
        {user.phoneNumber ?? 'No phone'}
        <small>{user.email ?? 'No email'}</small>
      </span>
      <span>{user.roles.join(', ')}</span>
      <span>{user.totalBookings}</span>
      <span>
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Never logged in'}
        {user.recentlyActive ? <small>Active recently</small> : null}
      </span>
      <span className={user.isActive ? 'status-card' : 'priority priority-high'}>
        {user.isActive ? 'Active' : 'Suspended'}
      </span>
      <span className="row-actions">
        <Link className="ghost-control" href={`/admin/users/${user.id}`}>
          View details
        </Link>
        {!canManage ? <small>View-only access</small> : null}
      </span>
    </div>
  );
}
