'use client';

import { useState } from 'react';

import { PermissionGate } from '../../../src/components/PermissionGate';

const exportTypes = [
  'Bookings',
  'Revenue',
  'Commission',
  'Lodges',
  'Owners',
  'Rooms',
  'QR Reports',
  'Notification Reports',
  'Audit Reports',
  'Analytics',
];
const formats = ['CSV', 'Excel', 'PDF'];

export default function AdminExportsPage() {
  const [exportType, setExportType] = useState(exportTypes[0] ?? 'Bookings');
  const [format, setFormat] = useState(formats[0] ?? 'CSV');
  const [schedule, setSchedule] = useState('Manual');

  return (
    <PermissionGate permission="reports.export">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Export Center</p>
            <h2>Reports and scheduled export foundation</h2>
            <p className="muted-copy">
              Prepare export requests with filters and formats. Backend export generation and email
              delivery remain future services.
            </p>
          </div>
        </section>

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Create Export</p>
            <div className="form-stack">
              <label className="form-field">
                <span>Report</span>
                <select value={exportType} onChange={(event) => setExportType(event.target.value)}>
                  {exportTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Format</span>
                <select value={format} onChange={(event) => setFormat(event.target.value)}>
                  {formats.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <div className="control-grid">
                <label>
                  <span>Start</span>
                  <input type="date" />
                </label>
                <label>
                  <span>End</span>
                  <input type="date" />
                </label>
                <label>
                  <span>City</span>
                  <input placeholder="Optional city" />
                </label>
                <label>
                  <span>Lodge</span>
                  <input placeholder="Optional lodge" />
                </label>
              </div>
              <button className="button button-secondary" disabled type="button">
                Request Export - Backend endpoint required
              </button>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Scheduled Reports</p>
            <h3>Delivery foundation</h3>
            <label className="form-field">
              <span>Schedule</span>
              <select value={schedule} onChange={(event) => setSchedule(event.target.value)}>
                {['Manual', 'Daily', 'Weekly', 'Monthly'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <p>
              Selected request: {exportType} / {format} / {schedule}.
            </p>
            <p className="muted-copy">
              Required APIs: `POST /api/admin/exports`, `GET /api/admin/exports`, and scheduled
              report delivery worker.
            </p>
          </section>
        </section>

        <section className="table-panel">
          <p className="eyebrow">Export Catalog</p>
          <div className="admin-table export-table">
            <div className="admin-table-row admin-table-head">
              <span>Report</span>
              <span>Formats</span>
              <span>Status</span>
            </div>
            {exportTypes.map((item) => (
              <div className="admin-table-row" key={item}>
                <span>{item}</span>
                <span>{formats.join(', ')}</span>
                <span className="status-card">Foundation</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}
