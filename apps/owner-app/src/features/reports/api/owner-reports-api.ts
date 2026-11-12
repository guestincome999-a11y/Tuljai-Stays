import type {
  BookingReportRow,
  BookingReportPdf,
  BookingStatus,
  CommissionSummary,
  LodgeCommissionFinanceReport,
  PaginatedResponse,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface OwnerReportQuery {
  reportType?: 'all' | 'completed';
  endDate?: string;
  limit?: number;
  lodgeId?: string;
  page?: number;
  startDate?: string;
  status?: BookingStatus;
}

export function exportOwnerBookingReportPdf(query: OwnerReportQuery): Promise<BookingReportPdf> {
  return apiClient.get<BookingReportPdf>('/owner/reports/bookings/pdf', {
    params: query,
    timeout: 120_000,
  });
}

export async function getOwnerBookingReport(
  query: OwnerReportQuery,
): Promise<PaginatedResponse<BookingReportRow>> {
  return apiClient.get<PaginatedResponse<BookingReportRow>>('/owner/reports/bookings', {
    params: { limit: 80, page: 1, ...query },
  });
}

export async function getOwnerRegisterReport(
  query: OwnerReportQuery,
): Promise<PaginatedResponse<BookingReportRow>> {
  return apiClient.get<PaginatedResponse<BookingReportRow>>('/owner/reports/register', {
    params: { limit: 80, page: 1, ...query },
  });
}

export async function getOwnerCommissionReport(
  query: OwnerReportQuery,
): Promise<CommissionSummary[]> {
  return apiClient.get<CommissionSummary[]>('/owner/reports/commission', {
    params: { limit: 80, page: 1, ...query },
  });
}

export async function getOwnerCommissionFinanceReport(
  lodgeId: string,
): Promise<LodgeCommissionFinanceReport> {
  return apiClient.get<LodgeCommissionFinanceReport>(`/owner/lodges/${lodgeId}/commission/report`);
}
