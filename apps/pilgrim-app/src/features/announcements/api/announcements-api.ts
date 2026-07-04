import type { Announcement, PaginatedResponse } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export async function listAnnouncements(): Promise<PaginatedResponse<Announcement>> {
  return apiClient.get<PaginatedResponse<Announcement>>('/api/announcements', {
    params: { limit: 30, page: 1 },
  });
}

export async function markAnnouncementRead(announcementId: string): Promise<{ success: true }> {
  return apiClient.post<{ success: true }>(`/api/announcements/${announcementId}/read`);
}
