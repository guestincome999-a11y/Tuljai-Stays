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

export interface AdminUserDetail {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
  identities: Array<{ provider: string; email: string | null; createdAt: string }>;
  bookingCount: number;
  totalBookingValue: number;
  totalCommission: number;
  bookings: Array<{
    id: string;
    bookingCode: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string | null;
    totalAmount: number;
    commissionAmount: number;
    checkInDate: string;
    checkOutDate: string;
    createdAt: string;
    lodge: { id: string; name: string };
    roomType: { id: string; name: string; basePrice: number } | null;
  }>;
}

export async function listAdminUsers(search = '', page = 1): Promise<AdminUsersResponse> {
  return apiClient.get<AdminUsersResponse>('/admin/users', {
    params: { limit: 20, page, ...(search.trim() ? { search: search.trim() } : {}) },
  });
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  return apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
}
