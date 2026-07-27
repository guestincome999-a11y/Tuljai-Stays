import type {
  Notification,
  NotificationType,
  NotificationUnreadCount,
  PaginatedResponse,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';

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

export async function markNotificationRead(notificationId: string): Promise<Notification> {
  return apiClient.post<Notification>(`/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<NotificationUnreadCount> {
  return apiClient.post<NotificationUnreadCount>('/notifications/read-all');
}

export async function deleteNotification(notificationId: string): Promise<{ success: true }> {
  return apiClient.request<{ success: true }>(`/notifications/${notificationId}`, {
    method: 'DELETE',
  });
}
