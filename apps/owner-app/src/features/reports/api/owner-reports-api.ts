import type {
  BookingReportRow,
  BookingStatus,
  CommissionSummary,
  PaginatedResponse,
} from '@tuljai/types';

import { apiClient } from '../../../api/client';

export interface OwnerReportQuery {
  endDate?: string;
  limit?: number;
  lodgeId?: string;
  page?: number;
  startDate?: string;
  status?: BookingStatus;
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
