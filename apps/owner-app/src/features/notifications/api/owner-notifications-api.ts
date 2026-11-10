import type {
  Notification,
  NotificationType,
  NotificationUnreadCount,
  PaginatedResponse,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';
import { notificationState } from '../notification-count-store';

export interface OwnerNotificationQuery {
  limit?: number;
  page?: number;
  type?: NotificationType;
  unreadOnly?: boolean;
}

export async function getUnreadNotificationCount(): Promise<NotificationUnreadCount> {
  return apiClient.get<NotificationUnreadCount>('/notifications/unread-count');
}

export async function listNotifications(
  query: OwnerNotificationQuery = {},
): Promise<PaginatedResponse<Notification>> {
  return apiClient.get<PaginatedResponse<Notification>>('/notifications', {
    params: {
      limit: query.limit ?? 30,
      page: query.page ?? 1,
      type: query.type,
      unreadOnly: query.unreadOnly ? 'true' : undefined,
    },
  });
}

export const markNotificationRead = notificationState.markRead;

export const markAllNotificationsRead = notificationState.markAllRead;

export async function deleteNotification(notificationId: string): Promise<{ success: true }> {
  return apiClient.request<{ success: true }>(`/notifications/${notificationId}`, {
    method: 'DELETE',
  });
}
