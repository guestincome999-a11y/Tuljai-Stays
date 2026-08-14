import type { NotificationPriority, NotificationType, RoomStatus } from '@prisma/client';

const PUSH_NOTIFICATION_TYPES = new Set<NotificationType>([
  'ADMIN_ANNOUNCEMENT',
  'BOOKING_ACCEPTED',
  'BOOKING_CANCELLED',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
  'BOOKING_REQUEST',
  'CHECKIN_COMPLETED',
  'CHECKOUT_COMPLETED',
  'CHECKOUT_REMINDER',
  'EMERGENCY_ALERT',
  'QR_GENERATED',
]);

const OPERATIONAL_ROOM_STATUSES = new Set<RoomStatus>(['BLOCKED', 'MAINTENANCE']);

export function resolveNotificationPriority(
  type: NotificationType,
  requestedPriority: NotificationPriority,
): NotificationPriority {
  if (type === 'EMERGENCY_ALERT') {
    return 'CRITICAL';
  }

  if (type === 'BOOKING_REQUEST' && requestedPriority === 'NORMAL') {
    return 'HIGH';
  }

  return requestedPriority;
}

export function shouldDeliverPush(
  type: NotificationType,
  data: unknown,
): boolean {
  if (PUSH_NOTIFICATION_TYPES.has(type)) {
    return true;
  }

  return (
    type === 'SYSTEM' &&
    isRecord(data) &&
    data.context === 'ROOM_ALERT' &&
    data.operationallyImportant === true
  );
}

export function isOperationalRoomStatusTransition(
  previousStatus: RoomStatus,
  nextStatus: RoomStatus,
): boolean {
  return (
    previousStatus !== nextStatus &&
    (OPERATIONAL_ROOM_STATUSES.has(previousStatus) ||
      OPERATIONAL_ROOM_STATUSES.has(nextStatus))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
