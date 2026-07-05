import type {
  AdminDashboardSummary,
  BookingReportRow,
  CommissionSummary,
  NotificationMetrics,
  PaginatedResponse,
  QrScanLogEntry,
} from '@tuljai/types';

import { apiClient } from './client';

export interface BiReportQuery {
  cityId?: string;
  endDate?: string;
  limit?: number;
  lodgeId?: string;
  page?: number;
  startDate?: string;
}

export async function getExecutiveSummary(): Promise<AdminDashboardSummary> {
  return apiClient.get<AdminDashboardSummary>('/admin/dashboard/summary');
}

export async function listBookingReport(
  query: BiReportQuery = {},
): Promise<PaginatedResponse<BookingReportRow>> {
  return apiClient.get<PaginatedResponse<BookingReportRow>>('/admin/reports/bookings', {
    params: {
      endDate: query.endDate,
      limit: query.limit ?? 200,
      page: query.page ?? 1,
      startDate: query.startDate,
    },
  });
}

export async function listOccupancyReport(
  query: BiReportQuery = {},
): Promise<PaginatedResponse<BookingReportRow>> {
  return apiClient.get<PaginatedResponse<BookingReportRow>>('/admin/reports/occupancy', {
    params: {
      endDate: query.endDate,
      limit: query.limit ?? 200,
      page: query.page ?? 1,
      startDate: query.startDate,
    },
  });
}

export async function listCommissionReport(
  query: BiReportQuery = {},
): Promise<CommissionSummary[]> {
  return apiClient.get<CommissionSummary[]>('/admin/reports/commission', {
    params: {
      endDate: query.endDate,
      startDate: query.startDate,
    },
  });
}

export async function getBiNotificationMetrics(): Promise<NotificationMetrics> {
  return apiClient.get<NotificationMetrics>('/admin/notifications/metrics');
}

export async function listBiQrScanLogs(): Promise<PaginatedResponse<QrScanLogEntry>> {
  return apiClient.get<PaginatedResponse<QrScanLogEntry>>('/owner/qr-scans', {
    params: { limit: 100, page: 1 },
  });
}
