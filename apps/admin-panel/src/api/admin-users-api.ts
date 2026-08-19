import { apiClient } from './client';

export interface AdminTrackedUser {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  bookingCount: number;
  totalBookingValue: number;
  recentBookings: Array<{ id: string; bookingCode: string; status: string; totalAmount: number; createdAt: string; lodgeName: string }>;
}

export interface AdminUsersResponse {
  items: AdminTrackedUser[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export async function listAdminUsers(search = '', page = 1): Promise<AdminUsersResponse> {
  return apiClient.get<AdminUsersResponse>('/admin/users', {
    params: { limit: 20, page, ...(search.trim() ? { search: search.trim() } : {}) },
  });
}
