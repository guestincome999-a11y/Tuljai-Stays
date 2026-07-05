import type { AdminBookingSummary, Booking, BookingStatus, QrScanLogEntry } from '@tuljai/types';

export type BookingPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';

export interface BookingTimelineItem {
  description: string;
  timestamp: string;
  title: string;
}

export interface InterventionItem {
  bookingCode: string;
  bookingId: string | null;
  guestName: string;
  id: string;
  lodgeName: string;
  priority: BookingPriority;
  reason: string;
  status: 'OPEN' | 'FOUNDATION';
  suggestedAction: string;
  waitingTime: string;
}

export const bookingStatuses: BookingStatus[] = [
  'PENDING_OWNER_APPROVAL',
  'ACCEPTED',
  'REJECTED',
  'QR_GENERATED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
];

export const callOutcomes = [
  'Owner answered',
  'Owner did not answer',
  'Pilgrim answered',
  'Pilgrim did not answer',
  'Booking confirmed by phone',
  'Booking rejected by phone',
  'Pilgrim requested alternative lodge',
  'Follow-up required',
  'Wrong number',
  'Other',
];

export const noteCategories = [
  'General',
  'Owner Call',
  'Pilgrim Call',
  'Transfer',
  'Escalation',
  'Complaint',
  'Payment',
  'QR Issue',
  'Emergency',
];

export const escalationReasons = [
  'Owner not responding',
  'Pilgrim waiting',
  'Room issue',
  'QR scan issue',
  'Emergency',
  'Payment issue future',
  'Complaint',
  'Other',
];

export function getBookingPriority(booking: AdminBookingSummary | Booking): BookingPriority {
  const waitingMinutes = getWaitingMinutes(booking.createdAt);
  const sameDay = booking.checkInDate === new Date().toISOString().slice(0, 10);

  if (booking.status === 'EXPIRED' || sameDay || waitingMinutes > 45) {
    return 'CRITICAL';
  }

  if (booking.status === 'PENDING_OWNER_APPROVAL' && waitingMinutes > 20) {
    return 'HIGH';
  }

  if (booking.status === 'PENDING_OWNER_APPROVAL') {
    return 'MEDIUM';
  }

  return 'NORMAL';
}

export function getOwnerResponseState(booking: AdminBookingSummary | Booking): {
  message: string;
  overdue: boolean;
} {
  if (booking.status !== 'PENDING_OWNER_APPROVAL') {
    return { message: formatStatus(booking.status), overdue: false };
  }

  if (!booking.ownerResponseDeadline) {
    return { message: 'No deadline recorded', overdue: false };
  }

  const deadline = new Date(booking.ownerResponseDeadline);
  const diffMs = deadline.getTime() - Date.now();

  if (diffMs < 0) {
    return {
      message: `Overdue by ${formatDuration(Math.abs(diffMs))}. Admin action recommended.`,
      overdue: true,
    };
  }

  return { message: `${formatDuration(diffMs)} remaining`, overdue: false };
}

export function buildBookingTimeline(booking: Booking): BookingTimelineItem[] {
  const items: BookingTimelineItem[] = [
    {
      description: 'Booking was created and sent for owner approval.',
      timestamp: booking.createdAt,
      title: 'Booking created',
    },
  ];

  if (booking.ownerResponseDeadline) {
    items.push({
      description: 'Owner response timer started.',
      timestamp: booking.ownerResponseDeadline,
      title: 'Owner response deadline',
    });
  }

  if (booking.status === 'ACCEPTED' || booking.status === 'QR_GENERATED') {
    items.push({
      description: 'Owner or admin accepted the booking.',
      timestamp: booking.updatedAt,
      title: 'Booking accepted',
    });
  }

  if (booking.status === 'REJECTED') {
    items.push({
      description: booking.rejectedReason ?? 'Booking rejected.',
      timestamp: booking.updatedAt,
      title: 'Booking rejected',
    });
  }

  if (booking.status === 'EXPIRED') {
    items.push({
      description: 'Booking expired before completion.',
      timestamp: booking.updatedAt,
      title: 'Booking expired',
    });
  }

  if (booking.checkedInAt) {
    items.push({
      description: 'QR was verified and guest checked in.',
      timestamp: booking.checkedInAt,
      title: 'Check-in completed',
    });
  }

  if (booking.checkedOutAt) {
    items.push({
      description: 'Guest checkout was completed.',
      timestamp: booking.checkedOutAt,
      title: 'Checkout completed',
    });
  }

  return items.sort(
    (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime(),
  );
}

export function buildInterventionItems(
  bookings: AdminBookingSummary[],
  qrScans: QrScanLogEntry[],
): InterventionItem[] {
  const bookingItems = bookings
    .filter((booking) => {
      const priority = getBookingPriority(booking);
      return priority !== 'NORMAL' || booking.status === 'EXPIRED';
    })
    .map((booking) => {
      const priority = getBookingPriority(booking);
      const ownerState = getOwnerResponseState(booking);

      return {
        bookingCode: booking.bookingCode,
        bookingId: booking.id,
        guestName: booking.guestName,
        id: booking.id,
        lodgeName: booking.lodgeName,
        priority,
        reason: ownerState.overdue ? ownerState.message : getInterventionReason(booking),
        status: 'OPEN',
        suggestedAction: getSuggestedAction(priority),
        waitingTime: getWaitingTime(booking.createdAt),
      } satisfies InterventionItem;
    });

  const qrItems = qrScans
    .filter((scan) => scan.result !== 'SUCCESS')
    .map((scan) => ({
      bookingCode: scan.bookingCode ?? 'QR scan',
      bookingId: scan.bookingId,
      guestName: scan.guestName ?? 'Unknown guest',
      id: scan.id,
      lodgeName: scan.lodgeId ?? 'Unknown lodge',
      priority: 'CRITICAL',
      reason: `QR failure: ${formatStatus(scan.result)}`,
      status: 'FOUNDATION',
      suggestedAction: 'Call reception and verify QR manually',
      waitingTime: getWaitingTime(scan.createdAt),
    })) satisfies InterventionItem[];

  return [...bookingItems, ...qrItems].sort(
    (first, second) => priorityWeight(second.priority) - priorityWeight(first.priority),
  );
}

export function maskPhone(value: string | null): string {
  if (!value) {
    return 'Hidden';
  }

  return `${value.slice(0, 3)}******${value.slice(-2)}`;
}

export function formatStatus(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function getWaitingTime(value: string): string {
  return formatDuration(Date.now() - new Date(value).getTime());
}

function getInterventionReason(booking: AdminBookingSummary): string {
  if (booking.status === 'EXPIRED') {
    return 'Booking expired before owner response';
  }

  if (booking.status === 'PENDING_OWNER_APPROVAL') {
    return 'Owner response pending';
  }

  return 'Monitor booking status';
}

function getSuggestedAction(priority: BookingPriority): string {
  if (priority === 'CRITICAL') {
    return 'Call owner and pilgrim immediately';
  }

  if (priority === 'HIGH') {
    return 'Call owner and prepare escalation';
  }

  return 'Monitor and follow up';
}

function getWaitingMinutes(value: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
}

function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

function priorityWeight(priority: BookingPriority): number {
  if (priority === 'CRITICAL') {
    return 4;
  }

  if (priority === 'HIGH') {
    return 3;
  }

  if (priority === 'MEDIUM') {
    return 2;
  }

  return 1;
}
