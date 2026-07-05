import type {
  AdminBookingSummary,
  AdminDashboardSummary,
  Announcement,
  FeatureFlag,
  NotificationMetrics,
  PaginatedResponse,
  PresenceSummary,
  QrScanLogEntry,
  SystemSetting,
} from '@tuljai/types';

import { apiClient } from './client';

export interface HealthResponse {
  database: 'ok' | 'error';
  firebaseConfigured: boolean;
  realtime: 'ok';
  service: 'tuljai-stays-api';
  status: 'ok' | 'degraded';
  storageConfigured: boolean;
  timestamp: string;
}

export async function getPlatformHealth(): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>('/health');
}

export async function getMonitoringDashboardSummary(): Promise<AdminDashboardSummary> {
  return apiClient.get<AdminDashboardSummary>('/admin/dashboard/summary');
}

export async function getMonitoringPresence(): Promise<PresenceSummary> {
  return apiClient.get<PresenceSummary>('/admin/realtime/presence');
}

export async function getMonitoringNotificationMetrics(): Promise<NotificationMetrics> {
  return apiClient.get<NotificationMetrics>('/admin/notifications/metrics');
}

export async function listMonitoringQrScanLogs(): Promise<PaginatedResponse<QrScanLogEntry>> {
  return apiClient.get<PaginatedResponse<QrScanLogEntry>>('/owner/qr-scans', {
    params: { limit: 100, page: 1 },
  });
}

export async function listMonitoringBookings(): Promise<PaginatedResponse<AdminBookingSummary>> {
  return apiClient.get<PaginatedResponse<AdminBookingSummary>>('/admin/bookings', {
    params: { limit: 30, page: 1 },
  });
}

export async function listMonitoringSettings(): Promise<SystemSetting[]> {
  return apiClient.get<SystemSetting[]>('/admin/settings');
}

export async function listMonitoringFeatureFlags(): Promise<FeatureFlag[]> {
  return apiClient.get<FeatureFlag[]>('/admin/feature-flags');
}

export async function listMonitoringAnnouncements(): Promise<PaginatedResponse<Announcement>> {
  return apiClient.get<PaginatedResponse<Announcement>>('/announcements', {
    params: { limit: 20, page: 1 },
  });
}
