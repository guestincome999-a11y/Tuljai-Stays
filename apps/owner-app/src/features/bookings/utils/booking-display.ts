import type { OwnerBookingSummary, PaymentStatus } from '@tuljai/types';

type BookingLike = Pick<OwnerBookingSummary, 'paymentStatus' | 'status'>;

const PREPAID_PAYMENT_STATUSES: PaymentStatus[] = ['ADVANCE_PAID', 'FULLY_PAID'];

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  ADVANCE_PAID: 'Advance paid online',
  FAILED: 'Payment failed',
  FULLY_PAID: 'Paid online',
  NOT_REQUIRED: 'No payment required',
  PAY_AT_LODGE: 'Pay at lodge (cash)',
  PENDING: 'Online payment pending',
  REFUNDED: 'Refunded',
};

export function isPrepaidBooking(booking: BookingLike): boolean {
  return PREPAID_PAYMENT_STATUSES.includes(booking.paymentStatus);
}

export function isCashBooking(booking: BookingLike): boolean {
  return booking.paymentStatus === 'PAY_AT_LODGE';
}

/**
 * Only pay-at-lodge (cash) requests wait for the owner. Prepaid bookings are
 * confirmed and assigned a room automatically, so they never get Accept/Reject.
 */
export function canOwnerRespond(booking: BookingLike): boolean {
  return booking.status === 'PENDING_OWNER_APPROVAL' && isCashBooking(booking);
}

export function getStatusLabel(booking: BookingLike): string {
  if (isPrepaidBooking(booking) && ['ACCEPTED', 'QR_GENERATED'].includes(booking.status)) {
    return 'Assigned';
  }

  if (booking.status === 'PENDING_OWNER_APPROVAL') {
    return 'Pending';
  }

  if (booking.status === 'QR_GENERATED') {
    return 'QR ready';
  }

  return booking.status
    .split('_')
    .map((part, index) =>
      index === 0 ? part.charAt(0) + part.slice(1).toLowerCase() : part.toLowerCase(),
    )
    .join(' ');
}

export function getPaymentLabel(paymentStatus: PaymentStatus): string {
  return PAYMENT_LABELS[paymentStatus];
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getGuestSummary(booking: OwnerBookingSummary): string {
  const parts = [pluralize(booking.numberOfAdults, 'adult')];

  if (booking.numberOfChildren > 0) {
    parts.push(pluralize(booking.numberOfChildren, 'child', 'children'));
  }

  return parts.join(', ');
}

export function getRoomRequirement(booking: OwnerBookingSummary): string {
  return `1 × ${booking.roomTypeName} · ${getGuestSummary(booking)}`;
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.slice(0, 10).split('-').map(Number);

  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function formatDateKey(value: string): string {
  return parseDateKey(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatStayRange(booking: OwnerBookingSummary): string {
  const checkOut = booking.checkoutDateFlexible ? 'not fixed' : formatDateKey(booking.checkOutDate);

  return `${formatDateKey(booking.checkInDate)} → ${checkOut}`;
}
