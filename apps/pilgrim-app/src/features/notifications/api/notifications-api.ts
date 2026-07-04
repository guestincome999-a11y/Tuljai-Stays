import type { Notification, NotificationUnreadCount, PaginatedResponse } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function getUnreadNotificationCount(): Promise<NotificationUnreadCount> {
  return apiClient.get<NotificationUnreadCount>('/api/notifications/unread-count');
}

export async function listNotifications(): Promise<PaginatedResponse<Notification>> {
  return apiClient.get<PaginatedResponse<Notification>>('/api/notifications', {
    params: { limit: 30, page: 1 },
  });
}

export async function markNotificationRead(notificationId: string): Promise<Notification> {
  return apiClient.post<Notification>(`/api/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<NotificationUnreadCount> {
  return apiClient.post<NotificationUnreadCount>('/api/notifications/read-all');
}
