import type {
  AdminBookingSummary,
  AdminBookingTrendPoint,
  AdminDashboardInsights,
  AdminDashboardKpis,
  AdminDashboardOperations,
  AdminDashboardPeriod,
  AdminDashboardSummary,
  Announcement,
  FeatureFlag,
  BookingStatus,
  Lodge,
  NotificationMetrics,
  PaginatedResponse,
  PresenceSummary,
  QrScanLogEntry,
  SystemSetting,
} from '@tuljai/types';

import { apiClient } from './client';

export async function getAdminDashboardKpis(): Promise<AdminDashboardKpis> {
  return apiClient.get<AdminDashboardKpis>('/admin/dashboard/kpis');
}

export async function getAdminBookingTrend(days = 7): Promise<AdminBookingTrendPoint[]> {
  return apiClient.get<AdminBookingTrendPoint[]>('/admin/dashboard/booking-trend', {
    params: { days },
  });
}

export async function getAdminDashboardInsights(
  period: AdminDashboardPeriod,
): Promise<AdminDashboardInsights> {
  return apiClient.get<AdminDashboardInsights>('/admin/dashboard/insights', {
    params: { period },
  });
}

export async function getAdminDashboardOperations(): Promise<AdminDashboardOperations> {
  return apiClient.get<AdminDashboardOperations>('/admin/dashboard/operations');
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  return apiClient.get<AdminDashboardSummary>('/admin/dashboard/summary');
}

export async function getPresenceSummary(): Promise<PresenceSummary> {
  return apiClient.get<PresenceSummary>('/admin/realtime/presence');
}

export async function getNotificationMetrics(): Promise<NotificationMetrics> {
  return apiClient.get<NotificationMetrics>('/admin/notifications/metrics');
}

export async function listAdminBookings(
  input: {
    limit?: number;
    status?: BookingStatus;
  } = {},
): Promise<PaginatedResponse<AdminBookingSummary>> {
  return apiClient.get<PaginatedResponse<AdminBookingSummary>>('/admin/bookings', {
    params: {
      limit: input.limit ?? 12,
      page: 1,
      status: input.status,
    },
  });
}

export async function listAdminLodges(): Promise<PaginatedResponse<Lodge>> {
  return apiClient.get<PaginatedResponse<Lodge>>('/admin/lodges', {
    params: { page: 1, pageSize: 18 },
  });
}

export async function listQrScanLogs(): Promise<PaginatedResponse<QrScanLogEntry>> {
  return apiClient.get<PaginatedResponse<QrScanLogEntry>>('/owner/qr-scans', {
    params: { limit: 40, page: 1 },
  });
}

export async function listEmergencyAnnouncements(): Promise<PaginatedResponse<Announcement>> {
  return apiClient.get<PaginatedResponse<Announcement>>('/announcements', {
    params: { category: 'EMERGENCY', limit: 5, page: 1 },
  });
}

export async function listPublicSettings(): Promise<SystemSetting[]> {
  return apiClient.get<SystemSetting[]>('/settings/public');
}

export async function listPublicFeatureFlags(): Promise<FeatureFlag[]> {
  return apiClient.get<FeatureFlag[]>('/feature-flags/public');
}
