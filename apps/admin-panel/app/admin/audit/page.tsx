'use client';

import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminAuditPage() {
  return (
    <PermissionGate permission="audit_logs.view">
      <div className="page-stack">
        <section className="panel">
          <p className="eyebrow">Audit Logs</p>
          <h2>Audit visibility foundation</h2>
          <p>
            Audit log records are created by backend services, but a public
            <code> GET /api/admin/audit-logs </code>
            endpoint is not available yet. This page is protected and ready to connect when the API
            is added.
          </p>
        </section>

        <section className="table-panel">
          <div className="table-row table-head">
            <span>Action</span>
            <span>Actor</span>
            <span>Entity</span>
            <span>Timestamp</span>
            <span>Metadata</span>
          </div>
          <div className="empty-table">
            No audit API connected yet. Do not display fake audit data.
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
