import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementTargetAudience,
  FeatureFlag,
  NotificationPriority,
  PaginatedResponse,
  SystemSetting,
} from '@tuljai/types';

import { apiClient } from './client';

export interface UpdateSystemSettingInput {
  description?: string;
  isPublic?: boolean;
  value: unknown;
}

interface PromotionalBannerImageUpload {
  imageUrl: string;
}

export async function uploadPromotionalBannerImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const response = await apiClient.post<PromotionalBannerImageUpload>(
    '/admin/settings/promotional-banners/image',
    body,
  );
  return response.imageUrl;
}

export interface UpdateFeatureFlagInput {
  description?: string;
  enabled: boolean;
  rolloutPercentage?: number | null;
}

export interface AnnouncementInput {
  body: string;
  category: AnnouncementCategory;
  expiresAt?: string;
  priority: NotificationPriority;
  startsAt?: string;
  targetAudience: AnnouncementTargetAudience;
  targetCityId?: string;
  targetLodgeId?: string;
  title: string;
}

export interface AnnouncementsQuery {
  category?: AnnouncementCategory;
  limit?: number;
  page?: number;
}

export async function listAdminSettings(): Promise<SystemSetting[]> {
  return apiClient.get<SystemSetting[]>('/admin/settings');
}

export async function listPublicSettings(): Promise<SystemSetting[]> {
  return apiClient.get<SystemSetting[]>('/settings/public');
}

export async function updateAdminSetting(
  key: string,
  input: UpdateSystemSettingInput,
): Promise<SystemSetting> {
  return apiClient.request<SystemSetting>(`/admin/settings/${key}`, {
    body: input,
    method: 'PATCH',
  });
}

export async function listAdminFeatureFlags(): Promise<FeatureFlag[]> {
  return apiClient.get<FeatureFlag[]>('/admin/feature-flags');
}

export async function updateAdminFeatureFlag(
  key: string,
  input: UpdateFeatureFlagInput,
): Promise<FeatureFlag> {
  return apiClient.request<FeatureFlag>(`/admin/feature-flags/${key}`, {
    body: input,
    method: 'PATCH',
  });
}

export async function listAnnouncements(
  query: AnnouncementsQuery = {},
): Promise<PaginatedResponse<Announcement>> {
  return apiClient.get<PaginatedResponse<Announcement>>('/announcements', {
    params: {
      category: query.category,
      limit: query.limit ?? 20,
      page: query.page ?? 1,
    },
  });
}

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  return apiClient.post<Announcement>('/admin/announcements', input);
}

export async function updateAnnouncement(
  announcementId: string,
  input: AnnouncementInput,
): Promise<Announcement> {
  return apiClient.request<Announcement>(`/admin/announcements/${announcementId}`, {
    body: input,
    method: 'PATCH',
  });
}

export async function deleteAnnouncement(announcementId: string): Promise<{ success: true }> {
  return apiClient.request<{ success: true }>(`/admin/announcements/${announcementId}`, {
    method: 'DELETE',
  });
}
