import type { BookingStatus, PaymentStatus, PaginatedResponse } from '@tuljai/types';

import { apiClient } from './client';

export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  totalBookings: number;
  completedBookings: number;
  totalBookingValue: string;
}

export interface AdminUserBooking {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
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

export interface AdminUserDetail {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalBookingValue: string;
  };
  bookings: AdminUserBooking[];
}

export interface AdminBookingUpdateInput {
  checkInDate?: string;
  checkOutDate?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  guestAddress?: string;
  numberOfAdults?: number;
  numberOfChildren?: number;
  specialRequest?: string;
  notes: string;
}

export async function searchAdminUsers(q: string, page = 1): Promise<PaginatedResponse<AdminUserSummary>> {
  return apiClient.get<PaginatedResponse<AdminUserSummary>>('/admin/users/search', { params: { q, page, limit: 20 } });
}

export async function getAdminUser(userId: string): Promise<AdminUserDetail> {
  return apiClient.get<AdminUserDetail>(`/admin/users/${userId}`);
}

export async function updateAdminUserBooking(userId: string, bookingId: string, input: AdminBookingUpdateInput): Promise<AdminUserBooking> {
  return apiClient.request<AdminUserBooking>(`/admin/users/${userId}/bookings/${bookingId}`, {
    body: input,
    method: 'PATCH',
  });
}
