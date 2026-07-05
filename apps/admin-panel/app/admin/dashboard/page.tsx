'use client';

import { useAdminAuth } from '../../../src/auth/AdminAuthProvider';

const roadmapCards = [
  'Live operations console',
  'Booking and override control',
  'Lodge, owner, room, and photo governance',
  'Reports, analytics, support, and system health',
];

export default function AdminDashboardPage() {
  const auth = useAdminAuth();
  const user = auth.session.user;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Secure Console</p>
          <h2>Welcome {user?.displayName ?? user?.phoneNumber ?? 'Admin'}</h2>
          <p>
            This foundation keeps the admin shell protected while the operational modules are added
            sequence by sequence.
          </p>
        </div>
        <div className="status-card">
          <span className="status-dot" />
          Session validated
        </div>
      </section>

      <section className="grid grid-3">
        <div className="panel">
          <p className="eyebrow">Roles</p>
          <h3>{user?.roles.join(', ') ?? 'No roles'}</h3>
          <p>Only supported admin roles can access this console.</p>
        </div>
        <div className="panel">
          <p className="eyebrow">Permissions</p>
          <h3>{auth.permissions.length}</h3>
          <p>Navigation is filtered by permission, not by static menu visibility.</p>
        </div>
        <div className="panel">
          <p className="eyebrow">System Status</p>
          <h3>Ready for Sequence 02</h3>
          <p>Live metrics will be connected in the operations sequence.</p>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Pending Tasks</p>
            <h3>Operational modules roadmap</h3>
          </div>
        </div>
        <div className="roadmap-grid">
          {roadmapCards.map((card) => (
            <article className="roadmap-card" key={card}>
              <h4>{card}</h4>
              <p>
                Placeholder route prepared. Feature implementation is reserved for later sequences.
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
