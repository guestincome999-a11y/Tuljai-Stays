import { formatStatus } from '../../bookings/booking-operations';

/** Human label for a booking status, keeping the QR acronym uppercase. */
export function statusLabel(status: string): string {
  return formatStatus(status).replace(/\bQr\b/gu, 'QR');
}
