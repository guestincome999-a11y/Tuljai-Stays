import type { PaginatedResponse } from '@tuljai/types';

import { apiClient } from './client';

export type UserDirectoryRole = 'PILGRIM' | 'OWNER' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserDirectoryStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  recentlyActiveUsers: number;
  byRole: Record<UserDirectoryRole, number>;
}

export interface UserDirectorySummary {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  roles: UserDirectoryRole[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  recentlyActive: boolean;
  totalBookings: number;
}

export interface UserDirectoryBooking {
  id: string;
  bookingCode: string;
  status: string;
  paymentStatus: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  numberOfAdults: number;
  numberOfChildren: number;
  totalGuests: number;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: string | null;
  lodge: { id: string; name: string };
  roomType: { id: string; name: string };
  roomNumber: string | null;
  updatedAt: string;
}

export interface UserDirectorySession {
  id: string;
  deviceName: string | null;
  platform: string;
  appType: string;
  ipAddress: string | null;
  isActive: boolean;
  lastSeenAt: string;
}

export interface UserDirectoryDetail {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  roles: UserDirectoryRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    upcomingBookings: number;
    totalBookingValue: string;
  };
  sessions: UserDirectorySession[];
  upcomingBookings: UserDirectoryBooking[];
  pastBookings: UserDirectoryBooking[];
}

export interface UserDirectoryListParams {
  page?: number;
  limit?: number;
  q?: string;
  role?: UserDirectoryRole;
  status?: 'active' | 'inactive';
}

export async function getUserDirectoryStats(): Promise<UserDirectoryStats> {
  return apiClient.get<UserDirectoryStats>('/admin/user-directory/stats');
}

export async function listUserDirectory(
  params: UserDirectoryListParams = {},
): Promise<PaginatedResponse<UserDirectorySummary>> {
  return apiClient.get<PaginatedResponse<UserDirectorySummary>>('/admin/user-directory', {
    params: { limit: 20, page: 1, ...params },
  });
}

export async function getUserDirectoryDetail(userId: string): Promise<UserDirectoryDetail> {
  return apiClient.get<UserDirectoryDetail>(`/admin/user-directory/${userId}`);
}

export async function updateUserDirectoryStatus(
  userId: string,
  input: { isActive: boolean; reason: string },
): Promise<{ id: string; isActive: boolean }> {
  return apiClient.request<{ id: string; isActive: boolean }>(
    `/admin/user-directory/${userId}/status`,
    { body: input, method: 'PATCH' },
  );
}
