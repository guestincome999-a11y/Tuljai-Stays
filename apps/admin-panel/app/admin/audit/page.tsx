'use client';

import { useState } from 'react';

import { PermissionGate } from '../../../src/components/PermissionGate';

export default function AdminAuditPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  return (
    <PermissionGate permission="audit_logs.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Audit Explorer</p>
            <h2>Audit history</h2>
            <p className="muted-copy">
              Filter-ready audit explorer for admin, booking, owner, lodge, room, setting, and
              security events.
            </p>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Audit Logs</p>
          <h3>Audit visibility foundation</h3>
          <p>
            Audit log records are created by backend services, but a public
            <code> GET /api/admin/audit-logs </code>
            endpoint is not available yet. This page is protected and prepared for search,
            pagination, severity, category, metadata, old value, new value, and reason display.
          </p>
        </section>

        <section className="panel">
          <div className="control-grid">
            <label>
              <span>Search</span>
              <input
                placeholder="Admin, action, booking, owner, lodge, room"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                <option>Authentication</option>
                <option>Booking</option>
                <option>Lodge</option>
                <option>Room</option>
                <option>Settings</option>
                <option>Security</option>
              </select>
            </label>
            <label>
              <span>Date</span>
              <input type="date" />
            </label>
            <label>
              <span>Severity</span>
              <select>
                <option>All severities</option>
                <option>Critical</option>
                <option>Warning</option>
                <option>Info</option>
              </select>
            </label>
          </div>
        </section>

        <section className="table-panel">
          <div className="admin-table audit-table">
            <div className="admin-table-row admin-table-head">
              <span>Timestamp</span>
              <span>Actor</span>
              <span>Action</span>
              <span>Target</span>
              <span>Old Value</span>
              <span>New Value</span>
              <span>Reason</span>
              <span>Metadata</span>
            </div>
          </div>
          <div className="empty-table">
            No audit API connected yet. Do not display fake audit data. Current filters:
            {query ? ` search "${query}"` : ' no search'} / {category || 'all categories'}.
          </div>
        </section>

        <section className="table-panel">
          <p className="eyebrow">Required API Shape</p>
          <div className="admin-table audit-api-table">
            <div className="admin-table-row admin-table-head">
              <span>Field</span>
              <span>Purpose</span>
            </div>
            {[
              ['timestamp', 'When the event happened'],
              ['actor', 'Admin/user/service actor'],
              ['action', 'Audit action name'],
              ['target', 'Entity type and id'],
              ['oldValue/newValue', 'Change diff for settings and state changes'],
              ['reason', 'Admin supplied reason for sensitive changes'],
              ['metadata', 'Request id, IP, user agent, and safe context'],
            ].map(([field, purpose]) => (
              <div className="admin-table-row" key={field}>
                <span>{field}</span>
                <span>{purpose}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
