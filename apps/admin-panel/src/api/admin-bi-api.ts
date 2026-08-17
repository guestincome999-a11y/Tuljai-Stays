import type {
  AdminDashboardSummary,
  BookingReportRow,
  CommissionSummary,
  LodgeCommissionFinanceReport,
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
      cityId: query.cityId,
      endDate: query.endDate,
      limit: query.limit ?? 200,
      lodgeId: query.lodgeId,
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
      cityId: query.cityId,
      endDate: query.endDate,
      limit: query.limit ?? 200,
      lodgeId: query.lodgeId,
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
      cityId: query.cityId,
      endDate: query.endDate,
      lodgeId: query.lodgeId,
      startDate: query.startDate,
    },
  });
}

export async function getLodgeCommissionFinanceReport(
  lodgeId: string,
): Promise<LodgeCommissionFinanceReport> {
  return apiClient.get<LodgeCommissionFinanceReport>(`/admin/lodges/${lodgeId}/commission/report`);
}

export async function createLodgeCommissionSettlement(
  lodgeId: string,
  payload: { amount: number; notes?: string; paymentMethod: string; reference?: string },
): Promise<LodgeCommissionFinanceReport> {
  return apiClient.post<LodgeCommissionFinanceReport>(`/admin/lodges/${lodgeId}/commission/settlements`, payload);
}

export async function voidLodgeCommissionTransaction(ledgerId: string): Promise<void> {
  await apiClient.patch(`/admin/commission/transactions/${ledgerId}/void`);
}

export async function getBiNotificationMetrics(): Promise<NotificationMetrics> {
  return apiClient.get<NotificationMetrics>('/admin/notifications/metrics');
}

export async function listBiQrScanLogs(): Promise<PaginatedResponse<QrScanLogEntry>> {
  return apiClient.get<PaginatedResponse<QrScanLogEntry>>('/owner/qr-scans', {
    params: { limit: 100, page: 1 },
  });
}
