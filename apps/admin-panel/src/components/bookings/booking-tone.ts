import type { BookingPriority } from '../../bookings/booking-operations';
import type { FinTone } from '../finance/FinanceUi';

/** Pill colour for a booking status. Shared by every booking page. */
export function bookingStatusTone(status: string): FinTone {
  if (['ACCEPTED', 'QR_GENERATED'].includes(status)) return 'green';
  if (status === 'CHECKED_IN') return 'blue';
  if (['CHECKED_OUT', 'COMPLETED'].includes(status)) return 'purple';
  if (['REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(status)) return 'red';
  return 'orange';
}

/** Pill colour for a payment status. */
export function paymentStatusTone(status: string): FinTone {
  const value = status.toUpperCase();
  if (value.includes('FAIL') || value.includes('CANCEL')) return 'red';
  if (value.includes('REFUND')) return 'purple';
  if (value === 'PAID' || value.includes('SUCCESS') || value.includes('COMPLETE')) return 'green';
  if (value.includes('PENDING') || value.includes('UNPAID') || value.includes('CREATED')) return 'orange';
  return 'blue';
}

/** Pill colour for an admin booking priority. */
export function bookingPriorityTone(priority: BookingPriority): FinTone {
  if (priority === 'CRITICAL') return 'red';
  if (priority === 'HIGH') return 'orange';
  if (priority === 'MEDIUM') return 'blue';
  return 'gray';
}
