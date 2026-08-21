import { apiClient } from './client';

export type StaffRole =
  | 'FINANCE_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'SUPPORT_EXECUTIVE'
  | 'PHOTO_REVIEWER'
  | 'ANALYST';

export interface StaffAccount {
  user_id: string;
  display_name: string | null;
  phone_number: string | null;
  base_roles: string[];
  staff_role: StaffRole | null;
  updated_at: string | null;
}

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  return apiClient.get<StaffAccount[]>('/admin/staff');
}

export async function assignStaffRole(
  userId: string,
  role: StaffRole | null,
): Promise<{ userId: string; role: StaffRole | null }> {
  return apiClient.patch<{ userId: string; role: StaffRole | null }>(`/admin/staff/${userId}/role`, { role });
}
