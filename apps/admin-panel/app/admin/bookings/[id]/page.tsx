'use client';

import type { BookingStatus } from '@tuljai/types';
import Link from 'next/link';
import { use, useState, type ReactNode } from 'react';

import { apiClient } from '../../../../src/api/client';
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
import {
  bookingPriorityTone,
  bookingStatusTone,
  paymentStatusTone,
} from '../../../../src/components/bookings/booking-tone';
import { BookingViewsStyles } from '../../../../src/components/bookings/BookingViewsStyles';
import { FinanceStyles } from '../../../../src/components/finance/FinanceStyles';
import { FinHeader, FinKv, FinPanel, FinPill } from '../../../../src/components/finance/FinanceUi';
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
  const [isOpeningProof, setIsOpeningProof] = useState(false);
  const canManage = hasPermission(auth.permissions, 'bookings.manage');
  const canOverride = hasPermission(auth.permissions, 'bookings.override');
  const canSupport = hasPermission(auth.permissions, 'support.manage');
  const canSeeContact = canManage || canSupport || canOverride;

  if (bookingDetail.isLoading) {
    return (
      <PermissionGate permission="bookings.view">
        <div className="fin-stack">
          <FinanceStyles />
          <FinHeader description="Fetching the latest booking record." eyebrow="Loading" title="Loading booking detail" />
          <div aria-label="Loading" className="fin-skeleton" />
        </div>
      </PermissionGate>
    );
  }

  if (!booking) {
    return (
      <PermissionGate permission="bookings.view">
        <div className="fin-stack">
          <FinanceStyles />
          <FinHeader
            actions={
              <button className="fin-btn" onClick={() => void bookingDetail.refresh()} type="button">
                Retry
              </button>
            }
            description={bookingDetail.errorMessage ?? 'Please retry.'}
            eyebrow="Unavailable"
            title="Booking could not be opened"
          />
        </div>
      </PermissionGate>
    );
  }

  const priority = getBookingPriority(booking);
  const ownerState = getOwnerResponseState(booking);
  const timeline = buildBookingTimeline(booking);
  const primaryGuest = booking.guests.find((guest) => guest.isPrimaryGuest) ?? booking.guests[0];
  const canOpenProof = canSeeContact && Boolean(primaryGuest?.idProofOriginalName);
  const currentBookingId = booking.id;

  async function openIdProof() {
    const proofWindow = window.open('about:blank', '_blank');
    if (!proofWindow) {
      window.alert('Please allow pop-ups to open the ID proof.');
      return;
    }

    proofWindow.opener = null;
    proofWindow.document.title = 'Opening ID proof...';
    setIsOpeningProof(true);
    try {
      const blob = await apiClient.request<Blob>(
        `/admin/bookings/${currentBookingId}/guest-id-proof`,
        {
          method: 'GET',
          responseType: 'blob',
        },
      );
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('The ID proof is empty');
      }

      const objectUrl = URL.createObjectURL(blob);
      proofWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      proofWindow.close();
      window.alert('ID proof could not be opened. Please retry.');
    } finally {
      setIsOpeningProof(false);
    }
  }

  const snapshotRows: Array<{ label: string; value: ReactNode }> = [
    { label: 'Payment', value: <FinPill tone={paymentStatusTone(booking.paymentStatus)}>{formatStatus(booking.paymentStatus)}</FinPill> },
    { label: 'Lodge', value: booking.lodgeName },
    { label: 'Room Type', value: booking.roomTypeName },
    { label: 'Room Number', value: booking.roomNumber ?? 'Not assigned' },
    { label: 'Guests', value: `${booking.totalGuests} total` },
    { label: 'Adults / Children', value: `${booking.numberOfAdults} / ${booking.numberOfChildren}` },
    { label: 'Special Request', value: booking.specialRequest ?? 'No special request' },
    { label: 'Created', value: new Date(booking.createdAt).toLocaleString('en-IN') },
    { label: 'Updated', value: new Date(booking.updatedAt).toLocaleString('en-IN') },
  ];

  const guestRows: Array<{ label: string; value: ReactNode }> = [
    { label: 'Guest', value: booking.guestName },
    {
      label: 'Phone',
      value: canSeeContact ? (booking.guestPhone ?? 'Not provided') : maskPhone(booking.guestPhone),
    },
    {
      label: 'Alternate',
      value: canSeeContact ? (booking.alternatePhone ?? 'Not provided') : maskPhone(booking.alternatePhone),
    },
    {
      label: 'Address',
      value: canSeeContact ? (booking.guestAddress ?? 'Not provided') : 'Hidden for read-only role',
    },
    {
      label: 'ID Proof',
      value: canSeeContact ? formatGuestIdProof(primaryGuest) : 'Hidden for read-only role',
    },
  ];
  if (canOpenProof) {
    guestRows.push({
      label: 'ID Proof File',
      value: (
        <button
          className="fin-btn fin-btn-sm fin-btn-soft"
          disabled={isOpeningProof}
          onClick={() => void openIdProof()}
          type="button"
        >
          {isOpeningProof ? 'Opening...' : 'Open uploaded proof'}
        </button>
      ),
    });
  }
  guestRows.push(
    { label: 'QR Status', value: booking.status === 'QR_GENERATED' ? 'Generated' : 'Not active' },
    {
      label: 'Check-in',
      value: booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleString('en-IN') : 'Not checked in',
    },
    {
      label: 'Checkout',
      value: booking.checkedOutAt ? new Date(booking.checkedOutAt).toLocaleString('en-IN') : 'Not checked out',
    },
  );

  return (
    <PermissionGate permission="bookings.view">
      <div className="fin-stack">
        <FinanceStyles />
        <BookingViewsStyles />
        <FinHeader
          actions={
            <>
              <FinPill tone={bookingPriorityTone(priority)}>{priority}</FinPill>
              <FinPill tone={bookingStatusTone(booking.status)}>{formatStatus(booking.status)}</FinPill>
              <Link className="fin-btn fin-btn-outline" href="/admin/bookings">
                Back to bookings
              </Link>
            </>
          }
          description={`${booking.guestName} / ${booking.checkInDate} to ${booking.checkoutDateFlexible ? 'checkout not fixed' : booking.checkOutDate}`}
          eyebrow="Booking Detail"
          title={booking.bookingCode}
        />

        {bookingDetail.errorMessage ? (
          <p className="error-banner" role="alert">{bookingDetail.errorMessage}</p>
        ) : null}
        {bookingDetail.successMessage ? (
          <p className="success-banner bk-banner-row" role="status">
            <span>{bookingDetail.successMessage}</span>
            <button
              className="fin-btn fin-btn-sm fin-btn-outline"
              onClick={() => bookingDetail.setSuccessMessage(null)}
              type="button"
            >
              Dismiss
            </button>
          </p>
        ) : null}

        <section className="fin-split">
          <FinPanel sub="Stay and payment" title="Booking snapshot">
            <FinKv rows={snapshotRows} />
          </FinPanel>
          <FinPanel sub="Contact details follow your role" title="Guest privacy">
            <FinKv rows={guestRows} />
          </FinPanel>
        </section>

        <div className={ownerState.overdue ? 'bk-warn' : undefined}>
          <FinPanel sub="Owner response timer" title="Owner response">
            <p className="bk-lead">{ownerState.message}</p>
            <FinKv
              rows={[
                {
                  label: 'Deadline',
                  value: booking.ownerResponseDeadline
                    ? new Date(booking.ownerResponseDeadline).toLocaleString('en-IN')
                    : 'No deadline recorded',
                },
              ]}
            />
            {ownerState.overdue ? (
              <p className="fin-field-error bk-foot">Owner response overdue. Admin action recommended.</p>
            ) : null}
          </FinPanel>
        </div>

        <section className="fin-split">
          <CallCenterPanel
            callOutcome={callOutcome}
            canSupport={canSupport}
            guestPhone={booking.guestPhone}
            onOutcomeChange={setCallOutcome}
            ownerPhone={booking.alternatePhone ?? booking.guestPhone}
          />
          <ManualStatusPanel
            canManage={canManage}
            canOverride={canOverride}
            isSubmitting={bookingDetail.isSubmitting}
            onReasonChange={setReason}
            onSelectedStatusChange={setSelectedStatus}
            onSubmit={() => {
              const finalReason = reason || getDefaultReason(selectedStatus);
              void bookingDetail.updateStatus(selectedStatus, finalReason);
            }}
            reason={reason}
            selectedStatus={selectedStatus}
          />
        </section>

        <section className="fin-split">
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

        <FinPanel sub="Booking lifecycle" title="Activity timeline">
          <div className="bk-timeline">
            {timeline.map((item) => (
              <article className="bk-tl-item" key={`${item.title}-${item.timestamp}`}>
                <span className="bk-tl-dot" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>{new Date(item.timestamp).toLocaleString('en-IN')}</small>
                </div>
              </article>
            ))}
          </div>
          <p className="fin-text bk-foot">
            Full audit feed, admin notes, call outcomes, notification events, and transfer history
            require future admin audit/note endpoints.
          </p>
        </FinPanel>
      </div>
    </PermissionGate>
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
    <FinPanel sub="Call Center Foundation" title="Coordinate by phone">
      <div className="fin-actions" style={{ marginTop: 0 }}>
        <a className="fin-btn fin-btn-soft" href={ownerPhone ? `tel:${ownerPhone}` : '#'}>
          Call Owner
        </a>
        <a className="fin-btn fin-btn-soft" href={guestPhone ? `tel:${guestPhone}` : '#'}>
          Call Pilgrim
        </a>
        <button className="fin-btn fin-btn-outline" disabled={!canSupport} type="button">
          Copy Owner Number
        </button>
        <button className="fin-btn fin-btn-outline" disabled={!canSupport} type="button">
          Copy Pilgrim Number
        </button>
      </div>
      <div className="fin-form" style={{ marginTop: 16 }}>
        <label className="fin-field fin-field-wide">
          <span>Record call outcome</span>
          <select
            disabled={!canSupport}
            onChange={(event) => onOutcomeChange(event.target.value)}
            value={callOutcome}
          >
            {callOutcomes.map((outcome) => (
              <option key={outcome}>{outcome}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="fin-text bk-foot">
        Call outcome persistence requires `POST /api/admin/bookings/:id/notes`.
      </p>
    </FinPanel>
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
    <FinPanel sub="Manual Accept / Reject" title="Audit-safe status update">
      <div className="fin-form">
        <label className="fin-field fin-field-wide">
          <span>Status</span>
          <select
            disabled={!canManage}
            onChange={(event) => onSelectedStatusChange(event.target.value as BookingStatus)}
            value={selectedStatus}
          >
            <option value="ACCEPTED">Accept booking manually</option>
            <option value="REJECTED">Reject booking manually</option>
            <option disabled={!canOverride} value="EXPIRED">
              Mark expired
            </option>
            <option disabled={!canOverride} value="CANCELLED">
              Mark cancelled
            </option>
            <option disabled={!canOverride} value="NO_SHOW">
              Mark no-show
            </option>
          </select>
        </label>
        <label className="fin-field fin-field-wide">
          <span>Reason required</span>
          <textarea
            disabled={!canManage}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder={
              selectedStatus === 'ACCEPTED' ? acceptReasons.join(', ') : rejectReasons.join(', ')
            }
            rows={3}
            value={reason}
          />
        </label>
      </div>
      <div className="fin-actions fin-actions-end">
        <button
          className="fin-btn"
          disabled={!canManage || !reason.trim() || isSubmitting}
          onClick={() => {
            if (window.confirm('Confirm manual booking status update?')) {
              onSubmit();
            }
          }}
          type="button"
        >
          {isSubmitting ? 'Updating…' : 'Confirm Manual Update'}
        </button>
      </div>
      <p className="fin-text bk-foot">
        Backend validation is not bypassed. Every accepted update creates booking history and audit
        logs.
      </p>
    </FinPanel>
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
    <div className="bk-anchor" id="notes">
      <FinPanel sub="Internal Notes" title="Private admin-only notes">
        <div className="fin-form">
          <label className="fin-field">
            <span>Category</span>
            <select
              disabled={!canSupport}
              onChange={(event) => onNoteCategoryChange(event.target.value)}
              value={noteCategory}
            >
              {noteCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="fin-field">
            <span>Visibility</span>
            <select disabled={!canSupport}>
              <option>Admin only</option>
              <option>Support only</option>
              <option>Operations only</option>
            </select>
          </label>
          <label className="fin-field fin-field-wide">
            <span>Note</span>
            <textarea
              disabled={!canSupport}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={3}
              value={note}
            />
          </label>
        </div>
        <div className="fin-actions fin-actions-end">
          <button className="fin-btn fin-btn-outline" disabled type="button">
            Save Note - Backend support required
          </button>
        </div>
        <p className="fin-text bk-foot">Required API: `POST /api/admin/bookings/:id/notes`.</p>
      </FinPanel>
    </div>
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
    <div className="bk-anchor" id="escalation">
      <FinPanel sub="Escalation Workflow" title="Assign and escalate">
        <div className="fin-form">
          <label className="fin-field">
            <span>Reason</span>
            <select
              disabled={!canManage}
              onChange={(event) => onEscalationReasonChange(event.target.value)}
              value={escalationReason}
            >
              {escalationReasons.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <label className="fin-field">
            <span>Level</span>
            <select
              disabled={!canManage}
              onChange={(event) =>
                onEscalationLevelChange(event.target.value as 'NORMAL' | 'HIGH' | 'CRITICAL')
              }
              value={escalationLevel}
            >
              <option>NORMAL</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
          </label>
        </div>
        <div className="fin-actions fin-actions-end">
          <button className="fin-btn fin-btn-violet" disabled type="button">
            Mark Escalated - Backend support required
          </button>
        </div>
        <p className="fin-text bk-foot">
          Required APIs: `POST /api/admin/bookings/:id/escalate` and `PATCH
          /api/admin/bookings/:id/escalation`.
        </p>
      </FinPanel>
    </div>
  );
}

function TransferFoundation() {
  return (
    <FinPanel sub="Transfer / Reassignment Foundation" title="Recommended alternatives">
      <div className="bk-cards">
        {[
          'Nearest lodge',
          'Lowest price',
          'Highest rating',
          'Bhakt Niwas',
          'Budget option',
          'Same capacity',
        ].map((item) => (
          <article className="bk-card" key={item}>
            <h4>{item}</h4>
            <p>Transfer recommendation requires availability and transfer-options backend APIs.</p>
          </article>
        ))}
      </div>
      <p className="fin-text bk-foot">
        Required APIs: `GET /api/admin/bookings/:id/transfer-options` and `POST
        /api/admin/bookings/:id/transfer`.
      </p>
    </FinPanel>
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
    <div className="bk-warn">
      <FinPanel sub="Admin Override Controls" title="Restricted controls">
        <div className="fin-actions" style={{ marginTop: 0 }}>
          {controls.map((control) => (
            <button
              className="fin-btn fin-btn-outline"
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
        <p className="fin-text bk-foot">
          Every future override must require reason, confirmation, and audit log.
        </p>
      </FinPanel>
    </div>
  );
}

function formatGuestIdProof(
  guest:
    | {
        idProofMimeType: string | null;
        idProofOriginalName: string | null;
        idProofSizeBytes: number | null;
      }
    | undefined,
): string {
  if (!guest?.idProofOriginalName) {
    return 'Not uploaded';
  }

  const parts = [
    guest.idProofOriginalName,
    guest.idProofMimeType,
    guest.idProofSizeBytes ? formatFileSize(guest.idProofSizeBytes) : null,
  ].filter(Boolean);

  return parts.join(' / ');
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
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
