import type { BookingStatus } from '@tuljai/types';
import { Chip } from 'react-native-paper';

interface BookingStatusChipProps {
  status: BookingStatus;
}

export function BookingStatusChip({ status }: BookingStatusChipProps) {
  return <Chip compact>{formatBookingStatus(status)}</Chip>;
}

export function formatBookingStatus(status: BookingStatus): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function getBookingNextStep(status: BookingStatus, rejectedReason?: string | null): string {
  if (status === 'PENDING_OWNER_APPROVAL') {
    return 'Waiting for lodge approval';
  }

  if (status === 'ACCEPTED' || status === 'QR_GENERATED') {
    return 'QR pass will be available in the next module';
  }

  if (status === 'REJECTED') {
    return rejectedReason
      ? `Rejected: ${rejectedReason}`
      : 'This booking was rejected by the lodge';
  }

  if (status === 'CHECKED_IN') {
    return 'You are checked in for this stay';
  }

  if (status === 'CHECKED_OUT' || status === 'COMPLETED') {
    return 'Stay completed';
  }

  if (status === 'EXPIRED') {
    return 'The owner response window expired';
  }

  if (status === 'CANCELLED') {
    return 'This booking is cancelled';
  }

  return 'Booking status is being updated';
}
