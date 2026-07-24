'use client';

import type { BookingStatus } from '@tuljai/types';
import Link from 'next/link';
import { use, useState } from 'react';

import { useAdminAuth } from '../../../../src/auth/AdminAuthProvider';
import {
  buildBookingTimeline,
  callOutcomes,
  escalationReasons,
  formatStatus,
  getBookingPriority,
  getOwnerResponseState,
  maskPhone,
  noteCategories,
} from '../../../../src/bookings/booking-operations';
import { PermissionGate } from '../../../../src/components/PermissionGate';
import { useAdminBookingDetail } from '../../../../src/hooks/useAdminBookingDetail';
import { hasPermission } from '../../../../src/permissions/permissions';

const acceptReasons = [
  'Owner confirmed by phone',
  'Admin verified availability',
  'Pilgrim confirmed arrival',
  'Emergency manual approval',
];

const rejectReasons = [
  'Lodge full',
  'Owner declined by phone',
  'Duplicate booking',
  'Invalid request',
  'Pilgrim cancelled by phone',
];

export default function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = use(params);
  const auth = useAdminAuth();
  const bookingDetail = useAdminBookingDetail(bookingId);
  const booking = bookingDetail.data;
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus>('ACCEPTED');
  const [reason, setReason] = useState('');
  const [callOutcome, setCallOutcome] = useState(callOutcomes[0] ?? 'Other');
  const [note, setNote] = useState('');
  const [noteCategory, setNoteCategory] = useState(noteCategories[0] ?? 'General');
  const [escalationReason, setEscalationReason] = useState(escalationReasons[0] ?? 'Other');
  const [escalationLevel, setEscalationLevel] = useState<'NORMAL' | 'HIGH' | 'CRITICAL'>('HIGH');
  const canManage = hasPermission(auth.permissions, 'bookings.manage');
  const canOverride = hasPermission(auth.permissions, 'bookings.override');
  const canSupport = hasPermission(auth.permissions, 'support.manage');
  const canSeeContact = canManage || canSupport || canOverride;

  if (bookingDetail.isLoading) {
    return (
      <PermissionGate permission="bookings.view">
        <section className="panel">
          <p className="eyebrow">Loading</p>
          <h2>Loading booking detail</h2>
        </section>
      </PermissionGate>
    );
  }

  if (!booking) {
    return (
      <PermissionGate permission="bookings.view">
        <section className="panel">
          <p className="eyebrow">Unavailable</p>
          <h2>Booking could not be opened</h2>
          <p>{bookingDetail.errorMessage ?? 'Please retry.'}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void bookingDetail.refresh()}
          >
            Retry
          </button>
        </section>
      </PermissionGate>
    );
  }

  const priority = getBookingPriority(booking);
  const ownerState = getOwnerResponseState(booking);
  const timeline = buildBookingTimeline(booking);

  return (
    <PermissionGate permission="bookings.view">
      <div className="page-stack">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Booking Detail</p>
            <h2>{booking.bookingCode}</h2>
            <p>
              {booking.guestName} / {booking.checkInDate} to{' '}
              {booking.checkoutDateFlexible ? 'checkout not fixed' : booking.checkOutDate}
            </p>
          </div>
          <div className="hero-actions">
            <span className={`priority priority-${priority.toLowerCase()}`}>{priority}</span>
            <span className="status-card">{formatStatus(booking.status)}</span>
            <Link className="button button-secondary" href="/admin/bookings">
              Back to bookings
            </Link>
          </div>
        </section>

        {bookingDetail.errorMessage ? (
          <section className="error-banner">{bookingDetail.errorMessage}</section>
        ) : null}
        {bookingDetail.successMessage ? (
          <section className="success-banner">
            {bookingDetail.successMessage}
            <button
              className="ghost-control"
              type="button"
              onClick={() => bookingDetail.setSuccessMessage(null)}
            >
              Dismiss
            </button>
          </section>
        ) : null}

        <section className="grid grid-2">
          <div className="panel">
            <p className="eyebrow">Booking Snapshot</p>
            <dl className="detail-list detail-list-wide">
              <Field label="Payment" value={formatStatus(booking.paymentStatus)} />
              <Field label="Lodge" value={booking.lodgeId} />
              <Field label="Room Type" value={booking.roomTypeId} />
              <Field label="Room Number" value={booking.roomId ?? 'Not assigned'} />
              <Field label="Guests" value={`${booking.totalGuests} total`} />
              <Field
                label="Adults / Children"
                value={`${booking.numberOfAdults} / ${booking.numberOfChildren}`}
              />
              <Field
                label="Special Request"
                value={booking.specialRequest ?? 'No special request'}
              />
              <Field label="Created" value={new Date(booking.createdAt).toLocaleString('en-IN')} />
              <Field label="Updated" value={new Date(booking.updatedAt).toLocaleString('en-IN')} />
            </dl>
          </div>

          <div className="panel">
            <p className="eyebrow">Guest Privacy</p>
            <dl className="detail-list detail-list-wide">
              <Field label="Guest" value={booking.guestName} />
              <Field
                label="Phone"
                value={
                  canSeeContact
                    ? (booking.guestPhone ?? 'Not provided')
                    : maskPhone(booking.guestPhone)
                }
              />
              <Field
                label="Alternate"
                value={
                  canSeeContact
                    ? (booking.alternatePhone ?? 'Not provided')
                    : maskPhone(booking.alternatePhone)
                }
              />
              <Field
                label="Address"
                value={
                  canSeeContact
                    ? (booking.guestAddress ?? 'Not provided')
                    : 'Hidden for read-only role'
                }
              />
              <Field
                label="QR Status"
                value={booking.status === 'QR_GENERATED' ? 'Generated' : 'Not active'}
              />
              <Field
                label="Check-in"
                value={
                  booking.checkedInAt
                    ? new Date(booking.checkedInAt).toLocaleString('en-IN')
                    : 'Not checked in'
                }
              />
              <Field
                label="Checkout"
                value={
                  booking.checkedOutAt
                    ? new Date(booking.checkedOutAt).toLocaleString('en-IN')
                    : 'Not checked out'
                }
              />
            </dl>
          </div>
        </section>

        <section className={ownerState.overdue ? 'panel warning-panel' : 'panel'}>
          <p className="eyebrow">Owner Response Timer</p>
          <h3>{ownerState.message}</h3>
          <p>
            Deadline:{' '}
            {booking.ownerResponseDeadline
              ? new Date(booking.ownerResponseDeadline).toLocaleString('en-IN')
              : 'No deadline recorded'}
          </p>
          {ownerState.overdue ? (
            <p className="text-danger">Owner response overdue. Admin action recommended.</p>
          ) : null}
        </section>

        <section className="grid grid-2">
          <CallCenterPanel
            canSupport={canSupport}
            callOutcome={callOutcome}
            guestPhone={booking.guestPhone}
            onOutcomeChange={setCallOutcome}
            ownerPhone={booking.alternatePhone ?? booking.guestPhone}
          />
          <ManualStatusPanel
            canManage={canManage}
            canOverride={canOverride}
            isSubmitting={bookingDetail.isSubmitting}
            reason={reason}
            selectedStatus={selectedStatus}
            onReasonChange={setReason}
            onSelectedStatusChange={setSelectedStatus}
            onSubmit={() => {
              const finalReason = reason || getDefaultReason(selectedStatus);
              void bookingDetail.updateStatus(selectedStatus, finalReason);
            }}
          />
        </section>

        <section className="grid grid-2">
          <NotesFoundation
            canSupport={canSupport}
            note={note}
            noteCategory={noteCategory}
            onNoteCategoryChange={setNoteCategory}
            onNoteChange={setNote}
          />
          <EscalationFoundation
            canManage={canManage}
            escalationLevel={escalationLevel}
            escalationReason={escalationReason}
            onEscalationLevelChange={setEscalationLevel}
            onEscalationReasonChange={setEscalationReason}
          />
        </section>

        <TransferFoundation />
        <OverrideControls canOverride={canOverride} />

        <section className="panel">
          <p className="eyebrow">Activity Timeline</p>
          <h3>Booking lifecycle</h3>
          <div className="timeline">
            {timeline.map((item) => (
              <article className="timeline-item" key={`${item.title}-${item.timestamp}`}>
                <span className="timeline-dot" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>{new Date(item.timestamp).toLocaleString('en-IN')}</small>
                </div>
              </article>
            ))}
          </div>
          <p className="muted-copy">
            Full audit feed, admin notes, call outcomes, notification events, and transfer history
            require future admin audit/note endpoints.
          </p>
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

function CallCenterPanel({
  callOutcome,
  canSupport,
  guestPhone,
  onOutcomeChange,
  ownerPhone,
}: {
  callOutcome: string;
  canSupport: boolean;
  guestPhone: string | null;
  onOutcomeChange: (value: string) => void;
  ownerPhone: string | null;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Call Center Foundation</p>
      <h3>Coordinate by phone</h3>
      <div className="quick-actions">
        <a className="button button-secondary" href={ownerPhone ? `tel:${ownerPhone}` : '#'}>
          Call Owner
        </a>
        <a className="button button-secondary" href={guestPhone ? `tel:${guestPhone}` : '#'}>
          Call Pilgrim
        </a>
        <button className="button button-secondary" disabled={!canSupport} type="button">
          Copy Owner Number
        </button>
        <button className="button button-secondary" disabled={!canSupport} type="button">
          Copy Pilgrim Number
        </button>
      </div>
      <label className="form-field">
        <span>Record call outcome</span>
        <select
          disabled={!canSupport}
          value={callOutcome}
          onChange={(event) => onOutcomeChange(event.target.value)}
        >
          {callOutcomes.map((outcome) => (
            <option key={outcome}>{outcome}</option>
          ))}
        </select>
      </label>
      <p className="muted-copy">
        Call outcome persistence requires `POST /api/admin/bookings/:id/notes`.
      </p>
    </section>
  );
}

function ManualStatusPanel({
  canManage,
  canOverride,
  isSubmitting,
  onReasonChange,
  onSelectedStatusChange,
  onSubmit,
  reason,
  selectedStatus,
}: {
  canManage: boolean;
  canOverride: boolean;
  isSubmitting: boolean;
  onReasonChange: (value: string) => void;
  onSelectedStatusChange: (value: BookingStatus) => void;
  onSubmit: () => void;
  reason: string;
  selectedStatus: BookingStatus;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Manual Accept / Reject</p>
      <h3>Audit-safe status update</h3>
      <label className="form-field">
        <span>Status</span>
        <select
          disabled={!canManage}
          value={selectedStatus}
          onChange={(event) => onSelectedStatusChange(event.target.value as BookingStatus)}
        >
          <option value="ACCEPTED">Accept booking manually</option>
          <option value="REJECTED">Reject booking manually</option>
          <option value="EXPIRED" disabled={!canOverride}>
            Mark expired
          </option>
          <option value="CANCELLED" disabled={!canOverride}>
            Mark cancelled
          </option>
          <option value="NO_SHOW" disabled={!canOverride}>
            Mark no-show
          </option>
        </select>
      </label>
      <label className="form-field">
        <span>Reason required</span>
        <textarea
          disabled={!canManage}
          placeholder={
            selectedStatus === 'ACCEPTED' ? acceptReasons.join(', ') : rejectReasons.join(', ')
          }
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </label>
      <button
        className="button button-primary"
        disabled={!canManage || !reason.trim() || isSubmitting}
        type="button"
        onClick={() => {
          if (window.confirm('Confirm manual booking status update?')) {
            onSubmit();
          }
        }}
      >
        Confirm Manual Update
      </button>
      <p className="muted-copy">
        Backend validation is not bypassed. Every accepted update creates booking history and audit
        logs.
      </p>
    </section>
  );
}

function NotesFoundation({
  canSupport,
  note,
  noteCategory,
  onNoteCategoryChange,
  onNoteChange,
}: {
  canSupport: boolean;
  note: string;
  noteCategory: string;
  onNoteCategoryChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}) {
  return (
    <section className="panel" id="notes">
      <p className="eyebrow">Internal Notes</p>
      <h3>Private admin-only note foundation</h3>
      <div className="control-grid">
        <label>
          <span>Category</span>
          <select
            disabled={!canSupport}
            value={noteCategory}
            onChange={(event) => onNoteCategoryChange(event.target.value)}
          >
            {noteCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Visibility</span>
          <select disabled={!canSupport}>
            <option>Admin only</option>
            <option>Support only</option>
            <option>Operations only</option>
          </select>
        </label>
      </div>
      <label className="form-field">
        <span>Note</span>
        <textarea
          disabled={!canSupport}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </label>
      <button className="button button-secondary" disabled type="button">
        Save Note - Backend support required
      </button>
      <p className="muted-copy">Required API: `POST /api/admin/bookings/:id/notes`.</p>
    </section>
  );
}

function EscalationFoundation({
  canManage,
  escalationLevel,
  escalationReason,
  onEscalationLevelChange,
  onEscalationReasonChange,
}: {
  canManage: boolean;
  escalationLevel: 'NORMAL' | 'HIGH' | 'CRITICAL';
  escalationReason: string;
  onEscalationLevelChange: (value: 'NORMAL' | 'HIGH' | 'CRITICAL') => void;
  onEscalationReasonChange: (value: string) => void;
}) {
  return (
    <section className="panel" id="escalation">
      <p className="eyebrow">Escalation Workflow</p>
      <h3>Assign and escalate foundation</h3>
      <div className="control-grid">
        <label>
          <span>Reason</span>
          <select
            disabled={!canManage}
            value={escalationReason}
            onChange={(event) => onEscalationReasonChange(event.target.value)}
          >
            {escalationReasons.map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Level</span>
          <select
            disabled={!canManage}
            value={escalationLevel}
            onChange={(event) =>
              onEscalationLevelChange(event.target.value as 'NORMAL' | 'HIGH' | 'CRITICAL')
            }
          >
            <option>NORMAL</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </label>
      </div>
      <button className="button button-secondary" disabled type="button">
        Mark Escalated - Backend support required
      </button>
      <p className="muted-copy">
        Required APIs: `POST /api/admin/bookings/:id/escalate` and `PATCH
        /api/admin/bookings/:id/escalation`.
      </p>
    </section>
  );
}

function TransferFoundation() {
  return (
    <section className="panel">
      <p className="eyebrow">Transfer / Reassignment Foundation</p>
      <h3>Recommended alternatives</h3>
      <div className="roadmap-grid">
        {[
          'Nearest lodge',
          'Lowest price',
          'Highest rating',
          'Bhakt Niwas',
          'Budget option',
          'Same capacity',
        ].map((item) => (
          <article className="roadmap-card" key={item}>
            <h4>{item}</h4>
            <p>Transfer recommendation requires availability and transfer-options backend APIs.</p>
          </article>
        ))}
      </div>
      <p className="muted-copy">
        Required APIs: `GET /api/admin/bookings/:id/transfer-options` and `POST
        /api/admin/bookings/:id/transfer`.
      </p>
    </section>
  );
}

function OverrideControls({ canOverride }: { canOverride: boolean }) {
  const controls = [
    'Force accept',
    'Force reject',
    'Mark expired',
    'Mark cancelled',
    'Reassign lodge',
    'Change room',
    'Regenerate QR',
    'Mark no-show',
  ];

  return (
    <section className="panel warning-panel">
      <p className="eyebrow">Admin Override Controls</p>
      <h3>Restricted controls</h3>
      <div className="quick-actions">
        {controls.map((control) => (
          <button
            className="button button-secondary"
            disabled={!canOverride}
            key={control}
            type="button"
          >
            {canOverride
              ? `${control} - Backend support required`
              : `${control} - Permission required`}
          </button>
        ))}
      </div>
      <p className="muted-copy">
        Every future override must require reason, confirmation, and audit log.
      </p>
    </section>
  );
}

function getDefaultReason(status: BookingStatus): string {
  if (status === 'ACCEPTED') {
    return acceptReasons[0] ?? 'Admin verified availability';
  }

  if (status === 'REJECTED') {
    return rejectReasons[0] ?? 'Admin rejected booking manually';
  }

  return 'Admin manual status update';
}
