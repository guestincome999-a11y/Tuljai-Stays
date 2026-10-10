'use client';

import type { AdminBookingSummary, BookingGuest, BookingStatus } from '@tuljai/types';
import Link from 'next/link';
import { use, useState, type ReactNode } from 'react';

import { apiClient } from '../../../../src/api/client';
import { useAdminAuth } from '../../../../src/auth/AdminAuthProvider';
import {
  buildBookingTimeline,
  formatStatus,
  getBookingPriority,
  getOwnerResponseState,
  maskPhone,
} from '../../../../src/bookings/booking-operations';
import {
  bookingPriorityTone,
  bookingStatusTone,
  paymentStatusTone,
} from '../../../../src/components/bookings/booking-tone';
import { BookingViewsStyles } from '../../../../src/components/bookings/BookingViewsStyles';
import { formatDate } from '../../../../src/components/dashboard/format';
import { FinanceStyles } from '../../../../src/components/finance/FinanceStyles';
import {
  FinHeader,
  FinKpi,
  FinKv,
  FinPanel,
  FinPill,
  formatMoney,
} from '../../../../src/components/finance/FinanceUi';
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

const statusChoices: Array<{ label: string; needsOverride: boolean; value: BookingStatus }> = [
  { label: 'Accept', needsOverride: false, value: 'ACCEPTED' },
  { label: 'Reject', needsOverride: false, value: 'REJECTED' },
  { label: 'Mark expired', needsOverride: true, value: 'EXPIRED' },
  { label: 'Mark cancelled', needsOverride: true, value: 'CANCELLED' },
  { label: 'Mark no-show', needsOverride: true, value: 'NO_SHOW' },
];

const upcomingTools = [
  { id: 'notes', text: 'Private admin-only notes and call outcomes for this booking.', title: 'Internal notes' },
  { id: 'escalation', text: 'Assign this booking to operations and track its escalation level.', title: 'Escalation' },
  { id: 'transfer', text: 'Move the guest to another lodge or room type with suggested alternatives.', title: 'Transfer booking' },
  { id: 'override', text: 'Force accept or reject, reassign the lodge, change the room, regenerate the QR.', title: 'Admin overrides' },
];

export default function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = use(params);
  const auth = useAdminAuth();
  const detail = useAdminBookingDetail(bookingId);
  const booking = detail.data;
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus>('ACCEPTED');
  const [reason, setReason] = useState('');
  const [isOpeningProof, setIsOpeningProof] = useState(false);
  const canManage = hasPermission(auth.permissions, 'bookings.manage');
  const canOverride = hasPermission(auth.permissions, 'bookings.override');
  const canSupport = hasPermission(auth.permissions, 'support.manage');
  const canSeeContact = canManage || canSupport || canOverride;

  if (detail.isLoading) {
    return (
      <PermissionGate permission="bookings.view">
        <div className="fin-stack">
          <FinanceStyles />
          <FinHeader description="Fetching the latest booking record." eyebrow="Booking Detail" title="Loading booking" />
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
              <>
                <button className="fin-btn" onClick={() => void detail.refresh()} type="button">
                  Retry
                </button>
                <Link className="fin-btn fin-btn-outline" href="/admin/bookings">
                  Back to bookings
                </Link>
              </>
            }
            description={detail.errorMessage ?? 'Please try again.'}
            eyebrow="Booking Detail"
            title="Booking could not be opened"
          />
        </div>
      </PermissionGate>
    );
  }

  const primaryGuest = booking.guests.find((guest) => guest.isPrimaryGuest) ?? booking.guests[0];
  const priority = getBookingPriority(booking);
  const canOpenProof = canSeeContact && Boolean(primaryGuest?.idProofOriginalName);
  const bookingIdForProof = booking.id;

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
      const blob = await apiClient.request<Blob>(`/admin/bookings/${bookingIdForProof}/guest-id-proof`, {
        method: 'GET',
        responseType: 'blob',
      });
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

  return (
    <PermissionGate permission="bookings.view">
      <div className="fin-stack">
        <FinanceStyles />
        <BookingViewsStyles />

        <FinHeader
          actions={
            <>
              <FinPill tone={bookingStatusTone(booking.status)}>{formatStatus(booking.status)}</FinPill>
              <FinPill tone={bookingPriorityTone(priority)}>{formatStatus(priority)} priority</FinPill>
              <Link className="fin-btn fin-btn-outline" href="/admin/bookings">
                Back to bookings
              </Link>
            </>
          }
          description={`${booking.guestName} · ${booking.lodgeName} · ${booking.roomTypeName}`}
          eyebrow="Booking Detail"
          title={booking.bookingCode}
        />

        {detail.errorMessage ? (
          <p className="error-banner" role="alert">
            {detail.errorMessage}
          </p>
        ) : null}
        {detail.successMessage ? (
          <p className="success-banner bk-banner-row" role="status">
            <span>{detail.successMessage}</span>
            <button
              className="fin-btn fin-btn-sm fin-btn-outline"
              onClick={() => detail.setSuccessMessage(null)}
              type="button"
            >
              Dismiss
            </button>
          </p>
        ) : null}

        <SummaryCards booking={booking} />

        <div className="bk-layout">
          <div className="bk-col">
            <StayPanel booking={booking} />
            <GuestsPanel
              booking={booking}
              canOpenProof={canOpenProof}
              canSeeContact={canSeeContact}
              isOpeningProof={isOpeningProof}
              onOpenProof={() => void openIdProof()}
              primaryGuest={primaryGuest}
            />
            <PaymentPanel booking={booking} />
            <TimelinePanel booking={booking} />
          </div>

          <div className="bk-col">
            <OwnerResponsePanel booking={booking} />
            <StatusPanel
              canManage={canManage}
              canOverride={canOverride}
              isSubmitting={detail.isSubmitting}
              onReasonChange={setReason}
              onStatusChange={(status) => {
                setSelectedStatus(status);
                setReason('');
              }}
              onSubmit={() => void detail.updateStatus(selectedStatus, reason.trim())}
              reason={reason}
              selectedStatus={selectedStatus}
            />
            <ContactPanel booking={booking} canSeeContact={canSeeContact} />
            <ToolsPanel />
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}

