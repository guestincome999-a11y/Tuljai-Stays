import type {
  AuthUserProfile,
  LogoutRequest,
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@tuljai/types';

import { apiClient } from '../api/client';

export async function requestAdminOtp(phoneNumber: string): Promise<RequestOtpResponse> {
  const body: RequestOtpRequest = {
    appType: 'ADMIN_PANEL',
    phoneNumber: normalizeAdminPhoneNumber(phoneNumber),
    purpose: 'LOGIN',
  };

  return apiClient.post<RequestOtpResponse>('/auth/request-otp', body);
}

export async function verifyAdminOtp(input: {
  deviceId: string;
  otp: string;
  phoneNumber: string;
  totpCode?: string;
}): Promise<VerifyOtpResponse> {
  const body: VerifyOtpRequest = {
    appType: 'ADMIN_PANEL',
    deviceId: input.deviceId,
    deviceName: 'Admin Browser',
    otp: input.otp,
    phoneNumber: normalizeAdminPhoneNumber(input.phoneNumber),
    platform: 'WEB',
    totpCode: input.totpCode,
  };

  return apiClient.post<VerifyOtpResponse>('/auth/verify-otp', body);
}

export async function getCurrentStaffRole(): Promise<{ role: string | null }> {
  return apiClient.get<{ role: string | null }>('/admin/staff/me');
}

export async function getAdminProfile(): Promise<AuthUserProfile> {
  const profile = await apiClient.get<AuthUserProfile>('/auth/me');
  try {
    const staff = await getCurrentStaffRole();
    if (staff.role) {
      return {
        ...profile,
        roles: [...profile.roles, staff.role] as AuthUserProfile['roles'],
      };
    }
  } catch {
    // A legacy admin without a staff assignment remains a normal ADMIN/SUPER_ADMIN.
  }
  return profile;
}

export async function logoutAdmin(input: LogoutRequest): Promise<{ success: true }> {
  return apiClient.post<{ success: true }>('/auth/logout', input);
}

export function normalizeAdminPhoneNumber(value: string): string {
  const compact = value.trim().replace(/[\s()-]/gu, '');

  if (/^\d{10}$/u.test(compact)) {
    return `+91${compact}`;
  }

  if (/^91\d{10}$/u.test(compact)) {
    return `+${compact}`;
  }

  return compact;
}
