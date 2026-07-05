'use client';

import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';

export default function AdminAccountPage() {
  const auth = useAdminAuth();
  const user = auth.session.user;
  const activeSession = auth.session.activeSession;

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Account</p>
        <h2>{user?.displayName ?? 'Admin account'}</h2>
        <dl className="detail-list">
          <div>
            <dt>Phone</dt>
            <dd>{user?.phoneNumber ?? 'Not available'}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>{user?.roles.join(', ') ?? 'No roles'}</dd>
          </div>
          <div>
            <dt>Permissions</dt>
            <dd>{auth.permissions.join(', ')}</dd>
          </div>
          <div>
            <dt>Last login</dt>
            <dd>
              {user?.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleString('en-IN')
                : 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>
              {activeSession
                ? `${activeSession.deviceName ?? 'Admin Browser'} / ${activeSession.platform}`
                : 'No active session metadata'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel warning-panel">
        <p className="eyebrow">Security Reminder</p>
        <h3>Use admin access carefully</h3>
        <p>
          Do not share OTPs or leave an admin session open on shared devices. Later critical actions
          must be audit logged by default.
        </p>
        <button className="button button-primary" type="button" onClick={() => void auth.signOut()}>
          Logout safely
        </button>
      </section>
    </div>
  );
}