/* ------------------------------------------------------------- summary */

function SummaryCards({ booking }: { booking: AdminBookingSummary }) {
  const nights = countNights(booking);
  return (
    <section className="fin-kpis">
      <FinKpi
        icon="money"
        label="Total amount"
        meta={<>Payment {formatStatus(booking.paymentStatus).toLowerCase()}</>}
        tone="blue"
        value={formatAmount(booking.totalAmount)}
      />
      <FinKpi
        icon="receipt"
        label="Balance at lodge"
        meta={booking.advanceAmount ? <>Advance {formatAmount(booking.advanceAmount)}</> : <>No advance recorded</>}
        tone="orange"
        value={formatAmount(booking.balanceAmount)}
      />
      <FinKpi
        icon="calendar"
        label="Stay"
        meta={
          booking.checkoutDateFlexible
            ? <>{formatDate(booking.checkInDate)} · checkout not fixed</>
            : <>{formatDate(booking.checkInDate)} to {formatDate(booking.checkOutDate)}</>
        }
        tone="purple"
        value={nights}
      />
      <FinKpi
        icon="lodge"
        label="Guests"
        meta={<>{booking.numberOfAdults} adults · {booking.numberOfChildren} children</>}
        tone="green"
        value={booking.totalGuests}
      />
    </section>
  );
}

/* ---------------------------------------------------------------- main */

function StayPanel({ booking }: { booking: AdminBookingSummary }) {
  return (
    <FinPanel sub="Where and when" title="Stay details">
      <FinKv
        rows={[
          { label: 'Lodge', value: booking.lodgeName },
          { label: 'City', value: booking.cityName },
          { label: 'Room type', value: booking.roomTypeName },
          { label: 'Room number', value: booking.roomNumber ?? 'Not assigned yet' },
          { label: 'Check-in', value: withTime(formatDate(booking.checkInDate), booking.expectedCheckInTime) },
          {
            label: 'Check-out',
            value: booking.checkoutDateFlexible
              ? 'Not fixed'
              : withTime(formatDate(booking.checkOutDate), booking.expectedCheckOutTime),
          },
          { label: 'Checked in at', value: formatDateTime(booking.checkedInAt) },
          { label: 'Checked out at', value: formatDateTime(booking.checkedOutAt) },
          { label: 'QR code', value: booking.status === 'QR_GENERATED' ? 'Generated' : 'Not active' },
          { label: 'Special request', value: booking.specialRequest ?? 'None' },
        ]}
        twoColumns
      />
    </FinPanel>
  );
}

