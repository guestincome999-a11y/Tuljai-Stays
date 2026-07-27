import type { Announcement, AnnouncementCategory, PaginatedResponse } from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface OwnerAnnouncementQuery {
  category?: AnnouncementCategory;
  limit?: number;
  page?: number;
  unreadOnly?: boolean;
}

export async function listAnnouncements(
  query: OwnerAnnouncementQuery = {},
): Promise<PaginatedResponse<Announcement>> {
  return apiClient.get<PaginatedResponse<Announcement>>('/announcements', {
    params: {
      category: query.category,
      limit: query.limit ?? 30,
      page: query.page ?? 1,
      unreadOnly: query.unreadOnly ? 'true' : undefined,
    },
  });
}

export async function markAnnouncementRead(announcementId: string): Promise<{ success: true }> {
  return apiClient.post<{ success: true }>(`/announcements/${announcementId}/read`);
}
