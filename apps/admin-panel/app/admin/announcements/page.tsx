'use client';

import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementTargetAudience,
  NotificationPriority,
} from '@tuljai/types';
import { useCallback, useEffect, useState } from 'react';

import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  type AnnouncementInput,
} from '../../../src/api/admin-platform-control-api';
import { PermissionGate } from '../../../src/components/PermissionGate';
import { formatControlLabel } from '../../../src/platform-control/platform-control-config';

const categories: AnnouncementCategory[] = [
  'GENERAL',
  'EMERGENCY',
  'TEMPLE_NOTICE',
  'FESTIVAL',
  'MAINTENANCE',
  'OFFER',
  'SYSTEM',
];
const priorities: NotificationPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const audiences: AnnouncementTargetAudience[] = [
  'ALL',
  'PILGRIMS',
  'OWNERS',
  'ADMINS',
  'LODGE_SPECIFIC',
  'CITY_SPECIFIC',
];

const initialForm: AnnouncementInput = {
  body: '',
  category: 'GENERAL',
  priority: 'NORMAL',
  targetAudience: 'ALL',
  title: '',
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState<AnnouncementInput>(initialForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await listAnnouncements({ limit: 20, page: 1 });
      setAnnouncements(response.items);
    } catch {
      setErrorMessage('Announcements could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    if (!form.title.trim() || !form.body.trim()) {
      setErrorMessage('Announcement title and body are required.');
      return;
    }

    if (
      (form.category === 'EMERGENCY' || form.priority === 'CRITICAL') &&
      !window.confirm('Confirm emergency or critical announcement broadcast?')
    ) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createAnnouncement({
        ...form,
        expiresAt: form.expiresAt || undefined,
        startsAt: form.startsAt || undefined,
        targetCityId: form.targetCityId || undefined,
        targetLodgeId: form.targetLodgeId || undefined,
      });
      setForm(initialForm);
      await load();
      setSuccessMessage('Announcement published.');
    } catch {
      setErrorMessage('Announcement publish failed. Check target fields and retry.');
    }
  }

  async function remove(announcementId: string) {
    if (!window.confirm('Delete this announcement?')) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAnnouncement(announcementId);
      await load();
      setSuccessMessage('Announcement deleted.');
    } catch {
      setErrorMessage('Announcement delete failed.');
    }
  }

  return (
    <PermissionGate permission="announcements.manage">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Platform Control Center</p>
            <h2>Announcement broadcast</h2>
            <p className="muted-copy">
              Broadcast general, festival, temple, maintenance, and emergency messages to the right
              audience.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </section>

        {errorMessage ? <section className="error-banner">{errorMessage}</section> : null}
        {successMessage ? <section className="success-banner">{successMessage}</section> : null}

        <section className="grid grid-2">
          <section className="panel">
            <p className="eyebrow">Compose</p>
            <h3>New announcement</h3>
            <div className="form-stack">
              <label className="form-field">
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Body</span>
                <textarea
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, body: event.target.value }))
                  }
                />
              </label>
              <div className="control-grid">
                <SelectField
                  label="Category"
                  options={categories}
                  value={form.category}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, category: value as AnnouncementCategory }))
                  }
                />
                <SelectField
                  label="Priority"
                  options={priorities}
                  value={form.priority}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, priority: value as NotificationPriority }))
                  }
                />
                <SelectField
                  label="Audience"
                  options={audiences}
                  value={form.targetAudience}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      targetAudience: value as AnnouncementTargetAudience,
                    }))
                  }
                />
              </div>
              <div className="control-grid">
                <label>
                  <span>City id</span>
                  <input
                    value={form.targetCityId ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, targetCityId: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Lodge id</span>
                  <input
                    value={form.targetLodgeId ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, targetLodgeId: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Start time</span>
                  <input
                    type="datetime-local"
                    value={form.startsAt ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startsAt: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Expiry time</span>
                  <input
                    type="datetime-local"
                    value={form.expiresAt ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, expiresAt: event.target.value }))
                    }
                  />
                </label>
              </div>
              <button
                className="button button-primary"
                type="button"
                onClick={() => void publish()}
              >
                Preview Confirm Publish
              </button>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Preview</p>
            <h3>{form.title || 'Announcement title'}</h3>
            <p>{form.body || 'Announcement body preview appears here.'}</p>
            <div className="quick-actions">
              <span className="status-card">{formatControlLabel(form.category)}</span>
              <span className="status-card">{formatControlLabel(form.priority)}</span>
              <span className="status-card">{formatControlLabel(form.targetAudience)}</span>
            </div>
          </section>
        </section>

        <section className="table-panel">
          <p className="eyebrow">Active Announcements</p>
          <div className="admin-table announcement-table">
            <div className="admin-table-row admin-table-head">
              <span>Title</span>
              <span>Category</span>
              <span>Priority</span>
              <span>Audience</span>
              <span>Expiry</span>
              <span>Action</span>
            </div>
            {announcements.map((announcement) => (
              <div className="admin-table-row" key={announcement.id}>
                <span>
                  <strong>{announcement.title}</strong>
                  <small>{announcement.body}</small>
                </span>
                <span>{formatControlLabel(announcement.category)}</span>
                <span className="status-card">{formatControlLabel(announcement.priority)}</span>
                <span>{formatControlLabel(announcement.targetAudience)}</span>
                <span>
                  {announcement.expiresAt
                    ? new Date(announcement.expiresAt).toLocaleString('en-IN')
                    : 'No expiry'}
                </span>
                <span>
                  <button
                    className="ghost-control"
                    type="button"
                    onClick={() => void remove(announcement.id)}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PermissionGate>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatControlLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
