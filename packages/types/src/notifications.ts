import type { AppType, ISODateTime, UserRole, UUID } from './common';

export type NotificationType =
  | 'BOOKING_REQUEST'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED'
  | 'QR_GENERATED'
  | 'CHECKIN_COMPLETED'
  | 'CHECKOUT_COMPLETED'
  | 'CHECKOUT_REMINDER'
  | 'PHOTO_APPROVED'
  | 'PHOTO_REJECTED'
  | 'ADMIN_ANNOUNCEMENT'
  | 'EMERGENCY_ALERT'
  | 'REVIEW_RECEIVED'
  | 'SYSTEM';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type NotificationChannel =
  'IN_APP' | 'PUSH' | 'SOCKET' | 'EMAIL_OPTIONAL' | 'WHATSAPP_OPTIONAL';
export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';
export type AnnouncementCategory =
  'GENERAL' | 'EMERGENCY' | 'TEMPLE_NOTICE' | 'FESTIVAL' | 'MAINTENANCE' | 'OFFER' | 'SYSTEM';
export type AnnouncementTargetAudience =
  'ALL' | 'PILGRIMS' | 'OWNERS' | 'ADMINS' | 'LODGE_SPECIFIC' | 'CITY_SPECIFIC';

export type SocketEventName =
  | 'notification:new'
  | 'notification:unread-count'
  | 'booking:new'
  | 'booking:accepted'
  | 'booking:rejected'
  | 'booking:cancelled'
  | 'booking:expired'
  | 'qr:generated'
  | 'qr:scan-success'
  | 'qr:scan-failed'
  | 'checkin:completed'
  | 'checkout:completed'
  | 'room:status-updated'
  | 'room:availability-updated'
  | 'announcement:new'
  | 'dashboard:update'
  | 'owner:alert'
  | 'system:error';

export interface Notification {
  body: string;
  bookingId: UUID | null;
  channel: NotificationChannel;
  createdAt: ISODateTime;
  data: Record<string, unknown> | null;
  deliveredAt: ISODateTime | null;
  failedAt: ISODateTime | null;
  failureReason: string | null;
  id: UUID;
  lodgeId: UUID | null;
  priority: NotificationPriority;
  readAt: ISODateTime | null;
  recipientRole: UserRole | null;
  recipientUserId: UUID | null;
  title: string;
  type: NotificationType;
}

export interface NotificationUnreadCount {
  unreadCount: number;
}

export interface PushPayload {
  appType?: AppType;
  body: string;
  data: Record<string, string>;
  priority: NotificationPriority;
  title: string;
  type: NotificationType;
}

export interface Announcement {
  body: string;
  category: AnnouncementCategory;
  createdAt: ISODateTime;
  expiresAt: ISODateTime | null;
  id: UUID;
  isActive: boolean;
  priority: NotificationPriority;
  readAt: ISODateTime | null;
  startsAt: ISODateTime | null;
  targetAudience: AnnouncementTargetAudience;
  targetCityId: UUID | null;
  targetLodgeId: UUID | null;
  title: string;
}
