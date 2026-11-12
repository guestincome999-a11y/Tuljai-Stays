import type { Notification, NotificationUnreadCount, PaginatedResponse } from '@tuljai/types';

import { apiClient } from '../../../api/client';
import { notificationState } from '../notification-count-store';

export async function getUnreadNotificationCount(): Promise<NotificationUnreadCount> {
  return apiClient.get<NotificationUnreadCount>('/notifications/unread-count');
}

export async function listNotifications(): Promise<PaginatedResponse<Notification>> {
  return apiClient.get<PaginatedResponse<Notification>>('/notifications', {
    params: { limit: 30, page: 1 },
  });
}

export const markNotificationRead = notificationState.markRead;

export const markAllNotificationsRead = notificationState.markAllRead;
