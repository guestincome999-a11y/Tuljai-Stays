'use client';

import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';
import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminSessionsPage() {
  const auth = useAdminAuth();
  const session = auth.session.activeSession;
  const user = auth.session.user;

  return (
    <PermissionGate permission="security.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Active Sessions</p>
            <h2>Session management</h2>
            <p className="muted-copy">
              Shows the current admin session. Full admin, owner, and pilgrim session inventory
              requires backend session-read and revoke endpoints.
            </p>
          </div>
        </section>

        <section className="table-panel">
          <div className="admin-table session-table">
            <div className="admin-table-row admin-table-head">
              <span>User</span>
              <span>Role</span>
              <span>Device</span>
              <span>Platform</span>
              <span>Login Time</span>
              <span>Last Activity</span>
              <span>Status</span>
            </div>
            {session && user ? (
              <div className="admin-table-row">
                <span>{user.displayName ?? user.phoneNumber}</span>
                <span>{user.roles.join(', ')}</span>
                <span>{session.deviceName ?? session.deviceId}</span>
                <span>{session.platform}</span>
                <span>{new Date(session.createdAt).toLocaleString('en-IN')}</span>
                <span>{new Date(session.lastSeenAt).toLocaleString('en-IN')}</span>
                <span className="status-card">{session.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel warning-panel">
          <p className="eyebrow">Backend Required</p>
          <h3>Force logout and revoke session</h3>
          <p>
            Required APIs:
            <code> GET /api/admin/sessions </code>
            and
            <code> POST /api/admin/sessions/:id/revoke </code>. IP addresses should be masked unless
            the requester has explicit security permission.
          </p>
        </section>
      </div>
    </PermissionGate>
  );
}
