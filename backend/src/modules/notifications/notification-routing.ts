const BOOKING_UPDATE_TYPES = new Set([
  'BOOKING_ACCEPTED',
  'BOOKING_REJECTED',
  'BOOKING_CANCELLED',
  'QR_GENERATED',
  'CHECKIN_COMPLETED',
  'CHECKOUT_COMPLETED',
  'CHECKOUT_REMINDER',
]);

export function resolveAndroidNotificationChannel(data: Record<string, string>): string {
  if (data.type === 'BOOKING_REQUEST') {
    return 'booking-requests-v2';
  }

  if (data.type && BOOKING_UPDATE_TYPES.has(data.type)) {
    return 'booking-updates-v1';
  }

  if (data.roomId || data.roomTypeId || data.context === 'ROOM_ALERT') {
    return 'room-alerts-v1';
  }

  if (data.type === 'ADMIN_ANNOUNCEMENT' || data.type === 'EMERGENCY_ALERT') {
    return 'announcements-v1';
  }

  return 'general-v1';
}