function GuestsPanel({
  booking,
  canOpenProof,
  canSeeContact,
  isOpeningProof,
  onOpenProof,
  primaryGuest,
}: {
  booking: AdminBookingSummary;
  canOpenProof: boolean;
  canSeeContact: boolean;
  isOpeningProof: boolean;
  onOpenProof: () => void;
  primaryGuest: BookingGuest | undefined;
}) {
  return (
    <FinPanel
      action={
        canOpenProof ? (
          <button className="fin-btn fin-btn-sm fin-btn-soft" disabled={isOpeningProof} onClick={onOpenProof} type="button">
            {isOpeningProof ? 'Opening…' : 'View ID proof'}
          </button>
        ) : undefined
      }
      sub={`${booking.guests.length} ${booking.guests.length === 1 ? 'guest' : 'guests'} registered`}
      title="Guests"
    >
      <FinKv
        rows={[
          { label: 'Lead guest', value: booking.guestName },
          { label: 'Email', value: canSeeContact ? (booking.guestEmail ?? 'Not provided') : 'Hidden for your role' },
          { label: 'Address', value: canSeeContact ? (booking.guestAddress ?? 'Not provided') : 'Hidden for your role' },
          { label: 'ID proof file', value: canSeeContact ? describeIdProof(primaryGuest) : 'Hidden for your role' },
        ]}
      />
      {booking.guests.length > 0 ? (
        <div className="fin-scroll bk-label-gap">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Age / Gender</th>
                <th>ID</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {booking.guests.map((guest) => (
                <tr key={guest.id}>
                  <td>
                    {guest.fullName}
                    {guest.isPrimaryGuest ? (
                      <span className="fin-cell-sub">Lead guest</span>
                    ) : null}
                  </td>
                  <td>{[guest.age, guest.gender ? formatStatus(guest.gender) : null].filter(Boolean).join(' · ') || '—'}</td>
                  <td>
                    {guest.idType ? formatStatus(guest.idType) : '—'}
                    <span className="fin-cell-sub">{canSeeContact ? (guest.idNumber ?? '—') : 'Hidden'}</span>
                  </td>
                  <td>{canSeeContact ? (guest.phone ?? '—') : maskPhone(guest.phone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </FinPanel>
  );
}

function PaymentPanel({ booking }: { booking: AdminBookingSummary }) {
  return (
    <FinPanel sub="Amounts for this booking" title="Payment">
      <FinKv
        rows={[
          {
            label: 'Payment status',
            value: (
              <FinPill tone={paymentStatusTone(booking.paymentStatus)}>{formatStatus(booking.paymentStatus)}</FinPill>
            ),
          },
          { label: 'Total amount', value: formatAmount(booking.totalAmount) },
          { label: 'Advance paid', value: formatAmount(booking.advanceAmount) },
          { label: 'Balance at lodge', value: formatAmount(booking.balanceAmount) },
        ]}
      />
    </FinPanel>
  );
}

function TimelinePanel({ booking }: { booking: AdminBookingSummary }) {
  const timeline = buildBookingTimeline(booking);
  return (
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
    </FinPanel>
  );
}

/* ------------------------------------------------------------- sidebar */

function OwnerResponsePanel({ booking }: { booking: AdminBookingSummary }) {
  const state = getOwnerResponseState(booking);
  const pending = booking.status === 'PENDING_OWNER_APPROVAL';
  let stateValue: ReactNode = <FinPill tone="green">Responded</FinPill>;
  if (pending) {
    stateValue = <FinPill tone={state.overdue ? 'red' : 'orange'}>{state.overdue ? 'Overdue' : 'Awaiting owner'}</FinPill>;
  } else if (booking.status === 'EXPIRED') {
    stateValue = <FinPill tone="red">No response</FinPill>;
  }

  return (
    <FinPanel sub="Owner approval timer" title="Owner response">
      <FinKv
        rows={[
          { label: 'State', value: stateValue },
          ...(pending ? [{ label: 'Timer', value: state.message }] : []),
          { label: 'Deadline', value: formatDateTime(booking.ownerResponseDeadline, 'No deadline recorded') },
          { label: 'Booked on', value: formatDateTime(booking.createdAt) },
        ]}
      />
    </FinPanel>
  );
}

function StatusPanel({
  canManage,
  canOverride,
  isSubmitting,
  onReasonChange,
  onStatusChange,
  onSubmit,
  reason,
  selectedStatus,
}: {
  canManage: boolean;
  canOverride: boolean;
  isSubmitting: boolean;
  onReasonChange: (value: string) => void;
  onStatusChange: (value: BookingStatus) => void;
  onSubmit: () => void;
  reason: string;
  selectedStatus: BookingStatus;
}) {
  const choice = statusChoices.find((item) => item.value === selectedStatus);
  const quickReasons =
    selectedStatus === 'ACCEPTED' ? acceptReasons : selectedStatus === 'REJECTED' ? rejectReasons : [];
  const allowed = canManage && (!choice?.needsOverride || canOverride);
  const destructive = selectedStatus !== 'ACCEPTED';

  return (
    <FinPanel sub="Recorded in the audit trail" title="Update status">
      <div aria-label="New status" className="fin-chip-row" role="group">
        {statusChoices.map((item) => (
          <button
            aria-pressed={selectedStatus === item.value}
            className={selectedStatus === item.value ? 'fin-filter fin-filter-active' : 'fin-filter'}
            disabled={!canManage || (item.needsOverride && !canOverride)}
            key={item.value}
            onClick={() => onStatusChange(item.value)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {quickReasons.length > 0 ? (
        <>
          <span className="bk-label">Quick reasons</span>
          <div className="fin-chip-row">
            {quickReasons.map((item) => (
              <button
                className={reason === item ? 'fin-filter fin-filter-active' : 'fin-filter'}
                disabled={!canManage}
                key={item}
                onClick={() => onReasonChange(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="fin-form bk-label-gap">
        <label className="fin-field fin-field-wide">
          <span>Reason (required)</span>
          <textarea
            disabled={!canManage}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Why is this status being changed?"
            rows={3}
            value={reason}
          />
        </label>
      </div>
      <div className="fin-actions fin-actions-end">
        <button
          className={destructive ? 'fin-btn fin-btn-danger' : 'fin-btn'}
          disabled={!allowed || !reason.trim() || isSubmitting}
          onClick={() => {
            if (window.confirm(`Confirm: ${choice?.label.toLowerCase() ?? 'update status'}?`)) {
              onSubmit();
            }
          }}
          type="button"
        >
          {isSubmitting ? 'Updating…' : `Confirm · ${choice?.label ?? 'Update'}`}
        </button>
      </div>
      <p className="fin-text bk-foot">
        {canManage
          ? 'Backend validation still applies. Every update creates booking history and an audit log entry.'
          : 'You have view-only access to this booking.'}
      </p>
    </FinPanel>
  );
}

function ContactPanel({ booking, canSeeContact }: { booking: AdminBookingSummary; canSeeContact: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  const contacts = [
    { label: 'Guest phone', value: booking.guestPhone },
    { label: 'Alternate phone', value: booking.alternatePhone },
  ].filter((item) => item.value);

  return (
    <FinPanel sub={booking.guestName} title="Contact guest">
      {contacts.length === 0 ? <p className="fin-empty">No phone number on file.</p> : null}
      {contacts.map((item) => {
        const value = item.value ?? '';
        return (
          <div className="bk-contact-row" key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{canSeeContact ? value : maskPhone(value)}</strong>
            </div>
            {canSeeContact ? (
              <div className="bk-contact-actions">
                <a className="fin-btn fin-btn-sm fin-btn-soft" href={`tel:${value}`}>
                  Call
                </a>
                <button className="fin-btn fin-btn-sm fin-btn-outline" onClick={() => void copy(item.label, value)} type="button">
                  {copied === item.label ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </FinPanel>
  );
}

function ToolsPanel() {
  return (
    <FinPanel sub="Planned for this page" title="Operations tools">
      {upcomingTools.map((tool) => (
        <div className="bk-tool" id={tool.id} key={tool.id}>
          <div>
            <strong>{tool.title}</strong>
            <p>{tool.text}</p>
          </div>
          <FinPill tone="gray">Coming soon</FinPill>
        </div>
      ))}
    </FinPanel>
  );
}

/* ------------------------------------------------------------- helpers */

function formatAmount(value: string | null): string {
  return value === null || value === '' ? '—' : formatMoney(value);
}

function formatDateTime(value: string | null, fallback = '—'): string {
  return value ? new Date(value).toLocaleString('en-IN') : fallback;
}

function withTime(date: string, time: string | null): string {
  return time ? `${date} · ${time}` : date;
}

function countNights(booking: AdminBookingSummary): string {
  if (booking.checkoutDateFlexible) {
    return 'Flexible';
  }

  const nights = Math.round(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 86_400_000,
  );
  if (!Number.isFinite(nights) || nights < 0) {
    return '—';
  }

  return `${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

function describeIdProof(guest: BookingGuest | undefined): string {
  if (!guest?.idProofOriginalName) {
    return 'Not uploaded';
  }

  const size = guest.idProofSizeBytes ? formatFileSize(guest.idProofSizeBytes) : null;
  return [guest.idProofOriginalName, size].filter(Boolean).join(' · ');
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
